import { Navigate, Outlet } from 'react-router-dom';
import { homePathFor } from './home-path';
import ErrorPage from '../../components/ui/ErrorPage';
import PageLoader from '../../components/ui/PageLoader';
import { useAuth } from '../../features/auth/hooks/useAuth';
import SessionRetry from './SessionRetry';

export default function CoordinatorRoute() {
  const { account, loading, offline } = useAuth();

  if (loading) return <PageLoader label="Đang kiểm tra tài khoản" />;
  if (!account && offline) return <SessionRetry />;
  if (!account) return <Navigate to="/staff/login" replace />;
  // Báo rõ không có quyền thay vì chuyển trang không giải thích.
  if (account.role !== 'COORDINATOR') return <ErrorPage kind={403} signedIn homePath={homePathFor(account.role)} />;
  return <Outlet />;
}
