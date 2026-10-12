import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../features/auth/hooks/useAuth';

export default function ProtectedRoute() {
  const { account, loading } = useAuth();

  if (loading) return <div className="container" role="status">Đang kiểm tra tài khoản…</div>;
  if (!account) return <Navigate to="/login" replace />;
  return <Outlet />;
}
