import { Alert, Button, Input, Select, Tag } from 'antd';
import { ThunderboltOutlined, ReloadOutlined } from '@ant-design/icons';
import type { RoutePlanWaypoint } from './TripRoutePlanner';
import type { RouteCandidate } from './route.types';

export type AutoSchedule = {
  departureAt: string; startDrivingAt: string; rawArrivalAt: string; arrivalAt: string;
  breakdown: { loadingMin: number; driveMin: number; restMin: number; borderMin: number; overnightMin: number; bufferMin: number; truckFactor: number };
  stops: { index: number; arriveAt: string; departAt: string; dwellMin: number; overnight: boolean; driveMinFromPrevRest: number }[];
  maxContinuousMin: number; warnings: string[];
};
export type AutoPlanResult = {
  waypoints: RoutePlanWaypoint[]; route: RouteCandidate; schedule: AutoSchedule | null;
  departure: { at: string | null; source: 'INPUT' | 'CUSTOMER' | 'MISSING'; customerDate: string | null; pickupTime: string | null };
  locate: { origin: Precision; destination: Precision } | null;
  corridor: { chosen: string | null; options: { code: string; name: string; km: number }[] };
  warnings: string[];
};
type Precision = 'MANUAL' | 'ADDRESS' | 'WARD' | 'CITY' | 'SEARCH';

const PRECISION: Record<Precision, string> = {
  MANUAL: 'vị trí bạn đã chỉnh', ADDRESS: 'theo địa chỉ trong đơn', WARD: 'gần đúng theo phường/xã, nên kéo ghim cho đúng chỗ lấy ngựa',
  CITY: 'gần đúng theo tỉnh/thành, cần kéo ghim cho đúng chỗ', SEARCH: 'theo kết quả tìm địa chỉ, hãy kiểm tra lại',
};
const when = (iso: string) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
export const duration = (minutes: number) => {
  const h = Math.floor(minutes / 60), m = Math.round(minutes % 60);
  return h ? `${h} giờ${m ? ` ${m} phút` : ''}` : `${m} phút`;
};
const kindName = (point: RoutePlanWaypoint) => point.kind === 'ORIGIN' ? 'Điểm gửi' : point.kind === 'DESTINATION' ? 'Điểm nhận'
  : point.kind === 'BORDER' ? (point.borderStage === 'ARRIVED' ? 'Đến cửa khẩu' : 'Qua cửa khẩu') : 'Điểm nghỉ';

