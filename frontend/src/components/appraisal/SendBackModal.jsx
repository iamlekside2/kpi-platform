import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, CornerUpLeft } from 'lucide-react';

/**
 * Sending an appraisal back used to be a window.prompt asking for free text,
 * so what came out was whatever the reviewer could be bothered to type. The
 * common case is "this one section is blank", and the person receiving it
 * needs to know which. Here they tick the sections and add a note; the two
 * are composed into the reason the recipient sees and is emailed.
 */

// What the recipient can actually act on depends on the stage it returns to,
// so only those sections are offered.
export function sectionsForStage(status, { jobSectionLabel, reasonsColumn }) {
  if (status === 'submitted') {
    return [
      { key: 'discussion', label: 'A1 Discussion Points' },
      { key: 'ratings', label: 'Self-ratings' },
      ...(reasonsColumn ? [{ key: 'reasons', label: 'The "Give Reason" column beside each rating' }] : []),
      ...(jobSectionLabel ? [{ key: 'job', label: `${jobSectionLabel} section` }] : []),
    ];
  }
  if (status === 'unit_reviewed') {
    return [
      { key: 'unit_scores', label: 'Unit head scores' },
      { key: 'unit_comment', label: 'Unit head comment' },
    ];
  }
  if (status === 'admin_reviewed') {
    return [{ key: 'hr_comment', label: 'HR comment' }];
  }
  return [];
}

export default function SendBackModal({
  recipientName,
  recipientRoleLabel,
  sections,
  onCancel,
  onConfirm,
  saving,
}) {
  const [picked, setPicked] = useState([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);

  function toggle(key) {
    setError(null);
    setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));
  }

  // The recipient reads one sentence, not a form dump.
  function composeReason() {
    const chosen = sections.filter((s) => picked.includes(s.key)).map((s) => s.label);
    const parts = [];
    if (chosen.length === 1) {
      parts.push(`Please complete the ${chosen[0]}.`);
    } else if (chosen.length > 1) {
      const last = chosen[chosen.length - 1];
      parts.push(`Please complete the following: ${chosen.slice(0, -1).join(', ')} and ${last}.`);
    }
    if (note.trim()) parts.push(note.trim());
    return parts.join(' ');
  }

  const reason = composeReason();

  function handleConfirm() {
    if (!reason) {
      setError('Tick at least one section, or write a note explaining what is needed.');
      return;
    }
    onConfirm(reason);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ duration: 0.2 }}
        className="bg-surface-900 border border-white/[0.06] rounded-2xl w-full max-w-lg shadow-2xl shadow-black/30"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-6 pb-3">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <CornerUpLeft className="w-4 h-4 text-amber-400" />
              Send back to {recipientName}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              It reopens for {recipientRoleLabel} to edit. Everything already filled in is kept, and
              they are emailed the reason below.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {sections.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-2">What needs work?</p>
              <div className="space-y-1.5">
                {sections.map((s) => (
                  <label
                    key={s.key}
                    className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-surface-950/60 border border-white/[0.06] hover:border-white/10 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={picked.includes(s.key)}
                      onChange={() => toggle(s.key)}
                      className="mt-0.5 w-4 h-4 accent-accent-500 cursor-pointer"
                    />
                    <span className="text-sm text-slate-300 leading-snug">{s.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Anything else they should know <span className="text-slate-600 font-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => { setNote(e.target.value); setError(null); }}
              placeholder="e.g. the figures for July are missing"
              className="w-full px-3 py-2 bg-surface-950/60 border border-white/[0.08] rounded-lg text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-accent-500/50 transition-colors resize-none"
            />
          </div>

          {reason && (
            <div className="px-3 py-2.5 rounded-lg bg-amber-500/[0.07] border border-amber-500/20">
              <p className="text-[10px] uppercase tracking-wider text-amber-400/70 font-semibold mb-1">
                They will see
              </p>
              <p className="text-xs text-amber-200/90 leading-relaxed">{reason}</p>
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-surface-950 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Sending...' : 'Send back'}
            </button>
            <button
              onClick={onCancel}
              disabled={saving}
              className="px-4 py-2 bg-white/[0.06] hover:bg-white/10 text-slate-300 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
