import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import PageWrapper from '../../components/layout/PageWrapper';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

const TOOLS = [
  { key: 'ado', name: 'Azure DevOps', icon: '🔷', fields: ['orgUrl', 'accessToken', 'project'] },
  { key: 'jira', name: 'Jira', icon: '🟦', fields: ['orgUrl', 'email', 'accessToken'] },
  { key: 'asana', name: 'Asana', icon: '🟠', fields: ['accessToken', 'projectId'] },
];

const TABS = [
  { key: 'integrations', label: 'Integrations', icon: '🔗' },
  { key: 'alerts', label: 'Alerts', icon: '🔔' },
  { key: 'logs', label: 'Sync History', icon: '📋' },
];

export default function SettingsPage() {
  const [tab, setTab] = useState('integrations');
  const [orgId, setOrgId] = useState(null);
  const [integrations, setIntegrations] = useState([]);
  const [syncLogs, setSyncLogs] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [connectForm, setConnectForm] = useState(null);
  const [formData, setFormData] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    async function load() {
      const { data: orgs } = await api.get('/orgs');
      if (orgs.length > 0) {
        setOrgId(orgs[0].id);
        const [intRes, logRes, kpiRes] = await Promise.all([
          api.get(`/integrations/org/${orgs[0].id}`),
          api.get(`/integrations/org/${orgs[0].id}/logs`),
          api.get(`/kpis/org/${orgs[0].id}`),
        ]);
        setIntegrations(intRes.data);
        setSyncLogs(logRes.data);
        setKpis(kpiRes.data);
      }
    }
    load();
  }, []);

  async function handleConnect(e) {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        tool: connectForm,
        accessToken: formData.accessToken || '',
        orgUrl: formData.orgUrl || '',
        email: formData.email || '',
        fieldMap: {},
      };
      if (formData.project) payload.fieldMap.project = formData.project;
      if (formData.projectId) payload.fieldMap.projectId = formData.projectId;

      const { data } = await api.post(`/integrations/org/${orgId}`, payload);
      setIntegrations((prev) => [data, ...prev]);
      setConnectForm(null);
      setFormData({});
      setSuccess('Integration connected!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to connect');
    }
  }

  async function handleSync(integrationId) {
    try {
      await api.post(`/integrations/${integrationId}/sync`);
      setSuccess('Sync completed!');
      setTimeout(() => setSuccess(''), 3000);
      const { data } = await api.get(`/integrations/org/${orgId}/logs`);
      setSyncLogs(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Sync failed');
    }
  }

  async function handleDeleteIntegration(id) {
    if (!window.confirm('Remove this integration?')) return;
    try {
      await api.delete(`/integrations/${id}`);
      setIntegrations((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete');
    }
  }

  async function toggleAlert(kpiId, enabled) {
    try {
      await api.patch(`/sync/alerts/${kpiId}`, { alertEnabled: enabled });
      setKpis((prev) => prev.map((k) => k.id === kpiId ? { ...k, alertEnabled: enabled } : k));
    } catch (err) {
      console.error('Alert toggle failed:', err);
    }
  }

  async function setThreshold(kpiId, threshold) {
    try {
      await api.patch(`/sync/alerts/${kpiId}`, { alertThreshold: threshold });
      setKpis((prev) => prev.map((k) => k.id === kpiId ? { ...k, alertThreshold: parseFloat(threshold) } : k));
    } catch (err) {
      console.error('Threshold update failed:', err);
    }
  }

  return (
    <PageWrapper>
      <div className="max-w-4xl">
        <h2 className="text-2xl font-bold text-white mb-6">Settings</h2>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-slate-900/60 border border-white/[0.06] rounded-xl mb-6 w-fit">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 cursor-pointer
                ${tab === t.key
                  ? 'bg-indigo-500/15 text-indigo-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'}`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Messages */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400"
            >
              {error}
            </motion.div>
          )}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-400"
            >
              {success}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Integrations Tab */}
        {tab === 'integrations' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {TOOLS.map((tool, i) => {
                const connected = integrations.find((ig) => ig.tool === tool.key);
                return (
                  <motion.div
                    key={tool.key}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`bg-slate-900/60 border rounded-xl p-5 transition-all
                      ${connected
                        ? 'border-emerald-500/30 shadow-sm shadow-emerald-500/5'
                        : 'border-white/[0.06] hover:border-white/10'}`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{tool.icon}</span>
                      <h3 className="text-base font-semibold text-white">{tool.name}</h3>
                    </div>

                    {connected ? (
                      <div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full
                          ${connected.status === 'connected'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-red-500/10 text-red-400'}`}>
                          {connected.status}
                        </span>
                        {connected.lastSyncedAt && (
                          <p className="text-[11px] text-slate-500 mt-2">
                            Last synced: {new Date(connected.lastSyncedAt).toLocaleString()}
                          </p>
                        )}
                        <div className="flex gap-2 mt-3">
                          <Button onClick={() => handleSync(connected.id)}>Sync Now</Button>
                          <Button variant="danger" onClick={() => handleDeleteIntegration(connected.id)}>Disconnect</Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="outline" onClick={() => { setConnectForm(tool.key); setFormData({}); }}>
                        Connect
                      </Button>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Connect Form Modal */}
            <AnimatePresence>
              {connectForm && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                  onClick={() => setConnectForm(null)}
                >
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    className="bg-slate-900 border border-white/[0.06] rounded-2xl p-6 w-full max-w-md shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 className="text-lg font-bold text-white mb-4">
                      Connect {TOOLS.find((t) => t.key === connectForm)?.name}
                    </h3>
                    <form onSubmit={handleConnect}>
                      {TOOLS.find((t) => t.key === connectForm)?.fields.map((field) => (
                        <Input
                          key={field}
                          label={field === 'orgUrl' ? 'Organisation URL / Domain' : field === 'accessToken' ? 'Access Token / PAT' : field.charAt(0).toUpperCase() + field.slice(1)}
                          type={field === 'accessToken' ? 'password' : 'text'}
                          value={formData[field] || ''}
                          onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                          required={field === 'accessToken'}
                        />
                      ))}
                      <div className="flex gap-2 mt-2">
                        <Button type="submit">Connect</Button>
                        <Button variant="secondary" onClick={() => setConnectForm(null)}>Cancel</Button>
                      </div>
                    </form>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Alerts Tab */}
        {tab === 'alerts' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="text-sm text-slate-400 mb-4">Enable alerts to get notified when KPIs cross a threshold.</p>
            <div className="space-y-2">
              {kpis.map((kpi, i) => (
                <motion.div
                  key={kpi.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center justify-between p-4 bg-slate-900/60 border border-white/[0.06] rounded-xl hover:border-white/10 transition-all"
                >
                  <div>
                    <span className="text-sm font-semibold text-white">{kpi.name}</span>
                    <span className="text-xs text-slate-500 ml-2">{kpi.value ?? '--'} {kpi.unit}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={kpi.alertEnabled}
                          onChange={(e) => toggleAlert(kpi.id, e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-white/[0.08] rounded-full peer-checked:bg-indigo-500/40 transition-colors" />
                        <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-slate-400 rounded-full peer-checked:bg-indigo-400 peer-checked:translate-x-4 transition-all" />
                      </div>
                      <span className="text-xs text-slate-400">Alert</span>
                    </label>
                    {kpi.alertEnabled && (
                      <input
                        type="number"
                        className="w-20 px-2 py-1 bg-slate-800/80 border border-white/[0.08] rounded-lg text-xs text-slate-300 outline-none focus:border-indigo-500/50 transition-all"
                        value={kpi.alertThreshold ?? ''}
                        placeholder="Threshold"
                        onBlur={(e) => e.target.value && setThreshold(kpi.id, e.target.value)}
                        onChange={() => {}}
                      />
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Sync Logs Tab */}
        {tab === 'logs' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {syncLogs.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-800/50 border border-white/[0.06] flex items-center justify-center text-2xl mb-4">
                  📋
                </div>
                <p className="text-sm text-slate-400">No sync history yet.</p>
              </div>
            ) : (
              <div className="bg-slate-900/60 border border-white/[0.06] rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-slate-500 bg-slate-800/40">Tool</th>
                      <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-slate-500 bg-slate-800/40">Status</th>
                      <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-slate-500 bg-slate-800/40">Rows</th>
                      <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-slate-500 bg-slate-800/40">Time</th>
                      <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-slate-500 bg-slate-800/40">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncLogs.map((log, i) => (
                      <tr key={log.id} className={i < syncLogs.length - 1 ? 'border-b border-white/[0.04]' : ''}>
                        <td className="px-4 py-3 text-sm text-slate-300 font-medium">{log.integration?.tool?.toUpperCase()}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full
                            ${log.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-400 tabular-nums">{log.rowsUpdated}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{new Date(log.createdAt).toLocaleString()}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{log.errorMessage || '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </PageWrapper>
  );
}
