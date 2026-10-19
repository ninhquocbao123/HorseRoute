import './tracking.css';
import DriverWorkspace from './driver/DriverWorkspace';
import CustomerTracking from './customer/CustomerTracking';
import OperationsWorkspace from './ops/OperationsWorkspace';

/** Khu vực (`?view=`) mà mỗi vai trò dùng để mở giao diện Flow 4; các khu vực khác giữ bảng chờ kết nối. */
const VIEWS: Record<string, string[]> = {
  DRIVER_ESCORT: ['assignments', 'milestones', 'horse-logs'],
  CUSTOMER: ['tracking'],
  COORDINATOR: ['operations'],
  MANAGER: ['operations'],
  SPECIALIST: ['tracking'],
};

export const trackingViews = (role: string) => VIEWS[role] ?? [];

export default function TrackingWorkspace({ role, view, onNavigate }: { role: string; view: string; onNavigate: (view: string) => void }) {
  if (!trackingViews(role).includes(view)) return null;
  if (role === 'DRIVER_ESCORT') return <DriverWorkspace view={view} onNavigate={onNavigate} />;
  if (role === 'CUSTOMER') return <CustomerTracking />;
  return <OperationsWorkspace role={role} />;
}
