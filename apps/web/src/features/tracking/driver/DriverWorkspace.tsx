import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Empty, Spin, Tooltip } from 'antd';
import { HistoryOutlined, ReloadOutlined } from '@ant-design/icons';
import type { IDriverTripDetail, IDriverTripSummary } from '@my-project/shared';
import { currentLeg } from '../tracking.format';
import { HistoryDetail, HistoryList } from './DriverHistory';
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
import { useDriverNotice } from './DriverNotices';
import { isTripStart, useLegAction } from './useLegAction';
import { PRE_DEPARTURE_CHECKS, checkInTitle } from './driver-ui';
import type { DriverTrips } from './useDriverTrips';
import './driver.css';

/** Màn tài xế: chuyến đang hoạt động (D1 khi READY, D1b khi IN_TRANSIT), ?view=incident (D2), ?view=history (lịch sử, chỉ xem). */
export default function DriverWorkspace({ data, userId, view, historyTripId, search, onNavigate }: {
  data: DriverTrips;
  /** Tài khoản đang đăng nhập: ghi chú từ hộ tống là của người khác. */
  userId: string;
  view: string;
  /** ?trip=ID của trang chi tiết lịch sử */
  historyTripId: string | null;
  search: string;
  onNavigate: (view: string, tripId?: string) => void;
}) {
  const { details, active, upcoming, history, load, loading, refreshing, error } = data;
  const [flash, setFlash] = useState('');
  const clearFlash = useCallback(() => setFlash(''), []);

  if (loading) return <div className="drv-loading"><Spin size="large" /><span>Đang tải chuyến…</span></div>;

  const retry = error && (
    <Alert type="error" showIcon message={error} action={<Button size="small" onClick={() => void load()}>Thử lại</Button>} />
  );

  if (view === 'history') {
    const opened = historyTripId ? history.find(trip => trip.id === historyTripId) : null;
    return (
      <div className="drv">
        {retry}
        {historyTripId && !opened && !error ? (
          <Alert type="info" showIcon message="Không tìm thấy chuyến này trong lịch sử giao hàng." action={<Button size="small" onClick={() => onNavigate('history')}>Về danh sách</Button>} />
        ) : opened ? (
          <HistoryDetail key={opened.id} trip={opened} detail={details[opened.id]} onBack={() => onNavigate('history')} />
        ) : !error && <HistoryList history={history} details={details} search={search} onOpen={id => onNavigate('history', id)} />}
      </div>
    );
  }

  return (
    <div className={'drv' + (view === 'trip' ? ' is-trip' : '')}>
      {retry}
      {!error && !active ? (
        <section className="drv-card drv-empty">
          <Empty description={<>
            <strong>Bạn chưa có chuyến được phân công</strong>
            <p>Chuyến sẽ xuất hiện khi kế hoạch được duyệt và điều phối viên phân công đủ tài xế, hộ tống (đơn tự chuyển sang sẵn sàng).</p>
          </>} />
          <div className="drv-empty-actions">
            <Button type="primary" icon={<HistoryOutlined />} className="drv-btn-start" onClick={() => onNavigate('history')}>Xem lịch sử giao hàng</Button>
            <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={refreshing}>Tải lại</Button>
          </div>
        </section>
      ) : active && (view === 'incident' ? (
        <IncidentScreen
          key={active.id} trip={active} detail={details[active.id]} onNavigate={onNavigate}
          onDone={message => { setFlash(message); onNavigate('trip'); }}
        />
      ) : (
        <TripScreen
          key={active.id} trip={active} detail={details[active.id]} upcoming={upcoming}
          onChanged={load} onNavigate={onNavigate} flash={flash} onFlashClose={clearFlash} userId={userId}
        />
      ))}
    </div>
  );
}

