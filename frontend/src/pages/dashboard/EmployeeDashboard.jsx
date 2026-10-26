import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { ClipboardList, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import PageWrapper from '../../components/layout/PageWrapper';
import {
  StatCard, ChartCard, ChartTooltip, LoadingState,
  GRADE_COLORS, STATUS_LABELS, STATUS_BADGES, getAccentColor400,
} from './shared';

const GRADE_MEANING = {
  A: 'Outstanding performance',
  B: 'Exceeds expectations',
  C: 'Meets expectations',
  D: 'Below expectations',
};

// What the employee should do, or wait for, at each stage
const STAGE_NOTE = {
  draft: { text: 'Yours to complete. Fill in every section and submit it.', Icon: AlertCircle, tone: 'text-amber-300', action: 'Complete it' },
  submitted: { text: 'With your unit head for review.', Icon: Clock, tone: 'text-slate-400', action: 'View' },
  unit_reviewed: { text: 'Reviewed by your unit head, now with HR.', Icon: Clock, tone: 'text-slate-400', action: 'View' },
  admin_reviewed: { text: 'With the Managing Director for final scoring.', Icon: Clock, tone: 'text-slate-400', action: 'View' },
  completed: { text: 'Finalised. Your result is ready.', Icon: CheckCircle2, tone: 'text-emerald-400', action: 'See your result' },
};

function formatPeriod(from, to) {
  const o = { month: 'short', year: 'numeric' };
  return `${new Date(from).toLocaleDateString('en-GB', o)} – ${new Date(to).toLocaleDateString('en-GB', o)}`;
}

export default function EmployeeDashboard() {
  const { user, activeOrg } = useAuth();
  const [appraisals, setAppraisals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!activeOrg?.id) return;
      try {
        const { data } = await api.get(`/appraisals/org/${activeOrg.id}/my`);
        setAppraisals(data);
      } catch (err) {
        console.error('Failed to load your appraisals:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [activeOrg?.id]);

  if (loading) return <PageWrapper><LoadingState /></PageWrapper>;

  const accent400 = getAccentColor400();
  const open = appraisals.filter((a) => a.status !== 'completed');
  const completed = appraisals.filter((a) => a.status === 'completed');
  // getEmployeeAppraisals returns newest first
  const latest = completed[0] || null;
  const needsMe = open.find((a) => a.status === 'draft') || null;

  const avg = completed.length > 0
    ? Math.round((completed.reduce((s, a) => s + (a.finalScore || 0), 0) / completed.length) * 10) / 10
    : 0;

  const trend = [...completed]
    .reverse()
    .filter((a) => a.finalScore > 0)
    .map((a) => ({
      name: new Date(a.reviewPeriodTo).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
      Score: a.finalScore,
    }));

  return (
    <PageWrapper>
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">
            {user?.name ? `Hello, ${user.name.split(' ')[0]}` : 'Your performance'}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {activeOrg?.name} · your appraisals and results
          </p>
        </div>

        {/* ── Anything waiting on you ── */}
        {needsMe && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between gap-4 flex-wrap bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 mb-6"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-amber-300 font-semibold">
                  Your self-assessment for {formatPeriod(needsMe.reviewPeriodFrom, needsMe.reviewPeriodTo)} is waiting on you
                </p>
                {needsMe.returnReason && (
                  <p className="text-xs text-amber-200/80 mt-1">
                    Sent back: {needsMe.returnReason}
                  </p>
                )}
              </div>
            </div>
            <Link
              to={`/appraisals/${needsMe.id}`}
              className="px-4 py-2 bg-accent-500 hover:bg-accent-400 text-white text-xs font-semibold rounded-lg transition-all shrink-0"
            >
              Complete it
            </Link>
          </motion.div>
        )}

        {/* ── Your numbers ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard
            label="Latest Grade"
            value={latest?.grade || '--'}
            sub={latest ? GRADE_MEANING[latest.grade] : 'no completed appraisal yet'}
            delay={0}
          />
          <StatCard
            label="Latest Score"
            value={latest?.finalScore?.toFixed(1) ?? '--'}
            sub={latest ? formatPeriod(latest.reviewPeriodFrom, latest.reviewPeriodTo) : 'out of 100'}
            delay={0.05}
          />
          <StatCard label="Average Score" value={avg || '--'} sub={`${completed.length} completed`} delay={0.1} />
          <StatCard label="In Progress" value={open.length} sub={open.length ? 'not finalised yet' : 'nothing open'} delay={0.15} />
        </div>

        {/* ── Where each one stands ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-surface-900/60 border border-white/[0.06] rounded-2xl overflow-hidden mb-6"
        >
          <h3 className="text-sm font-semibold text-white px-6 pt-5 pb-3">Your appraisals</h3>
          {appraisals.length === 0 ? (
            <div className="px-6 pb-8 pt-2 text-center">
              <ClipboardList className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No appraisal has been raised for you yet.</p>
              <p className="text-xs text-slate-500 mt-1">Your unit head or HR will start one when the review cycle opens.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {appraisals.map((a) => {
                const note = STAGE_NOTE[a.status] || STAGE_NOTE.submitted;
                return (
                  <div key={a.id} className="flex items-center justify-between gap-4 px-6 py-4 flex-wrap">
                    <div className="flex items-start gap-3 min-w-0">
                      <note.Icon className={`w-4 h-4 mt-0.5 shrink-0 ${note.tone}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-white">
                            {formatPeriod(a.reviewPeriodFrom, a.reviewPeriodTo)}
                          </span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_BADGES[a.status] || 'bg-slate-500/10 text-slate-400'}`}>
                            {STATUS_LABELS[a.status] || a.status}
                          </span>
                          {a.grade && (
                            <span className="text-sm font-bold" style={{ color: GRADE_COLORS[a.grade] || '#fff' }}>
                              {a.grade}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{note.text}</p>
                      </div>
                    </div>
                    <Link
                      to={`/appraisals/${a.id}`}
                      className="text-xs font-semibold text-accent-400 hover:text-accent-300 shrink-0"
                    >
                      {note.action}
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* ── Your score over time ── */}
        {trend.length > 1 && (
          <ChartCard title="Your score over time" delay={0.2}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trend} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
                <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="Score" stroke={accent400} strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>
    </PageWrapper>
  );
}
