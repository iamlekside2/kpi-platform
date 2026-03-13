import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import PageWrapper from '../../components/layout/PageWrapper';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

const ROLE_CONFIG = {
  admin: { label: 'HR / Admin', color: 'bg-accent-500/10 text-accent-400 border-accent-500/20', icon: '👑', description: 'Full access: manage staff, review all appraisals, admin & MD comments' },
  lead: { label: 'Unit Head', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: '👔', description: 'Can review employee appraisals and provide unit head scoring' },
  member: { label: 'Employee', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20', icon: '👤', description: 'Can fill self-assessment and view own appraisals' },
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
  const [members, setMembers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviteDeptId, setInviteDeptId] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviting, setInviting] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [editingDept, setEditingDept] = useState(null);
  const [filterDept, setFilterDept] = useState('all');
  const [error, setError] = useState('');

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
      setError('Failed to load staff members');
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
    setInviteError('');
    setInviteSuccess('');
    try {
      const { data } = await api.post(`/orgs/${activeOrg.id}/invite`, {
        email: inviteEmail,
        name: inviteName,
        role: inviteRole,
        departmentId: inviteDeptId || undefined,
      });
      setMembers([...members, data]);
      setShowInvite(false);
      setInviteName('');
      setInviteEmail('');
      setInviteRole('member');
      setInviteDeptId('');
      setInviteSuccess(`${data.name} added! Default password: Welcome@123`);
      setTimeout(() => setInviteSuccess(''), 8000);
    } catch (err) {
      setInviteError(err.response?.data?.error || 'Failed to invite member');
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
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update role');
    }
  }

  async function handleDeptChange(memberId, departmentId) {
    try {
      const { data } = await api.patch(`/orgs/${activeOrg.id}/members/${memberId}/department`, { departmentId: departmentId || null });
      setMembers(members.map((m) => m.id === memberId ? { ...m, department: data.department } : m));
      setEditingDept(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update department');
    }
  }

  async function handleRemove(memberId, name) {
    if (!confirm(`Remove ${name} from the organization?`)) return;
    try {
      await api.delete(`/orgs/${activeOrg.id}/members/${memberId}`);
      setMembers(members.filter((m) => m.id !== memberId));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove member');
    }
  }

  const filteredMembers = filterDept === 'all'
    ? members
    : filterDept === 'unassigned'
      ? members.filter((m) => !m.department)
      : members.filter((m) => m.department?.id === filterDept);

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
            <Button onClick={() => setShowInvite(true)}>+ Add Staff</Button>
          )}
        </div>

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

        {/* Role legend */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
            <div key={key} className="p-3 bg-surface-900/60 border border-white/[0.06] rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{cfg.icon}</span>
                <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${cfg.color}`}>
                  {cfg.label}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">{cfg.description}</p>
            </div>
          ))}
        </div>

        {/* Success message */}
        {inviteSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-400"
          >
            {inviteSuccess}
          </motion.div>
        )}

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
                          <span className="text-lg">{cfg.icon}</span>
                          <div>
                            <span className="text-sm font-semibold text-white block">{cfg.label}</span>
                            <span className="text-[10px] text-slate-500">{cfg.description}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {inviteError && (
                    <div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                      {inviteError}
                    </div>
                  )}

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
        ) : error ? (
          <div className="text-center py-20 text-red-400">{error}</div>
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
                  className="flex items-center justify-between p-4 bg-surface-900/60 border border-white/[0.06] rounded-xl hover:border-white/10 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-accent-500/10 border border-accent-500/20 flex items-center justify-center text-lg">
                      {cfg.icon}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white flex items-center gap-2 flex-wrap">
                        {m.name}
                        {m.department && (
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${getDeptColor(m.department.slug)}`}>
                            {m.department.name}
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
                    ) : editingMember === m.id ? (
                      <div className="flex gap-1">
                        {['admin', 'lead', 'member'].map((r) => (
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
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                              </svg>
                            </button>
                            <button
                              onClick={() => { setEditingMember(m.id); setEditingDept(null); }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-all cursor-pointer"
                              title="Change role"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleRemove(m.id, m.name)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                              title="Remove member"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
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
