import { useEffect, useState } from 'react';
import { Alert, Button, Empty, Spin, Tag, Tooltip } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { IAlert, IDriverTripDetail, IDriverTripSummary } from '@my-project/shared';
import { trackingApi } from '../tracking.api';
import { ALERT_LABEL, currentLeg, formatDateTime } from '../tracking.format';
import IncidentReportPage from './IncidentReportPage';
import TripHeaderCard from './TripHeaderCard';
import StopTimeline from './StopTimeline';
import PreDepartureChecklist from './PreDepartureChecklist';
import LiveStatsCards from './LiveStatsCards';
import EscortNoteCard from './EscortNoteCard';
import RouteMapCard from './RouteMapCard';
import { useTripMap } from './useTripMap';
import { useGpsSharing } from './useGpsSharing';
import { useDraft } from './useDraft';
import { isTripStart, useLegAction } from './useLegAction';
import { ALERT_COLOR, PRE_DEPARTURE_CHECKS, checkInTitle } from './driver-ui';
import type { DriverTrips } from './useDriverTrips';
import './driver.css';

/** Chuyến khớp ô tìm kiếm (mã đơn hoặc tên khách), lọc phía client. */
export function matchTrips(trips: IDriverTripSummary[], details: Record<string, IDriverTripDetail>, search: string) {
  const term = search.trim().toLocaleLowerCase('vi');
  if (!term) return trips;
  return trips.filter(trip => trip.orderCode.toLocaleLowerCase('vi').includes(term)
    || details[trip.id]?.customer.name.toLocaleLowerCase('vi').includes(term));
}

/** Màn tài xế: một chuyến đang chọn (D1 khi READY, D1b khi IN_TRANSIT, D2 ở ?view=incident). */
export default function DriverWorkspace({ data, userId, view, search, onNavigate }: {
  data: DriverTrips;
  /** Tài khoản đang đăng nhập: ghi chú từ hộ tống là của người khác. */
  userId: string;
  view: string;
  search: string;
  onNavigate: (view: string) => void;
}) {
  const { trips, details, selected, select, load, loading, refreshing, error } = data;
  const [flash, setFlash] = useState('');

  if (loading) return <div className="drv-loading"><Spin size="large" /><span>Đang tải chuyến…</span></div>;

  const matches = matchTrips(trips, details, search);
  const options = selected && !matches.includes(selected) ? [selected, ...matches] : matches;

  return (
    <div className="drv">
      {error && (
        <Alert type="error" showIcon message={error} action={<Button size="small" onClick={() => void load()}>Thử lại</Button>} />
      )}
      {search.trim() && matches.length === 0 && trips.length > 0 && (
        <Alert type="info" showIcon message={`Không có chuyến nào khớp “${search.trim()}”.`} />
      )}

      {!error && trips.length === 0 ? (
        <section className="drv-card drv-empty">
          <Empty description={<>
            <strong>Chưa có chuyến nào được giao</strong>
            <p>Chuyến sẽ xuất hiện khi kế hoạch được duyệt và điều phối viên phân công đủ tài xế, hộ tống (đơn tự chuyển sang sẵn sàng).</p>
          </>} />
          <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={refreshing}>Tải lại</Button>
        </section>
      ) : selected && (view === 'incident' ? (
        <IncidentScreen
          key={selected.id} trip={selected} detail={details[selected.id]} onNavigate={onNavigate}
          onDone={message => { setFlash(message); onNavigate('trip'); }}
        />
      ) : (
        <TripScreen
          key={selected.id} trip={selected} detail={details[selected.id]} trips={options} onSelect={select}
          onChanged={load} onNavigate={onNavigate} flash={flash} onFlashClose={() => setFlash('')} userId={userId}
        />
      ))}
    </div>
  );
}

/** ?view=incident: màn D2 cho chuyến đang chọn; chuyến không còn báo được sự cố thì chỉ báo lý do. */
function IncidentScreen({ trip, detail, onNavigate, onDone }: {
  trip: IDriverTripSummary;
  detail: IDriverTripDetail | undefined;
  onNavigate: (view: string) => void;
  onDone: (message: string) => void;
}) {
  if (trip.orderStatus !== 'READY' && trip.orderStatus !== 'IN_TRANSIT') {
    return (
      <Alert
        type="info" showIcon message="Chỉ báo sự cố khi chuyến sẵn sàng khởi hành hoặc đang vận chuyển."
        action={<Button size="small" onClick={() => onNavigate('trip')}>Về chuyến vận chuyển</Button>}
      />
    );
  }
  return <IncidentReportPage trip={trip} detail={detail} onDone={onDone} onCancel={() => onNavigate('trip')} />;
}

