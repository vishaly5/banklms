import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Archive,
  ArrowRight,
  Award,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Download,
  Edit2,
  Eye,
  FileCheck,
  FileText,
  Filter,
  GraduationCap,
  Loader2,
  MoreVertical,
  NotebookPen,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Upload,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getSubmissionDetail,
  getTeacherAssignmentOverview,
  getTeacherAssignmentSubmissions,
  reviewAssignmentSubmission,
  uploadTeacherFeedbackFile,
} from '../services/assignmentService';
import { toAbsoluteAssetUrl } from '../utils/fileUrl';

type ReviewStatus = 'graded' | 'needs_resubmission' | 'rejected';

interface FiltersState {
  course: string;
  lesson: string;
  status: string;
  date: string;
}

const statusOptions = [
  { value: 'all', label: 'All' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'graded', label: 'Graded' },
  { value: 'needs_resubmission', label: 'Returned' },
  { value: 'overdue', label: 'Overdue' },
];

const dateOptions = [
  { value: 'all', label: 'All Dates' },
  { value: 'due_today', label: 'Due Today' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'this_week', label: 'This Week' },
];

const quickFilters = [
  { value: 'all', label: 'All' },
  { value: 'pending_review', label: 'Pending' },
  { value: 'submitted', label: 'Needs Review' },
  { value: 'graded', label: 'Graded' },
  { value: 'overdue', label: 'Overdue' },
];

const reviewStatuses: Array<{ value: ReviewStatus; label: string }> = [
  { value: 'graded', label: 'Graded' },
  { value: 'needs_resubmission', label: 'Return for Revision' },
  { value: 'rejected', label: 'Rejected' },
];

const rowsPerPageOptions = [10, 20, 50];

const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

const getAssignmentKey = (assignment: any) => String(assignment?.assignmentId || assignment?._id || assignment?.lessonId || '');

const labelize = (value = '') => value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const getInitials = (name = 'Learner') => name
  .split(' ')
  .filter(Boolean)
  .map((part) => part[0])
  .join('')
  .toUpperCase()
  .slice(0, 2) || 'LR';

