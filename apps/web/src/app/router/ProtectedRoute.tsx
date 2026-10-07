import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../features/auth/hooks/useAuth';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="container">Đang tải...</div>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
