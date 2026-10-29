import { Navigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../auth/pages/components/DashboardLayout';
import { useAuth } from '../auth/hooks/useAuth';
import CustomerDashboard from '../auth/pages/Customer/CustomerDashboard';
import DriverDashboard from '../auth/pages/Driver/DriverDashboard';
import ManagerDashboard from '../auth/pages/Manager/ManagerDashboard';
import SpecialistDashboard from '../auth/pages/Specialist/SpecialistDashboard';

export default function HomePage() {
  const { account, logout } = useAuth();
  const [params] = useSearchParams();

  if (!account) {
    return (
      <div className="container" style={{ padding: '20px' }}>
        <p>Đang tải thông tin người dùng...</p>
      </div>
    );
  }

  if (account.role === 'COORDINATOR') {
    return <Navigate to="/coordinator/dashboard" replace />;
  }

  if (params.get('view') === 'trips' && ['MANAGER', 'COORDINATOR'].includes(account.role)) {
    return <Navigate to="/dashboard/trips" replace />;
  }

  switch (account.role) {
    case 'ADMIN':
      return <DashboardLayout account={account} logout={logout} />;
    case 'CUSTOMER':
      return <CustomerDashboard account={account} logout={logout} />;
    case 'DRIVER_ESCORT':
      return <DriverDashboard account={account} logout={logout} />;
    case 'MANAGER':
      return <ManagerDashboard account={account} logout={logout} />;
    case 'SPECIALIST':
      return <SpecialistDashboard account={account} logout={logout} />;
    default:
      return (
        <div className="container">
          <div className="header" style={{ display: 'flex', justifyContent: 'space-between', padding: '20px' }}>
            <h2>Trang chủ (Không xác định role)</h2>
            <button className="button" onClick={logout} style={{ padding: '8px 16px' }}>Đăng xuất</button>
          </div>
          <div className="card" style={{ padding: '20px', margin: '20px', border: '1px solid #ccc' }}>
            <p>{account.fullName} · {account.email}</p>
          </div>
        </div>
      );
  }
}


