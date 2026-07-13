import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  LineChart,
  LogOut,
  MessageCircle,
  Settings,
  UserRound,
  Users,
} from 'lucide-react';
import { getUnreadCount } from '../services/notificationService';

interface SidebarProps {
  userRole: 'admin' | 'trainer' | 'participant';
  activePage: string;
  onPageChange: (page: string) => void;
  onLogout?: () => void;
}

type MenuItem = {
  icon: any;
  label: string;
  page?: string;
  badge?: string;
  disabled?: boolean;
  disabledReason?: string;
};

export function Sidebar({ userRole, activePage, onPageChange, onLogout }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('anuvadini-sidebar-collapsed') === 'true');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    localStorage.setItem('anuvadini-sidebar-collapsed', String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const count = await getUnreadCount();
        setUnreadCount(count);
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleToggle = () => setMobileOpen((open) => !open);
    window.addEventListener('anuvadini:toggle-sidebar', handleToggle);
    return () => window.removeEventListener('anuvadini:toggle-sidebar', handleToggle);
  }, []);

  const trainerItems: MenuItem[] = [
    { icon: LayoutDashboard, label: 'Dashboard', page: 'dashboard' },
    { icon: BookOpen, label: 'My Courses', page: 'courses' },
    { icon: Users, label: 'Batches', page: 'batches' },
    { icon: UserRound, label: 'Students', page: 'student-activity-tracker' },
    { icon: ClipboardCheck, label: 'Assignments', page: 'assignments-review' },
    { icon: BarChart3, label: 'Assessments', disabled: true, disabledReason: 'Assessments are not available in this build' },
    { icon: LineChart, label: 'Reports', page: 'reports' },
    { icon: MessageCircle, label: 'Messages', page: 'qms' },
    { icon: CalendarDays, label: 'Calendar', disabled: true, disabledReason: 'Calendar route is not available yet' },
    { icon: Settings, label: 'Settings', page: 'settings' },
  ];

  const participantItems: MenuItem[] = [
    { icon: LayoutDashboard, label: 'My Dashboard', page: 'dashboard' },
    { icon: CalendarDays, label: 'Calendar Activity', page: 'calendar-activity' },
    { icon: BarChart3, label: 'My Progress', page: 'reports' },
    { icon: BookOpen, label: 'Course Marketplace', page: 'global-courses' },
    { icon: BookOpen, label: 'My Courses', page: 'courses' },
    { icon: Award, label: 'My Certificates', page: 'certificates' },
    { icon: MessageCircle, label: 'Ask Questions', page: 'qms' },
    { icon: MessageCircle, label: 'Community Forum', page: 'forum' },
    { icon: Settings, label: 'Settings', page: 'settings' },
  ];

  const adminItems: MenuItem[] = [
    { icon: LayoutDashboard, label: 'Admin Dashboard', page: 'dashboard' },
    { icon: LineChart, label: 'Advanced Analytics', page: 'analytics' },
    { icon: CalendarDays, label: 'Student Activity Monitor', page: 'student-activity-monitor' },
    { icon: BarChart3, label: 'Platform Reports', page: 'reports' },
    { icon: Users, label: 'User Management', page: 'user-management' },
    { icon: Users, label: 'Trainer Management', page: 'trainer-management' },
    { icon: Users, label: 'Student Management', page: 'student-management' },
    { icon: Building2, label: 'Departments', page: 'departments' },
    { icon: BookOpen, label: 'Batches', page: 'batches' },
    { icon: GraduationCap, label: 'Trainer Assignment', page: 'trainer-assignment' },
    { icon: BookOpen, label: 'Course Management', page: 'courses' },
    { icon: ClipboardCheck, label: 'Course Review', page: 'course-review' },
    { icon: ClipboardCheck, label: 'Assignments', page: 'assignments-review' },
    { icon: Award, label: 'Certificates', page: 'certificate-management' },
    { icon: MessageCircle, label: 'Messages', page: 'qms' },
    { icon: Settings, label: 'Settings', page: 'settings' },
  ];

  const mainItems = useMemo(() => {
    if (userRole === 'trainer') return trainerItems;
    if (userRole === 'admin') return adminItems;
    return participantItems;
  }, [userRole, unreadCount]);

  const bottomItems: MenuItem[] = [
    { icon: HelpCircle, label: 'Help & Support', page: 'qms' },
    { icon: Bell, label: 'Notifications', page: 'notifications', badge: unreadCount > 0 ? String(unreadCount) : undefined },
  ];

  const effectiveCollapsed = collapsed && !mobileOpen;

  const handleNavigate = (item: MenuItem) => {
    if (item.disabled || !item.page) return;
    onPageChange(item.page);
    setMobileOpen(false);
  };

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-slate-950/35 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-shrink-0 flex-col border-r border-slate-200 bg-white transition-all duration-300 lg:relative lg:z-20 ${
          collapsed ? 'lg:w-20' : 'lg:w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} w-64`}
      >
        <div className="flex h-[72px] items-center gap-3 border-b border-slate-200 px-4">
          <img src="/ankuvadini.png" alt="Anuvadini logo" className="h-10 w-10 flex-shrink-0 object-contain" />
          {!effectiveCollapsed && (
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-slate-950">Anuvadini</p>
              <p className="truncate text-xs text-slate-500">Learning for Excellence</p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-24 hidden h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-violet-100 lg:flex"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label={`${userRole} navigation`}>
          {mainItems.map((item) => (
            <SidebarButton
              key={item.label}
              item={item}
              active={Boolean(item.page && activePage === item.page)}
              collapsed={effectiveCollapsed}
              onClick={() => handleNavigate(item)}
            />
          ))}
        </nav>

        <div className="space-y-1 border-t border-slate-200 px-3 py-4">
          {bottomItems.map((item) => (
            <SidebarButton
              key={item.label}
              item={item}
              active={Boolean(item.page && activePage === item.page)}
              collapsed={effectiveCollapsed}
              onClick={() => handleNavigate(item)}
            />
          ))}
          <button
            type="button"
            onClick={onLogout}
            title={effectiveCollapsed ? 'Logout' : undefined}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus:ring-4 focus:ring-rose-100 ${
              effectiveCollapsed ? 'justify-center' : ''
            }`}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {!effectiveCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

function SidebarButton({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: MenuItem;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      disabled={item.disabled}
      onClick={onClick}
      title={collapsed ? item.disabledReason || item.label : item.disabledReason}
      aria-label={item.label}
      className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm transition focus:outline-none focus:ring-4 focus:ring-violet-100 ${
        collapsed ? 'justify-center' : ''
      } ${
        active
          ? 'bg-violet-50 font-bold text-violet-700'
          : item.disabled
            ? 'cursor-not-allowed text-slate-300'
            : 'font-semibold text-slate-700 hover:bg-slate-50 hover:text-violet-700'
      }`}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      {!collapsed && <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>}
      {!collapsed && item.badge && (
        <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-xs font-bold text-white">{item.badge}</span>
      )}
      {collapsed && item.badge && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500" />}
    </button>
  );
}
