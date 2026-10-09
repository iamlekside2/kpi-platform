import { motion } from 'framer-motion';

// Grade colours
export const GRADE_COLORS = { A: '#10b981', B: '#3b82f6', C: '#f59e0b', D: '#ef4444' };

// Status labels + badge styles
export const STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  unit_reviewed: 'Unit Reviewed',
  admin_reviewed: 'Admin Reviewed',
  completed: 'Completed',
};
export const STATUS_COLORS = ['#64748b', '#818cf8', '#f59e0b', '#3b82f6', '#10b981'];
export const STATUS_BADGES = {
  draft: 'bg-slate-500/10 text-slate-400',
  submitted: 'bg-indigo-500/10 text-indigo-400',
  unit_reviewed: 'bg-amber-500/10 text-amber-400',
  admin_reviewed: 'bg-blue-500/10 text-blue-400',
  completed: 'bg-emerald-500/10 text-emerald-400',
};

export function getAccentColor() {
  const root = document.documentElement;
  return root.style.getPropertyValue('--accent-500').trim() || '#6366f1';
}

export function getAccentColor400() {
  const root = document.documentElement;
  return root.style.getPropertyValue('--accent-400').trim() || '#818cf8';
}

export function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-900 border border-white/10 rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-slate-300 font-medium mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }} className="font-semibold">
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
          {entry.name?.includes('%') || entry.dataKey?.includes('Achievement') ? '%' : ''}
        </p>
      ))}
    </div>
  );
}

export function StatCard({ label, value, sub, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-surface-900/60 border border-white/[0.06] rounded-xl px-5 py-4 flex flex-col"
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <span className="text-2xl font-bold text-white tabular-nums mt-1">{value}</span>
      {sub && <span className="text-xs text-slate-400 mt-0.5">{sub}</span>}
    </motion.div>
  );
}

export function ChartCard({ title, children, delay = 0, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`bg-surface-900/60 border border-white/[0.06] rounded-2xl p-6 ${className}`}
    >
      <h3 className="text-sm font-semibold text-white mb-4">{title}</h3>
      {children}
    </motion.div>
  );
}

export function LoadingState() {
  return (
    <div className="flex items-center justify-center py-32">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-slate-400">Loading dashboard...</span>
      </div>
    </div>
  );
}
