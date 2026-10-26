import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import PageWrapper from '../../components/layout/PageWrapper';
import {
  StatCard, ChartCard, ChartTooltip, LoadingState,
  GRADE_COLORS, STATUS_LABELS, STATUS_BADGES, getAccentColor400,
} from '../dashboard/shared';

const ROLE_LABELS = {
  admin: 'Administrator',
  lead: 'Unit Head',
  md: 'MD',
  chairman: 'Chairman',
  member: 'Employee',
};

function formatPeriod(from, to) {
  const opts = { month: 'short', year: 'numeric' };
  return `${new Date(from).toLocaleDateString('en-GB', opts)} – ${new Date(to).toLocaleDateString('en-GB', opts)}`;
}

export default function EmployeePerformancePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { activeOrg } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      if (!activeOrg?.id) return;
      try {
        const res = await api.get(`/analytics/org/${activeOrg.id}/staff/${userId}`);
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Could not load this employee');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [activeOrg?.id, userId]);

  if (loading) return <PageWrapper><LoadingState /></PageWrapper>;

  if (error || !data) {
    return (
      <PageWrapper>
        <div className="py-20 text-center">
          <p className="text-sm text-slate-400">{error || 'Could not load this employee.'}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 text-xs text-accent-400 hover:text-accent-300 cursor-pointer"
          >
            Go back
          </button>
        </div>
      </PageWrapper>
    );
  }

  const { employee, summary, appraisals, workItems, levelChanges } = data;
  const accent400 = getAccentColor400();

  // Only completed appraisals carry a meaningful score to trend
  const trend = appraisals
    .filter((a) => a.finalScore > 0)
    .map((a) => ({
      name: new Date(a.reviewPeriodTo).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
      Score: a.finalScore,
    }));

  const latestWork = workItems[0] || null;

  return (
    <PageWrapper>
      <div>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 mb-4 cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>

        {/* ── Who this is ── */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">{employee.name}</h2>
          <div className="flex items-center gap-2 flex-wrap mt-2 text-xs text-slate-400">
            <span>{employee.email}</span>
            <span className="text-slate-700">·</span>
            <span>{ROLE_LABELS[employee.role] || employee.role}</span>
            {employee.department && (
              <>
                <span className="text-slate-700">·</span>
                <span>{employee.department.name}</span>
              </>
            )}
            {employee.level != null && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-violet-500/10 text-violet-300 border-violet-500/20">
                Level {employee.level}
              </span>
            )}
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-sky-500/10 text-sky-400 border-sky-500/20 capitalize">
              {employee.staffType}
            </span>
          </div>
        </div>

        {/* ── Headline numbers ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="Appraisals" value={summary.appraisalsTotal} sub={`${summary.appraisalsCompleted} completed`} delay={0} />
          <StatCard label="Average Score" value={summary.avgScore || '--'} sub="completed only" delay={0.05} />
          <StatCard
            label="Latest Grade"
            value={summary.latestGrade || '--'}
            sub={summary.latestGrade ? `${summary.byGrade[summary.latestGrade]} total at this grade` : 'not graded yet'}
            delay={0.1}
          />
          <StatCard
            label="Tasks Completed"
            value={latestWork?.completedItems ?? '--'}
            sub={latestWork ? `of ${latestWork.totalItems} in last synced period` : 'no synced tasks'}
            delay={0.15}
          />
        </div>

        {/* ── Score over time ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <ChartCard title="Score Over Time" delay={0.1}>
            {trend.length > 1 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trend} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="Score" stroke={accent400} strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-500 text-center py-16">
                {trend.length === 1
                  ? 'Only one scored appraisal so far — a trend needs at least two.'
                  : 'No completed appraisals to chart yet.'}
              </p>
            )}
          </ChartCard>

          <ChartCard title="Level History" delay={0.15}>
            {levelChanges.length > 0 ? (
              <div className="space-y-2">
                {levelChanges.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 text-xs">
                    <TrendingUp className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                    <span className="text-slate-300 font-medium">
                      {c.fromLevel ? `Level ${c.fromLevel}` : 'No level'} &rarr; Level {c.toLevel}
                    </span>
                    <span className="text-slate-600">
                      {new Date(c.createdAt).toLocaleDateString()} · by {c.changedBy}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-16">
                No level changes recorded
                {employee.level != null ? ` — Level ${employee.level} was set when they were added.` : '.'}
              </p>
            )}
          </ChartCard>
        </div>

        {/* ── Every appraisal, not just the latest ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-surface-900/60 border border-white/[0.06] rounded-2xl overflow-hidden mb-6"
        >
          <h3 className="text-sm font-semibold text-white px-6 pt-5 pb-3">Appraisal History</h3>
          {appraisals.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-slate-500">No appraisals raised for this employee yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {['Review Period', 'Status', 'Score', 'MD Score', 'Grade', ''].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-slate-500 bg-slate-800/40 first:pl-6">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...appraisals].reverse().map((a, i, arr) => (
                    <tr key={a.id} className={i < arr.length - 1 ? 'border-b border-white/[0.04]' : ''}>
                      <td className="px-4 py-3 pl-6 text-sm text-slate-300">
                        {formatPeriod(a.reviewPeriodFrom, a.reviewPeriodTo)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_BADGES[a.status] || 'bg-slate-500/10 text-slate-400'}`}>
                          {STATUS_LABELS[a.status] || a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300 tabular-nums">
                        {a.finalScore > 0 ? a.finalScore.toFixed(1) : '--'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400 tabular-nums">{a.mdScore || '--'}</td>
                      <td className="px-4 py-3">
                        {a.grade ? (
                          <span className="text-sm font-bold" style={{ color: GRADE_COLORS[a.grade] || '#fff' }}>{a.grade}</span>
                        ) : (
                          <span className="text-xs text-slate-600">--</span>
                        )}
                      </td>
                      <td className="px-4 py-3 pr-6">
                        <Link to={`/appraisals/${a.id}`} className="text-xs text-accent-400 hover:text-accent-300">
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {/* ── Synced task counts per period ── */}
        {workItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-surface-900/60 border border-white/[0.06] rounded-2xl overflow-hidden"
          >
            <h3 className="text-sm font-semibold text-white px-6 pt-5 pb-3">Azure DevOps Activity</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {['Period', 'Total', 'Completed', 'Active', 'Story Points'].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-slate-500 bg-slate-800/40 first:pl-6">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {workItems.map((w, i) => (
                    <tr key={`${w.periodFrom}-${w.periodTo}`} className={i < workItems.length - 1 ? 'border-b border-white/[0.04]' : ''}>
                      <td className="px-4 py-3 pl-6 text-sm text-slate-300">{formatPeriod(w.periodFrom, w.periodTo)}</td>
                      <td className="px-4 py-3 text-sm text-slate-300 tabular-nums">{w.totalItems}</td>
                      <td className="px-4 py-3 text-sm text-emerald-400 tabular-nums">{w.completedItems}</td>
                      <td className="px-4 py-3 text-sm text-blue-400 tabular-nums">{w.activeItems}</td>
                      <td className="px-4 py-3 text-sm text-slate-300 tabular-nums">{w.totalStoryPoints ?? '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-slate-600 px-6 py-3">
              Counts cover each synced review period, not all time.
            </p>
          </motion.div>
        )}
      </div>
    </PageWrapper>
  );
}
