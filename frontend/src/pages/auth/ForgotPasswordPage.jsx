import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../../services/api';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { KeyRound, AlertCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSuccess('');
    setError(null);
    setSubmitting(true);

    try {
      const { data } = await api.post('/auth/forgot-password', { email: email.trim() });
      setSuccess(data.message || 'If an account exists with that email, a password reset link has been sent.');
      setEmail('');
    } catch (err) {
      const data = err.response?.data;
      setError({
        message: data?.error || 'Something went wrong. Please try again.',
        field: data?.field || null,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative"
      >
        <div className="bg-surface-900 border border-white/[0.06] rounded-2xl p-8 shadow-2xl shadow-black/20">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-accent-500/10 border border-accent-500/20 flex items-center justify-center mx-auto mb-4">
              <KeyRound className="w-6 h-6 text-accent-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Forgot Password?</h1>
            <p className="text-sm text-slate-400">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>

          {success && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-400"
            >
              {success}
            </motion.div>
          )}

          {error && !error.field && (
            <div className="flex items-start gap-2 mb-4 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-px" />
              <p className="text-xs text-red-300 leading-relaxed">{error.message}</p>
            </div>
          )}

          {!success ? (
            <form onSubmit={handleSubmit} noValidate className="space-y-1">
              <Input
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                error={error?.field === 'email' ? error.message : undefined}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="you@company.com"
              />
              <div className="pt-2">
                <Button type="submit" fullWidth disabled={submitting || !email}>
                  {submitting ? 'Sending...' : 'Send Reset Link'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="pt-2">
              <Button fullWidth onClick={() => { setSuccess(''); setEmail(''); }}>
                Send Another Link
              </Button>
            </div>
          )}

          <p className="mt-6 text-center text-sm text-slate-500">
            Remember your password?{' '}
            <Link to="/login" className="text-accent-400 hover:text-accent-300 font-medium transition-colors">
              Sign In
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
