import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import api, { setAccessToken } from '../services/api';

const AuthContext = createContext(null);

// Which org the user last worked in. Without this a multi-org account
// silently lands on whichever org came back first.
const ACTIVE_ORG_KEY = 'activeOrgId';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [orgRole, setOrgRole] = useState(null); // admin | lead | member | md | chairman
  const [activeOrg, setActiveOrg] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const didRestore = useRef(false);

  // Fetch user's org role after login/restore
  const loadOrgRole = useCallback(async () => {
    try {
      const { data } = await api.get('/orgs');
      if (data.length === 0) return;
      setOrgs(data);
      const storedId = localStorage.getItem(ACTIVE_ORG_KEY);
      const next = data.find((o) => o.id === storedId) || data[0];
      // Keep the same object identity when nothing changed, so effects that
      // depend on activeOrg don't refetch on every re-check.
      setActiveOrg((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      setOrgRole(next.role || 'member');
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
      setOrgs([]);
    }
  }, [user, loadOrgRole]);

  // The browser tab names the organisation too, so a second tab on another
  // org is tellable apart. index.html keeps the neutral title until sign-in.
  useEffect(() => {
    document.title = activeOrg?.name || 'KPI Platform';
  }, [activeOrg?.name]);

  // An admin can change someone's role while that person has the app open.
  // Without this the tab keeps the role it was given at login — a promoted
  // admin would keep seeing the employee dashboard until a full reload.
  useEffect(() => {
    if (!user) return undefined;
    function recheckRole() {
      if (document.visibilityState === 'visible') loadOrgRole();
    }
    window.addEventListener('focus', recheckRole);
    document.addEventListener('visibilitychange', recheckRole);
    return () => {
      window.removeEventListener('focus', recheckRole);
      document.removeEventListener('visibilitychange', recheckRole);
    };
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

  const switchOrg = useCallback((orgId) => {
    const next = orgs.find((o) => o.id === orgId);
    if (!next) return;
    localStorage.setItem(ACTIVE_ORG_KEY, orgId);
    setActiveOrg(next);
    setOrgRole(next.role || 'member');
  }, [orgs]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    localStorage.setItem('loggedOut', 'true'); // prevent auto-restore on refresh
    localStorage.removeItem(ACTIVE_ORG_KEY);
    setAccessToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user, setUser, loading, login, register, logout, isAuthenticated: !!user,
      orgRole, activeOrg, orgs, switchOrg, loadOrgRole,
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
