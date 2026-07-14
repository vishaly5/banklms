import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  ChevronDown,
  Clock,
  Copy,
  Edit2,
  Eye,
  FileText,
  Grid3X3,
  LayoutList,
  Loader2,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { CoursePlayer } from '../course/CoursePlayer';
import { CreateCourse } from '../course/CreateCourse';
import {
  deleteCourse as deleteCourseAPI,
  getCourses,
  submitCourseForReview,
  updateCourseStatus,
  type DBCourse,
} from '../../services/courseService';

type ViewMode = 'table' | 'grid';

type CourseStatus =
  | 'published'
  | 'active'
  | 'draft'
  | 'archived'
  | 'pending_review'
  | 'changes_requested'
  | 'rejected'
  | 'unpublished';

type CourseRow = {
  id: string;
  title: string;
  code: string;
  category: string;
  trainerName: string;
  trainerInitials: string;
  modules: number;
  lessons: number;
  enrolled: number;
  completion: number;
  rating: number;
  status: CourseStatus;
  statusLabel: string;
  updatedAt: string;
  thumbnail?: string;
  raw: DBCourse;
};

const PAGE_SIZE = 10;

const bankingFallbacks = [
  { title: 'Banking Fundamentals', code: 'BF-101', category: 'Banking' },
  { title: 'Customer Service Excellence', code: 'CSE-202', category: 'Soft Skills' },
  { title: 'Banking Regulations & Compliance', code: 'BRC-303', category: 'Compliance' },
  { title: 'Cybersecurity Awareness', code: 'CA-404', category: 'Technology' },
  { title: 'KYC and AML Training', code: 'KYC-505', category: 'Compliance' },
  { title: 'Fraud Prevention', code: 'FP-606', category: 'Risk Management' },
];

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'active', label: 'Active' },
  { value: 'pending_review', label: 'Under Review' },
  { value: 'archived', label: 'Archived' },
  { value: 'rejected', label: 'Rejected' },
];

const defaultCategories = ['Banking', 'Compliance', 'Customer Service', 'Technology', 'Risk Management', 'Soft Skills'];

const getTrainerName = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.fullName || user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Trainer';
  } catch {
    return 'Trainer';
  }
};

const initialsOf = (value: string) =>
  value
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'TR';

const getCourseStatus = (course: DBCourse): CourseStatus => {
  const reviewStatus = String(course.reviewStatus || '').toLowerCase();
  const status = String(course.status || '').toLowerCase();
  if (status === 'archived') return 'archived';
  if (reviewStatus === 'published' || course.isPublished) return 'published';
  if (['pending_review', 'changes_requested', 'rejected', 'unpublished'].includes(reviewStatus)) return reviewStatus as CourseStatus;
  if (['active', 'published', 'draft', 'archived'].includes(status)) return status as CourseStatus;
  return 'draft';
};

const getStatusLabel = (status: CourseStatus) => {
  const labels: Record<CourseStatus, string> = {
    published: 'Published',
    active: 'Published',
    draft: 'Draft',
    archived: 'Archived',
    pending_review: 'Under Review',
    changes_requested: 'Changes Requested',
    rejected: 'Rejected',
    unpublished: 'Unpublished',
  };
  return labels[status] || 'Draft';
};

const getCourseCode = (course: DBCourse, index: number) => {
  const raw = (course as any).code || (course as any).courseCode || (course as any).slug;
  if (raw) return String(raw).toUpperCase().slice(0, 12);
  const title = course.title || bankingFallbacks[index % bankingFallbacks.length].title;
  const prefix = title
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
  return `${prefix || 'CRS'}-${String(index + 101).padStart(3, '0')}`;
};

