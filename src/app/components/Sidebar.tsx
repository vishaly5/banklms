import { useEffect, useMemo, useState } from 'react';
import {
  Award,
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
  const [tabletCollapsed, setTabletCollapsed] = useState(false);
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

  useEffect(() => {
    const syncTabletState = () => {
      setTabletCollapsed(window.innerWidth >= 768 && window.innerWidth < 1024);
    };
    syncTabletState();
    window.addEventListener('resize', syncTabletState);
    return () => window.removeEventListener('resize', syncTabletState);
  }, []);

  const trainerItems: MenuItem[] = [
    { icon: LayoutDashboard, label: 'Dashboard', page: 'dashboard' },
    { icon: BookOpen, label: 'My Courses', page: 'courses' },
    { icon: Users, label: 'Batches', page: 'batches' },
    { icon: UserRound, label: 'Students', page: 'student-activity-tracker' },
    { icon: ClipboardCheck, label: 'Assignments', page: 'assignments-review' },
    { icon: MessageCircle, label: 'Student Query', page: 'qms' },
    { icon: MessageCircle, label: 'Community Forum', page: 'forum' },
    { icon: Settings, label: 'Settings', page: 'settings' },
  ];

  const participantItems: MenuItem[] = [
    { icon: LayoutDashboard, label: 'My Dashboard', page: 'dashboard' },
    { icon: BookOpen, label: 'Course Marketplace', page: 'global-courses' },
    { icon: BookOpen, label: 'My Courses', page: 'courses' },
    { icon: Award, label: 'My Certificates', page: 'certificates' },
    { icon: MessageCircle, label: 'Student Query', page: 'qms' },
    { icon: MessageCircle, label: 'Community Forum', page: 'forum' },
    { icon: Settings, label: 'Settings', page: 'settings' },
  ];

  const adminItems: MenuItem[] = [
    { icon: LayoutDashboard, label: 'Admin Dashboard', page: 'dashboard' },
    { icon: LineChart, label: 'Advanced Analytics', page: 'analytics' },
    { icon: CalendarDays, label: 'Student Activity Monitor', page: 'student-activity-monitor' },
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
    { icon: MessageCircle, label: 'Student Query', page: 'qms' },
    { icon: MessageCircle, label: 'Community Forum', page: 'forum' },
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

  const effectiveCollapsed = !mobileOpen && (collapsed || tabletCollapsed);

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
          className="fixed inset-0 z-40 bg-slate-950/35 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-shrink-0 flex-col border-r border-slate-200 bg-white transition-all duration-300 md:relative md:z-20 ${
          effectiveCollapsed ? 'md:w-[72px]' : 'md:w-[240px]'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        <div className={`relative flex h-[84px] items-center gap-3 border-b border-slate-200 px-4 ${effectiveCollapsed ? 'justify-center px-3' : 'pr-12'}`}>
          <img src="/ankuvadini.png" alt="Anuvadini logo" className={`${effectiveCollapsed ? 'h-10 w-10' : 'h-12 w-12'} flex-shrink-0 object-contain`} />
          {!effectiveCollapsed && (
            <div className="min-w-0">
              <p className="truncate text-lg font-bold leading-tight text-slate-950">Anuvadini</p>
              <p className="truncate text-[13px] font-medium leading-tight text-slate-500">Learning for Excellence</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="absolute right-3 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition duration-150 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-violet-100 lg:flex"
          >
            {effectiveCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-5" aria-label={`${userRole} navigation`}>
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

        <div className="space-y-2 border-t border-slate-200 px-4 py-4">
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
            className={`flex w-full items-center gap-4 rounded-xl px-3 py-2.5 text-[15px] font-semibold text-slate-700 transition duration-150 hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus:ring-4 focus:ring-rose-100 ${
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
      className={`group relative flex w-full items-center gap-4 rounded-xl px-3 py-2.5 text-[15px] transition duration-150 focus:outline-none focus:ring-4 focus:ring-violet-100 ${
        collapsed ? 'justify-center' : ''
      } ${
        active
          ? 'bg-[#F3F0FF] font-bold text-[#5B4CF0]'
          : item.disabled
            ? 'cursor-not-allowed text-slate-300'
            : 'font-semibold text-slate-700 hover:bg-[#F3F4F6] hover:text-slate-950'
      }`}
    >
      {active && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[#5B4CF0]" />}
      <Icon className="h-5 w-5 flex-shrink-0" />
      {!collapsed && <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>}
      {!collapsed && item.badge && (
        <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-xs font-bold text-white">{item.badge}</span>
      )}
      {collapsed && item.badge && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500" />}
    </button>
  );
}
