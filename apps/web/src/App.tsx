import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { Layout } from '@/components/Layout';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { AuthCallbackPage } from '@/pages/AuthCallbackPage';
import { JoinPoolPage } from '@/pages/JoinPoolPage';
import { CreatePoolPage } from '@/pages/CreatePoolPage';
import { PoolManagePage } from '@/pages/PoolManagePage';
import { PoolLivePage } from '@/pages/PoolLivePage';
import { SettingsPage } from '@/pages/SettingsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuthStore();
  if (isLoading) return <div className="flex items-center justify-center min-h-[60vh]"><p>Loading...</p></div>;
  if (!token) return <Navigate to="/login" />;
  return <>{children}</>;
}

export default function App() {
  const { loadUser } = useAuthStore();

  useEffect(() => {
    loadUser();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/join" element={<JoinPoolPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/pools/create" element={<ProtectedRoute><CreatePoolPage /></ProtectedRoute>} />
          <Route path="/pools/:id" element={<ProtectedRoute><PoolManagePage /></ProtectedRoute>} />
          <Route path="/pools/:id/live" element={<PoolLivePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
