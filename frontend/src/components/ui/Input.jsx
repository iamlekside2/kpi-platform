import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function Input({ label, error, className = '', type = 'text', ...props }) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === 'password';
  // Every password field in the app comes through here, so the reveal
  // toggle is added once rather than per form.
  const inputType = isPassword && revealed ? 'text' : type;

  return (
    <div className="flex flex-col gap-1.5 mb-4">
      {label && <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</label>}
      <div className="relative">
        <input
          type={inputType}
          className={`w-full px-4 py-2.5 bg-surface-900/50 border border-white/[0.06] rounded-lg text-sm text-slate-100 placeholder-slate-600
            outline-none transition-all duration-200
            focus:border-accent-500/50 focus:ring-2 focus:ring-accent-500/20
            ${isPassword ? 'pr-11' : ''}
            ${error ? 'border-red-500/50' : ''}
            ${className}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            // Keeps the field focused when the eye is clicked
            onMouseDown={(e) => e.preventDefault()}
            tabIndex={-1}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            title={revealed ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
          >
            {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
