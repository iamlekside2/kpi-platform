import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // { message, field } — see LoginPage; the API names the field at fault.
  const [error, setError] = useState(null);
  const { register } = useAuth();
  const navigate = useNavigate();

  function clearError(field) {
    setError((e) => (e && (e.field === field || !e.field) ? null : e));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError({ message: 'Password must be at least 6 characters', field: 'password' });
      return;
    }

    setSubmitting(true);

    try {
      await register(name, email.trim(), password);
      navigate('/onboarding');
    } catch (err) {
      const data = err.response?.data;
      setError({
        message: data?.error || 'Could not create your account. Please try again.',
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
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-accent-500/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md relative"
      >
        <div className="bg-surface-900/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-8 shadow-2xl shadow-black/20">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Create Account</h1>
            <p className="text-sm text-slate-400">Get started with KPI Platform</p>
          </div>

          {error && !error.field && (
            <div className="flex items-start gap-2 mb-5 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-px" />
              <p className="text-xs text-red-300 leading-relaxed">{error.message}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-1">
            <Input
              label="Full Name"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); clearError('name'); }}
              error={fieldError('name')}
              autoComplete="name"
              placeholder="John Doe"
            />
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
              autoComplete="new-password"
              placeholder="At least 6 characters"
            />
            <div className="pt-2">
              <Button type="submit" fullWidth disabled={submitting}>
                {submitting ? 'Creating account...' : 'Create Account'}
              </Button>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="text-accent-400 hover:text-accent-300 font-medium transition-colors">
              Sign In
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
