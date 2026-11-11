import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../features/auth/hooks/useAuth';
import SessionRetry from './SessionRetry';

export default function CoordinatorRoute() {
  const { account, loading, offline } = useAuth();

  if (loading) return <div className="container" role="status">Đang kiểm tra tài khoản…</div>;
  if (!account && offline) return <SessionRetry />;
  if (!account) return <Navigate to="/staff/login" replace />;
  if (account.role !== 'COORDINATOR') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
