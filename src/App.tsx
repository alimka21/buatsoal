import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from '@/modules/auth/Login';
import FirstLogin from '@/modules/auth/FirstLogin';
import History from '@/modules/profile/History';
import Settings from '@/modules/settings/Settings';
import AdminDashboard from '@/modules/admin/AdminDashboard';
import Generator from '@/modules/generator/Generator';
import { ProtectedRoute, AdminRoute } from '@/components/layout/ProtectedRoute';
import Layout from '@/components/layout/Layout';
import { useAuthStore } from '@/store/authStore';

import ProjectList from '@/modules/projects/ProjectList';
import ProjectDetail from '@/modules/projects/ProjectDetail';

export default function App() {
  const initializeAuth = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route element={<ProtectedRoute />}>
          <Route path="/first-login" element={<FirstLogin />} />
          
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/generator" replace />} />
            <Route path="/generator" element={<Generator />} />
            <Route path="/history" element={<History />} />
            <Route path="/projects" element={<ProjectList />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profile" element={<Navigate to="/history" replace />} />
            
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<AdminDashboard />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
