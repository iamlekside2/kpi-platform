import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import PageWrapper from '../../components/layout/PageWrapper';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import {
  ShieldCheck, UsersRound, Briefcase, Landmark, User,
  Building2, TrendingUp, Pencil, Trash2, BadgeCheck, Plus, X,
} from 'lucide-react';

const ROLE_CONFIG = {
  admin: { label: 'Administrator', color: 'bg-accent-500/10 text-accent-400 border-accent-500/20', Icon: ShieldCheck, description: 'Full access: manage staff, KPIs, departments, settings and the HR comment. Does not make them HR.' },
  lead: { label: 'Unit Head', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', Icon: UsersRound, description: 'Can review employee appraisals and provide unit head scoring' },
  md: { label: 'MD', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', Icon: Briefcase, description: 'Sees everything; provides the final MD comments and scoring on appraisals' },
  chairman: { label: 'Chairman', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20', Icon: Landmark, description: 'View-only access to everything: dashboards, KPIs, appraisals, staff, audit log' },
  member: { label: 'Employee', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20', Icon: User, description: 'Can fill self-assessment and view own appraisals' },
};

// Grade levels: 1 is the entry band. The backend accepts up to 20, the picker
// offers the range the org actually uses.
const LEVELS = Array.from({ length: 10 }, (_, i) => i + 1);

const STAFF_TYPE_CONFIG = {
  permanent: { label: 'Permanent', color: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
  contract: { label: 'Contract', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
};

const DEPT_COLORS = {
  tech: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  sales: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  general: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

function getDeptColor(slug) {
  return DEPT_COLORS[slug] || 'bg-accent-500/10 text-accent-400 border-accent-500/20';
}

export default function StaffPage() {
  const { activeOrg, orgRole, loadOrgRole } = useAuth();
  const toast = useToast();
  const [members, setMembers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviteDeptId, setInviteDeptId] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteLevel, setInviteLevel] = useState('');
  const [inviteStaffType, setInviteStaffType] = useState('permanent');
  const [editingMember, setEditingMember] = useState(null);
  const [editingDept, setEditingDept] = useState(null);
  const [editingLevel, setEditingLevel] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);
  const [levelHistory, setLevelHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [filterDept, setFilterDept] = useState('all');
  const [filterStaffType, setFilterStaffType] = useState('all');
  const [showDepts, setShowDepts] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [savingDept, setSavingDept] = useState(false);

  const isAdmin = orgRole === 'admin';

  useEffect(() => {
    if (!activeOrg) loadOrgRole();
  }, []);

  useEffect(() => {
    if (activeOrg) {
      loadMembers();
      loadDepartments();
    }
  }, [activeOrg]);

  async function loadMembers() {
    try {
      const { data } = await api.get(`/orgs/${activeOrg.id}/members`);
      setMembers(data);
    } catch (err) {
      console.error('Failed to load members:', err);
      toast.error('Failed to load staff members');
    } finally {
      setLoading(false);
    }
  }

  async function loadDepartments() {
    try {
      const { data } = await api.get(`/departments/org/${activeOrg.id}`);
      setDepartments(data);
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  }

  async function handleInvite(e) {
    e.preventDefault();
    setInviting(true);
    try {
      const { data } = await api.post(`/orgs/${activeOrg.id}/invite`, {
        email: inviteEmail,
        name: inviteName,
        role: inviteRole,
        departmentId: inviteDeptId || undefined,
        level: inviteLevel || undefined,
        staffType: inviteStaffType,
      });
      setMembers([...members, data]);
      setShowInvite(false);
      setInviteName('');
      setInviteEmail('');
      setInviteRole('member');
      setInviteDeptId('');
      setInviteLevel('');
      setInviteStaffType('permanent');
      toast.success(`${data.name} added! Default password: Welcome@123`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to invite member');
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(memberId, newRole) {
    try {
      await api.patch(`/orgs/${activeOrg.id}/members/${memberId}`, { role: newRole });
      setMembers(members.map((m) => m.id === memberId ? { ...m, role: newRole } : m));
      setEditingMember(null);
      loadOrgRole();
      toast.success('Role updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update role');
    }
  }

  async function handleDeptChange(memberId, departmentId) {
    try {
      const { data } = await api.patch(`/orgs/${activeOrg.id}/members/${memberId}/department`, { departmentId: departmentId || null });
      setMembers(members.map((m) => m.id === memberId ? { ...m, department: data.department } : m));
      setEditingDept(null);
      toast.success('Department updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update department');
    }
  }

  async function handleLevelChange(memberId, level) {
    try {
      const { data } = await api.patch(`/orgs/${activeOrg.id}/members/${memberId}/level`, { level });
      setMembers(members.map((m) => m.id === memberId
        ? { ...m, level: data.level, lastLevelChange: { fromLevel: data.previousLevel, toLevel: data.level, createdAt: new Date().toISOString() } }
        : m));
      setEditingLevel(null);
      const from = data.previousLevel ? `Level ${data.previousLevel}` : 'no level';
      toast.success(`${data.name}: ${from} → Level ${data.level}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update level');
    }
  }

  async function handleStaffTypeChange(memberId, staffType) {
    try {
      const { data } = await api.patch(`/orgs/${activeOrg.id}/members/${memberId}/staff-type`, { staffType });
      setMembers(members.map((m) => m.id === memberId ? { ...m, staffType: data.staffType } : m));
      toast.success(`${data.name} is now ${STAFF_TYPE_CONFIG[data.staffType].label.toLowerCase()} staff`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update staff type');
    }
  }

  async function handleHrToggle(memberId, isHr) {
    try {
      const { data } = await api.patch(`/orgs/${activeOrg.id}/members/${memberId}/hr`, { isHr });
      setMembers(members.map((m) => m.id === memberId ? { ...m, isHr: data.isHr } : m));
      loadOrgRole(); // your own HR flag may have just changed
      toast.success(data.isHr ? `${data.name} is now HR` : `${data.name} is no longer HR`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update HR designation');
    }
  }

  async function handleCreateDept(e) {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    setSavingDept(true);
    try {
      const { data } = await api.post(`/departments/org/${activeOrg.id}`, { name: newDeptName.trim() });
      setDepartments([...departments, data]);
      setNewDeptName('');
      toast.success(`${data.name} added`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create department');
    } finally {
      setSavingDept(false);
    }
  }

  async function handleDeleteDept(dept) {
    const inUse = members.filter((m) => m.department?.id === dept.id).length;
    const ok = await toast.confirm({
      title: `Delete ${dept.name}?`,
      message: inUse > 0
        ? `${inUse} staff member${inUse > 1 ? 's are' : ' is'} in this department and will become unassigned.`
        : 'This department has no staff assigned.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/departments/${dept.id}`);
      setDepartments(departments.filter((d) => d.id !== dept.id));
      loadMembers();
      toast.success(`${dept.name} deleted`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete department');
    }
  }

  async function openLevelHistory(member) {
    if (historyFor === member.id) {
      setHistoryFor(null);
      return;
    }
    setHistoryFor(member.id);
    setLevelHistory([]);
    setLoadingHistory(true);
    try {
      const { data } = await api.get(`/orgs/${activeOrg.id}/members/${member.id}/level-history`);
      setLevelHistory(data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load level history');
      setHistoryFor(null);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function handleRemove(memberId, name) {
    const ok = await toast.confirm({
      title: `Remove ${name}?`,
      message: 'They will lose access to this organisation. Their past appraisals are kept.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/orgs/${activeOrg.id}/members/${memberId}`);
      setMembers(members.filter((m) => m.id !== memberId));
      toast.success(`${name} removed from the organisation`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove member');
    }
  }

  const byDept = filterDept === 'all'
    ? members
    : filterDept === 'unassigned'
      ? members.filter((m) => !m.department)
      : members.filter((m) => m.department?.id === filterDept);

  const filteredMembers = filterStaffType === 'all'
    ? byDept
    : byDept.filter((m) => (m.staffType || 'permanent') === filterStaffType);

  const contractCount = members.filter((m) => m.staffType === 'contract').length;

  if (!activeOrg) {
    return (
      <PageWrapper>
        <div className="text-center py-20 text-slate-400">No organization found. Please set up your organization first.</div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Staff Management</h2>
            <p className="text-sm text-slate-400 mt-1">
              {activeOrg.name} &middot; {members.length} member{members.length !== 1 ? 's' : ''}
            </p>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowDepts(!showDepts)}>
                Manage Departments
              </Button>
              <Button onClick={() => setShowInvite(true)}>+ Add Staff</Button>
            </div>
          )}
        </div>

        {/* Department manager — HR, Marketing, Support etc. are job functions,
            created here and assigned to staff; they are not permissions. */}
        {isAdmin && showDepts && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-6 p-4 bg-surface-900/60 border border-white/[0.06] rounded-xl overflow-hidden"
          >
            <h3 className="text-sm font-semibold text-white mb-1">Departments</h3>
            <p className="text-[11px] text-slate-500 mb-3">
              Add the functions your organisation actually has — HR, Marketing, Support, Finance. Assigning
              someone to HR does not give them permissions, and making someone an Administrator does not make them HR.
            </p>

            <form onSubmit={handleCreateDept} className="flex gap-2 mb-3">
              <input
                type="text"
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                placeholder="e.g. Human Resources"
                className="flex-1 px-3 py-2 bg-slate-800/50 border border-white/[0.06] rounded-lg text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-accent-500/50 transition-all"
              />
              <Button type="submit" variant="secondary" disabled={savingDept || !newDeptName.trim()}>
                <span className="flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" />
                  {savingDept ? 'Adding...' : 'Add'}
                </span>
              </Button>
            </form>

            <div className="flex flex-wrap gap-2">
              {departments.map((d) => {
                const count = members.filter((m) => m.department?.id === d.id).length;
                return (
                  <span
                    key={d.id}
                    className={`inline-flex items-center gap-2 text-[11px] font-medium px-2.5 py-1 rounded-full border ${getDeptColor(d.slug)}`}
                  >
                    {d.name}
                    <span className="text-slate-500">{count}</span>
                    <button
                      onClick={() => handleDeleteDept(d)}
                      className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                      title={`Delete ${d.name}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
              {departments.length === 0 && (
                <span className="text-[11px] text-slate-500">No departments yet.</span>
              )}
            </div>
          </motion.div>
        )}

        {/* Department filter tabs */}
        {departments.length > 0 && (
          <div className="flex gap-1 p-1 bg-surface-900/60 border border-white/[0.06] rounded-xl mb-6 overflow-x-auto">
            <button
              onClick={() => setFilterDept('all')}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer
                ${filterDept === 'all'
                  ? 'bg-accent-500/15 text-accent-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'}`}
            >
              All ({members.length})
            </button>
            {departments.map((dept) => {
              const count = members.filter((m) => m.department?.id === dept.id).length;
              return (
                <button
                  key={dept.id}
                  onClick={() => setFilterDept(dept.id)}
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer
                    ${filterDept === dept.id
                      ? 'bg-accent-500/15 text-accent-400 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'}`}
                >
                  {dept.name} ({count})
                </button>
              );
            })}
            {(() => {
              const unassignedCount = members.filter((m) => !m.department).length;
              return unassignedCount > 0 ? (
                <button
                  onClick={() => setFilterDept('unassigned')}
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer
                    ${filterDept === 'unassigned'
                      ? 'bg-accent-500/15 text-accent-400 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'}`}
                >
                  Unassigned ({unassignedCount})
                </button>
              ) : null;
            })()}
          </div>
        )}

        {/* Employment type filter */}
        <div className="flex gap-1 p-1 bg-surface-900/60 border border-white/[0.06] rounded-xl mb-6 overflow-x-auto w-fit">
          {[
            { key: 'all', label: `All staff (${members.length})` },
            { key: 'permanent', label: `Permanent (${members.length - contractCount})` },
            { key: 'contract', label: `Contract (${contractCount})` },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterStaffType(f.key)}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer
                ${filterStaffType === f.key
                  ? 'bg-accent-500/15 text-accent-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Role legend */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
            <div key={key} className="p-3 bg-surface-900/60 border border-white/[0.06] rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <cfg.Icon className="w-4 h-4 text-slate-400" />
                <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${cfg.color}`}>
                  {cfg.label}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">{cfg.description}</p>
            </div>
          ))}
        </div>

        {/* Invite Modal */}
        <AnimatePresence>
          {showInvite && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
              onClick={() => setShowInvite(false)}
            >
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                className="bg-surface-900 border border-white/[0.06] rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-bold text-white mb-1">Add Staff Member</h3>
                <p className="text-xs text-slate-500 mb-4">Enter the staff member&apos;s details. An account will be created automatically if they don&apos;t have one.</p>

                <form onSubmit={handleInvite}>
                  <Input
                    label="Full Name"
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="John Doe"
                    required
                  />
                  <Input
                    label="Email Address"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="john@company.com"
                    required
                  />

                  {/* Department selector */}
                  {departments.length > 0 && (
                    <div className="mb-4">
                      <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-2">Department</label>
                      <select
                        value={inviteDeptId}
                        onChange={(e) => setInviteDeptId(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/[0.06] rounded-lg text-sm text-slate-100 outline-none focus:border-accent-500/50 focus:ring-2 focus:ring-accent-500/20 transition-all appearance-none cursor-pointer"
                      >
                        <option value="" className="bg-slate-800">No department</option>
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.id} className="bg-slate-800">
                            {dept.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Level + employment type */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-2">Level</label>
                      <select
                        value={inviteLevel}
                        onChange={(e) => setInviteLevel(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/[0.06] rounded-lg text-sm text-slate-100 outline-none focus:border-accent-500/50 focus:ring-2 focus:ring-accent-500/20 transition-all appearance-none cursor-pointer"
                      >
                        <option value="" className="bg-slate-800">Not set</option>
                        {LEVELS.map((l) => (
                          <option key={l} value={l} className="bg-slate-800">Level {l}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-2">Employment</label>
                      <select
                        value={inviteStaffType}
                        onChange={(e) => setInviteStaffType(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/[0.06] rounded-lg text-sm text-slate-100 outline-none focus:border-accent-500/50 focus:ring-2 focus:ring-accent-500/20 transition-all appearance-none cursor-pointer"
                      >
                        {Object.entries(STAFF_TYPE_CONFIG).map(([key, cfg]) => (
                          <option key={key} value={key} className="bg-slate-800">{cfg.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-2">Assign Role</label>
                    <div className="space-y-2">
                      {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setInviteRole(key)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all cursor-pointer
                            ${inviteRole === key
                              ? 'bg-accent-500/10 border-accent-500/40'
                              : 'bg-slate-800/50 border-white/[0.06] hover:border-white/10'}`}
                        >
                          <cfg.Icon className="w-4 h-4 text-slate-400 shrink-0" />
                          <div>
                            <span className="text-sm font-semibold text-white block">{cfg.label}</span>
                            <span className="text-[10px] text-slate-500">{cfg.description}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-3 px-3 py-2 bg-slate-800/50 border border-white/[0.06] rounded-lg text-[11px] text-slate-500">
                    Default password: <span className="font-mono text-slate-300">Welcome@123</span> — staff should change it after first login.
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" disabled={!inviteEmail || !inviteName || inviting}>
                      {inviting ? 'Adding...' : 'Add Staff'}
                    </Button>
                    <Button variant="secondary" onClick={() => setShowInvite(false)}>Cancel</Button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Staff list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {filteredMembers.map((m, i) => {
              const cfg = ROLE_CONFIG[m.role] || ROLE_CONFIG.member;
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="p-4 bg-surface-900/60 border border-white/[0.06] rounded-xl hover:border-white/10 transition-all"
                >
                  <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-accent-500/10 border border-accent-500/20 flex items-center justify-center">
                      <cfg.Icon className="w-5 h-5 text-accent-400" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white flex items-center gap-2 flex-wrap">
                        {m.name}
                        {m.department && (
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${getDeptColor(m.department.slug)}`}>
                            {m.department.name}
                          </span>
                        )}
                        {m.level != null && (
                          <button
                            onClick={() => openLevelHistory(m)}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-violet-500/10 text-violet-300 border-violet-500/20 hover:bg-violet-500/20 transition-all cursor-pointer"
                            title="View level history"
                          >
                            Level {m.level}
                          </button>
                        )}
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${(STAFF_TYPE_CONFIG[m.staffType] || STAFF_TYPE_CONFIG.permanent).color}`}>
                          {(STAFF_TYPE_CONFIG[m.staffType] || STAFF_TYPE_CONFIG.permanent).label}
                        </span>
                        {m.isHr && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-teal-500/10 text-teal-300 border-teal-500/20">
                            <BadgeCheck className="w-3 h-3" />
                            HR
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">{m.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {editingDept === m.id ? (
                      <div className="flex gap-1 items-center">
                        <select
                          defaultValue={m.department?.id || ''}
                          onChange={(e) => handleDeptChange(m.id, e.target.value)}
                          className="px-2 py-1 bg-slate-800/80 border border-white/[0.08] rounded-lg text-[11px] text-slate-200 outline-none cursor-pointer"
                        >
                          <option value="" className="bg-slate-800">No dept</option>
                          {departments.map((d) => (
                            <option key={d.id} value={d.id} className="bg-slate-800">{d.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => setEditingDept(null)}
                          className="px-2 py-1 text-slate-500 hover:text-slate-300 text-xs cursor-pointer"
                        >
                          &times;
                        </button>
                      </div>
                    ) : editingLevel === m.id ? (
                      <div className="flex gap-1 items-center">
                        <select
                          defaultValue={m.level ?? ''}
                          onChange={(e) => e.target.value && handleLevelChange(m.id, e.target.value)}
                          className="px-2 py-1 bg-slate-800/80 border border-white/[0.08] rounded-lg text-[11px] text-slate-200 outline-none cursor-pointer"
                        >
                          <option value="" className="bg-slate-800">Set level</option>
                          {LEVELS.map((l) => (
                            <option key={l} value={l} className="bg-slate-800">Level {l}</option>
                          ))}
                        </select>
                        <select
                          value={m.staffType || 'permanent'}
                          onChange={(e) => handleStaffTypeChange(m.id, e.target.value)}
                          className="px-2 py-1 bg-slate-800/80 border border-white/[0.08] rounded-lg text-[11px] text-slate-200 outline-none cursor-pointer"
                        >
                          {Object.entries(STAFF_TYPE_CONFIG).map(([key, c]) => (
                            <option key={key} value={key} className="bg-slate-800">{c.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => setEditingLevel(null)}
                          className="px-2 py-1 text-slate-500 hover:text-slate-300 text-xs cursor-pointer"
                        >
                          &times;
                        </button>
                      </div>
                    ) : editingMember === m.id ? (
                      <div className="flex gap-1">
                        {['admin', 'lead', 'md', 'chairman', 'member'].map((r) => (
                          <button
                            key={r}
                            onClick={() => handleRoleChange(m.id, r)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer border
                              ${m.role === r
                                ? ROLE_CONFIG[r].color
                                : 'bg-white/[0.04] text-slate-500 border-transparent hover:bg-white/[0.08]'}`}
                          >
                            {ROLE_CONFIG[r].label}
                          </button>
                        ))}
                        <button
                          onClick={() => setEditingMember(null)}
                          className="px-2 py-1.5 text-slate-500 hover:text-slate-300 text-xs cursor-pointer"
                        >
                          &times;
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        {isAdmin && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => { setEditingDept(m.id); setEditingMember(null); }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-all cursor-pointer"
                              title="Change department"
                            >
                              <Building2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => { setEditingLevel(m.id); setEditingDept(null); setEditingMember(null); }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-all cursor-pointer"
                              title="Change level or employment type"
                            >
                              <TrendingUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => { setEditingMember(m.id); setEditingDept(null); setEditingLevel(null); }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-all cursor-pointer"
                              title="Change role"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleHrToggle(m.id, !m.isHr)}
                              className={`p-1.5 rounded-lg transition-all cursor-pointer ${m.isHr
                                ? 'text-teal-400 hover:bg-teal-500/10'
                                : 'text-slate-500 hover:text-teal-400 hover:bg-white/[0.06]'}`}
                              title={m.isHr ? 'Remove HR designation' : 'Designate as HR'}
                            >
                              <BadgeCheck className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleRemove(m.id, m.name)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                              title="Remove member"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  </div>

                  {/* Level history — the promotion trail behind the current level */}
                  {historyFor === m.id && (
                    <div className="mt-3 pt-3 border-t border-white/[0.06]">
                      {loadingHistory ? (
                        <p className="text-[11px] text-slate-500">Loading level history...</p>
                      ) : levelHistory.length === 0 ? (
                        <p className="text-[11px] text-slate-500">
                          No level changes recorded — Level {m.level} was set when they were added.
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {levelHistory.map((h) => (
                            <div key={h.id} className="flex items-center gap-2 text-[11px]">
                              <span className="text-slate-300 font-medium">
                                {h.fromLevel ? `Level ${h.fromLevel}` : 'No level'} &rarr; Level {h.toLevel}
                              </span>
                              <span className="text-slate-600">
                                {new Date(h.createdAt).toLocaleDateString()} &middot; by {h.changedBy}
                              </span>
                              {h.note && <span className="text-slate-500 italic truncate">{h.note}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}

            {filteredMembers.length === 0 && (
              <div className="text-center py-12 text-slate-500 text-sm">
                No staff members in this department.
              </div>
            )}
          </div>
        )}

        {!isAdmin && (
          <div className="mt-6 px-4 py-3 bg-slate-800/50 border border-white/[0.06] rounded-lg text-xs text-slate-500 text-center">
            Only administrators can invite staff and change roles.
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