const mapCourse = (course: DBCourse, index: number): CourseRow => {
  const fallback = bankingFallbacks[index % bankingFallbacks.length];
  const trainerName =
    typeof course.trainer === 'object' && course.trainer
      ? course.trainer.fullName ||
        course.trainer.name ||
        `${course.trainer.firstName || ''} ${course.trainer.lastName || ''}`.trim() ||
        course.trainer.email ||
        getTrainerName()
      : typeof course.trainer === 'string' && course.trainer.length < 24
        ? course.trainer
        : getTrainerName();
  const modules = course.sections?.length || 0;
  const lessons =
    course.totalLessons ??
    course.sections?.reduce((sum, section) => sum + (section.lessons?.length || 0), 0) ??
    0;
  const enrolled = Number((course as any).enrollmentCount ?? course.currentEnrollments ?? course.statistics?.totalEnrollments ?? 0);
  const completed = Number((course as any).completedCount ?? course.statistics?.totalCompletions ?? 0);
  const explicitCompletion = Number((course as any).completionRate ?? (course as any).progress ?? 0);
  const completion = explicitCompletion > 0 ? Math.round(explicitCompletion) : enrolled ? Math.round((completed / enrolled) * 100) : 0;
  const status = getCourseStatus(course);

  return {
    id: course._id,
    title: course.title || fallback.title,
    code: getCourseCode(course, index),
    category: course.category || fallback.category,
    trainerName,
    trainerInitials: initialsOf(trainerName),
    modules,
    lessons,
    enrolled,
    completion: Math.max(0, Math.min(100, completion)),
    rating: Number(course.ratings?.average || 0),
    status,
    statusLabel: getStatusLabel(status),
    updatedAt: course.updatedAt || course.createdAt || '',
    thumbnail: course.thumbnail,
    raw: course,
  };
};