/** Bảng điều khiển tự lập lộ trình: giờ xuất phát, hành lang cửa khẩu, lịch dự kiến từng điểm và cách tính giờ đến. */
export default function AutoPlanPanel({ readOnly, busy, departure, onDepartureChange, corridor, onCorridorChange, result, points, manualEdits, onRun }: {
  readOnly: boolean; busy: boolean; departure: string; onDepartureChange: (value: string) => void;
  corridor: string | undefined; onCorridorChange: (value: string) => void; result: AutoPlanResult | null;
  points: RoutePlanWaypoint[]; manualEdits: boolean; onRun: (mode: 'full' | 'recalc') => void;
}) {
  const schedule = result?.schedule;
  const source = result?.departure;
  return <section className="auto-plan-panel" aria-label="Tự lập lộ trình">
    <div className="auto-plan-head">
      <div><strong><ThunderboltOutlined /> Tự lập lộ trình</strong>
        <small>Hệ thống lấy điểm gửi, điểm nhận từ đơn, tự chèn cửa khẩu (đơn quốc tế) và điểm nghỉ cho ngựa sau khoảng 3 giờ 30 phút lái (không quá 4 giờ), rồi tính giờ đến dự kiến.</small></div>
    </div>
    <div className="auto-plan-controls">
      <label><span>Giờ xuất phát (giờ Việt Nam)</span>
        <Input type="datetime-local" aria-label="Giờ xuất phát" disabled={readOnly || busy} value={departure} onChange={event => onDepartureChange(event.target.value)} /></label>
      {!!result?.corridor.options.length && <label><span>Hành lang cửa khẩu</span>
        <Select aria-label="Hành lang cửa khẩu" disabled={readOnly || busy} value={corridor ?? result.corridor.chosen ?? undefined} onChange={onCorridorChange}
          options={result.corridor.options.map(o => ({ value: o.code, label: `${o.name} (~${o.km} km đường chim bay)` }))} /></label>}
      {!readOnly && <div className="auto-plan-actions">
        <Button type="primary" icon={<ThunderboltOutlined />} loading={busy} onClick={() => onRun('full')}>{result ? 'Lập lại tự động' : 'Tự lập lộ trình'}</Button>
        {result && <Button icon={<ReloadOutlined />} disabled={busy || !manualEdits} onClick={() => onRun('recalc')}>Tính lại giờ theo các điểm hiện tại</Button>}
      </div>}
    </div>
    {source && <p className="auto-plan-source">{source.source === 'CUSTOMER'
      ? `Giờ xuất phát lấy theo đơn: ngày khách chọn ${source.customerDate?.split('-').reverse().join('/')}${source.pickupTime ? `, khung giờ lấy ngựa ${source.pickupTime}` : ', chưa có khung giờ nên lấy 08:00'}.`
      : source.source === 'INPUT' ? 'Giờ xuất phát do bạn nhập.' : 'Đơn chưa có ngày khởi hành: hãy nhập giờ xuất phát rồi bấm lập lại.'}</p>}
    {result?.locate && <p className="auto-plan-source">Điểm gửi: {PRECISION[result.locate.origin]}. Điểm nhận: {PRECISION[result.locate.destination]}.</p>}
    {result?.warnings.map(text => <Alert key={text} type="warning" showIcon message={text} />)}
    {schedule && <>
      <ol className="auto-plan-timeline">
        <li><Tag color="blue">Điểm gửi</Tag><span>{points[0]?.label}</span><small>Bốc ngựa từ {when(schedule.departureAt)}, lăn bánh {when(schedule.startDrivingAt)}</small></li>
        {schedule.stops.map(stop => {
          const point = points[stop.index];
          if (!point) return null;
          return <li key={point.id} data-kind={point.kind}>
            <Tag color={point.kind === 'BORDER' ? 'purple' : point.kind === 'DESTINATION' ? 'green' : 'gold'}>{kindName(point)}</Tag>
            <span>{point.label}</span>
            <small>Đến {when(stop.arriveAt)} · lái {duration(stop.driveMinFromPrevRest)} từ lần nghỉ trước
              {stop.dwellMin > 0 && <> · {stop.overnight ? <Tag color="volcano">Nghỉ qua đêm {duration(stop.dwellMin)}</Tag> : `dừng ${duration(stop.dwellMin)}`}, đi tiếp {when(stop.departAt)}</>}</small>
          </li>;
        })}
      </ol>
      <div className="auto-plan-eta" role="status">
        <strong>Giờ đến dự kiến: {when(schedule.arrivalAt)}</strong>
        <small>Lái xe {duration(schedule.breakdown.driveMin)} (thời gian bản đồ × {String(schedule.breakdown.truckFactor).replace('.', ',')} cho xe tải chở ngựa)
          {' '}+ bốc ngựa {duration(schedule.breakdown.loadingMin)} + nghỉ {duration(schedule.breakdown.restMin)}
          {schedule.breakdown.borderMin > 0 && ` + cửa khẩu ${duration(schedule.breakdown.borderMin)}`}
          {schedule.breakdown.overnightMin > 0 && ` + nghỉ qua đêm thêm ${duration(schedule.breakdown.overnightMin)}`}
          {' '}+ dự phòng {duration(schedule.breakdown.bufferMin)}. Đoạn lái liên tục dài nhất {duration(schedule.maxContinuousMin)}.
          Giờ này đã điền vào phần thời gian dự kiến; bạn có thể sửa nhưng không nên sớm hơn {when(schedule.rawArrivalAt)}.</small>
      </div>
    </>}
  </section>;
}
