import { useState, useEffect, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import PageWrapper from '../../components/layout/PageWrapper';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import {
  ShieldCheck, UsersRound, Briefcase, Landmark, User,
  Building2, Trash2, Plus, X, BadgeCheck, Search, History, ChevronDown, Pencil, KeyRound, Copy,
} from 'lucide-react';

const ROLE_CONFIG = {
  admin: { label: 'Administrator', color: 'bg-accent-500/10 text-accent-400 border-accent-500/20', Icon: ShieldCheck, description: 'Full access: manage staff, KPIs, departments, settings and appraisal sign-off' },
  lead: { label: 'Unit Head', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', Icon: UsersRound, description: 'Can review employee appraisals and provide unit head scoring' },
  md: { label: 'MD', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', Icon: Briefcase, description: 'Sees everything; provides the final MD comments and scoring on appraisals' },
  chairman: { label: 'Chairman', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20', Icon: Landmark, description: 'View-only access to everything: dashboards, KPIs, appraisals, staff, audit log' },
  member: { label: 'Employee', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20', Icon: User, description: 'Can fill self-assessment and view own appraisals' },
};

const ROLE_ORDER = ['admin', 'lead', 'md', 'chairman', 'member'];

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

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

const selectClass =
  'px-2 py-1 bg-slate-800 border border-white/[0.08] rounded-lg text-[11px] text-slate-200 outline-none focus:border-accent-500/50 cursor-pointer';

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
  // One cell at a time is editable: { id, field }
  const [editing, setEditing] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);
  const [levelHistory, setLevelHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('all');
  const [filterStaffType, setFilterStaffType] = useState('all');
  const [editUser, setEditUser] = useState(null); // the member whose details are open
  const [editForm, setEditForm] = useState({ name: '', email: '', integrationEmail: '' });
  const [savingUser, setSavingUser] = useState(false);
  const [resetResult, setResetResult] = useState(null); // { name, email, tempPassword }
  const [showDepts, setShowDepts] = useState(false);
  const [showRoleHelp, setShowRoleHelp] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [savingDept, setSavingDept] = useState(false);

  const isAdmin = orgRole === 'admin';
  const isEditing = (id, field) => editing?.id === id && editing?.field === field;

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
      setEditing(null);
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
      setEditing(null);
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
      setEditing(null);
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
      setEditing(null);
      toast.success(`${data.name} is now ${STAFF_TYPE_CONFIG[data.staffType].label.toLowerCase()} staff`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update staff type');
    }
  }

  function openEditUser(member) {
    setEditForm({
      name: member.name || '',
      email: member.email || '',
      integrationEmail: member.integrationEmail || '',
    });
    setEditUser(member);
  }

  async function handleSaveUser(e) {
    e.preventDefault();
    setSavingUser(true);
    try {
      const { data } = await api.patch(
        `/orgs/${activeOrg.id}/members/${editUser.id}/user`,
        editForm
      );
      setMembers(members.map((m) => m.id === editUser.id
        ? { ...m, name: data.name, email: data.email, integrationEmail: data.integrationEmail }
        : m));
      setEditUser(null);
      if (data.changed.length === 0) {
        toast.success('Nothing to change');
      } else if (data.changed.includes('email')) {
        toast.success(`${data.name} now signs in with ${data.email}`);
      } else {
        toast.success(`${data.name} updated`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update staff details');
    } finally {
      setSavingUser(false);
    }
  }

  async function handleResetPassword(member) {
    const ok = await toast.confirm({
      title: `Reset ${member.name}'s password?`,
      message: 'Their current password stops working immediately. A temporary one is emailed to them and shown to you once.',
      confirmLabel: 'Reset password',
      danger: true,
    });
    if (!ok) return;
    try {
      const { data } = await api.post(`/orgs/${activeOrg.id}/members/${member.id}/reset-password`);
      setResetResult(data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reset password');
    }
  }

  async function handleSetHrOfficer(member) {
    const ok = await toast.confirm({
      title: `Make ${member.name} the HR officer?`,
      message: activeOrg?.hrOfficerName && activeOrg.hrOfficerName !== member.name
        ? `${activeOrg.hrOfficerName} will stop being able to write the HR comment on appraisals.`
        : 'They become the only person who can write the HR comment on appraisals.',
      confirmLabel: 'Make HR officer',
    });
    if (!ok) return;
    try {
      await api.patch(`/orgs/${activeOrg.id}/hr-officer`, { userId: member.userId });
      setMembers(members.map((m) => ({ ...m, isHrOfficer: m.id === member.id })));
      loadOrgRole(); // activeOrg carries hrOfficerId, which gates the comment
      toast.success(`${member.name} is now the HR officer`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to set the HR officer');
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

  // ── Filtering ──
  const term = search.trim().toLowerCase();
  const filteredMembers = members.filter((m) => {
    if (term && !m.name.toLowerCase().includes(term) && !m.email.toLowerCase().includes(term)) return false;
    if (filterDept === 'unassigned' && m.department) return false;
    if (filterDept !== 'all' && filterDept !== 'unassigned' && m.department?.id !== filterDept) return false;
    if (filterStaffType !== 'all' && (m.staffType || 'permanent') !== filterStaffType) return false;
    return true;
  });

  const contractCount = members.filter((m) => m.staffType === 'contract').length;
  const unassignedCount = members.filter((m) => !m.department).length;
  const filtersActive = Boolean(term) || filterDept !== 'all' || filterStaffType !== 'all';

  if (!activeOrg) {
    return (
      <PageWrapper>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div>
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
          <div>
            <h2 className="text-2xl font-bold text-white">Staff</h2>
            <p className="text-sm text-slate-400 mt-1">
              {activeOrg.name} · {members.length} {members.length === 1 ? 'person' : 'people'}
              {contractCount > 0 && ` · ${contractCount} on contract`}
              {activeOrg.hrOfficerName && ` · HR officer: ${activeOrg.hrOfficerName}`}
            </p>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowDepts(!showDepts)}>Departments</Button>
              <Button onClick={() => setShowInvite(true)}>
                <span className="flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  Add Staff
                </span>
              </Button>
            </div>
          )}
        </div>

        {/* ── Department manager ── */}
        <AnimatePresence>
          {isAdmin && showDepts && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mb-5 p-4 bg-surface-900/60 border border-white/[0.06] rounded-xl">
                <h3 className="text-sm font-semibold text-white mb-1">Departments</h3>
                <p className="text-[11px] text-slate-500 mb-3">
                  The functions your organisation has — HR, Marketing, Support, Finance. A department says where
                  someone works; it grants no permissions, and making someone an Administrator does not place them in one.
                </p>

                <form onSubmit={handleCreateDept} className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    placeholder="e.g. Finance"
                    className="flex-1 px-3 py-2 bg-slate-800/50 border border-white/[0.06] rounded-lg text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-accent-500/50 transition-all"
                  />
                  <Button type="submit" variant="secondary" disabled={savingDept || !newDeptName.trim()}>
                    {savingDept ? 'Adding...' : 'Add'}
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Toolbar ── */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email"
              className="w-full pl-9 pr-3 py-2 bg-surface-900/60 border border-white/[0.06] rounded-lg text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-accent-500/40 transition-all"
            />
          </div>

          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="px-3 py-2 bg-surface-900/60 border border-white/[0.06] rounded-lg text-sm text-slate-300 outline-none focus:border-accent-500/40 cursor-pointer"
          >
            <option value="all" className="bg-slate-800">All departments ({members.length})</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id} className="bg-slate-800">
                {d.name} ({members.filter((m) => m.department?.id === d.id).length})
              </option>
            ))}
            {unassignedCount > 0 && (
              <option value="unassigned" className="bg-slate-800">Unassigned ({unassignedCount})</option>
            )}
          </select>

          <select
            value={filterStaffType}
            onChange={(e) => setFilterStaffType(e.target.value)}
            className="px-3 py-2 bg-surface-900/60 border border-white/[0.06] rounded-lg text-sm text-slate-300 outline-none focus:border-accent-500/40 cursor-pointer"
          >
            <option value="all" className="bg-slate-800">All employment</option>
            <option value="permanent" className="bg-slate-800">Permanent ({members.length - contractCount})</option>
            <option value="contract" className="bg-slate-800">Contract ({contractCount})</option>
          </select>

          {filtersActive && (
            <button
              onClick={() => { setSearch(''); setFilterDept('all'); setFilterStaffType('all'); }}
              className="px-3 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* ── Staff table ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="bg-surface-900/60 border border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {['Name', 'Department', 'Level', 'Employment', 'Role', ''].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-slate-500 bg-slate-800/40 first:pl-5 last:pr-5"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((m, i) => {
                    const cfg = ROLE_CONFIG[m.role] || ROLE_CONFIG.member;
                    const typeCfg = STAFF_TYPE_CONFIG[m.staffType] || STAFF_TYPE_CONFIG.permanent;
                    const isLast = i === filteredMembers.length - 1;
                    return (
                      <Fragment key={m.id}>
                        <tr
                          className={`group hover:bg-white/[0.02] transition-colors ${isLast && historyFor !== m.id ? '' : 'border-b border-white/[0.04]'}`}
                        >
                          {/* Name */}
                          <td className="px-4 py-3 pl-5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 shrink-0 rounded-full bg-accent-500/10 border border-accent-500/20 flex items-center justify-center text-[11px] font-bold text-accent-400">
                                {initials(m.name)}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <Link
                                    to={`/staff/${m.userId}`}
                                    className="text-sm font-semibold text-white hover:text-accent-400 transition-colors truncate"
                                  >
                                    {m.name}
                                  </Link>
                                  {m.isHrOfficer && (
                                    <span
                                      title="HR officer — the only person who can write the HR comment"
                                      className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border bg-teal-500/10 text-teal-300 border-teal-500/20"
                                    >
                                      <BadgeCheck className="w-2.5 h-2.5" />
                                      HR
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 truncate">{m.email}</div>
                              </div>
                            </div>
                          </td>

                          {/* Department */}
                          <td className="px-4 py-3">
                            {isEditing(m.id, 'dept') ? (
                              <select
                                autoFocus
                                defaultValue={m.department?.id || ''}
                                onChange={(e) => handleDeptChange(m.id, e.target.value)}
                                onBlur={() => setEditing(null)}
                                className={selectClass}
                              >
                                <option value="" className="bg-slate-800">No department</option>
                                {departments.map((d) => (
                                  <option key={d.id} value={d.id} className="bg-slate-800">{d.name}</option>
                                ))}
                              </select>
                            ) : (
                              <button
                                disabled={!isAdmin}
                                onClick={() => setEditing({ id: m.id, field: 'dept' })}
                                className={`text-[11px] font-medium px-2 py-0.5 rounded-full border transition-all ${
                                  m.department ? getDeptColor(m.department.slug) : 'bg-white/[0.03] text-slate-500 border-white/[0.06]'
                                } ${isAdmin ? 'cursor-pointer hover:brightness-125' : 'cursor-default'}`}
                              >
                                {m.department?.name || 'Unassigned'}
                              </button>
                            )}
                          </td>

                          {/* Level */}
                          <td className="px-4 py-3">
                            {isEditing(m.id, 'level') ? (
                              <select
                                autoFocus
                                defaultValue={m.level ?? ''}
                                onChange={(e) => e.target.value && handleLevelChange(m.id, e.target.value)}
                                onBlur={() => setEditing(null)}
                                className={selectClass}
                              >
                                <option value="" className="bg-slate-800">Set level</option>
                                {LEVELS.map((l) => (
                                  <option key={l} value={l} className="bg-slate-800">Level {l}</option>
                                ))}
                              </select>
                            ) : (
                              <div className="flex items-center gap-1">
                                <button
                                  disabled={!isAdmin}
                                  onClick={() => setEditing({ id: m.id, field: 'level' })}
                                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                                    m.level != null
                                      ? 'bg-violet-500/10 text-violet-300 border-violet-500/20'
                                      : 'bg-white/[0.03] text-slate-500 border-white/[0.06]'
                                  } ${isAdmin ? 'cursor-pointer hover:brightness-125' : 'cursor-default'}`}
                                >
                                  {m.level != null ? `Level ${m.level}` : '--'}
                                </button>
                                {m.level != null && (
                                  <button
                                    onClick={() => openLevelHistory(m)}
                                    title="Level history"
                                    className="p-1 rounded text-slate-600 hover:text-violet-300 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                  >
                                    <History className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Employment */}
                          <td className="px-4 py-3">
                            {isEditing(m.id, 'type') ? (
                              <select
                                autoFocus
                                defaultValue={m.staffType || 'permanent'}
                                onChange={(e) => handleStaffTypeChange(m.id, e.target.value)}
                                onBlur={() => setEditing(null)}
                                className={selectClass}
                              >
                                {Object.entries(STAFF_TYPE_CONFIG).map(([key, c]) => (
                                  <option key={key} value={key} className="bg-slate-800">{c.label}</option>
                                ))}
                              </select>
                            ) : (
                              <button
                                disabled={!isAdmin}
                                onClick={() => setEditing({ id: m.id, field: 'type' })}
                                className={`text-[11px] font-medium px-2 py-0.5 rounded-full border transition-all ${typeCfg.color} ${
                                  isAdmin ? 'cursor-pointer hover:brightness-125' : 'cursor-default'
                                }`}
                              >
                                {typeCfg.label}
                              </button>
                            )}
                          </td>

                          {/* Role */}
                          <td className="px-4 py-3">
                            {isEditing(m.id, 'role') ? (
                              <select
                                autoFocus
                                defaultValue={m.role}
                                onChange={(e) => handleRoleChange(m.id, e.target.value)}
                                onBlur={() => setEditing(null)}
                                className={selectClass}
                              >
                                {ROLE_ORDER.map((r) => (
                                  <option key={r} value={r} className="bg-slate-800">{ROLE_CONFIG[r].label}</option>
                                ))}
                              </select>
                            ) : (
                              <button
                                disabled={!isAdmin}
                                onClick={() => setEditing({ id: m.id, field: 'role' })}
                                title={cfg.description}
                                className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border transition-all ${cfg.color} ${
                                  isAdmin ? 'cursor-pointer hover:brightness-125' : 'cursor-default'
                                }`}
                              >
                                <cfg.Icon className="w-3 h-3" />
                                {cfg.label}
                              </button>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 pr-5">
                            {isAdmin && (
                              <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleResetPassword(m)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-white/[0.06] transition-all cursor-pointer"
                                  title="Reset password"
                                >
                                  <KeyRound className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => openEditUser(m)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] transition-all cursor-pointer"
                                  title="Edit name and email"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                {!m.isHrOfficer && (
                                  <button
                                    onClick={() => handleSetHrOfficer(m)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-teal-400 hover:bg-white/[0.06] transition-all cursor-pointer"
                                    title="Make HR officer"
                                  >
                                    <BadgeCheck className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleRemove(m.id, m.name)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                                  title="Remove from organisation"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>

                        {/* Level history */}
                        {historyFor === m.id && (
                          <tr className={isLast ? '' : 'border-b border-white/[0.04]'}>
                            <td colSpan={6} className="px-5 py-3 bg-surface-950/40">
                              {loadingHistory ? (
                                <p className="text-[11px] text-slate-500">Loading level history...</p>
                              ) : levelHistory.length === 0 ? (
                                <p className="text-[11px] text-slate-500">
                                  No level changes recorded — Level {m.level} was set when {m.name.split(' ')[0]} was added.
                                </p>
                              ) : (
                                <div className="space-y-1.5">
                                  {levelHistory.map((h) => (
                                    <div key={h.id} className="flex items-center gap-2 text-[11px]">
                                      <span className="text-slate-300 font-medium">
                                        {h.fromLevel ? `Level ${h.fromLevel}` : 'No level'} &rarr; Level {h.toLevel}
                                      </span>
                                      <span className="text-slate-600">
                                        {new Date(h.createdAt).toLocaleDateString()} · by {h.changedBy}
                                      </span>
                                      {h.note && <span className="text-slate-500 italic truncate">{h.note}</span>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredMembers.length === 0 && (
              <div className="text-center py-14 text-sm text-slate-500">
                {filtersActive ? 'No staff match these filters.' : 'No staff yet.'}
              </div>
            )}

            {isAdmin && filteredMembers.length > 0 && (
              <p className="text-[11px] text-slate-600 px-5 py-3 border-t border-white/[0.04]">
                Select a badge to change it. Select a name to open that person&apos;s record.
              </p>
            )}
          </div>
        )}

        {/* ── Role reference ── */}
        <div className="mt-4">
          <button
            onClick={() => setShowRoleHelp(!showRoleHelp)}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showRoleHelp ? 'rotate-180' : ''}`} />
            What do the roles mean?
          </button>
          <AnimatePresence>
            {showRoleHelp && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                  {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
                    <div key={key} className="p-3 bg-surface-900/60 border border-white/[0.06] rounded-xl">
                      <div className="flex items-center gap-2 mb-1">
                        <cfg.Icon className="w-3.5 h-3.5 text-slate-400" />
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">{cfg.description}</p>
                    </div>
                  ))}
                  <div className="p-3 bg-surface-900/60 border border-white/[0.06] rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                      <BadgeCheck className="w-3.5 h-3.5 text-teal-400" />
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-teal-500/10 text-teal-300 border-teal-500/20">
                        HR Officer
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Not a role — one named person per organisation, the only one who can write the HR comment on an appraisal.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Temporary password, shown once ── */}
        <AnimatePresence>
          {resetResult && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => setResetResult(null)}
            >
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                className="bg-surface-900 border border-white/[0.06] rounded-2xl p-6 w-full max-w-md shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-bold text-white mb-1">Password reset</h3>
                <p className="text-xs text-slate-500 mb-4">
                  {resetResult.name} has been emailed this temporary password at {resetResult.email}.
                  It is shown here once so you can pass it on directly.
                </p>

                <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-800/60 border border-white/[0.08] rounded-lg mb-3">
                  <code className="flex-1 text-sm font-mono text-accent-300 break-all">{resetResult.tempPassword}</code>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(resetResult.tempPassword);
                      toast.success('Copied');
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer shrink-0"
                    title="Copy"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-[11px] text-amber-300/80 mb-4">
                  Closing this hides it for good. Ask them to change it after signing in.
                </p>

                <Button onClick={() => setResetResult(null)} fullWidth>Done</Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Edit staff details ── */}
        <AnimatePresence>
          {editUser && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => setEditUser(null)}
            >
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                className="bg-surface-900 border border-white/[0.06] rounded-2xl p-6 w-full max-w-md shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-bold text-white mb-1">Edit staff details</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Role, department, level and employment are changed on the staff list itself.
                </p>

                <form onSubmit={handleSaveUser}>
                  <Input
                    label="Full Name"
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                  <Input
                    label="Login Email"
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  />
                  <Input
                    label="Azure DevOps Email (optional)"
                    type="email"
                    value={editForm.integrationEmail}
                    onChange={(e) => setEditForm({ ...editForm, integrationEmail: e.target.value })}
                    placeholder="only if different from the login email"
                  />

                  {editForm.email.trim().toLowerCase() !== (editUser.email || '').toLowerCase() && (
                    <div className="mb-3 px-3 py-2 bg-amber-500/5 border border-amber-500/20 rounded-lg text-[11px] text-amber-300">
                      This changes the address {editUser.name.split(' ')[0]} signs in with. Their password is
                      unchanged, and no email is sent about it, so tell them yourself.
                    </div>
                  )}

                  <div className="flex gap-2 mt-2">
                    <Button type="button" variant="secondary" onClick={() => setEditUser(null)} fullWidth>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={savingUser || !editForm.name.trim() || !editForm.email.trim()} fullWidth>
                      {savingUser ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Add staff modal ── */}
        <AnimatePresence>
          {showInvite && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
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
                <p className="text-xs text-slate-500 mb-4">
                  An account is created automatically if they don&apos;t have one.
                </p>

                <form onSubmit={handleInvite}>
                  <Input
                    label="Full Name"
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="Jane Doe"
                  />
                  <Input
                    label="Email Address"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="jane@company.com"
                  />

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-2">Department</label>
                      <select
                        value={inviteDeptId}
                        onChange={(e) => setInviteDeptId(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-800/50 border border-white/[0.06] rounded-lg text-sm text-slate-100 outline-none focus:border-accent-500/50 transition-all cursor-pointer"
                      >
                        <option value="" className="bg-slate-800">None</option>
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.id} className="bg-slate-800">{dept.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-2">Level</label>
                      <select
                        value={inviteLevel}
                        onChange={(e) => setInviteLevel(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-800/50 border border-white/[0.06] rounded-lg text-sm text-slate-100 outline-none focus:border-accent-500/50 transition-all cursor-pointer"
                      >
                        <option value="" className="bg-slate-800">Not set</option>
                        {LEVELS.map((l) => (
                          <option key={l} value={l} className="bg-slate-800">Level {l}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-2">Employment</label>
                    <div className="flex gap-2">
                      {Object.entries(STAFF_TYPE_CONFIG).map(([key, cfg]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setInviteStaffType(key)}
                          className={`flex-1 px-3 py-2 rounded-lg border-2 text-xs font-semibold transition-all cursor-pointer ${
                            inviteStaffType === key
                              ? 'bg-accent-500/10 border-accent-500/40 text-white'
                              : 'bg-slate-800/50 border-white/[0.06] text-slate-400 hover:border-white/10'
                          }`}
                        >
                          {cfg.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-2">Role</label>
                    <div className="space-y-2">
                      {ROLE_ORDER.map((key) => {
                        const cfg = ROLE_CONFIG[key];
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setInviteRole(key)}
                            className={`w-full flex items-center gap-3 p-2.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                              inviteRole === key
                                ? 'bg-accent-500/10 border-accent-500/40'
                                : 'bg-slate-800/50 border-white/[0.06] hover:border-white/10'
                            }`}
                          >
                            <cfg.Icon className="w-4 h-4 text-slate-400 shrink-0" />
                            <div className="min-w-0">
                              <span className="text-sm font-semibold text-white block">{cfg.label}</span>
                              <span className="text-[10px] text-slate-500">{cfg.description}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mb-3 px-3 py-2 bg-slate-800/50 border border-white/[0.06] rounded-lg text-[11px] text-slate-500">
                    Default password: <span className="font-mono text-slate-300">Welcome@123</span> — staff should change it after first login.
                  </div>

                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" onClick={() => setShowInvite(false)} fullWidth>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={!inviteEmail || !inviteName || inviting} fullWidth>
                      {inviting ? 'Adding...' : 'Add Staff'}
                    </Button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageWrapper>
  );
}
