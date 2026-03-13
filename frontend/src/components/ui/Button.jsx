import { motion } from 'framer-motion';

const variants = {
  primary: 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-400 hover:shadow-indigo-500/30',
  secondary: 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white',
  outline: 'bg-transparent border border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/10',
  danger: 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20',
};

export default function Button({ children, variant = 'primary', type = 'button', disabled, onClick, fullWidth, className = '', ...props }) {
  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      type={type}
      className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 inline-flex items-center justify-center gap-2
        ${variants[variant] || variants.primary}
        ${fullWidth ? 'w-full' : ''}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
        ${className}`}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </motion.button>
  );
}
