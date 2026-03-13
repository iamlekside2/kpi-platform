import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';

const allLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/staff', label: 'Staff', icon: '👥', roles: ['admin', 'lead'] },
  { to: '/appraisals', label: 'Appraisals', icon: '📋' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function Sidebar() {
  const { orgRole } = useAuth();
  const links = allLinks.filter(link => !link.roles || link.roles.includes(orgRole));
  return (
    <aside className="w-64 min-h-screen bg-surface-950 border-r border-white/[0.06] flex flex-col">
      {/* Brand */}
      <div className="px-6 py-6 border-b border-white/[0.06]">
        <motion.h2
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-lg font-bold text-white tracking-tight"
        >
          <span className="text-accent-400">KPI</span> Platform
        </motion.h2>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {links.map((link, i) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
              ${isActive
                ? 'bg-accent-500/10 text-accent-400 border border-accent-500/20 shadow-sm shadow-accent-500/10'
                : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 border border-transparent'}`
            }
          >
            {({ isActive }) => (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 w-full"
              >
                <span className="text-base">{link.icon}</span>
                <span>{link.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-400"
                  />
                )}
              </motion.div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-white/[0.06]">
        <p className="text-[10px] text-slate-600 uppercase tracking-widest">v1.0 Beta</p>
      </div>
    </aside>
  );
}
