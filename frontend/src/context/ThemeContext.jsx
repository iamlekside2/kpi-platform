import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';

const ThemeContext = createContext(null);

// Tailwind default colour hex values for each shade
const COLOR_MAP = {
  indigo:  { 300: '#a5b4fc', 400: '#818cf8', 500: '#6366f1' },
  blue:    { 300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6' },
  cyan:    { 300: '#67e8f9', 400: '#22d3ee', 500: '#06b6d4' },
  emerald: { 300: '#6ee7b7', 400: '#34d399', 500: '#10b981' },
  amber:   { 300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b' },
  rose:    { 300: '#fda4af', 400: '#fb7185', 500: '#f43f5e' },
  purple:  { 300: '#d8b4fe', 400: '#c084fc', 500: '#a855f7' },
  pink:    { 300: '#f9a8d4', 400: '#f472b6', 500: '#ec4899' },
  violet:  { 300: '#c4b5fd', 400: '#a78bfa', 500: '#8b5cf6' },
  teal:    { 300: '#5eead4', 400: '#2dd4bf', 500: '#14b8a6' },
};

function applyTheme(colorName) {
  const colors = COLOR_MAP[colorName] || COLOR_MAP.indigo;
  const root = document.documentElement;
  root.style.setProperty('--accent-300', colors[300]);
  root.style.setProperty('--accent-400', colors[400]);
  root.style.setProperty('--accent-500', colors[500]);
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
