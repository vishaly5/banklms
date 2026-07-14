import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  ChevronDown,
  CircleHelp,
  Grid3X3,
  Languages,
  LogOut,
  Menu,
  Search,
  Settings,
  UserRound,
} from 'lucide-react';
import { getUnreadCount } from '../services/notificationService';

interface BrandingBarProps {
  currentUser: { name: string; role: 'admin' | 'trainer' | 'participant'; avatar: string; email?: string };
  onLogout: () => void;
  onNavigate?: (page: string) => void;
}

const roleLabel = (role: BrandingBarProps['currentUser']['role']) =>
  role === 'participant' ? 'Participant' : role === 'trainer' ? 'Trainer' : 'Admin';

export function BrandingBar({ currentUser, onLogout, onNavigate }: BrandingBarProps) {
  const [languageOpen, setLanguageOpen] = useState(false);
  const [appsOpen, setAppsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [language, setLanguage] = useState('English');
  const [unreadCount, setUnreadCount] = useState(0);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const closeMenus = (event: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setLanguageOpen(false);
        setAppsOpen(false);
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', closeMenus);
    return () => document.removeEventListener('mousedown', closeMenus);
  }, []);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        setUnreadCount(await getUnreadCount());
      } catch {
        setUnreadCount(0);
      }
    };
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const toggleMobileSidebar = () => {
    window.dispatchEvent(new CustomEvent('anuvadini:toggle-sidebar'));
  };

  const quickApps = [
    { label: 'Dashboard', page: 'dashboard' },
    { label: 'Courses', page: 'courses' },
    { label: 'Batches', page: 'batches' },
    { label: 'Forum', page: 'forum' },
  ];

  return (
    <header ref={headerRef} className="sticky top-0 z-40 h-[72px] border-b border-[#E5E7EB] bg-white">
      <div className="flex h-full items-center gap-4 px-4 md:px-6">
        <button
          type="button"
          onClick={toggleMobileSidebar}
          aria-label="Open navigation menu"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-violet-100 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <label className="relative min-w-0 flex-1 md:max-w-[500px]">
          <span className="sr-only">Search students, courses, batches</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            placeholder="Search students, courses, batches..."
            className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
          />
        </label>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative hidden sm:block">
            <button
              type="button"
              onClick={() => setLanguageOpen((value) => !value)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-violet-100"
              aria-haspopup="menu"
              aria-expanded={languageOpen}
            >
              <Languages className="h-4 w-4 text-[#5B4CF0]" />
              {language}
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>
            {languageOpen && (
              <div className="absolute right-0 top-12 w-44 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10" role="menu">
                {['English', 'Hindi', 'Bengali', 'Marathi'].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setLanguage(item);
                      setLanguageOpen(false);
                    }}
                    className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    role="menuitem"
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            aria-label="Open notifications"
            onClick={() => onNavigate?.('notifications')}
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-violet-100"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white ring-2 ring-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <div className="relative hidden sm:block">
            <button
              type="button"
              onClick={() => setAppsOpen((value) => !value)}
              aria-label="Open app launcher"
              aria-haspopup="menu"
              aria-expanded={appsOpen}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-violet-100"
            >
              <Grid3X3 className="h-5 w-5" />
            </button>
            {appsOpen && (
              <div className="absolute right-0 top-12 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10" role="menu">
                {quickApps.map((app) => (
                  <button
                    key={app.page}
                    type="button"
                    onClick={() => {
                      onNavigate?.(app.page);
                      setAppsOpen(false);
                    }}
                    className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    role="menuitem"
                  >
                    {app.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((value) => !value)}
              className="flex h-11 items-center gap-3 rounded-2xl border border-slate-200 bg-white py-1 pl-1.5 pr-3 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-violet-100"
              aria-haspopup="menu"
              aria-expanded={profileOpen}
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#5B4CF0] text-xs font-bold text-white">
                {currentUser.avatar}
              </div>
              <div className="hidden min-w-0 text-left lg:block">
                <p className="max-w-[150px] truncate text-sm font-bold leading-tight text-slate-950">{currentUser.name}</p>
                <p className="text-xs font-medium text-slate-500">{roleLabel(currentUser.role)}</p>
              </div>
              <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10" role="menu">
                <button type="button" onClick={() => onNavigate?.('settings')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50" role="menuitem">
                  <UserRound className="h-4 w-4 text-[#5B4CF0]" />
                  Profile
                </button>
                <button type="button" onClick={() => onNavigate?.('settings')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50" role="menuitem">
                  <Settings className="h-4 w-4 text-[#5B4CF0]" />
                  Settings
                </button>
                <button type="button" onClick={() => onNavigate?.('qms')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50" role="menuitem">
                  <CircleHelp className="h-4 w-4 text-[#5B4CF0]" />
                  Help
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button type="button" onClick={onLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50" role="menuitem">
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
