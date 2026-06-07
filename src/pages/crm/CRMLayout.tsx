import { useState, useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import {
  LayoutDashboard, Users, CalendarPlus, Stethoscope,
  FileText, DollarSign, Bell, LogOut, Menu,
  ChevronRight, Building2, Shield, UserCircle
} from 'lucide-react';
import { logout, getCurrentUser, isAdmin, isLoggedIn, validateSession } from '../../lib/auth';

interface CRMLayoutProps {
  children: React.ReactNode;
}

export default function CRMLayout({ children }: CRMLayoutProps) {
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  // Centralized auth guard:
  // 1. Immediate sync check — don't render if clearly not logged in
  // 2. Async server-side session validation on mount (and on navigation)
  useEffect(() => {
    if (!isLoggedIn()) {
      setLocation('/admin');
      return;
    }
    validateSession().then(valid => {
      if (!valid) {
        setLocation('/admin');
      } else {
        setSessionChecked(true);
      }
    });
  }, [location]);

  const user = getCurrentUser();
  const admin = isAdmin();

  const handleLogout = async () => {
    await logout();
    setLocation('/admin');
  };

  // Don't render CRM shell until session is confirmed valid
  if (!isLoggedIn() || !sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const allNavItems = [
    { path: '/crm/dashboard',    label: 'Dashboard',    icon: LayoutDashboard, adminOnly: false },
    { path: '/crm/patients',     label: 'Patients',     icon: Users,           adminOnly: false },
    { path: '/crm/appointments', label: 'Appointments', icon: CalendarPlus,    adminOnly: false },
    { path: '/crm/treatments',   label: 'Treatments',   icon: Stethoscope,     adminOnly: false },
    { path: '/crm/billing',      label: 'Billing',      icon: FileText,        adminOnly: false },
    { path: '/crm/collections',  label: 'Collections',  icon: DollarSign,      adminOnly: true  },
    { path: '/crm/followups',    label: 'Follow-ups',   icon: Bell,            adminOnly: false },
  ];

  const navItems = allNavItems.filter(item => !item.adminOnly || admin);
  const currentNav = navItems.find(item => location.startsWith(item.path));

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white font-bold text-lg shadow-sm flex-shrink-0">
              🦷
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-800 text-sm leading-tight truncate">Sri Chaitanya</p>
              <p className="text-teal-600 text-xs font-semibold">Dental Care CRM</p>
            </div>
          </div>
        </div>

        {/* User info */}
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${admin ? 'bg-teal-100 text-teal-700' : 'bg-blue-100 text-blue-700'}`}>
              <UserCircle size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-800 truncate">{user?.name ?? 'User'}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Shield size={10} className={admin ? 'text-teal-500' : 'text-blue-500'} />
                <span className={`text-xs font-semibold uppercase tracking-wider ${admin ? 'text-teal-600' : 'text-blue-600'}`}>
                  {admin ? 'Admin' : 'Staff'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ path, label, icon: Icon, adminOnly }) => {
            const isActive = location.startsWith(path);
            return (
              <Link
                key={path}
                href={path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group
                  ${isActive
                    ? 'bg-teal-50 text-teal-700 border border-teal-100'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                  }`}
              >
                <Icon size={17} className={isActive ? 'text-teal-600' : 'text-slate-400 group-hover:text-slate-600'} />
                <span className="flex-1">{label}</span>
                {adminOnly && (
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-teal-100 text-teal-600 px-1.5 py-0.5 rounded-full">
                    Admin
                  </span>
                )}
                {isActive && <ChevronRight size={13} className="text-teal-400" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 space-y-1">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all"
          >
            <LogOut size={17} />
            Logout
          </button>
          <a
            href="/"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all"
          >
            <Building2 size={17} />
            View Website
          </a>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-slate-800 font-semibold text-base">{currentNav?.label ?? 'Dashboard'}</h1>
            <p className="text-slate-400 text-xs">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className={`hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full
              ${admin ? 'bg-teal-50 text-teal-700 border border-teal-100' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
              <Shield size={11} />
              {admin ? 'Admin Access' : 'Staff Access'}
            </div>
            <div className="hidden sm:flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-medium px-3 py-1.5 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
