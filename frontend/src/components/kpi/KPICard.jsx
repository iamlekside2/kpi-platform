import { useState } from 'react';
import { motion } from 'framer-motion';
import api from '../../services/api';

export default function KPICard({ kpi, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(kpi.value ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const { data } = await api.patch(`/kpis/${kpi.id}`, { value: editValue });
      onUpdate?.(data);
      setEditing(false);
    } catch (err) {
      console.error('Failed to save KPI:', err);
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') setEditing(false);
  }

  const displayValue = kpi.value != null ? kpi.value : '\u2014';
  const displayTarget = kpi.target != null ? kpi.target : '\u2014';
  const progress = kpi.value != null && kpi.target ? Math.min((kpi.value / kpi.target) * 100, 100) : 0;
  const isOverTarget = kpi.value != null && kpi.target && kpi.value >= kpi.target;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="group bg-slate-900/60 backdrop-blur-sm border border-white/[0.06] rounded-xl p-5 hover:border-white/10 hover:shadow-lg hover:shadow-accent-500/5 transition-all duration-300"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-400/70 bg-accent-500/10 px-2 py-0.5 rounded-full">
          {kpi.category}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-xs text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Edit value"
            >
              ✏
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(kpi.id)}
              className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-red-500/20 flex items-center justify-center text-xs text-slate-400 hover:text-red-400 transition-all cursor-pointer"
              title="Delete"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <h3 className="text-sm font-semibold text-white mb-3 leading-tight">{kpi.name}</h3>

      {editing ? (
        <div className="space-y-2">
          <input
            type="number"
            className="w-full px-3 py-2 bg-slate-800/80 border border-accent-500/30 rounded-lg text-sm text-white outline-none focus:border-accent-500/60 focus:ring-2 focus:ring-accent-500/20 transition-all"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-1.5 bg-accent-500 hover:bg-accent-400 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              {saving ? '...' : 'Save'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="flex-1 py-1.5 bg-white/[0.06] hover:bg-white/10 text-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-1.5 mb-3">
            <span className="text-2xl font-bold text-white tabular-nums">{displayValue}</span>
            <span className="text-xs text-slate-500 font-medium">{kpi.unit}</span>
          </div>

          {kpi.target != null && (
            <div className="mb-2">
              <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={`h-full rounded-full ${isOverTarget ? 'bg-emerald-400' : 'bg-accent-500'}`}
                />
              </div>
            </div>
          )}

          <div className="text-[11px] text-slate-500">
            Target: <span className="text-slate-400 font-medium">{displayTarget} {kpi.unit}</span>
          </div>
        </>
      )}

      {kpi.description && (
        <p className="mt-3 pt-3 border-t border-white/[0.04] text-[11px] text-slate-500 leading-relaxed line-clamp-2">
          {kpi.description}
        </p>
      )}
    </motion.div>
  );
}
