import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import PageWrapper from '../../components/layout/PageWrapper';
import { ChevronDown, ChevronRight, Filter, ScrollText } from 'lucide-react';

// Action badge colours
const ACTION_STYLES = {
  create: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  update: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  delete: 'bg-red-500/10 text-red-400 border-red-500/20',
  status_change: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

const ENTITY_TYPES = ['Appraisal', 'KPI', 'OrgMember', 'Organisation'];
const ACTIONS = ['create', 'update', 'delete', 'status_change'];

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function DiffView({ label, data }) {
  if (!data || typeof data !== 'object' || Object.keys(data).length === 0) return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">{label}</p>
      <div className="space-y-0.5">
        {Object.entries(data).map(([key, val]) => {
          if (val === undefined || val === null) return null;
          return (
            <div key={key} className="flex gap-2 text-xs">
              <span className="text-slate-500 font-medium min-w-[100px]">{key}:</span>
              <span className="text-slate-300 font-mono">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AuditLogsPage() {
  const { activeOrg } = useAuth();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState(null);
  const [filterEntity, setFilterEntity] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const limit = 30;

  useEffect(() => {
    loadLogs();
  }, [activeOrg, offset, filterEntity, filterAction]);

  async function loadLogs() {
    if (!activeOrg?.id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit, offset });
      if (filterEntity) params.set('entityType', filterEntity);
      if (filterAction) params.set('action', filterAction);

      const { data } = await api.get(`/audit-logs/org/${activeOrg.id}?${params}`);
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleFilterChange() {
    setOffset(0); // reset pagination on filter change
  }

  const hasMore = offset + limit < total;
  const hasPrev = offset > 0;

  return (
    <PageWrapper>
      <div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Audit Log</h2>
            <p className="text-sm text-slate-400 mt-1">Track all changes across your organisation</p>
          </div>
          <div className="text-xs text-slate-500">
            {total} total {total === 1 ? 'entry' : 'entries'}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={filterEntity}
              onChange={(e) => { setFilterEntity(e.target.value); handleFilterChange(); }}
              className="bg-surface-900/60 border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-accent-500/50 cursor-pointer"
            >
              <option value="">All Entities</option>
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <select
            value={filterAction}
            onChange={(e) => { setFilterAction(e.target.value); handleFilterChange(); }}
            className="bg-surface-900/60 border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-accent-500/50 cursor-pointer"
          >
            <option value="">All Actions</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>{a.replace('_', ' ')}</option>
            ))}
          </select>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-slate-400">Loading audit logs...</span>
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center py-32 text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-900/60 border border-white/[0.06] flex items-center justify-center mb-4">
              <ScrollText className="w-7 h-7 text-slate-600" />
            </div>
            <p className="text-sm text-slate-400">No audit log entries yet.</p>
            <p className="text-xs text-slate-500 mt-1">Actions like creating appraisals, updating KPIs, and managing staff will appear here.</p>
          </div>
        ) : (
          <>
            {/* Log Table */}
            <div className="bg-surface-900/60 border border-white/[0.06] rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 border-b border-white/[0.06] bg-surface-900/80">
                <div className="col-span-3 text-[10px] uppercase tracking-wider font-semibold text-slate-500">Timestamp</div>
                <div className="col-span-2 text-[10px] uppercase tracking-wider font-semibold text-slate-500">User</div>
                <div className="col-span-1 text-[10px] uppercase tracking-wider font-semibold text-slate-500">Action</div>
                <div className="col-span-2 text-[10px] uppercase tracking-wider font-semibold text-slate-500">Entity</div>
                <div className="col-span-4 text-[10px] uppercase tracking-wider font-semibold text-slate-500">Description</div>
              </div>

              {/* Rows */}
              {logs.map((log, i) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                >
                  {/* Row */}
                  <button
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    className={`w-full text-left grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer
                      ${i < logs.length - 1 ? 'border-b border-white/[0.04]' : ''}
                      ${expandedId === log.id ? 'bg-white/[0.02]' : ''}`}
                  >
                    {/* Timestamp */}
                    <div className="col-span-3 flex items-center gap-2">
                      {expandedId === log.id ? (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      )}
                      <span className="text-xs text-slate-400 tabular-nums">{formatDate(log.createdAt)}</span>
                    </div>

                    {/* User */}
                    <div className="col-span-2">
                      <span className="text-xs text-slate-300 font-medium truncate block">
                        {log.user?.name || log.user?.email || 'Unknown'}
                      </span>
                    </div>

                    {/* Action Badge */}
                    <div className="col-span-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${ACTION_STYLES[log.action] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                        {log.action.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Entity Type */}
                    <div className="col-span-2">
                      <span className="text-xs text-slate-400">{log.entityType}</span>
                    </div>

                    {/* Description */}
                    <div className="col-span-4">
                      <span className="text-xs text-slate-300 line-clamp-1">{log.description}</span>
                    </div>
                  </button>

                  {/* Expanded Details */}
                  <AnimatePresence>
                    {expandedId === log.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-4 pt-1 ml-6 border-b border-white/[0.04]">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-surface-950/50 rounded-xl border border-white/[0.04]">
                            <DiffView label="Previous Values" data={log.oldValues} />
                            <DiffView label="New Values" data={log.newValues} />
                            {!log.oldValues && !log.newValues && (
                              <p className="text-xs text-slate-500 col-span-2">No detailed changes recorded.</p>
                            )}
                            <div className="col-span-2 pt-2 border-t border-white/[0.04]">
                              <span className="text-[10px] text-slate-600 font-mono">ID: {log.entityId}</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-slate-500">
                Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={!hasPrev}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-900/60 border border-white/[0.06] text-slate-400 hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setOffset(offset + limit)}
                  disabled={!hasMore}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-900/60 border border-white/[0.06] text-slate-400 hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </PageWrapper>
  );
}
