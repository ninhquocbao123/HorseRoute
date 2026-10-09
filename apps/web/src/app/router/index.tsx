import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';

const LoginPage = lazy(() => import('../../features/auth/pages/LoginPage'));
const HomePage = lazy(() => import('../../features/home/HomePage'));
const LandingPage = lazy(() => import('../../features/home/LandingPage'));

export default function AppRouter() {
  return (
    <Suspense fallback={<div className="container">Đang tải...</div>}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<HomePage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
