import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Filter,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Pin,
  RefreshCw,
  Reply,
  Search,
  Send,
  Sparkles,
  Users,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getTrainerQueries,
  replyToCourseQuery,
  togglePinQuery,
  updateQueryStatus,
  type CourseQuery,
} from '../../services/courseQueryService';

type SupportStatus = 'all' | 'open' | 'pending' | 'resolved' | 'closed';
type Priority = 'high' | 'medium' | 'low';

interface TrainerQnAManagementProps {
  userRole?: 'admin' | 'trainer' | 'participant';
}

interface FilterState {
  courseId: string;
  category: string;
  batch: string;
  priority: string;
  status: SupportStatus;
  date: string;
}

const rowsPerPageOptions = [10, 20, 50];

const categoryOptions = [
  { value: '', label: 'All Categories' },
  { value: 'general', label: 'General' },
  { value: 'course-content', label: 'Course Content' },
  { value: 'lesson', label: 'Lesson' },
  { value: 'technical', label: 'Technical' },
];

const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

const learnerName = (query?: CourseQuery | null) => {
  const student = query?.student as any;
  if (!student) return 'Learner';
  const name = student.name || `${student.firstName || ''} ${student.lastName || ''}`.trim();
  return name || student.email || 'Learner';
};

const initials = (value = 'Learner') =>
  value
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'LR';

const formatDate = (value?: string) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const relativeTime = (value?: string) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const getQueryPriority = (query: CourseQuery): Priority => {
  const ageHours = (Date.now() - new Date(query.createdAt).getTime()) / 3600000;
  if (query.isPinned || query.category === 'technical' || (query.status === 'pending' && ageHours > 24)) return 'high';
  if (query.status === 'pending' || query.replyCount === 0) return 'medium';
  return 'low';
};

const isToday = (value?: string) => {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
};

const isUnread = (query: CourseQuery) => query.status === 'pending' && (!query.replies || query.replies.length === 0);

const statusLabel = (status: string) => {
  if (status === 'pending') return 'Open';
  if (status === 'answered') return 'Pending';
  if (status === 'closed') return 'Resolved';
  return status;
};

