import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import PageWrapper from '../../components/layout/PageWrapper';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

const ROLE_STYLES = {
  admin: 'bg-accent-500/10 text-accent-400 border-accent-500/20',
  lead: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  member: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

const ROLE_LABELS = {
  admin: 'Admin',
  lead: 'Team Lead',
  member: 'Member',
};

export default function ProfilePage() {
  const { user, setUser } = useAuth();

  // Profile state
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Messages
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    async function loadProfile() {
      try {
        const { data } = await api.get('/users/me');
        setProfile(data);
        setName(data.name);
      } catch {
        // fallback to auth context data
        if (user) {
          setProfile({ ...user, orgs: [] });
          setName(user.name);
        }
      } finally {
        setProfileLoading(false);
      }
    }
    loadProfile();
  }, [user]);

  async function handleSaveProfile(e) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setProfileMsg({ type: '', text: '' });

    try {
      const { data } = await api.patch('/users/me', { name: name.trim() });
      setProfile((prev) => ({ ...prev, ...data }));
      // Update AuthContext so Navbar reflects immediately
      setUser((prev) => ({ ...prev, name: data.name }));
      setProfileMsg({ type: 'success', text: 'Profile updated successfully!' });
      setTimeout(() => setProfileMsg({ type: '', text: '' }), 4000);
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.response?.data?.error || 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordMsg({ type: '', text: '' });

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'All fields are required' });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'New password must be at least 6 characters' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    setChangingPassword(true);

    try {
      await api.patch('/users/me/password', { currentPassword, newPassword });
      setPasswordMsg({ type: 'success', text: 'Password changed successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordMsg({ type: '', text: '' }), 4000);
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err.response?.data?.error || 'Failed to change password' });
    } finally {
      setChangingPassword(false);
    }
  }

  if (profileLoading) {
    return (
      <PageWrapper>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </PageWrapper>
    );
  }

  const initial = (profile?.name || profile?.email || '?').charAt(0).toUpperCase();
  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';

  return (
    <PageWrapper>
      <div className="max-w-2xl">
        <h2 className="text-2xl font-bold text-white mb-6">My Profile</h2>

        {/* ── Profile Info Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-900/60 border border-white/[0.06] rounded-2xl p-6 mb-6"
        >
          {/* Avatar + Info Header */}
          <div className="flex items-start gap-5 mb-6">
            <div className="w-20 h-20 rounded-2xl bg-accent-500/20 border border-accent-500/30 flex items-center justify-center text-2xl font-bold text-accent-400 shrink-0">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-white truncate">{profile?.name}</h3>
              <p className="text-sm text-slate-400 truncate">{profile?.email}</p>
              {memberSince && (
                <p className="text-xs text-slate-500 mt-1">Member since {memberSince}</p>
              )}

              {/* Org Membership Badges */}
              {profile?.orgs?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {profile.orgs.map((org) => (
                    <span
                      key={org.id}
                      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${ROLE_STYLES[org.role] || ROLE_STYLES.member}`}
                    >
                      <span className="truncate max-w-[120px]">{org.name}</span>
                      <span className="opacity-60">·</span>
                      <span>{ROLE_LABELS[org.role] || org.role}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Edit Name Form */}
          <form onSubmit={handleSaveProfile}>
            <Input
              label="Display Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
            />

            <AnimatePresence>
              {profileMsg.text && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`mb-4 px-4 py-2.5 rounded-lg text-sm border ${
                    profileMsg.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}
                >
                  {profileMsg.text}
                </motion.div>
              )}
            </AnimatePresence>

            <Button
              type="submit"
              disabled={saving || name.trim() === profile?.name}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </motion.div>

        {/* ── Change Password Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-surface-900/60 border border-white/[0.06] rounded-2xl p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-1">Change Password</h3>
          <p className="text-sm text-slate-400 mb-5">Update your password to keep your account secure.</p>

          <form onSubmit={handleChangePassword}>
            {/* Current Password */}
            <div className="relative">
              <Input
                label="Current Password"
                type={showCurrentPw ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
              <button
                type="button"
                className="absolute right-3 top-[30px] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer text-xs"
                onClick={() => setShowCurrentPw(!showCurrentPw)}
              >
                {showCurrentPw ? 'Hide' : 'Show'}
              </button>
            </div>

            {/* New Password */}
            <div className="relative">
              <Input
                label="New Password"
                type={showNewPw ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
              <button
                type="button"
                className="absolute right-3 top-[30px] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer text-xs"
                onClick={() => setShowNewPw(!showNewPw)}
              >
                {showNewPw ? 'Hide' : 'Show'}
              </button>
            </div>

            {/* Confirm Password */}
            <Input
              label="Confirm New Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              error={confirmPassword && newPassword !== confirmPassword ? 'Passwords do not match' : ''}
            />

            <AnimatePresence>
              {passwordMsg.text && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`mb-4 px-4 py-2.5 rounded-lg text-sm border ${
                    passwordMsg.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}
                >
                  {passwordMsg.text}
                </motion.div>
              )}
            </AnimatePresence>

            <Button
              type="submit"
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
            >
              {changingPassword ? 'Changing...' : 'Change Password'}
            </Button>
          </form>
        </motion.div>
      </div>
    </PageWrapper>
  );
}
