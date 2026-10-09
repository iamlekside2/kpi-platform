import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import PageWrapper from '../../components/layout/PageWrapper';
import Button from '../../components/ui/Button';
import {
  StatCard, ChartCard, ChartTooltip,
  GRADE_COLORS, STATUS_LABELS, STATUS_COLORS, getAccentColor, getAccentColor400,
} from './shared';
import UnitHeadDashboard from './UnitHeadDashboard';
import ExecutiveDashboard from './ExecutiveDashboard';

// Role-aware entry point: unit heads get a team view, MD/chairman the
// executive overview, everyone else (HR/admin + employees) the org dashboard.
export default function DashboardPage() {
  const { orgRole } = useAuth();
  if (orgRole === 'lead') return <UnitHeadDashboard />;
  if (orgRole === 'md' || orgRole === 'chairman') return <ExecutiveDashboard />;
  return <OrgDashboard />;
}

function OrgDashboard() {
  const { activeOrg } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exportingKPIs, setExportingKPIs] = useState(false);

  useEffect(() => {
    async function loadAnalytics() {
      if (!activeOrg?.id) {
        // Try to get org first
        try {
          const { data: orgs } = await api.get('/orgs');
          if (orgs.length > 0) {
            const { data: summary } = await api.get(`/analytics/org/${orgs[0].id}`);
            setData(summary);
          }
        } catch (err) {
          console.error('Failed to load analytics:', err);
        } finally {
          setLoading(false);
        }
        return;
      }
      try {
        const { data: summary } = await api.get(`/analytics/org/${activeOrg.id}`);
        setData(summary);
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, [activeOrg]);

  async function handleExportKPIs() {
    const orgId = activeOrg?.id;
    if (!orgId) return;
    setExportingKPIs(true);
    try {
      const response = await api.get(`/exports/org/${orgId}/kpis/excel`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `kpis-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('KPI Excel export failed:', err);
    } finally {
      setExportingKPIs(false);
    }
  }

  if (loading) {
    return (
      <PageWrapper>
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-400">Loading dashboard...</span>
          </div>
        </div>
      </PageWrapper>
    );
  }

  if (!data) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-20 h-20 rounded-2xl bg-accent-500/10 border border-accent-500/20 flex items-center justify-center text-3xl mb-6">
            🚀
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Welcome to KPI Platform</h2>
          <p className="text-sm text-slate-400 mb-6">Set up your organisation and add some KPIs to see analytics here.</p>
          <a
            href="/onboarding"
            className="px-6 py-2.5 bg-accent-500 hover:bg-accent-400 text-white text-sm font-semibold rounded-lg shadow-lg shadow-accent-500/20 transition-all"
          >
            Get Started
          </a>
        </div>
      </PageWrapper>
    );
  }

  const { kpi, appraisals } = data;
  const accentColor = getAccentColor();
  const accentColor400 = getAccentColor400();

  // Prepare chart data
  const categoryData = kpi.byCategory.map((c) => ({
    name: c.category,
    'Avg Achievement': c.avgAchievement,
    count: c.count,
  }));

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

  // KPI achievement donut
  const kpiDonut = [
    { name: 'On Target', value: kpi.onTarget },
    { name: 'Below Target', value: Math.max(0, kpi.withValue - kpi.onTarget) },
    { name: 'No Value', value: Math.max(0, kpi.total - kpi.withValue) },
  ].filter((d) => d.value > 0);
  const KPI_DONUT_COLORS = [accentColor, '#f59e0b', '#334155'];

  return (
    <PageWrapper>
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Dashboard</h2>
            {activeOrg && (
              <p className="text-sm text-slate-400 mt-1">{activeOrg.name}</p>
            )}
          </div>
          <Button variant="outline" onClick={handleExportKPIs} disabled={exportingKPIs}>
            {exportingKPIs ? 'Exporting...' : 'Export KPIs'}
          </Button>
        </div>

        {/* ── Summary Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="Total KPIs" value={kpi.total} delay={0} />
          <StatCard label="On Target" value={kpi.onTarget} sub={`of ${kpi.withValue} tracked`} delay={0.05} />
          <StatCard label="Avg Achievement" value={`${kpi.avgAchievement}%`} delay={0.1} />
          <StatCard label="Appraisals" value={appraisals.total} sub={`${appraisals.byStatus.completed} completed`} delay={0.15} />
        </div>

        {/* ── Chart Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* 1. KPI Category Performance */}
          <ChartCard title="KPI Performance by Category" delay={0.1} className="lg:col-span-2">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={categoryData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} domain={[0, 'auto']} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="Avg Achievement" fill={accentColor} radius={[6, 6, 0, 0]} maxBarSize={60} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-500 text-center py-10">No KPI data to display yet.</p>
            )}
          </ChartCard>

          {/* 2. Appraisal Status Pipeline */}
          <ChartCard title="Appraisal Pipeline" delay={0.15}>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span className="text-xs text-slate-400">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-500 text-center py-10">No appraisals yet.</p>
            )}
          </ChartCard>

          {/* 3. Grade Distribution */}
          <ChartCard title="Grade Distribution" delay={0.2}>
            {gradeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={gradeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {gradeData.map((entry) => (
                      <Cell key={entry.grade} fill={GRADE_COLORS[entry.grade] || '#64748b'} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span className="text-xs text-slate-400">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-500 text-center py-10">No graded appraisals yet.</p>
            )}
          </ChartCard>

          {/* 4. Department Performance */}
          <ChartCard title="Performance by Department" delay={0.25}>
            {deptData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={deptData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} domain={[0, 100]} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="Avg Score" fill={accentColor400} radius={[6, 6, 0, 0]} maxBarSize={60} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-500 text-center py-10">No department data yet.</p>
            )}
          </ChartCard>

          {/* 5. KPI Target Achievement */}
          <ChartCard title="KPI Target Achievement" delay={0.3}>
            {kpiDonut.length > 0 ? (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={kpiDonut}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {kpiDonut.map((_, i) => (
                        <Cell key={i} fill={KPI_DONUT_COLORS[i]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-4 mt-2">
                  {kpiDonut.map((entry, i) => (
                    <div key={entry.name} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: KPI_DONUT_COLORS[i] }} />
                      <span className="text-xs text-slate-400">{entry.name} ({entry.value})</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-10">No KPI data to display.</p>
            )}
          </ChartCard>
        </div>
      </div>
    </PageWrapper>
  );
}
