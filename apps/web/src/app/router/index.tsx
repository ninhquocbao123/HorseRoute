import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';

const LoginPage = lazy(() => import('../../features/auth/pages/LoginPage'));
const HomePage = lazy(() => import('../../features/home/HomePage'));

export default function AppRouter() {
  return (
    <Suspense fallback={<div className="container">Đang tải...</div>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<HomePage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
