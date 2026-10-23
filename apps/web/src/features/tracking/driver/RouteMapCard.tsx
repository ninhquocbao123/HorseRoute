import type { ReactNode } from 'react';
import { Modal, Switch } from 'antd';
import type { IDriverTripSummary, ITripMap, ITripTrackPoint } from '@my-project/shared';
import MapView from '../../trackmap/MapView';
import { DriverRouteMap } from '../../trackmap/lazy-maps';
import '../../trackmap/trackmap.css';
import { formatDayTime, formatKm } from './driver-ui';
import type { GpsSharing } from './useGpsSharing';

const time = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' });

/** Thẻ "Lộ trình chuyến đi" (Figma D1/D1b): bản đồ thật, badge chia sẻ GPS, công tắc và cảnh báo tuyến ước lượng. */
export default function RouteMapCard({ trip, map, track, running, gps, children }: {
  trip: IDriverTripSummary;
  map: ITripMap | null;
  track: ITripTrackPoint[];
  running: boolean;
  /** Chỉ có ở D1b */
  gps: GpsSharing | null;
  /** Phần dưới bản đồ (D1b: ba thẻ số liệu) */
  children?: ReactNode;
}) {
  const lastLeg = trip.legs[trip.legs.length - 1];
  const corner = running
    ? [map?.remainingKm != null && `Còn ${formatKm(map.remainingKm)} km`, lastLeg && `ETA ${formatDayTime(lastLeg.plannedArrivalAt)}`].filter(Boolean).join(' · ')
    : map?.totalKm != null ? `${formatKm(map.totalKm)} km` : `${trip.legs.length} chặng`;

  return (
    <section className="drv-card drv-route-card" aria-labelledby="drv-route-title">
      <div className="drv-card-head">
        <h3 id="drv-route-title" className="drv-card-title">Lộ trình chuyến đi</h3>
        <span>{corner}</span>
      </div>
      <div className="drv-map-wrap">
        <MapView height={400} label="Bản đồ lộ trình chuyến đi" hint="Xem thứ tự điểm dừng ở thẻ “Các chặng”.">
          {map && <DriverRouteMap map={map} track={track} running={running} ownFix={gps?.active ? gps.lastFix : null} />}
        </MapView>
        {gps && <GpsBadge gps={gps} />}
      </div>
      {gps && <GpsControls gps={gps} />}
      {map && map.warnings.length > 0 && (
        <ul className="drv-map-warnings" aria-label="Lưu ý về bản đồ">
          {map.warnings.map(warning => <li key={warning}>{warning}</li>)}
        </ul>
      )}
      {map?.position?.source === 'ESTIMATED' && map.position.label && <p className="drv-map-estimate">{map.position.label}</p>}
      {children}
    </section>
  );
}

/** Badge phủ góc trên trái bản đồ: 3 trạng thái chính như yêu cầu (đang chia sẻ / chưa bật / mất mạng). */
function GpsBadge({ gps }: { gps: GpsSharing }) {
  const { status, queued } = gps;
  const view = status === 'sharing' ? { tone: 'is-on', text: 'Đang chia sẻ GPS với điều phối' }
    : status === 'offline' ? { tone: 'is-warn', text: `Mất mạng – sẽ gửi bù${queued ? ` (${queued} điểm)` : ''}` }
    : status === 'locating' ? { tone: 'is-off', text: 'Đang chờ tín hiệu GPS…' }
    : { tone: 'is-off', text: 'Chưa bật vị trí' };
  return <span className={'drv-gps-badge ' + view.tone} role="status">{view.text}</span>;
}

function GpsControls({ gps }: { gps: GpsSharing }) {
  const { status, enabled, stopReason, lastSentAt } = gps;
  const help = status === 'denied'
    ? 'Trình duyệt đang chặn vị trí. Bấm biểu tượng ổ khóa cạnh địa chỉ trang → Vị trí → Cho phép, rồi tải lại trang.'
    : status === 'unsupported' ? 'Trình duyệt này không hỗ trợ lấy vị trí.'
    : status === 'stopped' ? stopReason
    : enabled && lastSentAt ? `Đã gửi lúc ${time.format(new Date(lastSentAt))}. Chỉ gửi khi trang này đang mở.`
    : enabled ? 'Chỉ gửi khi trang này đang mở; giữ màn hình sáng trong lúc chạy.'
    : 'Bật để điều phối viên thấy xe của bạn trên bản đồ.';
  return (
    <div className="drv-gps-controls">
      <label className="drv-gps-switch">
        <Switch checked={enabled} onChange={on => (on ? gps.enable() : gps.disable())} aria-label="Chia sẻ vị trí" />
        <span>Chia sẻ vị trí</span>
      </label>
      <small className={status === 'denied' || status === 'stopped' ? 'is-warn' : undefined}>{help}</small>
      <Modal
        open={gps.consentOpen} title="Chia sẻ vị trí với điều phối viên?" centered
        okText="Đồng ý và bật" cancelText="Để sau" onOk={gps.acceptConsent} onCancel={gps.declineConsent}
      >
        <ul className="drv-consent">
          <li>Vị trí của máy này được gửi khoảng 30 giây một lần, <strong>chỉ khi chuyến đang chạy và trang này đang mở</strong>.</li>
          <li>Điều phối viên, quản lý và chuyên viên của chuyến xem được vị trí; khách hàng không xem được.</li>
          <li>Tự dừng khi chuyến giao xong hoặc khi đang ở chặng bay. Dữ liệu vị trí tự xóa sau 30 ngày.</li>
          <li>Bạn tắt được bất cứ lúc nào bằng công tắc “Chia sẻ vị trí”.</li>
        </ul>
      </Modal>
    </div>
  );
}
