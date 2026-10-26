import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  AlertTriangle, CheckCircle2, Clock, Plug, Users, ScrollText,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import PageWrapper from '../../components/layout/PageWrapper';
import {
  StatCard, ChartCard, ChartTooltip, LoadingState,
  STATUS_LABELS, STATUS_COLORS,
} from './shared';

const TOOL_LABELS = { ado: 'Azure DevOps', jira: 'Jira', asana: 'Asana' };

function relativeTime(value) {
  if (!value) return 'never';
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}

// A gap worth an admin's attention: a count, who it affects, and where to fix it.
function GapRow({ icon: Icon, tone, label, names, to, linkLabel }) {
  const tones = {
    warn: 'text-amber-400 bg-amber-500/10',
    bad: 'text-red-400 bg-red-500/10',
    ok: 'text-emerald-400 bg-emerald-500/10',
  };
  return (
    <div className="flex items-start gap-3 py-3 border-b border-white/[0.04] last:border-0">
      <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${tones[tone]}`}>
        <Icon className="w-3.5 h-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-200">{label}</p>
        {names?.length > 0 && (
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {names.slice(0, 4).join(', ')}
            {names.length > 4 && ` +${names.length - 4} more`}
          </p>
        )}
      </div>
      {to && (
        <Link to={to} className="text-xs font-semibold text-accent-400 hover:text-accent-300 shrink-0">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const { activeOrg } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        let orgId = activeOrg?.id;
        if (!orgId) {
          const { data: orgs } = await api.get('/orgs');
          orgId = orgs[0]?.id;
        }
        if (!orgId) {
          setError('No organisation found for your account.');
          return;
        }
        const { data: summary } = await api.get(`/analytics/org/${orgId}/admin-summary`);
        setData(summary);
      } catch (err) {
        console.error('Failed to load admin dashboard:', err);
        setError(err.response?.data?.error || 'Could not load the admin dashboard.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [activeOrg]);

  if (loading) return <PageWrapper><LoadingState /></PageWrapper>;
  if (error || !data) {
    return (
      <PageWrapper>
        <p className="text-sm text-slate-400 py-20 text-center">{error || 'Could not load the admin dashboard.'}</p>
      </PageWrapper>
    );
  }

  const { staff, appraisals, kpis, integrations, unsyncedStaff, recentActivity } = data;
  const queue = appraisals.awaitingAdminReview;
  // The HR stage belongs to the named HR officer, who may not be this admin
  const isHrOfficer = appraisals.viewerIsHrOfficer;
  const hrOfficerName = appraisals.hrOfficerName;

  const pipelineData = Object.entries(appraisals.byStatus).map(([status, count], i) => ({
    name: STATUS_LABELS[status] || status,
    count,
    fill: STATUS_COLORS[i % STATUS_COLORS.length],
  }));

  const completionPct = appraisals.total > 0
    ? Math.round((appraisals.byStatus.completed / appraisals.total) * 100)
    : 0;

  const brokenIntegrations = integrations.filter(
    (i) => i.status === 'error' || i.lastSync?.status === 'failure'
  );

  return (
    <PageWrapper>
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">Admin Console</h2>
          <p className="text-sm text-slate-400 mt-1">{data.orgName} · Administrator view</p>
        </div>

        {/* ── Headline stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard
            label={isHrOfficer ? 'Awaiting Your Review' : 'Awaiting HR'}
            value={queue.length}
            sub={queue.length === 0
              ? 'queue is clear'
              : isHrOfficer ? 'your action needed' : `with ${hrOfficerName || 'the HR officer'}`}
            delay={0}
          />
          <StatCard label="Staff" value={staff.total} sub={`${staff.byRole.admin} admin · ${staff.byRole.lead} lead`} delay={0.05} />
          <StatCard label="Appraisal Completion" value={`${completionPct}%`} sub={`${appraisals.byStatus.completed} of ${appraisals.total}`} delay={0.1} />
          <StatCard label="KPIs Tracked" value={kpis.total} sub={`${kpis.missingValue} with no value`} delay={0.15} />
        </div>

        {/* ── Admin action queue ── */}
        {queue.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`border rounded-2xl p-5 mb-6 ${isHrOfficer
              ? 'bg-amber-500/5 border-amber-500/20'
              : 'bg-white/[0.02] border-white/[0.06]'}`}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className={`text-sm font-semibold ${isHrOfficer ? 'text-amber-300' : 'text-slate-300'}`}>
                {queue.length} appraisal{queue.length > 1 ? 's' : ''} unit-reviewed and waiting on{' '}
                {isHrOfficer ? 'your comment' : `${hrOfficerName || 'the HR officer'}`}
              </h3>
              <Link to="/appraisals" className="text-xs font-semibold text-accent-400 hover:text-accent-300">
                View all
              </Link>
            </div>
            <div className="flex flex-col gap-1.5">
              {queue.slice(0, 6).map((a) => (
                <Link
                  key={a.id}
                  to={`/appraisals/${a.id}`}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
                >
                  <span className="text-sm text-slate-200">{a.employeeName}</span>
                  <span className="text-xs text-slate-500 capitalize">
                    {a.department} · {relativeTime(a.updatedAt)}
                  </span>
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* ── Setup gaps ── */}
          <ChartCard title="Setup Gaps" delay={0.1}>
            {staff.noDepartment.length === 0 && staff.noAppraisal.length === 0
              && kpis.missingTarget === 0 && kpis.stale.length === 0 ? (
              <div className="flex items-center gap-2 py-8 justify-center text-sm text-slate-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Everything is set up — no gaps found.
              </div>
            ) : (
              <div>
                {staff.noDepartment.length > 0 && (
                  <GapRow
                    icon={Users}
                    tone="warn"
                    label={`${staff.noDepartment.length} staff with no department`}
                    names={staff.noDepartment.map((m) => m.name)}
                    to="/staff"
                    linkLabel="Assign"
                  />
                )}
                {staff.noAppraisal.length > 0 && (
                  <GapRow
                    icon={Clock}
                    tone="warn"
                    label={`${staff.noAppraisal.length} staff with no appraisal yet`}
                    names={staff.noAppraisal.map((m) => m.name)}
                    to="/appraisals"
                    linkLabel="Create"
                  />
                )}
                {kpis.missingTarget > 0 && (
                  <GapRow
                    icon={AlertTriangle}
                    tone="warn"
                    label={`${kpis.missingTarget} KPI${kpis.missingTarget > 1 ? 's' : ''} with no target set`}
                    to="/kpis"
                    linkLabel="Set targets"
                  />
                )}
                {kpis.stale.length > 0 && (
                  <GapRow
                    icon={Clock}
                    tone="warn"
                    label={`${kpis.stale.length} KPI${kpis.stale.length > 1 ? 's' : ''} not updated in ${kpis.staleAfterDays} days`}
                    names={kpis.stale.map((k) => k.name)}
                    to="/kpis"
                    linkLabel="Review"
                  />
                )}
              </div>
            )}
          </ChartCard>

          {/* ── Appraisal pipeline ── */}
          <ChartCard title="Appraisal Pipeline" delay={0.15}>
            {appraisals.total > 0 ? (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={pipelineData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {pipelineData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-500 text-center py-10">No appraisals yet.</p>
            )}
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── Integration health ── */}
          <ChartCard title="Integration Health" delay={0.2}>
            {integrations.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-slate-500">No integrations connected.</p>
                <Link to="/settings" className="text-xs font-semibold text-accent-400 hover:text-accent-300 mt-2 inline-block">
                  Connect a tool
                </Link>
              </div>
            ) : (
              <div>
                {integrations.map((i) => {
                  const failed = i.status === 'error' || i.lastSync?.status === 'failure';
                  return (
                    <div key={i.id} className="flex items-start gap-3 py-3 border-b border-white/[0.04] last:border-0">
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${failed ? 'text-red-400 bg-red-500/10' : 'text-emerald-400 bg-emerald-500/10'}`}>
                        <Plug className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-200">{TOOL_LABELS[i.tool] || i.tool}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Last synced {relativeTime(i.lastSyncedAt)}
                          {i.lastSync?.status === 'success' && ` · ${i.lastSync.rowsUpdated} rows`}
                        </p>
                        {failed && i.lastSync?.errorMessage && (
                          <p className="text-xs text-red-400/80 mt-1 break-words">{i.lastSync.errorMessage}</p>
                        )}
                      </div>
                      <Link to="/settings" className="text-xs font-semibold text-accent-400 hover:text-accent-300 shrink-0">
                        Manage
                      </Link>
                    </div>
                  );
                })}
                {unsyncedStaff.length > 0 && (
                  <GapRow
                    icon={AlertTriangle}
                    tone="bad"
                    label={`${unsyncedStaff.length} staff never matched by the sync`}
                    names={unsyncedStaff.map((m) => m.name)}
                    to="/staff"
                    linkLabel="Fix emails"
                  />
                )}
              </div>
            )}
          </ChartCard>

          {/* ── Recent activity ── */}
          <ChartCard title="Recent Activity" delay={0.25}>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-10">No activity logged yet.</p>
            ) : (
              <>
                <div className="flex flex-col">
                  {recentActivity.map((l) => (
                    <div key={l.id} className="flex items-start gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
                      <span className="w-7 h-7 rounded-lg bg-white/[0.04] text-slate-400 flex items-center justify-center shrink-0">
                        <ScrollText className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-300 truncate">{l.description}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {l.userName} · {relativeTime(l.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <Link to="/audit-logs" className="text-xs font-semibold text-accent-400 hover:text-accent-300 mt-3 inline-block">
                  Open full audit log
                </Link>
              </>
            )}
          </ChartCard>
        </div>

        {brokenIntegrations.length > 0 && (
          <p className="text-[11px] text-slate-600 mt-4">
            Sync failures stop staff task counts from updating, which leaves appraisal work-item figures stale.
          </p>
        )}
      </div>
    </PageWrapper>
  );
}
