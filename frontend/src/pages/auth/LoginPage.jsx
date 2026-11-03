import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // { message, field } — the API names the field that was wrong so the message
  // sits on that input instead of in a toast the person has to read in time.
  const [error, setError] = useState(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Typing in the field the API complained about clears the complaint.
  function clearError(field) {
    setError((e) => (e && (e.field === field || !e.field) ? null : e));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email.trim(), password);
      navigate('/dashboard');
    } catch (err) {
      const data = err.response?.data;
      setError({
        message: data?.error || 'Could not sign in. Please try again.',
        field: data?.field || null,
      });
    } finally {
      setSubmitting(false);
    }
  }

  const fieldError = (field) => (error?.field === field ? error.message : undefined);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950 px-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-accent-500/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md relative"
      >
        <div className="bg-surface-900/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-8 shadow-2xl shadow-black/20">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Sign In</h1>
            <p className="text-sm text-slate-400">Welcome back to KPI Platform</p>
          </div>

          {/* A failure with no field of its own (network, server) still needs saying */}
          {error && !error.field && (
            <div className="flex items-start gap-2 mb-5 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-px" />
              <p className="text-xs text-red-300 leading-relaxed">{error.message}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-1">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearError('email'); }}
              error={fieldError('email')}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="you@company.com"
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearError('password'); }}
              error={fieldError('password')}
              autoComplete="current-password"
              placeholder="Your password"
            />
            <div className="flex justify-end -mt-1 mb-2">
              <Link to="/forgot-password" className="text-xs text-slate-500 hover:text-accent-400 transition-colors">
                Forgot password?
              </Link>
            </div>
            <div className="pt-1">
              <Button type="submit" fullWidth disabled={submitting}>
                {submitting ? 'Signing in...' : 'Sign In'}
              </Button>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Don't have an account?{' '}
            <Link to="/register" className="text-accent-400 hover:text-accent-300 font-medium transition-colors">
              Register
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
