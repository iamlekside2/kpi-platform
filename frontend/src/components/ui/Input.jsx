export default function Input({ label, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1.5 mb-4">
      {label && <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</label>}
      <input
        className={`w-full px-4 py-2.5 bg-slate-900/50 border border-white/[0.06] rounded-lg text-sm text-slate-100 placeholder-slate-600
          outline-none transition-all duration-200
          focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20
          ${error ? 'border-red-500/50' : ''}
          ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
