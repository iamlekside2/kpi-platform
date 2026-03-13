import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import PageWrapper from '../../components/layout/PageWrapper';
import KPIGrid from '../../components/kpi/KPIGrid';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

export default function DashboardPage() {
  const { orgRole } = useAuth();
  const canManageKpis = orgRole === 'admin' || orgRole === 'lead';
  const [orgs, setOrgs] = useState([]);
  const [activeOrg, setActiveOrg] = useState(null);
  const [kpis, setKpis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddKpi, setShowAddKpi] = useState(false);
  const [newKpi, setNewKpi] = useState({ name: '', unit: '', target: '', category: '', description: '' });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const { data: userOrgs } = await api.get('/orgs');
      setOrgs(userOrgs);

      if (userOrgs.length > 0) {
        const { data: orgData } = await api.get(`/orgs/${userOrgs[0].id}`);
        setActiveOrg(orgData);
        setKpis(orgData.kpis || []);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleKpiUpdate(updatedKpi) {
    setKpis((prev) => prev.map((k) => (k.id === updatedKpi.id ? updatedKpi : k)));
  }

  async function handleKpiDelete(kpiId) {
    if (!window.confirm('Delete this KPI?')) return;
    try {
      await api.delete(`/kpis/${kpiId}`);
      setKpis((prev) => prev.filter((k) => k.id !== kpiId));
    } catch (err) {
      console.error('Failed to delete KPI:', err);
    }
  }

  async function handleAddKpi(e) {
    e.preventDefault();
    try {
      const { data } = await api.post(`/kpis/org/${activeOrg.id}`, newKpi);
      setKpis((prev) => [...prev, data]);
      setNewKpi({ name: '', unit: '', target: '', category: '', description: '' });
      setShowAddKpi(false);
    } catch (err) {
      console.error('Failed to add KPI:', err);
    }
  }

  return (
    <PageWrapper>
      <div>
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-slate-400">Loading dashboard...</span>
            </div>
          </div>
        ) : !activeOrg ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-20 h-20 rounded-2xl bg-accent-500/10 border border-accent-500/20 flex items-center justify-center text-3xl mb-6">
              🚀
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Welcome to KPI Platform</h2>
            <p className="text-sm text-slate-400 mb-6">You haven't set up an organisation yet.</p>
            <a
              href="/onboarding"
              className="px-6 py-2.5 bg-accent-500 hover:bg-accent-400 text-white text-sm font-semibold rounded-lg shadow-lg shadow-accent-500/20 transition-all"
            >
              Get Started
            </a>
          </div>
        ) : (
          <>
            {/* Dashboard Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-2">
              <div>
                <h2 className="text-2xl font-bold text-white">{activeOrg.name}</h2>
                <p className="text-sm text-slate-400 mt-1">
                  {activeOrg.industry
                    ? activeOrg.industry.split(',').map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ')
                    : 'No template'}
                </p>
              </div>
              <div className="flex items-center gap-4">
                {/* Stats */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center px-4 py-2 bg-slate-900/60 border border-white/[0.06] rounded-xl">
                    <span className="text-lg font-bold text-white tabular-nums">{kpis.length}</span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">KPIs</span>
                  </div>
                  <div className="flex flex-col items-center px-4 py-2 bg-slate-900/60 border border-white/[0.06] rounded-xl">
                    <span className="text-lg font-bold text-white tabular-nums">{activeOrg.members?.length || 0}</span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Members</span>
                  </div>
                </div>
                {canManageKpis && <Button onClick={() => setShowAddKpi(true)}>+ Add KPI</Button>}
              </div>
            </div>

            {/* Add KPI Modal */}
            <AnimatePresence>
              {showAddKpi && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                  onClick={() => setShowAddKpi(false)}
                >
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="bg-slate-900 border border-white/[0.06] rounded-2xl p-6 w-full max-w-md shadow-2xl shadow-black/30"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 className="text-lg font-bold text-white mb-4">Add Custom KPI</h3>
                    <form onSubmit={handleAddKpi}>
                      <Input label="Name" value={newKpi.name} onChange={(e) => setNewKpi({...newKpi, name: e.target.value})} required />
                      <Input label="Unit" value={newKpi.unit} onChange={(e) => setNewKpi({...newKpi, unit: e.target.value})} placeholder="e.g. %, $, count" required />
                      <Input label="Target" type="number" value={newKpi.target} onChange={(e) => setNewKpi({...newKpi, target: e.target.value})} />
                      <Input label="Category" value={newKpi.category} onChange={(e) => setNewKpi({...newKpi, category: e.target.value})} placeholder="e.g. Performance" />
                      <Input label="Description" value={newKpi.description} onChange={(e) => setNewKpi({...newKpi, description: e.target.value})} />
                      <div className="flex gap-2 mt-2">
                        <Button type="submit">Add KPI</Button>
                        <Button variant="secondary" onClick={() => setShowAddKpi(false)}>Cancel</Button>
                      </div>
                    </form>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <KPIGrid kpis={kpis} onUpdate={handleKpiUpdate} onDelete={canManageKpis ? handleKpiDelete : null} />
          </>
        )}
      </div>
    </PageWrapper>
  );
}
