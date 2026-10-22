import './tracking.css';
import CustomerTracking from './customer/CustomerTracking';
import OperationsWorkspace from './ops/OperationsWorkspace';

/** Khu vực (`?view=`) mà mỗi vai trò dùng để mở giao diện Flow 4; các khu vực khác giữ bảng chờ kết nối.
 * Driver/Escort không đi qua đây: DriverDashboard dùng khung riêng (DriverShell). */
const VIEWS: Record<string, string[]> = {
  CUSTOMER: ['tracking'],
  COORDINATOR: ['operations'],
  MANAGER: ['operations'],
  SPECIALIST: ['tracking'],
};

export const trackingViews = (role: string) => VIEWS[role] ?? [];

export default function TrackingWorkspace({ role, view, onNavigate }: { role: string; view: string; onNavigate: (view: string) => void }) {
  if (!trackingViews(role).includes(view)) return null;
  if (role === 'CUSTOMER') return <CustomerTracking />;
  return <OperationsWorkspace role={role} />;
}
