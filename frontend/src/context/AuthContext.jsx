import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('pl_token');
    if (!token) { setLoading(false); return; }
    api.get('/auth/me')
      .then(r => setUser(r.data.user))
      .catch(() => localStorage.removeItem('pl_token'))
      .finally(() => setLoading(false));
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('pl_token', token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('pl_token');
    setUser(null);
  };

  const isPremium   = user?.tier === 'premium' || user?.role === 'admin' || user?.role === 'professor';
  const isAdmin     = user?.role === 'admin';
  const isProfessor = user?.role === 'professor' || user?.role === 'admin';
  const isStudent   = user?.role === 'student';
  const isUser      = user?.role === 'user';

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isPremium, isAdmin, isProfessor, isStudent, isUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
