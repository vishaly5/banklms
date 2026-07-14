import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import Login from './pages/Login';
import App from './app/App'; // Main dashboard app
import { CertificateVerification } from './app/components/CertificateVerification';

// Protected Route Component
function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard based on role
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// Home: skip the marketing landing page; send guests to login and sessions to dashboard.
function HomeGate() {
  const token = localStorage.getItem('token');
  const userRaw = localStorage.getItem('user');

  if (token && userRaw) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/login" replace />;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Root gate; signed-in users go to dashboard, guests go to login */}
        <Route path="/" element={<HomeGate />} />
        
        {/* Login page */}
        <Route path="/login" element={<Login />} />
        
        {/* Public Certificate Verification - No auth required */}
        <Route path="/verify/:token" element={<CertificateVerification />} />
        
        {/* Main Dashboard - Works for all roles */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={['administrator', 'trainer', 'student']}>
              <App />
            </ProtectedRoute>
          }
        />
        
        {/* Legacy routes - redirect to main dashboard */}
        <Route path="/admin/dashboard" element={<Navigate to="/dashboard" replace />} />
        <Route path="/trainer/dashboard" element={<Navigate to="/dashboard" replace />} />
        <Route path="/student/dashboard" element={<Navigate to="/dashboard" replace />} />
        <Route path="/student/calendar-activity" element={<Navigate to="/dashboard?page=calendar-activity" replace />} />
        <Route path="/student/learning-activity" element={<Navigate to="/dashboard?page=calendar-activity" replace />} />
        <Route path="/teacher/student-activity-tracker" element={<Navigate to="/dashboard?page=student-activity-tracker" replace />} />
        <Route path="/trainer/student-activity-tracker" element={<Navigate to="/dashboard?page=student-activity-tracker" replace />} />
        <Route path="/admin/student-activity-monitor" element={<Navigate to="/dashboard?page=student-activity-monitor" replace />} />
        
        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
