import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import PageWrapper from '../../components/layout/PageWrapper';
import { StatCard, LoadingState, STATUS_LABELS, STATUS_BADGES } from './shared';

export default function UnitHeadDashboard() {
  const { activeOrg } = useAuth();
  const [data, setData] = useState(null);
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
          const { data: team } = await api.get(`/analytics/org/${orgId}/team`);
          setData(team);
        }
      } catch (err) {
        console.error('Failed to load team summary:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [activeOrg]);

  if (loading) return <PageWrapper><LoadingState /></PageWrapper>;
  if (!data) {
    return (
      <PageWrapper>
        <p className="text-sm text-slate-400 py-20 text-center">Could not load your team summary.</p>
      </PageWrapper>
    );
  }

  const totalCompleted = data.members.reduce((s, m) => s + (m.workItems?.completed || 0), 0);
  const totalActive = data.members.reduce((s, m) => s + (m.workItems?.active || 0), 0);
  const totalPoints = data.members.reduce((s, m) => s + (m.workItems?.storyPoints || 0), 0);

  return (
    <PageWrapper>
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">My Team</h2>
          <p className="text-sm text-slate-400 mt-1">{data.department} · Unit Head view</p>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="Team Members" value={data.teamSize} delay={0} />
          <StatCard label="Awaiting My Review" value={data.pendingReviews.length} sub="submitted appraisals" delay={0.05} />
          <StatCard label="Tasks Completed" value={totalCompleted} sub={`${totalActive} active`} delay={0.1} />
          <StatCard label="Story Points" value={totalPoints} sub="completed (synced)" delay={0.15} />
        </div>

        {/* ── Pending reviews ── */}
        {data.pendingReviews.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 mb-6"
          >
            <h3 className="text-sm font-semibold text-amber-400 mb-3">
              ⏳ Appraisals waiting for your review
            </h3>
            <div className="space-y-2">
              {data.pendingReviews.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-surface-900/60 border border-white/[0.06] rounded-xl">
                  <div>
                    <span className="text-sm font-medium text-white">{p.employeeName}</span>
                    <span className="text-xs text-slate-500 ml-2">
                      submitted {new Date(p.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <Link
                    to={`/appraisals/${p.id}`}
                    className="px-4 py-1.5 bg-accent-500 hover:bg-accent-400 text-white text-xs font-semibold rounded-lg transition-all"
                  >
                    Review now
                  </Link>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Team table ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-surface-900/60 border border-white/[0.06] rounded-2xl overflow-hidden"
        >
          <h3 className="text-sm font-semibold text-white px-6 pt-5 pb-3">Team Overview</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {['Member', 'Appraisal', 'Grade', 'Done', 'Active', 'Points'].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-slate-500 bg-slate-800/40 first:pl-6">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.members.map((m, i) => (
                  <tr key={m.userId} className={i < data.members.length - 1 ? 'border-b border-white/[0.04]' : ''}>
                    <td className="px-4 py-3 pl-6">
                      <span className="text-sm font-medium text-white block">{m.name}</span>
                      <span className="text-[11px] text-slate-500">{m.email}</span>
                    </td>
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
                    <td className="px-4 py-3 text-sm font-bold text-white">{m.appraisal?.grade || '--'}</td>
                    <td className="px-4 py-3 text-sm text-slate-300 tabular-nums">{m.workItems?.completed ?? '--'}</td>
                    <td className="px-4 py-3 text-sm text-slate-300 tabular-nums">{m.workItems?.active ?? '--'}</td>
                    <td className="px-4 py-3 text-sm text-slate-300 tabular-nums">{m.workItems?.storyPoints ?? '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-600 px-6 py-3">
            Task counts come from the Azure DevOps staff sync. "--" means no synced data for that person yet.
          </p>
        </motion.div>
      </div>
    </PageWrapper>
  );
}
