import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import PageWrapper from '../../components/layout/PageWrapper';
import Button from '../../components/ui/Button';

const TYPE_ICONS = {
  appraisal_created: '📋',
  appraisal_submitted: '📤',
  appraisal_reviewed: '✅',
  appraisal_completed: '🏆',
  member_invited: '👤',
};

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function NotificationsPage() {
  const { activeOrg } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const LIMIT = 20;

  useEffect(() => {
    loadNotifications();
  }, [activeOrg]);

  async function loadNotifications() {
    if (!activeOrg?.id) return;
    try {
      const { data } = await api.get(`/notifications/org/${activeOrg.id}?limit=${LIMIT}&offset=0`);
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
      setOffset(LIMIT);
      setHasMore(data.notifications.length === LIMIT);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!activeOrg?.id) return;
    try {
      const { data } = await api.get(`/notifications/org/${activeOrg.id}?limit=${LIMIT}&offset=${offset}`);
      setNotifications((prev) => [...prev, ...data.notifications]);
      setOffset((prev) => prev + LIMIT);
      setHasMore(data.notifications.length === LIMIT);
    } catch (err) {
      console.error('Failed to load more notifications:', err);
    }
  }

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

  async function handleClick(notification) {
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
    if (notification.link) {
      navigate(notification.link);
    }
  }

  if (loading) {
    return (
      <PageWrapper>
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-400">Loading notifications...</span>
          </div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Notifications</h2>
            {unreadCount > 0 && (
              <p className="text-sm text-slate-400 mt-1">{unreadCount} unread</p>
            )}
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" onClick={handleMarkAllRead}>
              Mark all as read
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-900/60 border border-white/[0.06] flex items-center justify-center text-2xl mb-4">
              🔔
            </div>
            <p className="text-sm text-slate-400">No notifications yet.</p>
            <p className="text-xs text-slate-500 mt-1">Notifications will appear here when actions happen.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n, i) => (
              <motion.button
                key={n.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                onClick={() => handleClick(n)}
                className={`w-full text-left flex gap-4 p-4 rounded-xl border transition-all cursor-pointer
                  ${!n.read
                    ? 'bg-accent-500/[0.05] border-accent-500/15 hover:bg-accent-500/[0.08]'
                    : 'bg-surface-900/60 border-white/[0.06] hover:bg-surface-900/80'}`}
              >
                <span className="text-xl shrink-0 mt-0.5">{TYPE_ICONS[n.type] || '🔔'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-semibold ${!n.read ? 'text-white' : 'text-slate-300'}`}>
                      {n.title}
                    </p>
                    <span className="text-[10px] text-slate-500 whitespace-nowrap shrink-0">{timeAgo(n.createdAt)}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{n.message}</p>
                </div>
                {!n.read && (
                  <span className="w-2.5 h-2.5 rounded-full bg-accent-500 shrink-0 mt-2" />
                )}
              </motion.button>
            ))}

            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button variant="secondary" onClick={loadMore}>
                  Load more
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
