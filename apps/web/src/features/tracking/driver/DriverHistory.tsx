import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Empty, Table, Tag, Tooltip } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import type { IDriverTripDetail, IDriverTripSummary, IIncident, ILegTracking } from '@my-project/shared';
import { trackingApi } from '../tracking.api';
import { INCIDENT_STATUS_LABEL, LEG_STATUS_LABEL, formatDateTime } from '../tracking.format';
import RouteMapCard from './RouteMapCard';
import { useTripMap } from './useTripMap';
import { INCIDENT_STATUS_COLOR, ORDER_TAG, SEVERITY_SHORT, formatKm, headlineLeg, incidentKindLabel, routeStops, vehicleLabel } from './driver-ui';

const PAGE_SIZE = 10;
const day = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
const date = (iso: string | null | undefined) => (iso ? day.format(new Date(iso)) : '—');

const routeOf = (trip: IDriverTripSummary) => {
  const stops = routeStops(trip.legs);
  return stops.length ? `${stops[0]} → ${stops[stops.length - 1]}` : '—';
};
const departedAt = (trip: IDriverTripSummary) => trip.legs[0]?.actualDepartureAt ?? trip.legs[0]?.plannedDepartureAt ?? trip.plannedDepartureAt;
const deliveredAt = (trip: IDriverTripSummary) => trip.legs[trip.legs.length - 1]?.actualArrivalAt ?? null;

/** Ô tìm kiếm trên topbar: mã đơn, khách hàng hoặc tên điểm trên tuyến. */
export function matchHistory(trips: IDriverTripSummary[], details: Record<string, IDriverTripDetail>, search: string) {
  const term = search.trim().toLocaleLowerCase('vi');
  if (!term) return trips;
  return trips.filter(trip => [trip.orderCode, details[trip.id]?.customer.name ?? '', ...routeStops(trip.legs)]
    .some(text => text.toLocaleLowerCase('vi').includes(term)));
}

type Extra = { km: number | null; incidents: number | null };

