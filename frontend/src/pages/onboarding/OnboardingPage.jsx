import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

const STEPS = ['Name Your Organisation', 'Pick Templates', 'Invite Teammates'];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [orgName, setOrgName] = useState('');
  const [org, setOrg] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplates, setSelectedTemplates] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitedEmails, setInvitedEmails] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleCreateOrg(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/orgs', { name: orgName });
      setOrg(data);
      const templatesRes = await api.get('/templates');
      setTemplates(templatesRes.data);
      setStep(1);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create organisation');
    } finally {
      setLoading(false);
    }
  }

  function toggleTemplate(key) {
    setSelectedTemplates((prev) => {
      if (key === 'custom') return prev.includes('custom') ? [] : ['custom'];
      const without = prev.filter((k) => k !== 'custom');
      if (without.includes(key)) return without.filter((k) => k !== key);
      return [...without, key];
    });
  }

  async function handleApplyTemplates() {
    if (selectedTemplates.length === 0) {
      setError('Please select at least one template');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.post(`/templates/apply/${org.id}`, { templateKeys: selectedTemplates });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to apply templates');
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite(e) {
    e.preventDefault();
    setError('');
    if (!inviteEmail) return;
    try {
      await api.post(`/orgs/${org.id}/invite`, { email: inviteEmail });
      setInvitedEmails([...invitedEmails, inviteEmail]);
      setInviteEmail('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to invite user');
    }
  }

  function handleFinish() {
    navigate('/dashboard');
  }

  const templateIcons = {
    tech: '🛠️',
    sales: '💰',
    hr: '👥',
    marketing: '📢',
    operations: '📦',
    custom: '✏️',
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-8">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl relative"
      >
        <div className="bg-slate-900/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-8 shadow-2xl shadow-black/20">

          {/* Progress Indicator */}
          <div className="flex items-center gap-2 mb-8">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-2 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300
                  ${i < step ? 'bg-indigo-500 border-indigo-500 text-white' :
                    i === step ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10' :
                    'border-white/10 text-slate-600 bg-transparent'}`}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span className={`text-xs font-medium hidden sm:block transition-colors
                  ${i <= step ? 'text-slate-300' : 'text-slate-600'}`}>
                  {label}
                </span>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-2 transition-colors ${i < step ? 'bg-indigo-500' : 'bg-white/[0.06]'}`} />
                )}
              </div>
            ))}
          </div>

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
            {/* Step 1: Name org */}
            {step === 0 && (
              <motion.form
                key="step-0"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                onSubmit={handleCreateOrg}
              >
                <h2 className="text-xl font-bold text-white mb-2">Name your organisation</h2>
                <p className="text-sm text-slate-400 mb-6">This is how your team will see it in the dashboard.</p>
                <Input
                  label="Organisation Name"
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Acme Corp"
                  required
                />
                <div className="mt-2">
                  <Button type="submit" fullWidth disabled={loading || !orgName.trim()}>
                    {loading ? 'Creating...' : 'Continue'}
                  </Button>
                </div>
              </motion.form>
            )}

            {/* Step 2: Pick templates (multi-select) */}
            {step === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-xl font-bold text-white mb-2">Pick your templates</h2>
                <p className="text-sm text-slate-400 mb-2">
                  Select all that apply to your organisation. Each template adds KPIs for that department.
                </p>

                {selectedTemplates.length > 0 && selectedTemplates[0] !== 'custom' && (
                  <div className="mb-4 text-xs text-indigo-400 font-medium">
                    {selectedTemplates.length} template{selectedTemplates.length > 1 ? 's' : ''} selected
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                  {templates.map((t, i) => (
                    <motion.div
                      key={t.key}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className={`relative cursor-pointer rounded-xl p-4 border-2 transition-all duration-200
                        ${selectedTemplates.includes(t.key)
                          ? 'bg-indigo-500/10 border-indigo-500/40 shadow-lg shadow-indigo-500/10'
                          : 'bg-slate-800/50 border-white/[0.06] hover:border-white/10'}`}
                      onClick={() => !loading && toggleTemplate(t.key)}
                    >
                      {/* Check indicator */}
                      <div className={`absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-all
                        ${selectedTemplates.includes(t.key)
                          ? 'bg-indigo-500 border-indigo-500 text-white'
                          : 'border-white/10 text-transparent'}`}>
                        ✓
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{templateIcons[t.key] || '📋'}</span>
                        <h3 className="text-sm font-semibold text-white">{t.name}</h3>
                      </div>
                      <p className="text-xs text-slate-400 mb-2 line-clamp-2">{t.description}</p>
                      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        {t.kpis.length > 0 ? `${t.kpis.length} KPIs` : 'Blank template'}
                      </div>
                    </motion.div>
                  ))}
                </div>

                <Button
                  onClick={handleApplyTemplates}
                  fullWidth
                  disabled={loading || selectedTemplates.length === 0}
                >
                  {loading ? 'Applying...' : `Continue with ${selectedTemplates.length} template${selectedTemplates.length !== 1 ? 's' : ''}`}
                </Button>
              </motion.div>
            )}

            {/* Step 3: Invite teammates */}
            {step === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-xl font-bold text-white mb-2">Invite teammates</h2>
                <p className="text-sm text-slate-400 mb-6">Add team members by email. You can always do this later.</p>

                <form onSubmit={handleInvite} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Input
                      label="Email Address"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="colleague@company.com"
                    />
                  </div>
                  <div className="mb-4">
                    <Button type="submit" variant="secondary">Add</Button>
                  </div>
                </form>

                {invitedEmails.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Invited</h4>
                    {invitedEmails.map((email) => (
                      <div key={email} className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg border border-white/[0.06]">
                        <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-[10px] text-green-400">✓</div>
                        <span className="text-sm text-slate-300">{email}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-2 mt-6">
                  <Button onClick={handleFinish} fullWidth>Go to Dashboard</Button>
                  <Button variant="secondary" onClick={handleFinish} fullWidth>Skip for now</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
