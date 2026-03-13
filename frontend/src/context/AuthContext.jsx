import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import api, { setAccessToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [orgRole, setOrgRole] = useState(null); // admin | lead | member
  const [activeOrg, setActiveOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const didRestore = useRef(false);

  // Fetch user's org role after login/restore
  const loadOrgRole = useCallback(async () => {
    try {
      const { data: orgs } = await api.get('/orgs');
      if (orgs.length > 0) {
        setActiveOrg(orgs[0]);
        setOrgRole(orgs[0].role || 'member');
      }
    } catch {
      // ignore — orgs might not be set up yet
    }
  }, []);

  // Try to restore session on mount via refresh token
  // Uses raw axios (not the api instance) to avoid interceptor loops
  // Skips restore if user explicitly logged out (flag in localStorage)
  useEffect(() => {
    if (didRestore.current) return;
    didRestore.current = true;

    async function restoreSession() {
      // If user explicitly logged out, don't auto-restore
      if (localStorage.getItem('loggedOut') === 'true') {
        setLoading(false);
        return;
      }

      try {
        const apiBase = import.meta.env.VITE_API_URL || '/api';
        const { data } = await axios.post(`${apiBase}/auth/refresh`, {}, { withCredentials: true });
        setAccessToken(data.accessToken);
        setUser(data.user);
      } catch {
        // No valid refresh token — user needs to log in
      } finally {
        setLoading(false);
      }
    }
    restoreSession();
  }, []);

  // Whenever user changes, load their org role
  useEffect(() => {
    if (user) {
      loadOrgRole();
    } else {
      setOrgRole(null);
      setActiveOrg(null);
    }
  }, [user, loadOrgRole]);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.removeItem('loggedOut'); // clear logout flag on login
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    localStorage.removeItem('loggedOut'); // clear logout flag on register
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    localStorage.setItem('loggedOut', 'true'); // prevent auto-restore on refresh
    setAccessToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user, loading, login, register, logout, isAuthenticated: !!user,
      orgRole, activeOrg, loadOrgRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
