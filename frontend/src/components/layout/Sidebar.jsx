import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, BarChart3, Users, ClipboardList, Settings, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

const allLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/kpis', label: 'KPIs', icon: BarChart3 },
  { to: '/staff', label: 'Staff', icon: Users, roles: ['admin', 'lead'] },
  { to: '/appraisals', label: 'Appraisals', icon: ClipboardList },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ collapsed, onToggle }) {
  const { orgRole } = useAuth();
  const links = allLinks.filter(link => !link.roles || link.roles.includes(orgRole));

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 256 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="min-h-screen bg-surface-950 border-r border-white/[0.06] flex flex-col shrink-0 overflow-hidden"
    >
      {/* Brand */}
      <div className={`flex items-center justify-between border-b border-white/[0.06] ${collapsed ? 'px-3 py-6' : 'px-6 py-6'}`}>
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.h2
              key="brand"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="text-lg font-bold text-white tracking-tight whitespace-nowrap"
            >
              <span className="text-accent-400">KPI</span> Platform
            </motion.h2>
          )}
        </AnimatePresence>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onToggle}
          className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer shrink-0"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </motion.button>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 py-4 flex flex-col gap-1 ${collapsed ? 'px-2' : 'px-3'}`}>
        {links.map((link, i) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              title={collapsed ? link.label : undefined}
              className={({ isActive }) =>
                `group flex items-center rounded-lg text-sm font-medium transition-all duration-200
                ${collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-4 py-2.5'}
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
                  className={`flex items-center w-full ${collapsed ? 'justify-center' : 'gap-3'}`}
                >
                  <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                    <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-accent-400' : 'text-slate-500'}`} />
                  </motion.div>
                  {!collapsed && (
                    <>
                      <span className="whitespace-nowrap">{link.label}</span>
                      {isActive && (
                        <motion.div
                          layoutId="activeIndicator"
                          className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-400"
                        />
                      )}
                    </>
                  )}
                </motion.div>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={`py-4 border-t border-white/[0.06] ${collapsed ? 'px-3' : 'px-6'}`}>
        {!collapsed && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[10px] text-slate-600 uppercase tracking-widest"
          >
            v1.0 Beta
          </motion.p>
        )}
      </div>
    </motion.aside>
  );
}
