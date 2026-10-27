import { lazy, Suspense } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import TripsRoute from './TripsRoute';

const VnpayCheckout = lazy(() => import('../../features/payments/VnpayCheckout'));
const LoginPage = lazy(() => import('../../features/auth/pages/LoginPage'));
const HomePage = lazy(() => import('../../features/home/HomePage'));
const LandingPage = lazy(() => import('../../features/home/LandingPage'));

const TripListPage = lazy(() => import('../../modules/trips/pages/TripListPage'));
const TripDetailPage = lazy(() => import('../../modules/trips/pages/TripDetailPage'));
const TripPlanPage = lazy(() => import('../../modules/trips/pages/TripPlanPage'));

export default function AppRouter() {
  return (
    <Suspense fallback={<div className="container">Đang tải...</div>}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<LoginPage />} />
        <Route path="/staff/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/payments/vnpay" element={<VnpayCheckout />} />
          <Route path="/payments/vnpay/return" element={<VnpayCheckout />} />
          <Route path="/dashboard" element={<HomePage />} />
          <Route path="/dashboard/trips" element={<TripsRoute />}>
            <Route index element={<TripListPage />} />
            <Route path=":tripId" element={<TripDetailPage />} />
            <Route path=":tripId/plan" element={<TripPlanPage />} />
          </Route>
        </Route>
        <Route path="*" element={<main className="container"><h1>Không tìm thấy trang</h1><Link className="button" to="/dashboard">Về trang làm việc</Link></main>} />
      </Routes>
    </Suspense>
  );
}

