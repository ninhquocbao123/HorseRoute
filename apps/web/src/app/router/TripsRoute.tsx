import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/hooks/useAuth';

// Legacy entry point: Coordinator pages now live under the role-specific workspace.
export default function TripsRoute() {
  const { account } = useAuth();
  const location = useLocation();
  if (!account) return <Navigate to="/login" replace />;
  if (account.role === 'COORDINATOR') {
    const pathname = location.pathname.replace(/^\/dashboard\/trips/, '/coordinator/trips');
    return <Navigate to={`${pathname}${location.search}`} replace />;
  }
  return <Navigate to="/dashboard" replace />;
}
