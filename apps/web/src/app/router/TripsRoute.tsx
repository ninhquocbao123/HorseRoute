import { Navigate, Outlet } from 'react-router-dom';
import DashboardShell from '../../components/layout/DashboardShell';
import { useAuth } from '../../features/auth/hooks/useAuth';
import '../../modules/trips/styles/trips.css';

// Nested under ProtectedRoute; all three trip pages share the same role guard.
export default function TripsRoute() {
  const { account, logout } = useAuth();
  if (!account) return <Navigate to="/login" replace />;
  if (account.role !== 'COORDINATOR') {
    return <Navigate to="/dashboard" replace />;
  }
  return (
    <DashboardShell account={account} logout={logout} activeView="trips" showHeading={false}>
      <div className="trip-workspace"><Outlet /></div>
    </DashboardShell>
  );
}
