import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import Button from '../ui/Button';

// Bell SVG icon
function BellIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

// Notification type icons
const TYPE_ICONS = {
  appraisal_created: '📋',
  appraisal_submitted: '📤',
  appraisal_reviewed: '✅',
  appraisal_completed: '🏆',
  member_invited: '👤',
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

export default function Navbar() {
  const { user, activeOrg, logout } = useAuth();
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
      className="h-16 px-8 flex items-center justify-between border-b border-white/[0.06] bg-surface-950/50 backdrop-blur-xl sticky top-0 z-30"
    >
      <div />
      <div className="flex items-center gap-4">
        {/* Bell Icon */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen(!open)}
            className="relative w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <BellIcon className="w-4.5 h-4.5 text-slate-400" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

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
                      <span className="text-2xl mb-2">🔔</span>
                      <p className="text-xs text-slate-500">No notifications yet</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-white/[0.04] transition-colors cursor-pointer border-b border-white/[0.03] last:border-0
                          ${!n.read ? 'bg-accent-500/[0.04]' : ''}`}
                      >
                        <span className="text-lg shrink-0 mt-0.5">{TYPE_ICONS[n.type] || '🔔'}</span>
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
                      </button>
                    ))
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
          <div className="w-8 h-8 rounded-full bg-accent-500/20 border border-accent-500/30 flex items-center justify-center text-xs font-bold text-accent-400 group-hover:bg-accent-500/30 transition-colors">
            {(user?.name || user?.email || '?').charAt(0).toUpperCase()}
          </div>
          <span className="text-sm text-slate-300 font-medium hidden sm:block group-hover:text-white transition-colors">
            {user?.name || user?.email}
          </span>
        </Link>

        <Button variant="secondary" onClick={logout}>
          Logout
        </Button>
      </div>
    </motion.header>
  );
}
