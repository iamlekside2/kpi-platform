import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import PageWrapper from '../../components/layout/PageWrapper';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

const STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  unit_reviewed: 'Unit Reviewed',
  admin_reviewed: 'Admin Reviewed',
  completed: 'Completed',
};

const STATUS_COLORS = {
  draft: 'bg-slate-500/10 text-slate-400',
  submitted: 'bg-amber-500/10 text-amber-400',
  unit_reviewed: 'bg-blue-500/10 text-blue-400',
  admin_reviewed: 'bg-accent-500/10 text-accent-400',
  completed: 'bg-emerald-500/10 text-emerald-400',
};

const DEPT_ICONS = {
  tech: '💻',
  sales: '💰',
  general: '📋',
};

export default function AppraisalsPage() {
  const { orgRole, activeOrg } = useAuth();
  const [appraisals, setAppraisals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [department, setDepartment] = useState('tech');
  const [departments, setDepartments] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [exportingExcel, setExportingExcel] = useState(false);
  const navigate = useNavigate();

  const canCreate = orgRole === 'admin' || orgRole === 'lead';

  useEffect(() => {
    async function load() {
      try {
        if (!activeOrg) {
          // Fallback: load from /orgs if activeOrg not yet set
          const { data: orgs } = await api.get('/orgs');
          if (orgs.length > 0) {
            await loadAppraisals(orgs[0].id);
          }
        } else {
          await loadAppraisals(activeOrg.id);
        }
      } catch (err) {
        console.error('Failed to load appraisals:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [activeOrg]);

  async function loadAppraisals(orgId) {
    const [appraisalRes, structureRes] = await Promise.all([
      api.get(`/appraisals/org/${orgId}`),
      api.get('/appraisals/form-structure'),
    ]);
    setAppraisals(appraisalRes.data);
    setDepartments(structureRes.data.departments || []);
  }

  async function openCreateModal() {
    setShowCreate(true);
    // Load members for employee selection
    if (activeOrg && members.length === 0) {
      try {
        const { data } = await api.get(`/orgs/${activeOrg.id}/members`);
        setMembers(data);
      } catch (err) {
        console.error('Failed to load members:', err);
      }
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    const orgId = activeOrg?.id;
    if (!orgId) return;

    try {
      const { data } = await api.post(`/appraisals/org/${orgId}`, {
        reviewPeriodFrom: periodFrom,
        reviewPeriodTo: periodTo,
        department,
        employeeId: selectedEmployee || undefined,
      });
      setAppraisals([data, ...appraisals]);
      setShowCreate(false);
      setPeriodFrom('');
      setPeriodTo('');
      setDepartment('tech');
      setSelectedEmployee('');
      navigate(`/appraisals/${data.id}`);
    } catch (err) {
      console.error('Failed to create appraisal:', err);
    }
  }

  async function handleExportExcel() {
    if (!activeOrg?.id) return;
    setExportingExcel(true);
    try {
      const response = await api.get(`/exports/org/${activeOrg.id}/appraisals/excel`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `appraisals-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Excel export failed:', err);
    } finally {
      setExportingExcel(false);
    }
  }

  return (
    <PageWrapper>
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Performance Appraisals</h2>
            <p className="text-sm text-slate-400 mt-1">
              {orgRole === 'member'
                ? 'View and complete your performance reviews'
                : 'Create and manage employee performance reviews'}
            </p>
          </div>
          <div className="flex gap-2">
            {canCreate && (
              <Button variant="outline" onClick={handleExportExcel} disabled={exportingExcel}>
                {exportingExcel ? 'Exporting...' : 'Export Excel'}
              </Button>
            )}
            {canCreate && (
              <Button onClick={openCreateModal}>+ New Appraisal</Button>
            )}
          </div>
        </div>

        {/* Create Modal */}
        <AnimatePresence>
          {showCreate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
              onClick={() => setShowCreate(false)}
            >
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                className="bg-surface-900 border border-white/[0.06] rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-bold text-white mb-1">New Performance Appraisal</h3>
                <p className="text-xs text-slate-500 mb-4">Create an appraisal for a staff member</p>

                <form onSubmit={handleCreate}>
                  {/* Employee selector */}
                  <div className="mb-4">
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-2">Employee</label>
                    <select
                      value={selectedEmployee}
                      onChange={(e) => {
                        const empId = e.target.value;
                        setSelectedEmployee(empId);
                        // Auto-fill department from employee's assigned department
                        if (empId) {
                          const member = members.find((m) => m.userId === empId);
                          const slug = member?.department?.slug;
                          if (slug && departments.some((d) => d.key === slug)) {
                            setDepartment(slug);
                          }
                        }
                      }}
                      required
                      className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/[0.06] rounded-lg text-sm text-slate-100 outline-none focus:border-accent-500/50 focus:ring-2 focus:ring-accent-500/20 transition-all appearance-none cursor-pointer"
                    >
                      <option value="" className="bg-slate-800">Select employee...</option>
                      {members.map((m) => (
                        <option key={m.userId} value={m.userId} className="bg-slate-800">
                          {m.name} ({m.email}) — {m.role}{m.department ? ` · ${m.department.name}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Department selector */}
                  <div className="mb-4">
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-2">Department</label>
                    <div className="grid grid-cols-3 gap-2">
                      {departments.map((d) => (
                        <button
                          key={d.key}
                          type="button"
                          onClick={() => setDepartment(d.key)}
                          className={`p-3 rounded-xl border-2 text-center transition-all cursor-pointer
                            ${department === d.key
                              ? 'bg-accent-500/10 border-accent-500/40 shadow-lg shadow-accent-500/5'
                              : 'bg-slate-800/50 border-white/[0.06] hover:border-white/10'}`}
                        >
                          <span className="text-xl block mb-1">{d.icon}</span>
                          <span className="text-[10px] font-semibold text-slate-300 block leading-tight">{d.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Input
                    label="Review Period From"
                    type="date"
                    value={periodFrom}
                    onChange={(e) => setPeriodFrom(e.target.value)}
                    required
                  />
                  <Input
                    label="Review Period To"
                    type="date"
                    value={periodTo}
                    onChange={(e) => setPeriodTo(e.target.value)}
                    required
                  />
                  <div className="flex gap-2 mt-2">
                    <Button type="submit" disabled={!periodFrom || !periodTo || !selectedEmployee}>Create Appraisal</Button>
                    <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Appraisals list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : appraisals.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-white/[0.06] flex items-center justify-center text-2xl mb-4">📋</div>
            <p className="text-sm text-slate-400 mb-4">
              {canCreate
                ? 'No appraisals yet. Create your first performance review.'
                : 'No appraisals assigned to you yet.'}
            </p>
            {canCreate && (
              <Button onClick={openCreateModal}>Create Appraisal</Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {appraisals.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                whileHover={{ scale: 1.005 }}
                onClick={() => navigate(`/appraisals/${a.id}`)}
                className="flex items-center justify-between p-4 bg-surface-900/60 border border-white/[0.06] rounded-xl hover:border-white/10 cursor-pointer transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-accent-500/10 border border-accent-500/20 flex items-center justify-center text-lg">
                    {DEPT_ICONS[a.department] || '📝'}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white flex items-center gap-2">
                      {a.employee?.name || 'Unknown Employee'}
                      <span className="text-[10px] font-medium text-slate-500 bg-white/[0.04] px-1.5 py-0.5 rounded">
                        {a.department === 'tech' ? 'Tech' : a.department === 'sales' ? 'Sales' : 'General'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(a.reviewPeriodFrom).toLocaleDateString()} &mdash; {new Date(a.reviewPeriodTo).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${STATUS_COLORS[a.status] || STATUS_COLORS.draft}`}>
                    {STATUS_LABELS[a.status] || a.status}
                  </span>
                  <span className="text-slate-600">&rarr;</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
