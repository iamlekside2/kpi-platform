import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';

const ThemeContext = createContext(null);

// Tailwind default colour hex values for each shade + dark bg tints
const COLOR_MAP = {
  indigo:  { 300: '#a5b4fc', 400: '#818cf8', 500: '#6366f1', bg950: '#080a1a', bg900: '#0f1129' },
  blue:    { 300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6', bg950: '#060c1c', bg900: '#0c1427' },
  cyan:    { 300: '#67e8f9', 400: '#22d3ee', 500: '#06b6d4', bg950: '#041418', bg900: '#081e24' },
  emerald: { 300: '#6ee7b7', 400: '#34d399', 500: '#10b981', bg950: '#04120e', bg900: '#081d17' },
  amber:   { 300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b', bg950: '#120f04', bg900: '#1d1808' },
  rose:    { 300: '#fda4af', 400: '#fb7185', 500: '#f43f5e', bg950: '#18060a', bg900: '#230c12' },
  purple:  { 300: '#d8b4fe', 400: '#c084fc', 500: '#a855f7', bg950: '#0e0618', bg900: '#160c24' },
  pink:    { 300: '#f9a8d4', 400: '#f472b6', 500: '#ec4899', bg950: '#160614', bg900: '#220c1e' },
  violet:  { 300: '#c4b5fd', 400: '#a78bfa', 500: '#8b5cf6', bg950: '#0a0818', bg900: '#120e26' },
  teal:    { 300: '#5eead4', 400: '#2dd4bf', 500: '#14b8a6', bg950: '#041412', bg900: '#081e1c' },
};

function applyTheme(colorName) {
  const colors = COLOR_MAP[colorName] || COLOR_MAP.indigo;
  const root = document.documentElement;
  root.style.setProperty('--accent-300', colors[300]);
  root.style.setProperty('--accent-400', colors[400]);
  root.style.setProperty('--accent-500', colors[500]);
  root.style.setProperty('--surface-950', colors.bg950);
  root.style.setProperty('--surface-900', colors.bg900);
}

export function ThemeProvider({ children }) {
  const { activeOrg } = useAuth();
  const [themeColor, setThemeColor] = useState('indigo');

  // When activeOrg loads (or changes), apply its theme
  useEffect(() => {
    if (activeOrg?.themeColor) {
      setThemeColor(activeOrg.themeColor);
      applyTheme(activeOrg.themeColor);
    }
  }, [activeOrg]);

  async function updateThemeColor(colorName) {
    if (!activeOrg || !COLOR_MAP[colorName]) return;
    // Optimistic update
    setThemeColor(colorName);
    applyTheme(colorName);
    try {
      await api.patch(`/orgs/${activeOrg.id}/theme`, { themeColor: colorName });
    } catch (err) {
      // Revert on failure
      const prev = activeOrg.themeColor || 'indigo';
      setThemeColor(prev);
      applyTheme(prev);
      console.error('Failed to update theme:', err);
    }
  }

  return (
    <ThemeContext.Provider value={{ themeColor, updateThemeColor, COLOR_MAP }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
