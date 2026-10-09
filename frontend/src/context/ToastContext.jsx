import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

const ToastContext = createContext(null);

const TOAST_STYLES = {
  success: { icon: CheckCircle2, bar: 'bg-emerald-500', text: 'text-emerald-400' },
  error: { icon: XCircle, bar: 'bg-red-500', text: 'text-red-400' },
  info: { icon: Info, bar: 'bg-accent-500', text: 'text-accent-400' },
};

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const confirmResolver = useRef(null);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((type, message, duration = 4000) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, type, message }]);
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
    return id;
  }, [dismiss]);

  const success = useCallback((msg, duration) => push('success', msg, duration), [push]);
  const error = useCallback((msg, duration) => push('error', msg, duration), [push]);
  const info = useCallback((msg, duration) => push('info', msg, duration), [push]);

  // Styled replacement for window.confirm — returns a Promise<boolean>
  const confirm = useCallback(({ title = 'Are you sure?', message = '', confirmLabel = 'Confirm', danger = false } = {}) => {
    return new Promise((resolve) => {
      confirmResolver.current = resolve;
      setConfirmState({ title, message, confirmLabel, danger });
    });
  }, []);

  function settleConfirm(result) {
    setConfirmState(null);
    if (confirmResolver.current) {
      confirmResolver.current(result);
      confirmResolver.current = null;
    }
  }

  return (
    <ToastContext.Provider value={{ success, error, info, confirm, dismiss }}>
      {children}

      {/* ── Toast stack ── */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[min(380px,calc(100vw-2rem))]">
        <AnimatePresence>
          {toasts.map((t) => {
            const style = TOAST_STYLES[t.type] || TOAST_STYLES.info;
            const Icon = style.icon;
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 40, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="relative flex items-start gap-3 bg-surface-900 border border-white/10 rounded-xl shadow-2xl px-4 py-3 overflow-hidden"
              >
                <span className={`absolute left-0 top-0 bottom-0 w-1 ${style.bar}`} />
                <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${style.text}`} />
                <p className="text-sm text-slate-200 leading-snug flex-1">{t.message}</p>
                <button
                  onClick={() => dismiss(t.id)}
                  className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* ── Confirm dialog ── */}
      <AnimatePresence>
        {confirmState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => settleConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.95 }}
              className="bg-surface-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                  ${confirmState.danger ? 'bg-red-500/10 text-red-400' : 'bg-accent-500/10 text-accent-400'}`}>
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">{confirmState.title}</h3>
                  {confirmState.message && (
                    <p className="text-sm text-slate-400 mt-1">{confirmState.message}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => settleConfirm(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-300 bg-white/[0.06] hover:bg-white/[0.1] rounded-lg transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => settleConfirm(true)}
                  className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-all cursor-pointer
                    ${confirmState.danger ? 'bg-red-500 hover:bg-red-400' : 'bg-accent-500 hover:bg-accent-400'}`}
                >
                  {confirmState.confirmLabel}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