const formatDate = (value: string) => {
  if (!value) return 'Not updated';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not updated';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export function TrainerMyCoursesPage() {
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => (localStorage.getItem('trainer-course-view') as ViewMode) || 'table');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [page, setPage] = useState(1);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CourseRow | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCreatePage, setShowCreatePage] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseRow | null>(null);
  const [playingCourseId, setPlayingCourseId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    localStorage.setItem('trainer-course-view', viewMode);
  }, [viewMode]);

  const loadCourses = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await getCourses({ limit: '100', createdBy: 'me' });
      const mapped = Array.isArray(res.data) ? res.data.map(mapCourse) : [];
      setCourses(mapped);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to load courses');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, category, status]);

  if (playingCourseId) {
    return <CoursePlayer courseId={playingCourseId} onBack={() => setPlayingCourseId(null)} />;
  }

  if (showCreatePage || editingCourse) {
    const raw = editingCourse?.raw as any;
    return (
      <CreateCourse
        userRole="trainer"
        onBack={() => {
          setShowCreatePage(false);
          setEditingCourse(null);
        }}
        initialCourseId={editingCourse?.id}
        initialReviewStatus={raw?.reviewStatus || raw?.status}
        initialAdminReview={raw?.adminReview}
        onPublished={() => {
          setShowCreatePage(false);
          setEditingCourse(null);
          loadCourses(true);
        }}
      />
    );
  }

  const categories = Array.from(new Set([...defaultCategories, ...courses.map((course) => course.category).filter(Boolean)])).sort();

  const filteredCourses = courses.filter((course) => {
    const query = debouncedSearch;
    const queryMatch =
      !query ||
      course.title.toLowerCase().includes(query) ||
      course.code.toLowerCase().includes(query) ||
      course.category.toLowerCase().includes(query) ||
      course.trainerName.toLowerCase().includes(query);
    const categoryMatch = !category || course.category === category;
    const statusMatch = !status || course.status === status || (status === 'published' && course.status === 'active');
    return queryMatch && categoryMatch && statusMatch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredCourses.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const pageCourses = filteredCourses.slice(startIndex, startIndex + PAGE_SIZE);

  const stats = {
    total: courses.length,
    published: courses.filter((course) => course.status === 'published' || course.status === 'active').length,
    enrolled: courses.reduce((sum, course) => sum + course.enrolled, 0),
    drafts: courses.filter((course) => course.status === 'draft').length,
    archived: courses.filter((course) => course.status === 'archived' || course.status === 'unpublished').length,
  };

  const resetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setCategory('');
    setStatus('');
  };

  const setCourseStatus = async (course: CourseRow, nextStatus: 'active' | 'archived') => {
    setActionLoading(course.id);
    try {
      const res = await updateCourseStatus(course.id, nextStatus);
      if (!res.success) {
        toast.error(res.message || 'Failed to update course status');
        return;
      }
      toast.success(nextStatus === 'active' ? 'Course published' : 'Course archived');
      await loadCourses(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update course status');
    } finally {
      setActionLoading(null);
      setActiveMenu(null);
    }
  };

  const submitForReview = async (course: CourseRow) => {
    setActionLoading(course.id);
    try {
      const res = await submitCourseForReview(course.id);
      if (!res.success) {
        toast.error(res.message || 'Failed to submit course for review');
        return;
      }
      toast.success('Course submitted for admin review');
      await loadCourses(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to submit course for review');
    } finally {
      setActionLoading(null);
      setActiveMenu(null);
    }
  };

  const deleteCourse = async () => {
    if (!deleteTarget) return;
    setActionLoading(deleteTarget.id);
    try {
      const res = await deleteCourseAPI(deleteTarget.id);
      if (!res.success) {
        toast.error(res.message || 'Failed to delete course');
        return;
      }
      toast.success('Course deleted');
      setDeleteTarget(null);
      await loadCourses(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete course');
    } finally {
      setActionLoading(null);
      setActiveMenu(null);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">My Courses</h1>
          <p className="mt-1 text-sm text-slate-600">Manage, create, and track your course portfolio</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedView value={viewMode} onChange={setViewMode} />
          <button
            type="button"
            onClick={() => loadCourses(true)}
            disabled={refreshing}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-violet-100 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowCreatePage(true)}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-700 focus:outline-none focus:ring-4 focus:ring-violet-100"
          >
            <Plus className="h-4 w-4" />
            Create Course
          </button>
        </div>
      </section>

      {loading ? (
        <CoursesSkeleton />
      ) : error ? (
        <ErrorState onRetry={() => loadCourses()} />
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <CourseStatsCard title="Total Courses" value={stats.total} helper="All courses" icon={BookOpen} tone="violet" />
            <CourseStatsCard title="Published" value={stats.published} helper="Active courses" icon={BadgeCheck} tone="green" />
            <CourseStatsCard title="Total Enrolled" value={stats.enrolled} helper="Learners enrolled" icon={Users} tone="blue" />
            <CourseStatsCard title="Drafts" value={stats.drafts} helper="Work in progress" icon={Clock} tone="orange" />
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <button
                type="button"
                onClick={() => setFiltersOpen((value) => !value)}
                className="inline-flex items-center gap-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-violet-100"
              >
                Filters
                <ChevronDown className={`h-4 w-4 transition ${filtersOpen ? 'rotate-180' : ''}`} />
              </button>
              <label className="relative w-full lg:max-w-md">
                <span className="sr-only">Search courses</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by course name, code, category..."
                  className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-slate-800 outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </label>
            </div>
            {filtersOpen && (
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
                <label className="text-sm font-medium text-slate-700">
                  Category
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                  >
                    <option value="">All Categories</option>
                    {categories.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Status
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
                  >
                    {statusOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="h-11 self-end rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-violet-100"
                >
                  Reset
                </button>
                <button
                  type="button"
                  className="h-11 self-end rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200"
                >
                  Apply Filters
                </button>
              </div>
            )}
          </section>

          {pageCourses.length ? (
            viewMode === 'table' ? (
              <CourseTable
                courses={pageCourses}
                activeMenu={activeMenu}
                actionLoading={actionLoading}
                onMenu={setActiveMenu}
                onView={setPlayingCourseId}
                onEdit={setEditingCourse}
                onSubmitForReview={submitForReview}
                onSetStatus={setCourseStatus}
                onDelete={setDeleteTarget}
              />
            ) : (
              <CourseGrid
                courses={pageCourses}
                activeMenu={activeMenu}
                actionLoading={actionLoading}
                onMenu={setActiveMenu}
                onView={setPlayingCourseId}
                onEdit={setEditingCourse}
                onSubmitForReview={submitForReview}
                onSetStatus={setCourseStatus}
                onDelete={setDeleteTarget}
              />
            )
          ) : (
            <CourseEmptyState onCreate={() => setShowCreatePage(true)} />
          )}

          <CoursePagination
            page={safePage}
            totalPages={totalPages}
            total={filteredCourses.length}
            start={filteredCourses.length ? startIndex + 1 : 0}
            end={Math.min(startIndex + PAGE_SIZE, filteredCourses.length)}
            onPage={setPage}
          />

          <SummaryFooter total={stats.total} published={stats.published} draft={stats.drafts} archived={stats.archived} />
          <QuickActions onCreate={() => setShowCreatePage(true)} />
        </>
      )}

      {deleteTarget && (
        <DeleteCourseDialog
          course={deleteTarget}
          loading={actionLoading === deleteTarget.id}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={deleteCourse}
        />
      )}
    </div>
  );
}

function SegmentedView({ value, onChange }: { value: ViewMode; onChange: (value: ViewMode) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1" aria-label="Course view mode">
      <button
        type="button"
        aria-label="Grid view"
        onClick={() => onChange('grid')}
        className={`flex h-8 w-9 items-center justify-center rounded-md transition focus:outline-none focus:ring-2 focus:ring-violet-200 ${value === 'grid' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
      >
        <Grid3X3 className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="List view"
        onClick={() => onChange('table')}
        className={`flex h-8 w-9 items-center justify-center rounded-md transition focus:outline-none focus:ring-2 focus:ring-violet-200 ${value === 'table' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
      >
        <LayoutList className="h-4 w-4" />
      </button>
    </div>
  );
}

function CourseStatsCard({ title, value, helper, icon: Icon, tone }: { title: string; value: number; helper: string; icon: any; tone: 'violet' | 'green' | 'blue' | 'orange' }) {
  const tones = {
    violet: 'bg-violet-50 text-violet-700 border-violet-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    orange: 'bg-orange-50 text-orange-700 border-orange-100',
  };
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className={`flex h-12 w-12 items-center justify-center rounded-lg border ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <ArrowRight className="h-4 w-4 text-slate-300" />
      </div>
      <p className="mt-5 text-3xl font-bold text-slate-950">{value}</p>
      <h2 className="mt-1 text-sm font-semibold text-slate-800">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{helper}</p>
    </article>
  );
}

function StatusBadge({ status, label }: { status: CourseStatus; label: string }) {
  const tones: Record<string, string> = {
    published: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    draft: 'border-orange-200 bg-orange-50 text-orange-700',
    archived: 'border-slate-200 bg-slate-100 text-slate-700',
    pending_review: 'border-blue-200 bg-blue-50 text-blue-700',
    changes_requested: 'border-amber-200 bg-amber-50 text-amber-700',
    rejected: 'border-rose-200 bg-rose-50 text-rose-700',
    unpublished: 'border-slate-200 bg-slate-100 text-slate-700',
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${tones[status] || tones.draft}`}>{label}</span>;
}

function CategoryBadge({ value }: { value: string }) {
  return <span className="inline-flex rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">{value}</span>;
}

type CourseActionsProps = {
  course: CourseRow;
  activeMenu: string | null;
  actionLoading: string | null;
  onMenu: (id: string | null) => void;
  onView: (id: string) => void;
  onEdit: (course: CourseRow) => void;
  onSubmitForReview: (course: CourseRow) => void;
  onSetStatus: (course: CourseRow, status: 'active' | 'archived') => void;
  onDelete: (course: CourseRow) => void;
};

function CourseActions(props: CourseActionsProps) {
  const { course, activeMenu, actionLoading, onMenu, onView, onEdit, onSubmitForReview, onSetStatus, onDelete } = props;
  const isOpen = activeMenu === course.id;
  const busy = actionLoading === course.id;
  const canPublish = ['draft', 'rejected', 'changes_requested', 'unpublished', 'archived'].includes(course.status);
  const isPublished = course.status === 'published' || course.status === 'active';

  return (
    <div className="relative flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={() => onView(course.id)}
        aria-label={`View ${course.title}`}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-violet-100"
      >
        <Eye className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onMenu(isOpen ? null : course.id)}
        aria-label={`Open actions for ${course.title}`}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-violet-100"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
      </button>
      {isOpen && (
        <div className="absolute right-0 top-11 z-20 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          <ActionItem label="View Course" icon={Eye} onClick={() => onView(course.id)} />
          <ActionItem label="Edit Course" icon={Edit2} onClick={() => onEdit(course)} />
          <ActionItem label="Manage Content" icon={BookOpen} onClick={() => onEdit(course)} />
          <ActionItem label="View Students" icon={Users} onClick={() => toast.info('Open Students from the sidebar to review learner activity.')} />
          <ActionItem label="View Analytics" icon={FileText} onClick={() => toast.info('Course analytics are shown in this workspace.')} />
          <ActionItem label="Duplicate Course" icon={Copy} disabled onClick={() => undefined} />
          {canPublish && <ActionItem label="Publish Course" icon={BadgeCheck} onClick={() => onSubmitForReview(course)} />}
          {isPublished && <ActionItem label="Unpublish Course" icon={Clock} onClick={() => onSetStatus(course, 'archived')} />}
          {course.status !== 'archived' && <ActionItem label="Archive Course" icon={Clock} onClick={() => onSetStatus(course, 'archived')} />}
          <ActionItem label="Delete Course" icon={Trash2} danger onClick={() => onDelete(course)} />
        </div>
      )}
    </div>
  );
}

function ActionItem({ label, icon: Icon, onClick, disabled, danger }: { label: string; icon: any; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-45 ${danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-50'}`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function CourseTable(props: { courses: CourseRow[] } & Omit<CourseActionsProps, 'course'>) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full border-collapse text-left">
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Course</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Trainer</th>
              <th className="px-4 py-3">Modules</th>
              <th className="px-4 py-3">Lessons</th>
              <th className="px-4 py-3">Enrolled</th>
              <th className="px-4 py-3">Completion</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {props.courses.map((course) => (
              <tr key={course.id} className="transition hover:bg-slate-50">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    {course.thumbnail ? (
                      <img src={course.thumbnail} alt="" className="h-11 w-11 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-violet-50 text-sm font-bold text-violet-700">
                        {course.title.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-slate-950">{course.title}</p>
                      <p className="text-xs text-slate-500">{course.code}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4"><CategoryBadge value={course.category} /></td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">{course.trainerInitials}</span>
                    <span className="text-sm font-medium text-slate-700">{course.trainerName}</span>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm font-semibold text-slate-700">{course.modules}</td>
                <td className="px-4 py-4 text-sm font-semibold text-slate-700">{course.lessons}</td>
                <td className="px-4 py-4 text-sm font-semibold text-slate-700">{course.enrolled}</td>
                <td className="px-4 py-4">
                  <Completion value={course.completion} />
                </td>
                <td className="px-4 py-4"><StatusBadge status={course.status} label={course.statusLabel} /></td>
                <td className="px-4 py-4 text-sm text-slate-500">{formatDate(course.updatedAt)}</td>
                <td className="px-5 py-4">
                  <CourseActions course={course} {...props} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CourseGrid(props: { courses: CourseRow[] } & Omit<CourseActionsProps, 'course'>) {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {props.courses.map((course) => (
        <article key={course.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {course.thumbnail ? (
                <img src={course.thumbnail} alt="" className="h-14 w-14 rounded-lg object-cover" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-violet-50 text-base font-bold text-violet-700">
                  {course.title.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold text-slate-950">{course.title}</h2>
                <p className="text-xs font-medium text-slate-500">{course.code}</p>
              </div>
            </div>
            <CourseActions course={course} {...props} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <CategoryBadge value={course.category} />
            <StatusBadge status={course.status} label={course.statusLabel} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-3 text-center">
            <Metric label="Modules" value={course.modules} />
            <Metric label="Lessons" value={course.lessons} />
            <Metric label="Enrolled" value={course.enrolled} />
          </div>
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>Completion</span>
              <span>{course.completion}%</span>
            </div>
            <Completion value={course.completion} />
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">Updated {formatDate(course.updatedAt)}</p>
            <button
              type="button"
              onClick={() => props.onView(course.id)}
              className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-violet-700 focus:outline-none focus:ring-4 focus:ring-violet-100"
            >
              View Course
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}

function Completion({ value }: { value: number }) {
  return (
    <div className="min-w-[96px]">
      <div className="h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-blue-600" style={{ width: `${value}%` }} />
      </div>
      <p className="mt-1 text-xs font-semibold text-slate-600">{value}%</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-base font-bold text-slate-950">{value}</p>
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
    </div>
  );
}

function CoursePagination({ page, totalPages, total, start, end, onPage }: { page: number; totalPages: number; total: number; start: number; end: number; onPage: (page: number) => void }) {
  const pages = Array.from({ length: Math.min(totalPages, 3) }, (_, index) => index + 1);
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm md:flex-row md:items-center md:justify-between">
      <p className="text-sm text-slate-600">
        Showing <span className="font-semibold text-slate-900">{start}</span> to <span className="font-semibold text-slate-900">{end}</span> of <span className="font-semibold text-slate-900">{total}</span> courses
      </p>
      <div className="flex items-center gap-2">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40">Previous</button>
        {pages.map((item) => (
          <button key={item} type="button" onClick={() => onPage(item)} className={`h-9 w-9 rounded-lg text-sm font-bold ${page === item ? 'bg-violet-600 text-white' : 'border border-slate-200 text-slate-700'}`}>{item}</button>
        ))}
        <button type="button" disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}

function SummaryFooter({ total, published, draft, archived }: { total: number; published: number; draft: number; archived: number }) {
  const items = [
    ['Total', total, 'bg-slate-400'],
    ['Active', published, 'bg-emerald-500'],
    ['Draft', draft, 'bg-orange-500'],
    ['Archived', archived, 'bg-slate-500'],
  ] as const;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm text-slate-600 shadow-sm">
      {items.map(([label, value, color]) => (
        <span key={label} className="inline-flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${color}`} />
          <strong className="text-slate-900">{value}</strong> {label.toLowerCase()}
        </span>
      ))}
    </div>
  );
}

function QuickActions({ onCreate }: { onCreate: () => void }) {
  const actions = [
    { title: 'Create Course', desc: 'Build a new learning course', icon: Plus, onClick: onCreate },
    { title: 'Create Batch', desc: 'Create a new learner batch', icon: Users, onClick: () => toast.info('Open Batches from the sidebar to create a batch.') },
    { title: 'Add Assignment', desc: 'Create a course assignment', icon: FileText, onClick: () => toast.info('Open Assignments from the sidebar to manage assignments.') },
  ];
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-950">Quick Actions</h2>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button key={action.title} type="button" onClick={action.onClick} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-violet-200 hover:bg-violet-50 focus:outline-none focus:ring-4 focus:ring-violet-100">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700"><Icon className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-slate-950">{action.title}</span>
                <span className="block truncate text-xs text-slate-500">{action.desc}</span>
              </span>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function CourseEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white px-5 py-14 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
        <BookOpen className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-bold text-slate-950">No courses yet</h2>
      <p className="mt-2 text-sm text-slate-500">Create your first banking course and start training learners.</p>
      <button type="button" onClick={onCreate} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 focus:outline-none focus:ring-4 focus:ring-violet-100">
        <Plus className="h-4 w-4" />
        Create Course
      </button>
    </section>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="rounded-lg border border-rose-200 bg-white px-5 py-10 text-center shadow-sm">
      <h2 className="text-lg font-bold text-slate-950">Unable to load courses</h2>
      <p className="mt-2 text-sm text-slate-500">Please check your connection and try again.</p>
      <button type="button" onClick={onRetry} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 focus:outline-none focus:ring-4 focus:ring-violet-100">
        <RefreshCw className="h-4 w-4" />
        Retry
      </button>
    </section>
  );
}

function CoursesSkeleton() {
  return (
    <>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-36" />)}
      </section>
      <Skeleton className="h-28" />
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-16" />)}
        </div>
      </section>
    </>
  );
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-100 ${className}`} />;
}

function DeleteCourseDialog({ course, loading, onCancel, onConfirm }: { course: CourseRow; loading: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-slate-950">Delete course?</h2>
        <p className="mt-2 text-sm text-slate-600">
          This will delete <strong>{course.title}</strong>. This action cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
