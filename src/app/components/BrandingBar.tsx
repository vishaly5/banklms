import { Bell, ChevronDown, LogOut, Menu, MessageCircle, Search } from 'lucide-react';

interface BrandingBarProps {
  currentUser: { name: string; role: 'admin' | 'trainer' | 'participant'; avatar: string; email?: string };
  onLogout: () => void;
  onNavigate?: (page: string) => void;
}

export function BrandingBar({ currentUser, onLogout, onNavigate }: BrandingBarProps) {
  const roleLabel = currentUser.role === 'participant' ? 'Participant' : currentUser.role === 'trainer' ? 'Trainer' : 'Admin';

  const toggleMobileSidebar = () => {
    window.dispatchEvent(new CustomEvent('anuvadini:toggle-sidebar'));
  };

  return (
    <header className="sticky top-0 z-40 h-[72px] border-b border-slate-200 bg-white">
      <div className="flex h-full items-center justify-between gap-3 px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={toggleMobileSidebar}
            aria-label="Open navigation menu"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-violet-100 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden items-center gap-3 sm:flex">
            <img src="/ankuvadini.png" alt="Anuvadini logo" className="h-11 w-11 flex-shrink-0 object-contain" />
            <div className="min-w-0">
              <p className="truncate text-lg font-bold leading-tight text-slate-950">Anuvadini</p>
              <p className="truncate text-xs font-medium text-slate-500">Learning for Excellence</p>
            </div>
          </div>
        </div>

        <label className="relative hidden min-w-[240px] max-w-[560px] flex-1 md:block">
          <span className="sr-only">Search students, courses, batches</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            placeholder={currentUser.role === 'trainer' ? 'Search students, courses, batches...' : 'Search courses, users, reports...'}
            className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
          />
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Open notifications"
            onClick={() => onNavigate?.('notifications')}
            className="relative flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-violet-100"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
          </button>

          <button
            type="button"
            aria-label="Open messages"
            onClick={() => onNavigate?.('qms')}
            className="hidden h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-violet-100 sm:flex"
          >
            <MessageCircle className="h-5 w-5" />
          </button>

          <div className="flex h-11 items-center gap-3 rounded-lg border border-slate-200 bg-white py-1 pl-2 pr-2">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">
              {currentUser.avatar}
            </div>
            <div className="hidden min-w-0 text-left sm:block">
              <p className="max-w-[140px] truncate text-sm font-semibold leading-tight text-slate-950">{currentUser.name}</p>
              <p className="text-xs text-slate-500">{roleLabel}</p>
            </div>
            <ChevronDown className="hidden h-4 w-4 text-slate-400 md:block" />
            <button
              type="button"
              onClick={onLogout}
              aria-label="Logout"
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-4 focus:ring-rose-100"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
