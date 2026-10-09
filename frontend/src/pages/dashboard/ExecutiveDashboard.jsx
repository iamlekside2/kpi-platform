import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import PageWrapper from '../../components/layout/PageWrapper';
import {
  StatCard, ChartCard, ChartTooltip, LoadingState,
  GRADE_COLORS, STATUS_LABELS, STATUS_COLORS, STATUS_BADGES, getAccentColor400,
} from './shared';

export default function ExecutiveDashboard() {
  const { activeOrg, orgRole } = useAuth();
  const [summary, setSummary] = useState(null);
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        let orgId = activeOrg?.id;
        if (!orgId) {
          const { data: orgs } = await api.get('/orgs');
          orgId = orgs[0]?.id;
        }
        if (orgId) {
          const [s, p] = await Promise.all([
            api.get(`/analytics/org/${orgId}`),
            api.get(`/analytics/org/${orgId}/staff-performance`),
          ]);
          setSummary(s.data);
          setStaff(p.data);
        }
      } catch (err) {
        console.error('Failed to load executive dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [activeOrg]);

  if (loading) return <PageWrapper><LoadingState /></PageWrapper>;
  if (!summary || !staff) {
    return (
      <PageWrapper>
        <p className="text-sm text-slate-400 py-20 text-center">Could not load the executive dashboard.</p>
      </PageWrapper>
    );
  }

  const { appraisals } = summary;
  const accent400 = getAccentColor400();

  const statusData = Object.entries(appraisals.byStatus)
    .map(([status, count]) => ({ name: STATUS_LABELS[status] || status, value: count }))
    .filter((d) => d.value > 0);

  const gradeData = Object.entries(appraisals.byGrade)
    .map(([grade, count]) => ({ name: `Grade ${grade}`, grade, value: count }))
    .filter((d) => d.value > 0);

  const deptData = appraisals.byDepartment.map((d) => ({
    name: d.department,
    'Avg Score': d.avgScore,
    count: d.count,
  }));

  const completionPct = appraisals.total > 0
    ? Math.round((appraisals.byStatus.completed / appraisals.total) * 100)
    : 0;

  // Sort staff: completed grades first (best score desc), then by name
  const sortedStaff = [...staff.members].sort((a, b) => {
    const sa = a.appraisal?.finalScore || 0;
    const sb = b.appraisal?.finalScore || 0;
    if (sb !== sa) return sb - sa;
    return a.name.localeCompare(b.name);
  });

  return (
    <PageWrapper>
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">Executive Overview</h2>
          <p className="text-sm text-slate-400 mt-1">
            {activeOrg?.name} · {orgRole === 'md' ? 'Managing Director' : 'Chairman'} view
          </p>
        </div>

        {/* ── Company stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="Staff" value={staff.staffCount} delay={0} />
          <StatCard label="Appraisal Completion" value={`${completionPct}%`} sub={`${appraisals.byStatus.completed} of ${appraisals.total}`} delay={0.05} />
          <StatCard label="Avg Final Score" value={appraisals.avgScore || '--'} sub="completed appraisals" delay={0.1} />
          <StatCard label="Awaiting MD Review" value={staff.awaitingMd} sub={orgRole === 'md' ? 'your action needed' : 'with the MD'} delay={0.15} />
        </div>

        {/* ── MD call-to-action ── */}
        {orgRole === 'md' && staff.awaitingMd > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between bg-purple-500/5 border border-purple-500/20 rounded-2xl p-5 mb-6"
          >
            <p className="text-sm text-purple-300">
              <span className="font-semibold">{staff.awaitingMd} appraisal{staff.awaitingMd > 1 ? 's' : ''}</span> awaiting your final comments and score.
            </p>
            <Link
              to="/appraisals"
              className="px-4 py-2 bg-accent-500 hover:bg-accent-400 text-white text-xs font-semibold rounded-lg transition-all"
            >
              Open Appraisals
            </Link>
          </motion.div>
        )}

        {/* ── Charts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <ChartCard title="Grade Distribution" delay={0.1}>
            {gradeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie data={gradeData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} dataKey="value">
                    {gradeData.map((entry) => (
                      <Cell key={entry.grade} fill={GRADE_COLORS[entry.grade] || '#64748b'} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend verticalAlign="bottom" iconType="circle" iconSize={8}
                    formatter={(value) => <span className="text-xs text-slate-400">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-500 text-center py-10">No graded appraisals yet.</p>
            )}
          </ChartCard>

          <ChartCard title="Appraisal Pipeline" delay={0.15}>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} dataKey="value">
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend verticalAlign="bottom" iconType="circle" iconSize={8}
                    formatter={(value) => <span className="text-xs text-slate-400">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-500 text-center py-10">No appraisals yet.</p>
            )}
          </ChartCard>

          <ChartCard title="Performance by Department" delay={0.2}>
            {deptData.length > 0 ? (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={deptData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} domain={[0, 100]} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="Avg Score" fill={accent400} radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-500 text-center py-10">No department data yet.</p>
            )}
          </ChartCard>
        </div>

        {/* ── Staff performance table ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-surface-900/60 border border-white/[0.06] rounded-2xl overflow-hidden"
        >
          <h3 className="text-sm font-semibold text-white px-6 pt-5 pb-3">Staff Performance</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {['Staff', 'Department', 'Appraisal', 'Score', 'Grade', 'Tasks Done', 'Points'].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-slate-500 bg-slate-800/40 first:pl-6">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedStaff.map((m, i) => (
                  <tr key={m.userId} className={i < sortedStaff.length - 1 ? 'border-b border-white/[0.04]' : ''}>
                    <td className="px-4 py-3 pl-6">
                      <span className="text-sm font-medium text-white block">{m.name}</span>
                      <span className="text-[11px] text-slate-500 capitalize">{m.role}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">{m.department || '--'}</td>
                    <td className="px-4 py-3">
                      {m.appraisal ? (
                        <Link to={`/appraisals/${m.appraisal.id}`}>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_BADGES[m.appraisal.status] || 'bg-slate-500/10 text-slate-400'}`}>
                            {STATUS_LABELS[m.appraisal.status] || m.appraisal.status}
                          </span>
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-600">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300 tabular-nums">
                      {m.appraisal?.finalScore ? m.appraisal.finalScore.toFixed(1) : '--'}
                    </td>
                    <td className="px-4 py-3">
                      {m.appraisal?.grade ? (
                        <span className="text-sm font-bold" style={{ color: GRADE_COLORS[m.appraisal.grade] || '#fff' }}>
                          {m.appraisal.grade}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300 tabular-nums">{m.workItems?.completed ?? '--'}</td>
                    <td className="px-4 py-3 text-sm text-slate-300 tabular-nums">{m.workItems?.storyPoints ?? '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-600 px-6 py-3">
            Scores and grades come from completed appraisals; task counts from the Azure DevOps staff sync.
          </p>
        </motion.div>
      </div>
    </PageWrapper>
  );
}