/** Km (từ /map) và số sự cố của các chuyến đang hiện trên trang: chỉ tải dòng đang xem, nhớ lại để không gọi lặp. */
function useRowExtras(ids: string[]) {
  const [extras, setExtras] = useState<Record<string, Extra>>({});
  const requested = useRef(new Set<string>());
  const key = ids.join(',');
  useEffect(() => {
    for (const id of ids) {
      if (requested.current.has(id)) continue;
      requested.current.add(id);
      void Promise.all([
        trackingApi.tripMap(id).then(m => m.totalKm, () => null),
        trackingApi.incidents(id).then(list => list.length, () => null),
      ]).then(([km, incidents]) => setExtras(previous => ({ ...previous, [id]: { km, incidents } })));
    }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return extras;
}

/** ?view=history: bảng các chuyến đã giao, mới nhất trước, phân trang 10 dòng. */
export function HistoryList({ history, details, search, onOpen }: {
  history: IDriverTripSummary[];
  details: Record<string, IDriverTripDetail>;
  search: string;
  onOpen: (tripId: string) => void;
}) {
  const [page, setPage] = useState(1);
  const rows = useMemo(() => matchHistory(history, details, search), [history, details, search]);
  useEffect(() => setPage(1), [search]);
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const extras = useRowExtras(visible.map(trip => trip.id));
  const extra = (trip: IDriverTripSummary, field: keyof Extra, render: (value: number) => string) => {
    const entry = extras[trip.id];
    if (!entry) return '…';
    const value = entry[field];
    return value === null ? '—' : render(value);
  };

  if (!history.length) {
    return (
      <section className="drv-card drv-empty">
        <Empty description={<><strong>Chưa có chuyến nào đã giao</strong><p>Các chuyến bạn hoàn thành sẽ được lưu ở đây.</p></>} />
      </section>
    );
  }
  return (
    <section className="drv-card drv-history" aria-label="Lịch sử giao hàng">
      {search.trim() && rows.length === 0 && <Alert type="info" showIcon message={`Không có chuyến nào khớp “${search.trim()}”.`} />}
      <Table<IDriverTripSummary>
        rowKey="id" size="middle" dataSource={rows} locale={{ emptyText: 'Không có chuyến nào.' }}
        pagination={{ current: page, pageSize: PAGE_SIZE, showSizeChanger: false, hideOnSinglePage: true, onChange: setPage }}
        onRow={trip => ({ onClick: () => onOpen(trip.id), className: 'drv-history-row' })}
        columns={[
          {
            title: 'Mã đơn', dataIndex: 'orderCode', width: 130,
            render: (code: string, trip) => (
              <button type="button" className="drv-link" onClick={event => { event.stopPropagation(); onOpen(trip.id); }}>{code}</button>
            ),
          },
          { title: 'Tuyến', key: 'route', ellipsis: { showTitle: false }, render: (_: unknown, trip) => <Tooltip title={routeOf(trip)}><span>{routeOf(trip)}</span></Tooltip> },
          { title: 'Khởi hành', key: 'dep', width: 110, render: (_: unknown, trip) => date(departedAt(trip)) },
          { title: 'Giao thực tế', key: 'del', width: 120, render: (_: unknown, trip) => date(deliveredAt(trip)) },
          { title: 'Km', key: 'km', width: 80, align: 'right', render: (_: unknown, trip) => extra(trip, 'km', formatKm) },
          {
            title: 'Xe', key: 'vehicle', width: 190, ellipsis: { showTitle: false },
            render: (_: unknown, trip) => {
              const text = vehicleLabel(headlineLeg(trip.legs, trip.orderStatus), details[trip.id]?.vehicles) ?? '—';
              return <Tooltip title={text}><span>{text}</span></Tooltip>;
            },
          },
          { title: 'Ngựa', key: 'horses', width: 84, align: 'right', render: (_: unknown, trip) => (details[trip.id] ? details[trip.id].horses.length : '…') },
          { title: 'Sự cố', key: 'incidents', width: 92, align: 'right', render: (_: unknown, trip) => extra(trip, 'incidents', String) },
        ]}
      />
    </section>
  );
}

function legTimes(leg: ILegTracking) {
  if (!leg.actualDepartureAt && !leg.actualArrivalAt) return 'Chưa ghi giờ thực tế';
  return `${formatDateTime(leg.actualDepartureAt)} → ${formatDateTime(leg.actualArrivalAt)}`;
}

/** ?view=history&trip=ID: chi tiết chỉ xem của một chuyến đã giao (bản đồ toàn tuyến, các chặng giờ thực tế, sự cố). */
export function HistoryDetail({ trip, detail, onBack }: { trip: IDriverTripSummary; detail: IDriverTripDetail | undefined; onBack: () => void }) {
  const { map, failed: mapFailed, reload: reloadMap } = useTripMap(trip.id, false);
  const [incidents, setIncidents] = useState<IIncident[] | null>(null);
  const [incidentError, setIncidentError] = useState(false);
  useEffect(() => {
    setIncidents(null);
    setIncidentError(false);
    trackingApi.incidents(trip.id).then(setIncidents, () => setIncidentError(true));
  }, [trip.id]);
  const status = ORDER_TAG[trip.orderStatus];
  const summary = [
    detail && `Xe ${vehicleLabel(headlineLeg(trip.legs, trip.orderStatus), detail.vehicles) ?? '—'}`,
    detail && `${detail.horses.length} ngựa`,
  ].filter(Boolean).join(' · ');

  return (
    <>
      <section className="drv-card drv-header drv-history-header" aria-label="Chuyến đã giao">
        <div className="drv-header-top">
          <div className="drv-header-title">
            <div className="drv-header-code">
              <h2>{trip.orderCode}</h2>
              <span className={'drv-badge is-' + trip.orderStatus.toLowerCase()}>{status?.label ?? trip.orderStatus}</span>
            </div>
            <p>{[routeOf(trip), map?.totalKm != null && `${formatKm(map.totalKm)} km`, `${date(departedAt(trip))} → ${date(deliveredAt(trip))}`, summary].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="drv-header-actions">
            <Button size="large" icon={<ArrowLeftOutlined />} className="drv-btn-ghost" onClick={onBack}>Quay lại danh sách</Button>
          </div>
        </div>
      </section>

      <div className="drv-columns">
        <RouteMapCard trip={trip} map={map} track={[]} running={false} gps={null} failed={mapFailed} onRetry={() => void reloadMap()} />
        <div className="drv-side">
          <section className="drv-card drv-history-legs" aria-labelledby="drv-hl-title">
            <h3 id="drv-hl-title" className="drv-card-title">Các chặng</h3>
            <ol>
              {trip.legs.map(leg => (
                <li key={leg.id}>
                  <strong>{leg.seqNo}. {leg.fromLocationName} → {leg.toLocationName}</strong>
                  <small>{leg.vehicleCode ?? '—'} · {LEG_STATUS_LABEL[leg.status] ?? leg.status}</small>
                  <time>{legTimes(leg)}</time>
                </li>
              ))}
            </ol>
          </section>
          <section className="drv-card drv-reported-list" aria-labelledby="drv-hi-title">
            <h3 id="drv-hi-title" className="drv-card-title">Sự cố của chuyến</h3>
            {incidentError ? <p className="drv-muted">Không tải được danh sách sự cố.</p>
              : incidents === null ? <p className="drv-muted">Đang tải…</p>
              : incidents.length === 0 ? <p className="drv-muted">Chuyến này không có sự cố.</p>
              : (
                <ul>
                  {incidents.map(item => (
                    <li key={item.id}>
                      <span className="drv-reported-head">
                        {item.severity && <span className={'drv-sev-badge is-' + item.severity.toLowerCase()}>{SEVERITY_SHORT[item.severity]}</span>}
                        <strong>{incidentKindLabel(item.incidentType, item.subType)}</strong>
                        <Tag color={INCIDENT_STATUS_COLOR[item.status]}>{INCIDENT_STATUS_LABEL[item.status]}</Tag>
                      </span>
                      <span className="drv-reported-desc">{item.description}</span>
                      <time dateTime={item.reportedAt}>{formatDateTime(item.reportedAt)}</time>
                      {item.status === 'CLOSED' && item.handlingNote && <small>Xử lý: {item.handlingNote}</small>}
                    </li>
                  ))}
                </ul>
              )}
          </section>
        </div>
      </div>
    </>
  );
}
