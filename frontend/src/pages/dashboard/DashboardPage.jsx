import { useAuth } from '../../context/AuthContext';
import UnitHeadDashboard from './UnitHeadDashboard';
import ExecutiveDashboard from './ExecutiveDashboard';
import AdminDashboard from './AdminDashboard';
import EmployeeDashboard from './EmployeeDashboard';

// Role-aware entry point. Every role has its own view: the admin console,
// a unit head's team, the executive overview, and the employee's own
// appraisals. Employees used to land on an org-wide KPI dashboard that
// said nothing about them; that view is gone, and its history is in git.
export default function DashboardPage() {
  const { orgRole } = useAuth();
  if (orgRole === 'admin') return <AdminDashboard />;
  if (orgRole === 'lead') return <UnitHeadDashboard />;
  if (orgRole === 'md' || orgRole === 'chairman') return <ExecutiveDashboard />;
  return <EmployeeDashboard />;
}
