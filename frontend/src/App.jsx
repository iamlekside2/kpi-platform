import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import OnboardingPage from './pages/onboarding/OnboardingPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import SettingsPage from './pages/settings/SettingsPage';
import AppraisalsPage from './pages/appraisals/AppraisalsPage';
import AppraisalDetailPage from './pages/appraisals/AppraisalDetailPage';
import StaffPage from './pages/staff/StaffPage';
import ProfilePage from './pages/profile/ProfilePage';

export default function App() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-slate-400">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <LoginPage />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/onboarding" /> : <RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Protected routes */}
      <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/staff" element={<ProtectedRoute><StaffPage /></ProtectedRoute>} />
      <Route path="/appraisals" element={<ProtectedRoute><AppraisalsPage /></ProtectedRoute>} />
      <Route path="/appraisals/:id" element={<ProtectedRoute><AppraisalDetailPage /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

      {/* Default redirect */}
      <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} />} />
    </Routes>
  );
}
