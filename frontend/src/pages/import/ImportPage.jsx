import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import PageWrapper from '../../components/layout/PageWrapper';
import Button from '../../components/ui/Button';

export default function ImportPage() {
  const [orgId, setOrgId] = useState(null);
  const [kpis, setKpis] = useState([]);
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: orgs } = await api.get('/orgs');
      if (orgs.length > 0) {
        setOrgId(orgs[0].id);
        const { data } = await api.get(`/kpis/org/${orgs[0].id}`);
        setKpis(data);
      }
    }
    load();
  }, []);

  function handleFileRead(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(ev.target.result);
    reader.readAsText(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(ev.target.result);
    reader.readAsText(file);
  }

  async function handlePreview() {
    setError('');
    try {
      const { data } = await api.post(`/import/org/${orgId}/preview`, { csvText });
      setPreview(data);
      setStep(1);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to parse CSV');
    }
  }

  function setColumnMapping(csvCol, kpiId) {
    setMapping((prev) => {
      if (!kpiId) {
        const next = { ...prev };
        delete next[csvCol];
        return next;
      }
      return { ...prev, [csvCol]: kpiId };
    });
  }

  async function handleConfirm() {
    setError('');
    try {
      const { data } = await api.post(`/import/org/${orgId}/confirm`, { csvText, mapping });
      setResult(data);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Import failed');
    }
  }

  return (
    <PageWrapper>
      <div className="max-w-4xl">
        <h2 className="text-2xl font-bold text-white mb-1">CSV Import</h2>
        <p className="text-sm text-slate-400 mb-6">Upload a CSV file to populate your KPI values.</p>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400"
          >
            {error}
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {/* Step 0: Upload */}
          {step === 0 && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div
                className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer
                  ${dragOver
                    ? 'border-indigo-500/60 bg-indigo-500/10'
                    : 'border-white/[0.08] hover:border-white/15 bg-slate-900/40'}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-slate-800/60 border border-white/[0.06] flex items-center justify-center text-2xl">
                  📁
                </div>
                <p className="text-sm text-slate-300 mb-1 font-medium">Drag & drop a CSV file here</p>
                <p className="text-xs text-slate-500 mb-4">or click to browse</p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileRead}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>

              {csvText && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 flex items-center justify-between p-4 bg-slate-900/60 border border-white/[0.06] rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-sm">✓</div>
                    <span className="text-sm text-slate-300">{csvText.split('\n').length - 1} rows detected</span>
                  </div>
                  <Button onClick={handlePreview}>Preview & Map Columns</Button>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Step 1: Column mapping */}
          {step === 1 && preview && (
            <motion.div
              key="mapping"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <h3 className="text-lg font-semibold text-white mb-1">Map CSV columns to KPIs</h3>
              <p className="text-sm text-slate-400 mb-4">For each CSV column, choose which KPI it should update.</p>

              <div className="bg-slate-900/60 border border-white/[0.06] rounded-xl overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-3 gap-4 px-4 py-3 bg-slate-800/40 border-b border-white/[0.06]">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">CSV Column</span>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Sample Values</span>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Map to KPI</span>
                </div>

                {preview.headers.map((header, i) => (
                  <div
                    key={header}
                    className={`grid grid-cols-3 gap-4 px-4 py-3 items-center ${i < preview.headers.length - 1 ? 'border-b border-white/[0.04]' : ''}`}
                  >
                    <span className="text-sm text-slate-300 font-medium">{header}</span>
                    <span className="text-xs text-slate-500 truncate">
                      {preview.preview.slice(0, 3).map((row) => row[header]).join(', ')}
                    </span>
                    <select
                      value={mapping[header] || ''}
                      onChange={(e) => setColumnMapping(header, e.target.value)}
                      className="bg-slate-800/80 border border-white/[0.08] text-sm text-slate-300 rounded-lg px-3 py-1.5 outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    >
                      <option value="">-- Skip --</option>
                      {kpis.map((kpi) => (
                        <option key={kpi.id} value={kpi.id}>{kpi.name} ({kpi.unit})</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 mt-6">
                <Button onClick={handleConfirm} disabled={Object.keys(mapping).length === 0}>
                  Import {Object.keys(mapping).length} column{Object.keys(mapping).length !== 1 ? 's' : ''}
                </Button>
                <Button variant="secondary" onClick={() => { setStep(0); setPreview(null); setMapping({}); }}>
                  Back
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Done */}
          {step === 2 && result && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center py-16 text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-3xl mb-4">
                ✅
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Import Complete</h3>
              <p className="text-sm text-slate-400 mb-6">
                {result.updated} KPI{result.updated !== 1 ? 's' : ''} updated successfully.
              </p>
              <Button onClick={() => window.location.href = '/dashboard'}>Go to Dashboard</Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageWrapper>
  );
}
