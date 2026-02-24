import { useAuthStore } from '@/store/authStore';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

export function ProtectedRoute() {
  const { session, profile, loading } = useAuthStore();
  const location = useLocation();

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Force password change if required
  if (profile?.must_change_password && location.pathname !== '/first-login') {
    return <Navigate to="/first-login" replace />;
  }

  return <Outlet />;
}

export function AdminRoute() {
  const { profile, loading } = useAuthStore();

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (profile?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