function TripScreen({ trip, detail, trips, onSelect, onChanged, onNavigate, flash, onFlashClose, userId }: {
  trip: IDriverTripSummary;
  detail: IDriverTripDetail | undefined;
  trips: IDriverTripSummary[];
  onSelect: (tripId: string) => void;
  onChanged: () => Promise<void>;
  onNavigate: (view: string) => void;
  flash: string;
  onFlashClose: () => void;
  userId: string;
}) {
  const [checked, setChecked] = useDraft<string[]>(`checklist:${trip.id}`, []);
  const [alerts, setAlerts] = useState<IAlert[]>([]);
  const remaining = PRE_DEPARTURE_CHECKS.filter(item => !checked.includes(item.id)).length;
  const ready = trip.orderStatus === 'READY';
  const running = trip.orderStatus === 'IN_TRANSIT';
  const canReport = ready || running;
  const leg = currentLeg(trip.legs);
  const seqNo = leg?.seqNo;
  const { map, track } = useTripMap(trip.id, running, trip.legs);
  // GPS chỉ khi chặng đang chạy không phải chặng bay (API cũng trả 409 cho chặng bay).
  const runningLeg = map?.legs.find(item => item.status === 'MOVING' || item.status === 'AT_STOP');
  const gps = useGpsSharing({ tripId: trip.id, userId, eligible: running && !!runningLeg && runningLeg.mode !== 'AIR' });

  // D1b: nút chung "Check-in chặng", hộp thoại ghi rõ hành động cụ thể của chặng hiện tại.
  const legAction = useLegAction(trip, onChanged, {
    label: next => (isTripStart(next, seqNo) ? 'Bắt đầu chuyến đi' : running ? 'Check-in chặng' : next.label),
    title: next => (running && leg ? checkInTitle(next, leg) : isTripStart(next, seqNo) ? 'Bắt đầu chuyến đi' : next.label),
    warning: next => isTripStart(next, seqNo) && remaining > 0 && (
      <Alert type="warning" showIcon message={`Còn ${remaining} mục chưa kiểm tra`} description="Bạn vẫn có thể bắt đầu; hãy rà lại danh sách kiểm tra trước khi xe lăn bánh." />
    ),
  });
  const { action, finished } = legAction;

  useEffect(() => {
    trackingApi.alerts(trip.id).then(setAlerts).catch(() => setAlerts([]));
  }, [trip.id, trip.orderStatus]);

  const start = isTripStart(action, seqNo);

  return (
    <>
      <TripHeaderCard
        trip={trip} detail={detail} trips={trips} onSelect={onSelect} totalKm={map?.totalKm ?? null}
        actions={<>
          {running && (
            <Tooltip title={action ? undefined : 'Chưa có mốc nào cần ghi lúc này (chờ chặng trước hoàn thành hoặc điều phối hiệu chỉnh).'}>
              <Button size="large" className="drv-action drv-btn-checkin" disabled={!action} onClick={() => action && legAction.open(action)}>
                Check-in chặng
              </Button>
            </Tooltip>
          )}
          <Button
            danger size="large" className="drv-btn-report" disabled={!canReport} onClick={() => onNavigate('incident')}
            title={canReport ? undefined : 'Chỉ báo sự cố khi chuyến sẵn sàng khởi hành hoặc đang vận chuyển.'}
          >
            Báo cáo sự cố
          </Button>
          {action && !running && (
            <Button size="large" className={'drv-action' + (start ? ' drv-btn-start' : ' drv-btn-checkin')} onClick={() => legAction.open(action)}>
              {legAction.labelOf(action)}
            </Button>
          )}
        </>}
      />

      {legAction.notice && <Alert type="success" showIcon message={legAction.notice} role="status" closable onClose={() => legAction.setNotice('')} />}
      {flash && <Alert type="success" showIcon message={flash} role="status" closable onClose={onFlashClose} />}
      {legAction.pendingAlert}
      {finished && <Alert type="success" showIcon message="Tất cả các chặng đã hoàn thành. Cảm ơn bạn!" />}
      {!action && !finished && trip.legs.length > 0 && !ready && trip.orderStatus !== 'IN_TRANSIT' && (
        <Alert type="info" showIcon message="Chưa thể cập nhật chặng này lúc này" description="Chờ chặng trước hoàn thành hoặc đơn hàng chuyển sang sẵn sàng." />
      )}

      {alerts.length > 0 && (
        <Alert
          type="warning" showIcon className="drv-alerts"
          message="Cảnh báo từ điều phối viên"
          description={(
            <ul>
              {[...alerts].reverse().slice(0, 3).map(alert => (
                <li key={alert.id}>
                  <Tag color={ALERT_COLOR[alert.alertType]}>{ALERT_LABEL[alert.alertType] ?? alert.alertType}</Tag>
                  <span>{alert.content}</span>
                  <time dateTime={alert.sentAt}>{formatDateTime(alert.sentAt)} · {alert.sentByName}</time>
                </li>
              ))}
            </ul>
          )}
        />
      )}

      <div className="drv-columns">
        <RouteMapCard trip={trip} map={map} track={track} running={running} gps={running ? gps : null}>
          {running && <LiveStatsCards legs={trip.legs} leg={leg} map={map} />}
        </RouteMapCard>
        <div className="drv-side">
          <StopTimeline legs={trip.legs} horseCount={detail?.horses.length ?? 0} currentLegId={running ? leg?.id ?? null : null} />
          {ready && <PreDepartureChecklist checked={checked} onChange={setChecked} />}
          {running && <EscortNoteCard tripId={trip.id} userId={userId} refreshKey={trip.legs} />}
        </div>
      </div>

      {legAction.modal}
    </>
  );
}
