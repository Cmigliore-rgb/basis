import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Landing from './pages/Landing.jsx';
import Privacy from './pages/Privacy.jsx';
import Terms from './pages/Terms.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import MicrosoftCallback from './pages/MicrosoftCallback.jsx';
import OAuthReturn from './pages/OAuthReturn.jsx';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ minHeight: '100vh', background: '#0f0f0f' }} />;
  return user ? children : <Navigate to="/login" replace />;
}

function GuestRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ minHeight: '100vh', background: '#0f0f0f' }} />;
  return user ? <Navigate to="/app" replace /> : children;
}

const isElectron = navigator.userAgent.toLowerCase().includes('electron');

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"          element={isElectron ? <Navigate to="/login" replace /> : <Landing />} />
          <Route path="/login"     element={<GuestRoute><Login /></GuestRoute>} />
          <Route path="/register"  element={<GuestRoute><Register /></GuestRoute>} />
          <Route path="/app/*"     element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/privacy"         element={<Privacy />} />
          <Route path="/terms"           element={<Terms />} />
          <Route path="/forgot-password"           element={<ForgotPassword />} />
          <Route path="/reset-password"            element={<ResetPassword />} />
          <Route path="/auth/microsoft/callback"   element={<MicrosoftCallback />} />
          <Route path="/oauth-return"              element={<ProtectedRoute><OAuthReturn /></ProtectedRoute>} />
          <Route path="*"          element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
