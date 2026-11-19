import { Navigate, Outlet } from 'react-router-dom';
import PageLoader from '../../components/ui/PageLoader';
import { useAuth } from '../../features/auth/hooks/useAuth';
import SessionRetry from './SessionRetry';

export default function ProtectedRoute() {
  const { account, loading, offline } = useAuth();

  if (loading) return <PageLoader label="Đang kiểm tra tài khoản" />;
  if (!account && offline) return <SessionRetry />;
  if (!account) return <Navigate to="/login" replace />;
  return <Outlet />;
}