/** ?view=incident: màn D2 cho chuyến đang chọn; chuyến không còn báo được sự cố thì chỉ báo lý do. */
function IncidentScreen({ trip, detail, onNavigate, onDone }: {
  trip: IDriverTripSummary;
  detail: IDriverTripDetail | undefined;
  onNavigate: (view: string, tripId?: string) => void;
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

function TripScreen({ trip, detail, upcoming, onChanged, onNavigate, flash, onFlashClose, userId }: {
  trip: IDriverTripSummary;
  detail: IDriverTripDetail | undefined;
  /** Chuyến READY/IN_TRANSIT khác (sai quy tắc một chuyến hoạt động; chặn ở Flow 3) */
  upcoming: IDriverTripSummary[];
  onChanged: () => Promise<void>;
  onNavigate: (view: string, tripId?: string) => void;
  flash: string;
  onFlashClose: () => void;
  userId: string;
}) {
  const [checked, setChecked] = useDraft<string[]>(`checklist:${trip.id}`, []);
  const remaining = PRE_DEPARTURE_CHECKS.filter(item => !checked.includes(item.id)).length;
  const ready = trip.orderStatus === 'READY';
  const running = trip.orderStatus === 'IN_TRANSIT';
  const canReport = ready || running;
  const leg = currentLeg(trip.legs);
  const seqNo = leg?.seqNo;
  const { map, track, failed: mapFailed, reload: reloadMap } = useTripMap(trip.id, running, trip.legs);
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

  const start = isTripStart(action, seqNo);

  // Thông báo thành công là toast tự tắt sau 5 giây (không còn banner đẩy bản đồ xuống).
  const toast = useDriverNotice();
  const { notice: legNotice, setNotice: setLegNotice } = legAction;
  useEffect(() => {
    if (!legNotice) return;
    toast.success(legNotice);
    setLegNotice('');
  }, [legNotice, setLegNotice, toast]);
  useEffect(() => {
    if (!flash) return;
    toast.success(flash);
    onFlashClose();
  }, [flash, onFlashClose, toast]);
  const wasFinished = useRef(finished);
  useEffect(() => {
    if (finished && !wasFinished.current) toast.success('Tất cả các chặng đã hoàn thành. Cảm ơn bạn!');
    wasFinished.current = finished;
  }, [finished, toast]);
  const wasSharing = useRef(gps.enabled);
  useEffect(() => {
    if (gps.enabled && !wasSharing.current) toast.success('Đã bật chia sẻ vị trí.');
    wasSharing.current = gps.enabled;
  }, [gps.enabled, toast]);

  return (
    <>
      <TripHeaderCard
        trip={trip} detail={detail} totalKm={map?.totalKm ?? null}
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

      {legAction.pendingAlert}
      {!action && !finished && trip.legs.length > 0 && !ready && trip.orderStatus !== 'IN_TRANSIT' && (
        <Alert type="info" showIcon message="Chưa thể cập nhật chặng này lúc này" description="Chờ chặng trước hoàn thành hoặc đơn hàng chuyển sang sẵn sàng." />
      )}

      {upcoming.length > 0 && (
        <p className="drv-upcoming" role="note">Chuyến kế tiếp: {upcoming[0].orderCode}{upcoming.length > 1 ? ` (+${upcoming.length - 1})` : ''}</p>
      )}

      <div className="drv-columns">
        <RouteMapCard trip={trip} map={map} track={track} running={running} gps={running ? gps : null} failed={mapFailed} onRetry={() => void reloadMap()} />
        <div className="drv-side">
          <StopTimeline legs={trip.legs} horseCount={detail?.horses.length ?? 0} running={running} />
          {/* D1b: ba thẻ số liệu nằm dưới "Các chặng" ở cột phải; màn < 1200px CSS đưa về dưới bản đồ */}
          {running && <LiveStatsCards legs={trip.legs} map={map} />}
          {ready && <PreDepartureChecklist checked={checked} onChange={setChecked} />}
          {running && <EscortNoteCard tripId={trip.id} userId={userId} refreshKey={trip.legs} />}
        </div>
      </div>

      {legAction.modal}
    </>
  );
}