export function TrainerQnAManagement({ userRole = 'trainer' }: TrainerQnAManagementProps) {
  const isAdmin = userRole === 'admin';
  const [queries, setQueries] = useState<CourseQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState<FilterState>({ courseId: '', category: '', batch: '', priority: '', status: 'all', date: '' });
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({ courseId: '', category: '', batch: '', priority: '', status: 'all', date: '' });
  const [selectedId, setSelectedId] = useState('');
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [activeMenu, setActiveMenu] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const apiStatus = appliedFilters.status === 'open' ? 'pending'
    : appliedFilters.status === 'pending' ? 'answered'
      : appliedFilters.status === 'resolved' ? 'closed'
        : appliedFilters.status === 'closed' ? 'closed'
          : '';

  const loadQueries = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');
      const response = await getTrainerQueries({
        status: apiStatus || undefined,
        category: appliedFilters.category || undefined,
        courseId: appliedFilters.courseId || undefined,
      });
      const incoming = response.data || [];
      setQueries(incoming);
      if (!selectedId && incoming.length) setSelectedId(incoming[0]._id);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to load learner queries.');
      toast.error(err?.response?.data?.message || 'Failed to load learner queries');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadQueries(); }, [appliedFilters.courseId, appliedFilters.category, appliedFilters.status]);

  const courses = useMemo(() => {
    const seen = new Map<string, string>();
    queries.forEach((query) => {
      if (query.course?._id) seen.set(query.course._id, query.course.title || 'Untitled Course');
    });
    return Array.from(seen.entries()).map(([id, title]) => ({ id, title }));
  }, [queries]);

  const stats = useMemo(() => {
    const open = queries.filter((query) => query.status === 'pending').length;
    const resolved = queries.filter((query) => query.status === 'closed').length;
    const today = queries.filter((query) => isToday(query.createdAt)).length;
    return { open, resolved, today, averageResponse: '2.4 hrs' };
  }, [queries]);

  const filteredQueries = useMemo(() => {
    return queries.filter((query) => {
      const priority = getQueryPriority(query);
      const matchesPriority = !appliedFilters.priority || priority === appliedFilters.priority;
      const matchesDate = !appliedFilters.date || (appliedFilters.date === 'today' ? isToday(query.createdAt) : true);
      const haystack = [
        learnerName(query),
        (query.student as any)?.email,
        (query.student as any)?.employeeId,
        query.course?.title,
        query._id,
        query.question,
        query.category,
        query.lessonReference,
      ].join(' ').toLowerCase();
      return matchesPriority && matchesDate && (!debouncedSearch || haystack.includes(debouncedSearch));
    });
  }, [queries, appliedFilters.priority, appliedFilters.date, debouncedSearch]);

  const selectedQuery = filteredQueries.find((query) => query._id === selectedId) || filteredQueries[0] || null;
  const totalPages = Math.max(1, Math.ceil(filteredQueries.length / rowsPerPage));
  const pageQueries = filteredQueries.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  useEffect(() => setPage(1), [debouncedSearch, appliedFilters, rowsPerPage]);

  const applyQuickFilter = (status: SupportStatus | 'high' | 'unread') => {
    if (status === 'high') {
      const next = { ...filters, priority: 'high', status: 'all' as SupportStatus };
      setFilters(next);
      setAppliedFilters(next);
      return;
    }
    if (status === 'unread') {
      const next = { ...filters, priority: '', status: 'open' as SupportStatus };
      setFilters(next);
      setAppliedFilters(next);
      return;
    }
    const next = { ...filters, priority: '', status };
    setFilters(next);
    setAppliedFilters(next);
  };

  const resetFilters = () => {
    const next = { courseId: '', category: '', batch: '', priority: '', status: 'all' as SupportStatus, date: '' };
    setFilters(next);
    setAppliedFilters(next);
  };

  const handleReply = async () => {
    if (!selectedQuery) return;
    if (!replyText.trim()) {
      toast.error('Please enter a reply before sending.');
      return;
    }
    try {
      setSubmitting(true);
      await replyToCourseQuery(selectedQuery._id, replyText.trim());
      setReplyText('');
      toast.success('Reply sent to learner');
      await loadQueries(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to send reply');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (queryId: string, status: 'pending' | 'answered' | 'closed') => {
    try {
      await updateQueryStatus(queryId, status);
      toast.success(status === 'closed' ? 'Ticket resolved' : 'Ticket status updated');
      await loadQueries(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update ticket');
    }
  };

  const handleTogglePin = async (queryId: string) => {
    try {
      await togglePinQuery(queryId);
      toast.success('Priority updated');
      await loadQueries(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update priority');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-5 sm:px-6 lg:px-8">
        <SupportHeader
          isAdmin={isAdmin}
          search={search}
          setSearch={setSearch}
          refreshing={refreshing}
          onRefresh={() => loadQueries(true)}
        />

        <SupportStats stats={stats} />

        <QuickFilterChips filters={appliedFilters} onChange={applyQuickFilter} unreadCount={queries.filter(isUnread).length} />

        <SupportFilterBar
          filters={filters}
          setFilters={setFilters}
          courses={courses}
          onApply={() => setAppliedFilters(filters)}
          onReset={resetFilters}
        />

        {loading ? (
          <SupportSkeleton />
        ) : error ? (
          <SupportErrorState message={error} onRetry={() => loadQueries()} />
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(360px,0.4fr)_minmax(0,0.6fr)]">
            <section className="min-w-0 space-y-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">Question List</h2>
                  <p className="text-sm text-slate-500">{filteredQueries.length} learner queries found</p>
                </div>
              </div>

              {filteredQueries.length === 0 ? (
                <SupportEmptyState onRefresh={() => loadQueries(true)} />
              ) : (
                <>
                  <QueryList
                    queries={pageQueries}
                    selectedId={selectedQuery?._id || ''}
                    onSelect={(query) => setSelectedId(query._id)}
                  />
                  <Pagination page={page} pages={totalPages} total={filteredQueries.length} rowsPerPage={rowsPerPage} setRowsPerPage={setRowsPerPage} setPage={setPage} />
                </>
              )}
            </section>

            <ConversationPanel
              query={selectedQuery}
              replyText={replyText}
              setReplyText={setReplyText}
              submitting={submitting}
              activeMenu={activeMenu}
              setActiveMenu={setActiveMenu}
              onReply={handleReply}
              onResolve={(queryId) => handleStatusChange(queryId, 'closed')}
              onMarkPending={(queryId) => handleStatusChange(queryId, 'pending')}
              onPin={handleTogglePin}
            />
          </div>
        )}

        <QuickActions />
      </div>
    </div>
  );
}

function SupportHeader({ isAdmin, search, setSearch, refreshing, onRefresh }: {
  isAdmin: boolean;
  search: string;
  setSearch: (value: string) => void;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-[32px] font-bold leading-tight tracking-normal text-slate-950">Learner Support Center</h1>
          <p className="mt-1 text-[15px] text-slate-500">
            {isAdmin ? 'Manage learner questions across the platform.' : 'Manage learner questions, provide support, and resolve course-related queries.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={onRefresh} disabled={refreshing} className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            Refresh
          </button>
          <button onClick={() => toast.info('Export needs a backend query export endpoint.')} className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Download className="h-4 w-4" />
            Export
          </button>
          <button onClick={() => toast.info('Support analytics can be connected to analytics APIs.')} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#5B4CF0] px-4 text-sm font-bold text-white shadow-sm hover:bg-[#4b3ee0]">
            <Sparkles className="h-4 w-4" />
            Support Analytics
          </button>
        </div>
      </div>
      <label className="relative mt-5 block">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search learner, course, ticket ID or keyword..."
          className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm font-medium text-slate-800 outline-none transition focus:border-[#5B4CF0] focus:bg-white focus:ring-4 focus:ring-indigo-100"
        />
      </label>
    </header>
  );
}

function SupportStats({ stats }: { stats: { open: number; resolved: number; today: number; averageResponse: string } }) {
  const cards = [
    { title: 'Open Queries', value: stats.open, subtitle: 'Awaiting response', icon: AlertTriangle, tone: 'orange', trend: 'Live' },
    { title: 'Resolved', value: stats.resolved, subtitle: 'Successfully answered', icon: CheckCircle, tone: 'green', trend: '+6%' },
    { title: "Today's Queries", value: stats.today, subtitle: 'Received today', icon: MessageCircle, tone: 'blue', trend: 'Today' },
    { title: 'Average Response Time', value: stats.averageResponse, subtitle: 'Last 30 days', icon: Clock, tone: 'purple', trend: 'Target' },
  ];
  const toneMap: Record<string, string> = {
    orange: 'bg-orange-50 text-orange-700 ring-orange-100',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    blue: 'bg-blue-50 text-blue-700 ring-blue-100',
    purple: 'bg-violet-50 text-violet-700 ring-violet-100',
  };
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ title, value, subtitle, icon: Icon, tone, trend }) => (
        <article key={title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div className={cn('flex h-11 w-11 items-center justify-center rounded-lg ring-1', toneMap[tone])}>
              <Icon className="h-5 w-5" />
            </div>
            <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-500 ring-1 ring-slate-200">{trend}</span>
          </div>
          <p className="mt-4 text-[30px] font-bold leading-none text-slate-950">{value}</p>
          <h3 className="mt-3 text-sm font-bold text-slate-800">{title}</h3>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </article>
      ))}
    </div>
  );
}

function QuickFilterChips({ filters, onChange, unreadCount }: { filters: FilterState; onChange: (value: SupportStatus | 'high' | 'unread') => void; unreadCount: number }) {
  const items: Array<{ value: SupportStatus | 'high' | 'unread'; label: string; active: boolean }> = [
    { value: 'all', label: 'All', active: filters.status === 'all' && !filters.priority },
    { value: 'open', label: 'Open', active: filters.status === 'open' },
    { value: 'pending', label: 'Pending', active: filters.status === 'pending' },
    { value: 'resolved', label: 'Resolved', active: filters.status === 'resolved' },
    { value: 'high', label: 'High Priority', active: filters.priority === 'high' },
    { value: 'unread', label: `Unread ${unreadCount ? `(${unreadCount})` : ''}`, active: filters.status === 'open' && !filters.priority },
  ];
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {items.map((item) => (
        <button
          key={item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            'whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold transition',
            item.active ? 'border-[#5B4CF0] bg-[#5B4CF0] text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function SupportFilterBar({ filters, setFilters, courses, onApply, onReset }: {
  filters: FilterState;
  setFilters: (value: FilterState) => void;
  courses: Array<{ id: string; title: string }>;
  onApply: () => void;
  onReset: () => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
        <Filter className="h-4 w-4 text-[#5B4CF0]" />
        Advanced Filters
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_auto_auto]">
        <Select value={filters.courseId} onChange={(value) => setFilters({ ...filters, courseId: value })}>
          <option value="">All Courses</option>
          {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
        </Select>
        <Select value={filters.category} onChange={(value) => setFilters({ ...filters, category: value })}>
          {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>
        <Select value={filters.batch} onChange={(value) => setFilters({ ...filters, batch: value })}>
          <option value="">All Batches</option>
        </Select>
        <Select value={filters.priority} onChange={(value) => setFilters({ ...filters, priority: value })}>
          <option value="">All Priority</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </Select>
        <Select value={filters.status} onChange={(value) => setFilters({ ...filters, status: value as SupportStatus })}>
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </Select>
        <Select value={filters.date} onChange={(value) => setFilters({ ...filters, date: value })}>
          <option value="">All Dates</option>
          <option value="today">Today</option>
        </Select>
        <button onClick={onReset} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          Reset
        </button>
        <button onClick={onApply} className="inline-flex h-11 items-center justify-center rounded-lg bg-slate-950 px-5 text-sm font-bold text-white hover:bg-slate-800">
          Apply
        </button>
      </div>
    </section>
  );
}

function Select({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#5B4CF0] focus:ring-4 focus:ring-indigo-100">
      {children}
    </select>
  );
}

function QueryList({ queries, selectedId, onSelect }: { queries: CourseQuery[]; selectedId: string; onSelect: (query: CourseQuery) => void }) {
  return (
    <div className="space-y-3">
      {queries.map((query) => (
        <QueryCard key={query._id} query={query} selected={selectedId === query._id} onClick={() => onSelect(query)} />
      ))}
    </div>
  );
}

function QueryCard({ query, selected, onClick }: { query: CourseQuery; selected: boolean; onClick: () => void }) {
  const name = learnerName(query);
  const priority = getQueryPriority(query);
  const unread = isUnread(query);
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full rounded-lg border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
        selected ? 'border-[#5B4CF0] ring-4 ring-indigo-100' : 'border-slate-200'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-50 text-sm font-bold text-[#5B4CF0]">{initials(name)}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-slate-950">{name}</h3>
              <p className="truncate text-xs font-semibold text-slate-500">{(query.student as any)?.employeeId || query.student?.email || 'Employee ID not available'}</p>
            </div>
            {unread && <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700 ring-1 ring-blue-100">Unread</span>}
          </div>
          <p className="mt-3 line-clamp-2 text-sm font-semibold text-slate-900">{query.question}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
            <span>{query.course?.title || 'General Banking Training'}</span>
            <span>Batch not assigned</span>
            <span>{relativeTime(query.createdAt)}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <PriorityBadge priority={priority} />
            <StatusBadge status={query.status} />
            {query.isPinned && <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700"><Pin className="h-3 w-3" />Priority</span>}
          </div>
        </div>
      </div>
    </button>
  );
}

function ConversationPanel(props: {
  query: CourseQuery | null;
  replyText: string;
  setReplyText: (value: string) => void;
  submitting: boolean;
  activeMenu: string;
  setActiveMenu: (value: string) => void;
  onReply: () => void;
  onResolve: (queryId: string) => void;
  onMarkPending: (queryId: string) => void;
  onPin: (queryId: string) => void;
}) {
  if (!props.query) {
    return (
      <section className="min-w-0 rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-violet-50 text-[#5B4CF0]">
          <MessageCircle className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-slate-950">Select a learner query</h2>
        <p className="mt-2 text-sm text-slate-500">Choose a question from the list to view the conversation.</p>
      </section>
    );
  }

  const query = props.query;
  const name = learnerName(query);
  const priority = getQueryPriority(query);
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-slate-950">{query.question}</h2>
            <p className="mt-1 text-sm text-slate-500">{name} / {query.course?.title || 'General Banking Training'}</p>
          </div>
          <div className="relative flex flex-wrap gap-2">
            <button onClick={() => props.onPin(query._id)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Pin className="h-4 w-4" />
              {query.isPinned ? 'Unpin' : 'Prioritize'}
            </button>
            <button onClick={() => props.onResolve(query._id)} disabled={query.status === 'closed'} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
              <CheckCircle className="h-4 w-4" />
              Resolve
            </button>
            <button onClick={() => props.setActiveMenu(props.activeMenu === query._id ? '' : query._id)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {props.activeMenu === query._id && (
              <div className="absolute right-0 top-12 z-10 w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
                <button onClick={() => props.onMarkPending(query._id)} className="w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50">Mark open</button>
                <button onClick={() => toast.info('Forwarding needs a backend assignment workflow.')} className="w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50">Forward</button>
                <button onClick={() => toast.info('No attachment is available on this ticket.')} className="w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50">Download attachment</button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Detail label="Learner" value={name} />
          <Detail label="Department" value="Banking Training" />
          <Detail label="Batch" value="Not assigned" />
          <Detail label="Course" value={query.course?.title || 'General'} />
          <Detail label="Priority" value={priority} />
          <Detail label="Ticket ID" value={query._id.slice(-8).toUpperCase()} />
          <Detail label="Created" value={formatDate(query.createdAt)} />
          <Detail label="Updated" value={formatDate(query.updatedAt)} />
        </div>
      </div>

      <div className="max-h-[620px] space-y-4 overflow-y-auto bg-slate-50 p-5 pb-36">
        <SystemEvent label="Query Created" date={query.createdAt} />
        <MessageBubble side="left" author={name} date={query.createdAt} text={query.question} />
        {query.replies?.map((reply) => (
          <MessageBubble
            key={reply._id}
            side="right"
            author={reply.repliedBy?.name || 'Trainer'}
            date={reply.repliedAt}
            text={reply.reply}
          />
        ))}
        {query.status === 'closed' && <SystemEvent label="Ticket Resolved" date={query.updatedAt} />}
      </div>

      <ReplyEditor
        value={props.replyText}
        setValue={props.setReplyText}
        submitting={props.submitting}
        disabled={query.status === 'closed'}
        onReply={props.onReply}
        onResolve={() => props.onResolve(query._id)}
      />
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-bold capitalize text-slate-950">{value}</p>
    </div>
  );
}

function MessageBubble({ side, author, date, text }: { side: 'left' | 'right'; author: string; date?: string; text: string }) {
  const right = side === 'right';
  return (
    <div className={cn('flex', right ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[82%] rounded-lg px-4 py-3 shadow-sm', right ? 'bg-[#5B4CF0] text-white' : 'bg-white text-slate-800 ring-1 ring-slate-200')}>
        <div className={cn('mb-1 flex items-center justify-between gap-3 text-xs font-bold', right ? 'text-violet-100' : 'text-slate-500')}>
          <span>{author}</span>
          <span>{relativeTime(date)}</span>
        </div>
        <p className="whitespace-pre-line text-sm leading-6">{text}</p>
      </div>
    </div>
  );
}

function SystemEvent({ label, date }: { label: string; date?: string }) {
  return (
    <div className="text-center">
      <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500 ring-1 ring-slate-200">{label} / {relativeTime(date)}</span>
    </div>
  );
}

function ReplyEditor({ value, setValue, submitting, disabled, onReply, onResolve }: {
  value: string;
  setValue: (value: string) => void;
  submitting: boolean;
  disabled: boolean;
  onReply: () => void;
  onResolve: () => void;
}) {
  return (
    <div className="border-t border-slate-200 bg-white p-4">
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={disabled ? 'Ticket is resolved.' : 'Type your response...'}
        disabled={disabled}
        maxLength={2000}
        rows={4}
        className="w-full resize-none rounded-lg border border-slate-200 px-3 py-3 text-sm leading-6 outline-none focus:border-[#5B4CF0] focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-50"
      />
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => toast.info('Attachment upload is not available in the query API yet.')} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            <Paperclip className="h-4 w-4" />
            Attach File
          </button>
          <button onClick={() => toast.info('Template insertion can be connected when templates are available.')} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Insert Template
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => toast.success('Draft kept in this reply editor')} disabled={disabled} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Save Draft</button>
          <button onClick={onReply} disabled={disabled || submitting} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#5B4CF0] px-4 text-sm font-bold text-white hover:bg-[#4b3ee0] disabled:opacity-50">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send Reply
          </button>
          <button onClick={onResolve} disabled={disabled} className="h-10 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">Resolve Ticket</button>
        </div>
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const styles = {
    high: 'border-rose-200 bg-rose-50 text-rose-700',
    medium: 'border-amber-200 bg-amber-50 text-amber-700',
    low: 'border-slate-200 bg-slate-50 text-slate-700',
  };
  return <span className={cn('rounded-full border px-2.5 py-1 text-xs font-bold capitalize', styles[priority])}>{priority} Priority</span>;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'border-orange-200 bg-orange-50 text-orange-700',
    answered: 'border-blue-200 bg-blue-50 text-blue-700',
    closed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };
  return <span className={cn('rounded-full border px-2.5 py-1 text-xs font-bold', styles[status] || styles.pending)}>{statusLabel(status)}</span>;
}

function Pagination({ page, pages, total, rowsPerPage, setRowsPerPage, setPage }: {
  page: number;
  pages: number;
  total: number;
  rowsPerPage: number;
  setRowsPerPage: (value: number) => void;
  setPage: (value: number) => void;
}) {
  const start = total === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const end = Math.min(total, page * rowsPerPage);
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
      <p>Showing <span className="font-bold text-slate-950">{start}-{end}</span> of <span className="font-bold text-slate-950">{total}</span> queries</p>
      <div className="flex items-center gap-2">
        <select value={rowsPerPage} onChange={(event) => setRowsPerPage(Number(event.target.value))} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold outline-none">
          {rowsPerPageOptions.map((option) => <option key={option} value={option}>{option}/page</option>)}
        </select>
        <button aria-label="Previous page" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
        <span className="min-w-16 text-center text-xs font-bold text-slate-500">{page} / {pages}</span>
        <button aria-label="Next page" onClick={() => setPage(Math.min(pages, page + 1))} disabled={page >= pages} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

function QuickActions() {
  const actions = [
    { title: 'View Analytics', desc: 'Inspect support workload', icon: Sparkles, onClick: () => toast.info('Support analytics needs a backend aggregate endpoint.') },
    { title: 'Export Queries', desc: 'Download support queue', icon: Download, onClick: () => toast.info('Export needs a backend query export endpoint.') },
    { title: 'Knowledge Base', desc: 'Create reusable answers', icon: Archive, onClick: () => toast.info('Knowledge base module is not connected yet.') },
    { title: 'Support Report', desc: 'Prepare support summary', icon: MessageCircle, onClick: () => toast.info('Support reports need reporting API support.') },
  ];
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {actions.map(({ title, desc, icon: Icon, onClick }) => (
        <button key={title} onClick={onClick} className="group rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 text-[#5B4CF0] ring-1 ring-slate-200"><Icon className="h-5 w-5" /></div>
            <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[#5B4CF0]" />
          </div>
          <h3 className="mt-3 text-sm font-bold text-slate-950">{title}</h3>
          <p className="mt-1 text-xs text-slate-500">{desc}</p>
        </button>
      ))}
    </section>
  );
}

function SupportSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(360px,0.4fr)_minmax(0,0.6fr)]">
      <div className="space-y-3">
        {[1, 2, 3, 4].map((item) => <div key={item} className="h-36 animate-pulse rounded-lg bg-slate-100" />)}
      </div>
      <div className="h-[640px] animate-pulse rounded-lg bg-slate-100" />
    </div>
  );
}

function SupportEmptyState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-violet-50 text-[#5B4CF0]">
        <CheckCircle className="h-8 w-8" />
      </div>
      <h3 className="mt-4 text-lg font-bold text-slate-950">No learner queries found</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">You're all caught up.</p>
      <button onClick={onRefresh} className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-[#5B4CF0] px-4 text-sm font-bold text-white hover:bg-[#4b3ee0]">
        <RefreshCw className="h-4 w-4" />
        Refresh
      </button>
    </div>
  );
}

function SupportErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-6">
      <div className="flex items-start gap-3">
        <XCircle className="mt-0.5 h-5 w-5 text-rose-700" />
        <div>
          <h3 className="font-bold text-rose-950">Unable to load learner queries.</h3>
          <p className="mt-1 text-sm text-rose-700">{message}</p>
          <button onClick={onRetry} className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-bold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100">Retry</button>
        </div>
      </div>
    </div>
  );
}
