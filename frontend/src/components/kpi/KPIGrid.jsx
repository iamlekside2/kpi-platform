import KPICard from './KPICard';

export default function KPIGrid({ kpis, onUpdate, onDelete }) {
  if (!kpis || kpis.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-white/[0.06] flex items-center justify-center text-2xl mb-4">
          📊
        </div>
        <p className="text-sm text-slate-400">No KPIs yet. Apply a template or add custom KPIs to get started.</p>
      </div>
    );
  }

  // Group KPIs by category
  const grouped = {};
  for (const kpi of kpis) {
    if (!grouped[kpi.category]) {
      grouped[kpi.category] = [];
    }
    grouped[kpi.category].push(kpi);
  }

  return (
    <div className="space-y-8 mt-6">
      {Object.entries(grouped).map(([category, categoryKpis]) => (
        <div key={category}>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span>{category}</span>
            <span className="text-[10px] text-slate-600 bg-white/[0.04] px-2 py-0.5 rounded-full">
              {categoryKpis.length}
            </span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {categoryKpis.map((kpi) => (
              <KPICard key={kpi.id} kpi={kpi} onUpdate={onUpdate} onDelete={onDelete} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
