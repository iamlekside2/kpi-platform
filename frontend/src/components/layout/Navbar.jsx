import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Sun, Moon, LogOut, ClipboardList, Send, CheckCircle, Trophy, UserPlus, Menu, X } from 'lucide-react';
import api from '../../services/api';
import Button from '../ui/Button';

// Notification type icons
const TYPE_ICONS = {
  appraisal_created: ClipboardList,
  appraisal_submitted: Send,
  appraisal_reviewed: CheckCircle,
  appraisal_completed: Trophy,
  member_invited: UserPlus,
};

// Relative time helper
function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Navbar({ onMobileMenuToggle, mobileOpen }) {
  const { user, activeOrg, logout } = useAuth();
  const { mode, toggleMode } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!activeOrg?.id) return;
    try {
      const { data } = await api.get(`/notifications/org/${activeOrg.id}?limit=10`);
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // ignore
    }
  }, [activeOrg?.id]);

  // Initial load + polling every 30s
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  async function handleMarkAllRead() {
    if (!activeOrg?.id) return;
    try {
      await api.patch(`/notifications/org/${activeOrg.id}/read-all`);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  }

  async function handleNotificationClick(notification) {
    // Mark as read
    if (!notification.read) {
      try {
        await api.patch(`/notifications/${notification.id}/read`);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // ignore
      }
    }
    setOpen(false);
    if (notification.link) {
      navigate(notification.link);
    }
  }

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between border-b border-white/[0.06] bg-surface-950/50 backdrop-blur-xl sticky top-0 z-30"
    >
      {/* Mobile hamburger */}
      <div className="flex items-center">
        {onMobileMenuToggle && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onMobileMenuToggle}
            className="md:hidden w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            {mobileOpen ? <X className="w-4.5 h-4.5 text-slate-400" /> : <Menu className="w-4.5 h-4.5 text-slate-400" />}
          </motion.button>
        )}
      </div>
      <div className="flex items-center gap-3">
        {/* Light/Dark Toggle */}
        <motion.button
          onClick={toggleMode}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center hover:bg-white/[0.08] transition-colors cursor-pointer"
          title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <AnimatePresence mode="wait">
            {mode === 'dark' ? (
              <motion.div
                key="sun"
                initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.2 }}
              >
                <Sun className="w-4 h-4 text-slate-400" />
              </motion.div>
            ) : (
              <motion.div
                key="moon"
                initial={{ rotate: 90, opacity: 0, scale: 0.5 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: -90, opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.2 }}
              >
                <Moon className="w-4 h-4 text-slate-400" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Bell Icon */}
        <div className="relative" ref={dropdownRef}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setOpen(!open)}
            className="relative w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <Bell className="w-4 h-4 text-slate-400" />
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </motion.span>
            )}
          </motion.button>

          {/* Dropdown Panel */}
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-80 bg-surface-900 border border-white/[0.08] rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                  <h4 className="text-sm font-semibold text-white">Notifications</h4>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[11px] text-accent-400 hover:text-accent-300 font-medium cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                {/* Notification List */}
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center py-8 text-center">
                      <Bell className="w-8 h-8 text-slate-600 mb-2" />
                      <p className="text-xs text-slate-500">No notifications yet</p>
                    </div>
                  ) : (
                    notifications.map((n) => {
                      const Icon = TYPE_ICONS[n.type] || Bell;
                      return (
                        <motion.button
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          whileHover={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
                          className={`w-full text-left px-4 py-3 flex gap-3 transition-colors cursor-pointer border-b border-white/[0.03] last:border-0
                            ${!n.read ? 'bg-accent-500/[0.04]' : ''}`}
                        >
                          <div className="w-8 h-8 rounded-lg bg-accent-500/10 flex items-center justify-center shrink-0 mt-0.5">
                            <Icon className="w-4 h-4 text-accent-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold truncate ${!n.read ? 'text-white' : 'text-slate-300'}`}>
                              {n.title}
                            </p>
                            <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{n.message}</p>
                            <p className="text-[10px] text-slate-600 mt-1">{timeAgo(n.createdAt)}</p>
                          </div>
                          {!n.read && (
                            <span className="w-2 h-2 rounded-full bg-accent-500 shrink-0 mt-1.5" />
                          )}
                        </motion.button>
                      );
                    })
                  )}
                </div>

                {/* Footer */}
                <Link
                  to="/notifications"
                  onClick={() => setOpen(false)}
                  className="block text-center py-2.5 text-[11px] font-medium text-accent-400 hover:text-accent-300 border-t border-white/[0.06] hover:bg-white/[0.02] transition-colors"
                >
                  View all notifications
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Avatar + Name */}
        <Link to="/profile" className="flex items-center gap-3 group cursor-pointer">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="w-8 h-8 rounded-full bg-accent-500/20 border border-accent-500/30 flex items-center justify-center text-xs font-bold text-accent-400 group-hover:bg-accent-500/30 transition-colors"
          >
            {(user?.name || user?.email || '?').charAt(0).toUpperCase()}
          </motion.div>
          <span className="text-sm text-slate-300 font-medium hidden sm:block group-hover:text-white transition-colors">
            {user?.name || user?.email}
          </span>
        </Link>

        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button variant="secondary" onClick={logout}>
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">Logout</span>
          </Button>
        </motion.div>
      </div>
    </motion.header>
  );
}
