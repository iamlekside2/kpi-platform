import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { X, Trash2, Plus } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

// Readings describe a period, so the day is noise — show the month.
export function formatPeriod(iso) {
  return new Date(iso).toLocaleDateString('en-GB', {
    month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function KPIHistoryModal({ kpi, canManage, onClose, onChange }) {
  const toast = useToast();
  const readings = kpi.readings || [];
  const [value, setValue] = useState('');
  const [recordedFor, setRecordedFor] = useState(todayIso());
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Oldest first for the chart; the table below stays newest first.
  const series = [...readings].reverse().map((r) => ({
    period: formatPeriod(r.recordedFor),
    value: r.value,
  }));

  async function handleRecord(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const { data } = await api.post(`/kpis/${kpi.id}/readings`, { value, recordedFor, note });
      onChange(data.kpi);
      setValue('');
      setNote('');
      toast.success(`${formatPeriod(data.reading.recordedFor)} recorded`);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not record that reading');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(reading) {
    const ok = await toast.confirm({
      title: `Remove the ${formatPeriod(reading.recordedFor)} reading?`,
      message: 'The figure is deleted. The rest of the history is untouched.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    try {
      const { data } = await api.delete(`/kpis/readings/${reading.id}`);
      onChange(data.kpi);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not remove that reading');
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ duration: 0.2 }}
        className="bg-surface-900 border border-white/[0.06] rounded-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto shadow-2xl shadow-black/30"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-6 pb-4">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-400/70 bg-accent-500/10 px-2 py-0.5 rounded-full">
              {kpi.category}
            </span>
            <h3 className="text-lg font-bold text-white mt-2">{kpi.name}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Measured in {kpi.unit}
              {kpi.target != null && ` · target ${kpi.target}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {series.length >= 2 ? (
            <div className="h-56 -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey="period"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#0f172a',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: '#94a3b8' }}
                    formatter={(v) => [`${v} ${kpi.unit}`, 'Value']}
                  />
                  {kpi.target != null && (
                    <ReferenceLine
                      y={kpi.target}
                      stroke="#34d399"
                      strokeDasharray="4 4"
                      label={{ value: 'Target', fill: '#34d399', fontSize: 10, position: 'right' }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#6366f1' }}
                    activeDot={{ r: 5 }}
                    // The draw-on animation leaves the path fully dashed out
                    // when it mounts inside the modal's own scale transition,
                    // so the line never appears. Nothing is lost without it.
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-6 text-center border border-dashed border-white/[0.08] rounded-xl">
              {series.length === 1
                ? 'One reading so far. Record a second period to see a trend.'
                : 'No readings yet.'}
            </p>
          )}

          {canManage && (
            <form onSubmit={handleRecord} className="bg-surface-950/60 border border-white/[0.06] rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-300 mb-3">Record a reading</p>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1.4fr_auto] gap-2 items-start">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Period</label>
                  <input
                    type="date"
                    value={recordedFor}
                    onChange={(e) => setRecordedFor(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-900 border border-white/[0.08] rounded-lg text-sm text-slate-100 outline-none focus:border-accent-500/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                    Value ({kpi.unit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={value}
                    onChange={(e) => { setValue(e.target.value); setError(null); }}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-surface-900 border border-white/[0.08] rounded-lg text-sm text-slate-100 outline-none focus:border-accent-500/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Note</label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-2 bg-surface-900 border border-white/[0.08] rounded-lg text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-accent-500/50 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="sm:mt-[18px] px-4 py-2 bg-accent-500 hover:bg-accent-400 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5 justify-center"
                >
                  <Plus className="w-4 h-4" />
                  {saving ? 'Saving' : 'Add'}
                </button>
              </div>
              {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
              <p className="text-[11px] text-slate-600 mt-2">
                Recording a period that already has a figure corrects it rather than adding a second one.
              </p>
            </form>
          )}

          {readings.length > 0 && (
            <div className="border border-white/[0.06] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/[0.02] text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="text-left font-medium px-4 py-2.5">Period</th>
                    <th className="text-right font-medium px-4 py-2.5">Value</th>
                    <th className="text-left font-medium px-4 py-2.5">Recorded by</th>
                    {canManage && <th className="w-10" />}
                  </tr>
                </thead>
                <tbody>
                  {readings.map((r) => (
                    <tr key={r.id} className="border-t border-white/[0.04] group">
                      <td className="px-4 py-2.5 text-slate-300">
                        {formatPeriod(r.recordedFor)}
                        {r.note && <span className="block text-[11px] text-slate-600">{r.note}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-white tabular-nums font-medium">
                        {r.value} <span className="text-slate-500 font-normal">{kpi.unit}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">{r.recordedBy?.name || '—'}</td>
                      {canManage && (
                        <td className="px-2">
                          <button
                            onClick={() => handleDelete(r)}
                            className="w-7 h-7 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 flex items-center justify-center text-slate-500 hover:text-red-400 transition-all cursor-pointer"
                            title={`Remove ${formatPeriod(r.recordedFor)}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
