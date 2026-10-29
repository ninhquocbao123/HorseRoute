import { Skeleton } from 'antd';
import { CarOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, EditOutlined, SettingOutlined, WarningOutlined } from '@ant-design/icons';
import { orderStatuses, planStatuses } from './trip-status';
import '../styles/trip-status.css';

const icons = { car: CarOutlined, check: CheckCircleOutlined, clock: ClockCircleOutlined, close: CloseCircleOutlined, edit: EditOutlined, setting: SettingOutlined, warning: WarningOutlined };
function Badge({ value, mapping }: { value?: string; mapping: typeof orderStatuses }) {
  const status = value && Object.prototype.hasOwnProperty.call(mapping, value) ? mapping[value] : undefined;
  const Icon = icons[(status?.icon ?? 'warning') as keyof typeof icons];
  return <span className={`trip-status-badge is-${status?.tone ?? 'draft'}`}><Icon aria-hidden="true" />{status?.label ?? (value ? 'Chưa xác định' : 'Chưa tải được')}</span>;
}
export default function TripStatusBar({ orderStatus, planStatus, loading = false }: { orderStatus?: string; planStatus?: string; loading?: boolean }) {
  return <section className="trip-status-bar" aria-label="Trạng thái chuyến vận chuyển" aria-live="polite" aria-busy={loading}>
    {loading ? <Skeleton active title={false} paragraph={{ rows: 1 }} /> :
      <div className="trip-status-groups">
        <div className="trip-status-group"><span>Trạng thái đơn</span><Badge value={orderStatus} mapping={orderStatuses} /></div>
        <div className="trip-status-group"><span>Kế hoạch</span><Badge value={planStatus} mapping={planStatuses} /></div>
      </div>}
  </section>;
}
