import { useEffect, useState } from 'react';
import { Alert, Button, Empty, Spin, Tag } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { IAlert, IDriverTripDetail, IDriverTripSummary } from '@my-project/shared';
import { trackingApi } from '../tracking.api';
import { ALERT_LABEL, currentLeg, formatDateTime } from '../tracking.format';
import MapFallback from '../../trackmap/MapFallback';
import '../../trackmap/trackmap.css';
import IncidentDialog from './IncidentDialog';
import TripHeaderCard from './TripHeaderCard';
import StopTimeline from './StopTimeline';
import PreDepartureChecklist from './PreDepartureChecklist';
import { useDraft } from './useDraft';
import { isTripStart, useLegAction } from './useLegAction';
import { ALERT_COLOR, PRE_DEPARTURE_CHECKS } from './driver-ui';
import type { DriverTrips } from './useDriverTrips';
import './driver.css';

/** Chuyến khớp ô tìm kiếm (mã đơn hoặc tên khách), lọc phía client. */
export function matchTrips(trips: IDriverTripSummary[], details: Record<string, IDriverTripDetail>, search: string) {
  const term = search.trim().toLocaleLowerCase('vi');
  if (!term) return trips;
  return trips.filter(trip => trip.orderCode.toLocaleLowerCase('vi').includes(term)
    || details[trip.id]?.customer.name.toLocaleLowerCase('vi').includes(term));
}

/** Màn tài xế: một chuyến đang chọn (D1 khi READY; khi IN_TRANSIT tạm giữ nút ghi mốc + các chặng, phần còn lại ở bước G). */
export default function DriverWorkspace({ data, view, search, onNavigate }: {
  data: DriverTrips;
  view: string;
  search: string;
  onNavigate: (view: string) => void;
}) {
  const { trips, details, selected, select, load, loading, refreshing, error } = data;

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
      ) : selected && (
        <TripScreen
          key={selected.id} trip={selected} detail={details[selected.id]} trips={options} onSelect={select}
          onChanged={load} view={view} onNavigate={onNavigate}
        />
      )}
    </div>
  );
}

function TripScreen({ trip, detail, trips, onSelect, onChanged, view, onNavigate }: {
  trip: IDriverTripSummary;
  detail: IDriverTripDetail | undefined;
  trips: IDriverTripSummary[];
  onSelect: (tripId: string) => void;
  onChanged: () => Promise<void>;
  view: string;
  onNavigate: (view: string) => void;
}) {
  const [checked, setChecked] = useDraft<string[]>(`checklist:${trip.id}`, []);
  const [alerts, setAlerts] = useState<IAlert[]>([]);
  const [reported, setReported] = useState('');
  const remaining = PRE_DEPARTURE_CHECKS.filter(item => !checked.includes(item.id)).length;
  const ready = trip.orderStatus === 'READY';
  const canReport = ready || trip.orderStatus === 'IN_TRANSIT';
  const seqNo = currentLeg(trip.legs)?.seqNo;

  const legAction = useLegAction(trip, onChanged, {
    label: next => (isTripStart(next, seqNo) ? 'Bắt đầu chuyến đi' : next.label),
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
        trip={trip} detail={detail} trips={trips} onSelect={onSelect}
        actions={<>
          <Button
            danger size="large" className="drv-btn-report" disabled={!canReport} onClick={() => onNavigate('incident')}
            title={canReport ? undefined : 'Chỉ báo sự cố khi chuyến sẵn sàng khởi hành hoặc đang vận chuyển.'}
          >
            Báo cáo sự cố
          </Button>
          {action && (
            <Button size="large" className={'drv-action' + (start ? ' drv-btn-start' : ' drv-btn-checkin')} onClick={() => legAction.open(action)}>
              {legAction.labelOf(action)}
            </Button>
          )}
        </>}
      />

      {legAction.notice && <Alert type="success" showIcon message={legAction.notice} role="status" closable onClose={() => legAction.setNotice('')} />}
      {reported && <Alert type="success" showIcon message={reported} role="status" closable onClose={() => setReported('')} />}
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
        <section className="drv-card drv-route-card" aria-labelledby="drv-route-title">
          <div className="drv-card-head">
            <h3 id="drv-route-title" className="drv-card-title">Lộ trình chuyến đi</h3>
            <span>{trip.legs.length} chặng</span>
          </div>
          <MapFallback reason="disabled" height={400}>Bản đồ lộ trình sẽ có ở bước sau. Xem thứ tự điểm dừng ở thẻ “Các chặng”.</MapFallback>
        </section>
        <div className="drv-side">
          <StopTimeline legs={trip.legs} horseCount={detail?.horses.length ?? 0} />
          {ready && <PreDepartureChecklist checked={checked} onChange={setChecked} />}
        </div>
      </div>

      {legAction.modal}

      {view === 'incident' && (canReport ? (
        <IncidentDialog
          trip={trip}
          detail={detail}
          onClose={() => onNavigate('trip')}
          onReported={message => {
            setReported(message);
            onNavigate('trip');
          }}
        />
      ) : (
        <Alert type="info" showIcon message="Chỉ báo sự cố khi chuyến sẵn sàng khởi hành hoặc đang vận chuyển." />
      ))}
    </>
  );
}