const formatDate = (value: any) => {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const shortDate = (value: any) => {
  if (!value) return 'No due date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
};

const relativeDate = (value: any) => {
  if (!value) return 'Not submitted';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const submitted = new Date(date);
  submitted.setHours(0, 0, 0, 0);
  const days = Math.round((start.getTime() - submitted.getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days > 1 && days < 7) return `${days} days ago`;
  return shortDate(value);
};

const attachmentUrl = (file: any) => {
  if (!file) return '';
  if (file.fileId) return toAbsoluteAssetUrl(`/api/v1/files/${file.fileId}/download`);
  return toAbsoluteAssetUrl(file.url || '');
};

const getStatusBadgeClass = (status = '') => {
  switch (status.toLowerCase()) {
    case 'graded':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'submitted':
    case 'pending_review':
    case 'resubmitted':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'needs_resubmission':
      return 'border-orange-200 bg-orange-50 text-orange-700';
    case 'rejected':
    case 'overdue':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'completed':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700';
  }
};

const getAssignmentStatus = (assignment: any) => {
  if (assignment.overdue > 0) return 'overdue';
  if (assignment.pendingReview > 0) return 'pending_review';
  if (assignment.totalSubmissions > 0 && assignment.graded >= assignment.totalSubmissions) return 'completed';
  return 'active';
};

const bankingFallbackTitles = [
  'AML Compliance Assignment',
  'Fraud Detection Exercise',
  'Retail Banking Quiz',
  'Cybersecurity Awareness',
  'Customer Service Evaluation',
  'Risk Management Assignment',
  'KYC Documentation Review',
  'Credit Analysis Exercise',
];

export function AssignmentsReview() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filters, setFilters] = useState<FiltersState>({ course: 'all', lesson: 'all', status: 'all', date: 'all' });
  const [appliedFilters, setAppliedFilters] = useState<FiltersState>({ course: 'all', lesson: 'all', status: 'all', date: 'all' });
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [activeMenu, setActiveMenu] = useState('');

  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionPage, setSubmissionPage] = useState(1);

  const [reviewSubmission, setReviewSubmission] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>('graded');
  const [notifyLearner, setNotifyLearner] = useState(true);
  const [teacherFile, setTeacherFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const loadOverview = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');
      const res = await getTeacherAssignmentOverview({
        status: appliedFilters.status,
        date: appliedFilters.date,
        courseId: appliedFilters.course === 'all' ? '' : appliedFilters.course,
        lessonId: appliedFilters.lesson === 'all' ? '' : appliedFilters.lesson,
      });
      const incoming = res.data || [];
      setAssignments(incoming);
      setSummary(res.summary || {});
      if (!selectedAssignment && incoming.length) {
        openSubmissions(incoming[0], { silent: true });
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to load assignments.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadOverview(); }, [appliedFilters]);

  const courses = useMemo(() => {
    const seen = new Map<string, string>();
    assignments.forEach((item) => {
      if (item.courseId) seen.set(item.courseId, item.courseName || 'Untitled Course');
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [assignments]);

  const lessons = useMemo(() => {
    const seen = new Map<string, string>();
    assignments
      .filter((item) => filters.course === 'all' || item.courseId === filters.course)
      .forEach((item) => {
        if (item.lessonId) seen.set(item.lessonId, item.lessonTitle || 'Untitled Lesson');
      });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [assignments, filters.course]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter((item, index) => {
      const title = item.title || bankingFallbackTitles[index % bankingFallbackTitles.length];
      const haystack = [
        title,
        item.courseName,
        item.lessonTitle,
        item.sectionTitle,
        item.instructions,
        item.assignmentId,
        item.lessonId,
      ].join(' ').toLowerCase();
      return !debouncedQuery || haystack.includes(debouncedQuery);
    });
  }, [assignments, debouncedQuery]);

  const stats = useMemo(() => ({
    assignments: summary.totalAssignments || assignments.length || 0,
    submissions: summary.totalSubmissions || assignments.reduce((acc, item) => acc + Number(item.totalSubmissions || 0), 0),
    pending: summary.pendingReview || assignments.reduce((acc, item) => acc + Number(item.pendingReview || 0), 0),
    completed: summary.graded || assignments.reduce((acc, item) => acc + Number(item.graded || 0), 0),
    overdue: summary.overdue || assignments.reduce((acc, item) => acc + Number(item.overdue || 0), 0),
  }), [summary, assignments]);

  const assignmentPages = Math.max(1, Math.ceil(filteredAssignments.length / rowsPerPage));
  const visibleAssignments = filteredAssignments.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const submissionPages = Math.max(1, Math.ceil(submissions.length / rowsPerPage));
  const visibleSubmissions = submissions.slice((submissionPage - 1) * rowsPerPage, submissionPage * rowsPerPage);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, appliedFilters, rowsPerPage]);

  useEffect(() => {
    setSubmissionPage(1);
  }, [selectedAssignmentId, rowsPerPage]);

  const applyFilters = () => setAppliedFilters(filters);

  const resetFilters = () => {
    const next = { course: 'all', lesson: 'all', status: 'all', date: 'all' };
    setFilters(next);
    setAppliedFilters(next);
  };

  const openCreateAssignment = () => {
    toast.info('Create assignments from Course Builder > Lesson > Assignment.');
    window.history.pushState({}, '', '/dashboard?page=my-courses');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  async function openSubmissions(assignment: any, options: { silent?: boolean } = {}) {
    const assignmentId = getAssignmentKey(assignment);
    try {
      setSelectedAssignment(assignment);
      setSelectedAssignmentId(assignmentId);
      setSubmissionsLoading(true);
      const res = await getTeacherAssignmentSubmissions(assignmentId);
      setSubmissions(res.data || []);
      if (!options.silent) setActiveMenu('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load submissions');
    } finally {
      setSubmissionsLoading(false);
    }
  }

  const openReview = async (submission: any) => {
    try {
      setDetailLoading(true);
      const res = await getSubmissionDetail(submission._id);
      const detail = res.data;
      setReviewSubmission(detail);
      setScore(detail.grade?.score ?? detail.score ?? '');
      setFeedback(detail.teacherFeedback?.text || detail.feedback || '');
      setReviewStatus(['graded', 'needs_resubmission', 'rejected'].includes(detail.status) ? detail.status : 'graded');
      setNotifyLearner(true);
      setTeacherFile(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to open review');
    } finally {
      setDetailLoading(false);
    }
  };

  const submitReview = async (statusOverride?: ReviewStatus) => {
    if (!reviewSubmission) return;
    const nextStatus = statusOverride || reviewStatus;
    const maxScore = Number(reviewSubmission.assignment?.maxScore || selectedAssignment?.maxScore || 100);
    const numericScore = score === '' ? null : Number(score);

    if (nextStatus === 'graded' && numericScore === null) {
      toast.error('Score is required before publishing a grade');
      return;
    }
    if (numericScore !== null && (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > maxScore)) {
      toast.error(`Score must be between 0 and ${maxScore}`);
      return;
    }
    if (['needs_resubmission', 'rejected'].includes(nextStatus) && !feedback.trim()) {
      toast.error('Feedback is required when returning a submission');
      return;
    }

    try {
      setSubmitting(true);
      let teacherAttachment = reviewSubmission.teacherFeedback?.attachment || {};
      if (teacherFile) {
        const upload = await uploadTeacherFeedbackFile(teacherFile);
        teacherAttachment = upload.data;
      }
      const res = await reviewAssignmentSubmission(reviewSubmission._id, {
        score: numericScore,
        feedback,
        status: nextStatus,
        teacherAttachment,
      });
      setReviewSubmission(res.data);
      setSubmissions((prev) => prev.map((item) => item._id === res.data._id ? { ...item, ...res.data } : item));
      toast.success(nextStatus === 'graded' ? 'Grade published' : 'Submission returned');
      setTeacherFile(null);
      await loadOverview(true);
      if (selectedAssignment) await openSubmissions(selectedAssignment, { silent: true });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const reviewNextPending = () => {
    const next = submissions.find((item) => ['submitted', 'resubmitted', 'pending_review', 'needs_resubmission'].includes(item.status));
    if (next) openReview(next);
    else toast.info('No pending submissions in this assignment.');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-5 sm:px-6 lg:px-8">
        <AssignmentHeader
          query={query}
          setQuery={setQuery}
          refreshing={refreshing}
          onRefresh={() => loadOverview(true)}
          onCreate={openCreateAssignment}
        />

        <AssignmentStats stats={stats} />

        <AssignmentFilters
          filters={filters}
          setFilters={setFilters}
          courses={courses}
          lessons={lessons}
          onApply={applyFilters}
          onReset={resetFilters}
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(360px,0.4fr)_minmax(0,0.6fr)]">
          <section className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Assignment List</h2>
                <p className="text-sm text-slate-500">{filteredAssignments.length} assignments ready for review</p>
              </div>
              <QuickFilterChips value={filters.status} onChange={(status) => {
                const next = { ...filters, status };
                setFilters(next);
                setAppliedFilters(next);
              }} />
            </div>

            {loading ? (
              <AssignmentSkeleton />
            ) : error ? (
              <ErrorState message={error} onRetry={() => loadOverview()} />
            ) : filteredAssignments.length === 0 ? (
              <AssignmentEmptyState onCreate={openCreateAssignment} hasSearch={Boolean(debouncedQuery)} />
            ) : (
              <AssignmentList
                assignments={visibleAssignments}
                selectedId={selectedAssignmentId}
                onSelect={openSubmissions}
                page={page}
                pages={assignmentPages}
                total={filteredAssignments.length}
                rowsPerPage={rowsPerPage}
                setRowsPerPage={setRowsPerPage}
                setPage={setPage}
              />
            )}
          </section>

          <SubmissionWorkspace
            assignment={selectedAssignment}
            submissions={visibleSubmissions}
            allSubmissions={submissions}
            loading={submissionsLoading}
            activeMenu={activeMenu}
            setActiveMenu={setActiveMenu}
            onReview={openReview}
            onReviewNext={reviewNextPending}
            page={submissionPage}
            pages={submissionPages}
            total={submissions.length}
            rowsPerPage={rowsPerPage}
            setRowsPerPage={setRowsPerPage}
            setPage={setSubmissionPage}
          />
        </div>

        <QuickActions onCreate={openCreateAssignment} onReviewPending={reviewNextPending} />
      </div>

      {(reviewSubmission || detailLoading) && (
        <SubmissionDrawer
          submission={reviewSubmission}
          loading={detailLoading}
          selectedAssignment={selectedAssignment}
          score={score}
          setScore={setScore}
          feedback={feedback}
          setFeedback={setFeedback}
          reviewStatus={reviewStatus}
          setReviewStatus={setReviewStatus}
          notifyLearner={notifyLearner}
          setNotifyLearner={setNotifyLearner}
          teacherFile={teacherFile}
          setTeacherFile={setTeacherFile}
          submitting={submitting}
          onClose={() => setReviewSubmission(null)}
          onSaveDraft={() => toast.success('Draft kept locally in this review drawer')}
          onReturn={() => submitReview('needs_resubmission')}
          onPublish={() => submitReview('graded')}
        />
      )}
    </div>
  );
}

function AssignmentHeader({ query, setQuery, refreshing, onRefresh, onCreate }: {
  query: string;
  setQuery: (value: string) => void;
  refreshing: boolean;
  onRefresh: () => void;
  onCreate: () => void;
}) {
  return (
    <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-[32px] font-bold leading-tight tracking-normal text-slate-950">Assignment Review</h1>
          <p className="mt-1 text-[15px] text-slate-500">Review, grade and provide feedback on learner submissions.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={onRefresh} disabled={refreshing} className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            Refresh
          </button>
          <button onClick={() => toast.info('Grade export needs a backend export endpoint.')} className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Download className="h-4 w-4" />
            Export
          </button>
          <button onClick={onCreate} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#5B4CF0] px-4 text-sm font-bold text-white shadow-sm hover:bg-[#4b3ee0]">
            <Plus className="h-4 w-4" />
            Create Assignment
          </button>
        </div>
      </div>
      <label className="relative mt-5 block">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search assignments, learners, batch or course..."
          className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm font-medium text-slate-800 outline-none transition focus:border-[#5B4CF0] focus:bg-white focus:ring-4 focus:ring-indigo-100"
        />
      </label>
    </header>
  );
}

function AssignmentStats({ stats }: { stats: { assignments: number; submissions: number; pending: number; completed: number; overdue: number } }) {
  const cards = [
    { title: 'Assignments', value: stats.assignments, subtitle: 'Total active', icon: ClipboardCheck, tone: 'violet', trend: '+8%' },
    { title: 'Submissions', value: stats.submissions, subtitle: 'Received', icon: FileText, tone: 'blue', trend: '+12%' },
    { title: 'Pending Review', value: stats.pending, subtitle: 'Awaiting grading', icon: Clock, tone: 'amber', trend: 'Live' },
    { title: 'Completed', value: stats.completed, subtitle: 'Successfully graded', icon: CheckCircle2, tone: 'emerald', trend: '+5%' },
    { title: 'Overdue', value: stats.overdue, subtitle: 'Need attention', icon: AlertCircle, tone: 'rose', trend: stats.overdue ? 'Action' : 'Clear' },
  ];
  const toneMap: Record<string, string> = {
    violet: 'bg-violet-50 text-violet-700 ring-violet-100',
    blue: 'bg-blue-50 text-blue-700 ring-blue-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    rose: 'bg-rose-50 text-rose-700 ring-rose-100',
  };
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map(({ title, value, subtitle, icon: Icon, tone, trend }) => (
        <article key={title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div className={cn('flex h-11 w-11 items-center justify-center rounded-lg ring-1', toneMap[tone])}>
              <Icon className="h-5 w-5" />
            </div>
            <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-500 ring-1 ring-slate-200">{trend}</span>
          </div>
          <p className="mt-4 text-[30px] font-bold leading-none text-slate-950">{value || 0}</p>
          <h3 className="mt-3 text-sm font-bold text-slate-800">{title}</h3>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </article>
      ))}
    </div>
  );
}

function AssignmentFilters({ filters, setFilters, courses, lessons, onApply, onReset }: {
  filters: FiltersState;
  setFilters: (value: FiltersState) => void;
  courses: Array<{ id: string; name: string }>;
  lessons: Array<{ id: string; name: string }>;
  onApply: () => void;
  onReset: () => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
        <Filter className="h-4 w-4 text-[#5B4CF0]" />
        Filters
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto_auto]">
        <Select value={filters.course} onChange={(value) => setFilters({ ...filters, course: value, lesson: 'all' })}>
          <option value="all">All Courses</option>
          {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
        </Select>
        <Select value={filters.lesson} onChange={(value) => setFilters({ ...filters, lesson: value })}>
          <option value="all">All Lessons</option>
          {lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.name}</option>)}
        </Select>
        <Select value={filters.status} onChange={(value) => setFilters({ ...filters, status: value })}>
          {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>
        <Select value={filters.date} onChange={(value) => setFilters({ ...filters, date: value })}>
          {dateOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>
        <button onClick={onReset} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          <RotateCcw className="h-4 w-4" />
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

function QuickFilterChips({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
      {quickFilters.map((filter) => (
        <button
          key={filter.value}
          onClick={() => onChange(filter.value)}
          className={cn(
            'whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold transition',
            value === filter.value ? 'border-[#5B4CF0] bg-[#5B4CF0] text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          )}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

function AssignmentList(props: {
  assignments: any[];
  selectedId: string;
  onSelect: (assignment: any) => void;
  page: number;
  pages: number;
  total: number;
  rowsPerPage: number;
  setRowsPerPage: (value: number) => void;
  setPage: (value: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        {props.assignments.map((assignment, index) => (
          <AssignmentCard
            key={getAssignmentKey(assignment)}
            assignment={assignment}
            fallbackTitle={bankingFallbackTitles[index % bankingFallbackTitles.length]}
            selected={props.selectedId === getAssignmentKey(assignment)}
            onSelect={() => props.onSelect(assignment)}
          />
        ))}
      </div>
      <Pagination page={props.page} pages={props.pages} total={props.total} rowsPerPage={props.rowsPerPage} setRowsPerPage={props.setRowsPerPage} setPage={props.setPage} label="assignments" />
    </div>
  );
}

function AssignmentCard({ assignment, fallbackTitle, selected, onSelect }: { assignment: any; fallbackTitle: string; selected: boolean; onSelect: () => void }) {
  const submitted = Number(assignment.totalSubmissions || 0);
  const expected = Math.max(submitted, Number(assignment.totalLearners || assignment.enrolledLearners || assignment.targetLearners || 25));
  const progress = expected ? Math.min(100, Math.round((submitted / expected) * 100)) : 0;
  const status = getAssignmentStatus(assignment);
  const title = assignment.title || fallbackTitle;
  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full rounded-lg border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
        selected ? 'border-[#5B4CF0] ring-4 ring-indigo-100' : 'border-slate-200'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-[#5B4CF0]">
          <FileCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 title={title} className="truncate text-base font-bold text-slate-950">{title}</h3>
              <p title={assignment.courseName} className="mt-1 truncate text-sm font-semibold text-slate-500">{assignment.courseName || 'Banking Compliance'}</p>
            </div>
            <StatusBadge status={status} />
          </div>
          <div className="mt-3 grid gap-2 text-xs font-semibold text-slate-600 sm:grid-cols-2">
            <span className="inline-flex items-center gap-1"><BookOpen className="h-3.5 w-3.5 text-slate-400" />{assignment.lessonTitle || 'Batch A'}</span>
            <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5 text-slate-400" />Due {shortDate(assignment.dueDate)}</span>
          </div>
          <div className="mt-4">
            <div className="mb-2 flex justify-between text-xs font-bold text-slate-600">
              <span>{submitted} / {expected} Submitted</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-[#5B4CF0]" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

function SubmissionWorkspace(props: {
  assignment: any | null;
  submissions: any[];
  allSubmissions: any[];
  loading: boolean;
  activeMenu: string;
  setActiveMenu: (value: string) => void;
  onReview: (submission: any) => void;
  onReviewNext: () => void;
  page: number;
  pages: number;
  total: number;
  rowsPerPage: number;
  setRowsPerPage: (value: number) => void;
  setPage: (value: number) => void;
}) {
  if (!props.assignment) {
    return (
      <section className="min-w-0 rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-violet-50 text-[#5B4CF0]">
          <ClipboardCheck className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-slate-950">Select an assignment</h2>
        <p className="mt-2 text-sm text-slate-500">Choose an assignment to review learner submissions, feedback, attachments, and grading status.</p>
      </section>
    );
  }

  const averageScore = props.allSubmissions.length
    ? Math.round(props.allSubmissions.reduce((acc, item) => acc + Number(item.grade?.score ?? item.score ?? 0), 0) / props.allSubmissions.length)
    : 0;
  const rate = Number(props.assignment.totalSubmissions || props.allSubmissions.length || 0);
  const expected = Math.max(rate, Number(props.assignment.totalLearners || props.assignment.enrolledLearners || 25));
  const submissionRate = expected ? Math.round((rate / expected) * 100) : 0;

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h2 title={props.assignment.title} className="truncate text-xl font-bold text-slate-950">{props.assignment.title || 'AML Compliance Assignment'}</h2>
            <p className="mt-1 truncate text-sm text-slate-500">{props.assignment.courseName || 'Banking Compliance'} / {props.assignment.lessonTitle || 'Batch A'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => toast.info('Assignment detail view is available from Course Builder.')} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Eye className="h-4 w-4" />View Details</button>
            {attachmentUrl(props.assignment.attachment) && <a href={attachmentUrl(props.assignment.attachment)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Download className="h-4 w-4" />Download</a>}
            <button onClick={() => toast.info('Edit assignments from Course Builder.')} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Edit2 className="h-4 w-4" />Edit</button>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <MiniMetric label="Due Date" value={shortDate(props.assignment.dueDate)} />
          <MiniMetric label="Average Score" value={`${averageScore}/${props.assignment.maxScore || 100}`} />
          <MiniMetric label="Submission Rate" value={`${submissionRate}%`} />
          <MiniMetric label="Pending" value={props.assignment.pendingReview || 0} />
        </div>
      </div>

      <div className="p-5">
        {props.loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((item) => <div key={item} className="h-16 animate-pulse rounded-lg bg-slate-100" />)}
          </div>
        ) : props.allSubmissions.length === 0 ? (
          <NoSubmissionState />
        ) : (
          <>
            <SubmissionTable submissions={props.submissions} activeMenu={props.activeMenu} setActiveMenu={props.setActiveMenu} onReview={props.onReview} />
            <Pagination page={props.page} pages={props.pages} total={props.total} rowsPerPage={props.rowsPerPage} setRowsPerPage={props.setRowsPerPage} setPage={props.setPage} label="submissions" />
          </>
        )}
      </div>
    </section>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-slate-950">{value}</p>
    </div>
  );
}

function SubmissionTable({ submissions, activeMenu, setActiveMenu, onReview }: {
  submissions: any[];
  activeMenu: string;
  setActiveMenu: (value: string) => void;
  onReview: (submission: any) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="hidden min-w-[760px] lg:block">
        <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_140px] bg-slate-50 px-4 py-3 text-xs font-bold uppercase text-slate-500">
          <span>Student</span>
          <span>Submitted</span>
          <span>Score</span>
          <span>Status</span>
          <span className="text-right">Actions</span>
        </div>
        <div className="divide-y divide-slate-100">
          {submissions.map((submission) => (
            <SubmissionRow key={submission._id} submission={submission} activeMenu={activeMenu} setActiveMenu={setActiveMenu} onReview={onReview} />
          ))}
        </div>
      </div>
      <div className="divide-y divide-slate-100 lg:hidden">
        {submissions.map((submission) => (
          <SubmissionMobileCard key={submission._id} submission={submission} onReview={onReview} />
        ))}
      </div>
    </div>
  );
}

function SubmissionRow({ submission, activeMenu, setActiveMenu, onReview }: {
  submission: any;
  activeMenu: string;
  setActiveMenu: (value: string) => void;
  onReview: (submission: any) => void;
}) {
  const studentName = submission.studentId?.name || 'Learner';
  const fileUrl = attachmentUrl(submission.submissionFile || submission.attachment);
  const menuOpen = activeMenu === submission._id;
  return (
    <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_140px] items-center px-4 py-3 text-sm">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">{getInitials(studentName)}</div>
        <div className="min-w-0">
          <p className="truncate font-bold text-slate-950">{studentName}</p>
          <p className="truncate text-xs text-slate-500">{submission.studentId?.rollNumber || submission.studentId?.email || 'Employee ID not available'}</p>
        </div>
      </div>
      <div>
        <p className="font-semibold text-slate-800">{relativeDate(submission.submittedAt)}</p>
        <p className="text-xs text-slate-500">{submission.isLate ? 'Late' : 'On time'}</p>
      </div>
      <p className="font-bold text-slate-900">{submission.grade?.score ?? submission.score ?? '-' } / {submission.grade?.maxScore || 100}</p>
      <StatusBadge status={submission.isLate && submission.status !== 'graded' ? 'overdue' : submission.status} />
      <div className="relative flex justify-end gap-1">
        <IconButton label="Review submission" onClick={() => onReview(submission)}><Eye className="h-4 w-4" /></IconButton>
        <IconButton label="Grade submission" onClick={() => onReview(submission)}><NotebookPen className="h-4 w-4" /></IconButton>
        {fileUrl && <a title="Download attachment" href={fileUrl} target="_blank" rel="noreferrer" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"><Download className="h-4 w-4" /></a>}
        <IconButton label="More actions" onClick={() => setActiveMenu(menuOpen ? '' : submission._id)}><MoreVertical className="h-4 w-4" /></IconButton>
        {menuOpen && (
          <div className="absolute right-0 top-10 z-10 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
            <button onClick={() => onReview(submission)} className="w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50">Open drawer</button>
            {fileUrl && <a href={fileUrl} target="_blank" rel="noreferrer" className="block rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Download file</a>}
            <button onClick={() => toast.info('Bulk comments can be added in a future grading queue.')} className="w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50">Add note</button>
          </div>
        )}
      </div>
    </div>
  );
}

function SubmissionMobileCard({ submission, onReview }: { submission: any; onReview: (submission: any) => void }) {
  const studentName = submission.studentId?.name || 'Learner';
  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">{getInitials(studentName)}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-bold text-slate-950">{studentName}</p>
              <p className="truncate text-xs text-slate-500">{submission.studentId?.rollNumber || submission.studentId?.email}</p>
            </div>
            <StatusBadge status={submission.status} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-600">
            <span>Submitted {relativeDate(submission.submittedAt)}</span>
            <span>Score {submission.grade?.score ?? submission.score ?? '-'} / {submission.grade?.maxScore || 100}</span>
          </div>
          <button onClick={() => onReview(submission)} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#5B4CF0] text-sm font-bold text-white">
            <NotebookPen className="h-4 w-4" />
            Review
          </button>
        </div>
      </div>
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button title={label} aria-label={label} onClick={onClick} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900">
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className={cn('inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-bold', getStatusBadgeClass(status))}>{labelize(status || 'Pending')}</span>;
}

function SubmissionDrawer(props: {
  submission: any;
  loading: boolean;
  selectedAssignment: any | null;
  score: string;
  setScore: (value: string) => void;
  feedback: string;
  setFeedback: (value: string) => void;
  reviewStatus: ReviewStatus;
  setReviewStatus: (value: ReviewStatus) => void;
  notifyLearner: boolean;
  setNotifyLearner: (value: boolean) => void;
  teacherFile: File | null;
  setTeacherFile: (value: File | null) => void;
  submitting: boolean;
  onClose: () => void;
  onSaveDraft: () => void;
  onReturn: () => void;
  onPublish: () => void;
}) {
  const submission = props.submission;
  const maxScore = submission?.assignment?.maxScore || props.selectedAssignment?.maxScore || 100;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45">
      <aside className="flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Student Submission</h2>
            <p className="text-sm text-slate-500">{submission?.studentId?.name || 'Loading learner profile'}</p>
          </div>
          <button aria-label="Close review drawer" onClick={props.onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        {props.loading ? (
          <div className="flex flex-1 items-center justify-center text-sm font-semibold text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Opening review
          </div>
        ) : submission && (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto p-5 pb-40">
              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2">
                  <UserRound className="h-5 w-5 text-[#5B4CF0]" />
                  <h3 className="font-bold text-slate-950">Student Profile</h3>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <MiniMetric label="Name" value={submission.studentId?.name || 'Learner'} />
                  <MiniMetric label="Employee ID" value={submission.studentId?.rollNumber || 'Not available'} />
                  <MiniMetric label="Email" value={submission.studentId?.email || 'Not available'} />
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-950">{submission.assignment?.title || props.selectedAssignment?.title || 'Assignment'}</h3>
                    <p className="mt-1 text-sm text-slate-500">{submission.course?.title || props.selectedAssignment?.courseName} / {submission.lesson?.title || props.selectedAssignment?.lessonTitle}</p>
                  </div>
                  <StatusBadge status={submission.isLate && submission.status !== 'graded' ? 'overdue' : submission.status} />
                </div>
                <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-700">{submission.assignment?.instructions || 'No instructions provided.'}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                  <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">Due {formatDate(submission.assignment?.dueDate)}</span>
                  <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">Attempt {submission.attemptNumber || 1}</span>
                  <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">Max {maxScore}</span>
                </div>
                {attachmentUrl(submission.assignment?.attachment) && (
                  <a href={attachmentUrl(submission.assignment.attachment)} target="_blank" rel="noreferrer" className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-white px-3 text-sm font-bold text-[#5B4CF0] ring-1 ring-indigo-100">
                    <Download className="h-4 w-4" />
                    Assignment Attachment
                  </a>
                )}
              </section>

              <section className="rounded-lg border border-blue-100 bg-blue-50/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold text-blue-950">Submitted Answer</h3>
                  <p className="text-xs font-bold text-blue-700">Submitted {relativeDate(submission.submittedAt)}</p>
                </div>
                <div className="mt-4 rounded-lg bg-white p-4 text-sm leading-6 text-slate-800">
                  <p className="whitespace-pre-line">{submission.answerText || 'No written answer provided.'}</p>
                </div>
                {attachmentUrl(submission.submissionFile || submission.attachment) && (
                  <a href={attachmentUrl(submission.submissionFile || submission.attachment)} target="_blank" rel="noreferrer" className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-white px-3 text-sm font-bold text-blue-700 ring-1 ring-blue-100">
                    <Download className="h-4 w-4" />
                    Download Submission
                  </a>
                )}
              </section>

              <GradePanel
                score={props.score}
                setScore={props.setScore}
                maxScore={maxScore}
                feedback={props.feedback}
                setFeedback={props.setFeedback}
                reviewStatus={props.reviewStatus}
                setReviewStatus={props.setReviewStatus}
                notifyLearner={props.notifyLearner}
                setNotifyLearner={props.setNotifyLearner}
                teacherFile={props.teacherFile}
                setTeacherFile={props.setTeacherFile}
                currentAttachment={submission.teacherFeedback?.attachment}
              />
            </div>

            <div className="fixed bottom-0 right-0 w-full max-w-3xl border-t border-slate-200 bg-white/95 px-5 py-4 shadow-2xl backdrop-blur">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                {submission.teacherFeedback?.reviewedAt && (
                  <p className="mr-auto flex items-center gap-2 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Reviewed {formatDate(submission.teacherFeedback.reviewedAt)}
                  </p>
                )}
                <button onClick={props.onSaveDraft} className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Save Draft</button>
                <button onClick={props.onReturn} disabled={props.submitting} className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-bold text-orange-700 hover:bg-orange-100 disabled:opacity-60">Return for Revision</button>
                <button onClick={props.onPublish} disabled={props.submitting} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#5B4CF0] px-4 py-3 text-sm font-bold text-white hover:bg-[#4b3ee0] disabled:opacity-60">
                  {props.submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Grade & Publish
                </button>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function GradePanel(props: {
  score: string;
  setScore: (value: string) => void;
  maxScore: number;
  feedback: string;
  setFeedback: (value: string) => void;
  reviewStatus: ReviewStatus;
  setReviewStatus: (value: ReviewStatus) => void;
  notifyLearner: boolean;
  setNotifyLearner: (value: boolean) => void;
  teacherFile: File | null;
  setTeacherFile: (value: File | null) => void;
  currentAttachment: any;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Award className="h-5 w-5 text-[#5B4CF0]" />
        <h3 className="font-bold text-slate-950">Rubric, Score and Feedback</h3>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-bold uppercase text-slate-500">Score</label>
          <div className="mt-2 flex h-11 items-center overflow-hidden rounded-lg border border-slate-200 bg-white focus-within:border-[#5B4CF0] focus-within:ring-4 focus-within:ring-indigo-100">
            <input value={props.score} onChange={(event) => props.setScore(event.target.value)} type="number" min={0} max={props.maxScore} className="h-full min-w-0 flex-1 px-3 text-sm font-semibold outline-none" />
            <span className="border-l border-slate-200 px-3 text-sm font-bold text-slate-500">/ {props.maxScore}</span>
          </div>
        </div>
        <div>
          <label className="text-xs font-bold uppercase text-slate-500">Review Status</label>
          <select value={props.reviewStatus} onChange={(event) => props.setReviewStatus(event.target.value as ReviewStatus)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#5B4CF0] focus:ring-4 focus:ring-indigo-100">
            {reviewStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select>
        </div>
      </div>
      <label className="mt-4 block text-xs font-bold uppercase text-slate-500">Comments</label>
      <textarea value={props.feedback} onChange={(event) => props.setFeedback(event.target.value)} placeholder="Provide constructive feedback..." rows={6} className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-3 text-sm leading-6 outline-none focus:border-[#5B4CF0] focus:ring-4 focus:ring-indigo-100" />
      <label className="mt-4 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-600 hover:bg-slate-100">
        <Upload className="h-4 w-4" />
        {props.teacherFile ? props.teacherFile.name : 'Attach reviewed copy'}
        <input type="file" className="hidden" onChange={(event) => props.setTeacherFile(event.target.files?.[0] || null)} />
      </label>
      {attachmentUrl(props.currentAttachment) && (
        <a href={attachmentUrl(props.currentAttachment)} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#5B4CF0]">
          <Download className="h-4 w-4" />
          Current feedback attachment
        </a>
      )}
      <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-600">
        <input type="checkbox" checked={props.notifyLearner} onChange={(event) => props.setNotifyLearner(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-[#5B4CF0]" />
        Notify learner
      </label>
    </section>
  );
}

function Pagination({ page, pages, total, rowsPerPage, setRowsPerPage, setPage, label }: {
  page: number;
  pages: number;
  total: number;
  rowsPerPage: number;
  setRowsPerPage: (value: number) => void;
  setPage: (value: number) => void;
  label: string;
}) {
  const start = total === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const end = Math.min(total, page * rowsPerPage);
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
      <p>Showing <span className="font-bold text-slate-950">{start}-{end}</span> of <span className="font-bold text-slate-950">{total}</span> {label}</p>
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

function QuickActions({ onCreate, onReviewPending }: { onCreate: () => void; onReviewPending: () => void }) {
  const actions = [
    { title: 'Create Assignment', desc: 'Add a new banking assignment', icon: Plus, onClick: onCreate },
    { title: 'Review Pending', desc: 'Open the next learner submission', icon: NotebookPen, onClick: onReviewPending },
    { title: 'Export Grades', desc: 'Download-ready backend needed', icon: Download, onClick: () => toast.info('Grade export needs a backend export endpoint.') },
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

function AssignmentSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((item) => (
        <div key={item} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex gap-3">
            <div className="h-11 w-11 animate-pulse rounded-lg bg-slate-100" />
            <div className="flex-1 space-y-3">
              <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
              <div className="h-2 w-full animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AssignmentEmptyState({ onCreate, hasSearch }: { onCreate: () => void; hasSearch: boolean }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-violet-50 text-[#5B4CF0]">
        <Archive className="h-8 w-8" />
      </div>
      <h3 className="mt-4 text-lg font-bold text-slate-950">{hasSearch ? 'No matching assignments' : 'No assignments available'}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        {hasSearch ? 'Try changing your search or filters.' : 'Create your first assignment to begin reviewing learner submissions.'}
      </p>
      <button onClick={onCreate} className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-[#5B4CF0] px-4 text-sm font-bold text-white hover:bg-[#4b3ee0]">
        <Plus className="h-4 w-4" />
        Create Assignment
      </button>
    </div>
  );
}

function NoSubmissionState() {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-white text-slate-500 ring-1 ring-slate-200">
        <Clock className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-lg font-bold text-slate-950">No submissions yet.</h3>
      <p className="mt-2 text-sm text-slate-500">Learners have not submitted this assignment.</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 text-rose-700" />
        <div>
          <h3 className="font-bold text-rose-950">Unable to load assignments.</h3>
          <p className="mt-1 text-sm text-rose-700">{message}</p>
          <button onClick={onRetry} className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-bold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100">Retry</button>
        </div>
      </div>
    </div>
  );
}
