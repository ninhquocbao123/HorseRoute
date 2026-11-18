import type { DashboardProps } from '../components/DashboardLayout';
import AdminWorkspace from '../../../admin/AdminWorkspace';

export default function AdminDashboard(props: DashboardProps) {
  return <AdminWorkspace {...props} />;
}
