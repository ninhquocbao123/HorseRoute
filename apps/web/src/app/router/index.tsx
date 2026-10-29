import { lazy, Suspense } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import TripsRoute from './TripsRoute';
import CoordinatorRoute from './CoordinatorRoute';

const VnpayCheckout = lazy(() => import('../../features/payments/VnpayCheckout'));
const LoginPage = lazy(() => import('../../features/auth/pages/LoginPage'));
const HomePage = lazy(() => import('../../features/home/HomePage'));
const LandingPage = lazy(() => import('../../features/home/LandingPage'));

const TripListPage = lazy(() => import('../../modules/trips/pages/TripListPage'));
const TripDetailPage = lazy(() => import('../../modules/trips/pages/TripDetailPage'));
const TripPlanPage = lazy(() => import('../../modules/trips/pages/TripPlanPage'));
const CoordinatorLayout = lazy(() => import('../../modules/coordinator/layouts/CoordinatorLayout'));
const CoordinatorOverviewPage = lazy(() => import('../../modules/coordinator/pages/CoordinatorOverviewPage'));
const CoordinatorAccountPage = lazy(() => import('../../modules/coordinator/pages/CoordinatorAccountPage'));
const CoordinatorTripsPage = lazy(() => import('../../modules/coordinator/pages/CoordinatorTripsPage'));
const CoordinatorTripPage = lazy(() => import('../../modules/coordinator/pages/CoordinatorTripPage'));
const CoordinatorNotificationsPage = lazy(() => import('../../modules/coordinator/pages/CoordinatorNotificationsPage'));

export default function AppRouter() {
  return (
    <Suspense fallback={<div className="container">Đang tải...</div>}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<LoginPage />} />
        <Route path="/staff/login" element={<LoginPage />} />
        <Route element={<CoordinatorRoute />}>
          <Route path="/coordinator" element={<CoordinatorLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<CoordinatorOverviewPage />} />
            <Route path="trips" element={<CoordinatorTripsPage />} />
            <Route path="trips/:tripId" element={<CoordinatorTripPage />} />
            <Route path="trips/:tripId/plan" element={<CoordinatorTripPage />} />
            <Route path="operations" element={<Navigate to="/coordinator/trips" replace />} />
            <Route path="monitoring" element={<Navigate to="/coordinator/trips" replace />} />
            <Route path="fleet" element={<Navigate to="/coordinator/trips" replace />} />
            <Route path="notifications" element={<CoordinatorNotificationsPage />} />
            <Route path="account" element={<CoordinatorAccountPage />} />
          </Route>
        </Route>
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

