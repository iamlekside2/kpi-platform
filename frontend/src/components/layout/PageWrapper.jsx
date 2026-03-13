import { motion } from 'framer-motion';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function PageWrapper({ children }) {
  return (
    <div className="flex min-h-screen bg-surface-950 text-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <Navbar />
        <motion.main
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="flex-1 px-8 py-6 overflow-auto"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
