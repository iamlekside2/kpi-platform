import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';
import Button from '../ui/Button';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="h-16 px-8 flex items-center justify-between border-b border-white/[0.06] bg-surface-950/50 backdrop-blur-xl sticky top-0 z-30"
    >
      <div />
      <div className="flex items-center gap-4">
        <Link to="/profile" className="flex items-center gap-3 group cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-accent-500/20 border border-accent-500/30 flex items-center justify-center text-xs font-bold text-accent-400 group-hover:bg-accent-500/30 transition-colors">
            {(user?.name || user?.email || '?').charAt(0).toUpperCase()}
          </div>
          <span className="text-sm text-slate-300 font-medium hidden sm:block group-hover:text-white transition-colors">
            {user?.name || user?.email}
          </span>
        </Link>
        <Button variant="secondary" onClick={logout}>
          Logout
        </Button>
      </div>
    </motion.header>
  );
}
