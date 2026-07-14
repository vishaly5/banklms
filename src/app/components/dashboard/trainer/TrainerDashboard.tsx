import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Users,
} from 'lucide-react';
import { getTrainerDashboard } from '../../../services/dashboardService';
import { getCourses, type DBCourse } from '../../../services/courseService';
import { getBatches } from '../../../services/departmentBatchService';
import { getTeacherAssignmentOverview } from '../../../services/assignmentService';

type TrainerDashboardProps = {
  currentUser?: { name?: string; avatar?: string; role?: string; email?: string };
  onNavigate?: (page: string) => void;
};

type RecentCourse = {
  id: string;
  title: string;
  batchCode: string;
  studentCount: number;
  progress: number;
  status: 'Draft' | 'Published' | 'In Progress' | 'Completed';
  thumbnail?: string;
};

type UpcomingEvent = {
  id: string;
  date: string;
  title: string;
  courseName: string;
  time: string;
  targetPage: string;
};

const bankingCourseFallbacks = [
  'Banking Fundamentals',
  'Customer Service Excellence',
  'Banking Regulations & Compliance',
  'KYC and AML Training',
  'Cybersecurity Awareness',
  'Digital Banking Operations',
];

const statusLabel = (course: any): RecentCourse['status'] => {
  const raw = String(course.status || '').toLowerCase();
  if (raw === 'draft' || course.reviewStatus === 'draft') return 'Draft';
  if (raw === 'completed') return 'Completed';
  if (course.isPublished || raw === 'active' || raw === 'published') return 'Published';
  return 'In Progress';
};

const progressForCourse = (course: any) => {
  const explicit = Number(course.statistics?.avgProgress ?? course.avgProgress ?? course.progress ?? 0);
  if (Number.isFinite(explicit) && explicit > 0) return Math.min(100, Math.round(explicit));
  const students = Number(course.enrollmentCount ?? course.currentEnrollments ?? 0);
  const completed = Number(course.completedCount ?? course.statistics?.totalCompletions ?? 0);
  if (!students) return 0;
  return Math.min(100, Math.round((completed / students) * 100));
};

const formatDateLabel = (dateLike?: string) => {
  const date = dateLike ? new Date(dateLike) : new Date();
  if (Number.isNaN(date.getTime())) return 'Today';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }).toUpperCase();
};

const formatTime = (dateLike?: string) => {
  const date = dateLike ? new Date(dateLike) : null;
  if (!date || Number.isNaN(date.getTime())) return 'All day';
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

const getCurrentUser = (fallback?: TrainerDashboardProps['currentUser']) => {
  if (fallback?.name) return fallback;
  try {
    const stored = JSON.parse(localStorage.getItem('user') || '{}');
    const fullName =
      stored.fullName ||
      stored.name ||
      `${stored.firstName || ''} ${stored.lastName || ''}`.trim() ||
      'Trainer';
    const avatar = fullName
      .split(' ')
      .map((part: string) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    return { name: fullName, avatar, role: 'trainer', email: stored.email };
  } catch {
    return { name: 'Trainer', avatar: 'TR', role: 'trainer' };
  }
};

export function TrainerDashboard({ currentUser, onNavigate }: TrainerDashboardProps) {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [courses, setCourses] = useState<DBCourse[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [assignmentSummary, setAssignmentSummary] = useState<any>({});
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const trainer = getCurrentUser(currentUser);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashboardRes, courseRes, batchRes, assignmentRes] = await Promise.allSettled([
        getTrainerDashboard(),
        getCourses({ limit: '8', createdBy: 'me' }),
        getBatches({ isActive: true, limit: 100 }),
        getTeacherAssignmentOverview(),
      ]);

      if (dashboardRes.status === 'fulfilled' && dashboardRes.value.success) {
        setDashboardData(dashboardRes.value.data);
      }

      if (courseRes.status === 'fulfilled' && Array.isArray(courseRes.value.data)) {
        setCourses(courseRes.value.data);
      }

      if (batchRes.status === 'fulfilled') {
        const batchPayload = batchRes.value;
        setBatches(Array.isArray(batchPayload.data) ? batchPayload.data : Array.isArray(batchPayload.batches) ? batchPayload.batches : []);
      }

      if (assignmentRes.status === 'fulfilled' && assignmentRes.value.success) {
        setAssignments(assignmentRes.value.data || []);
        setAssignmentSummary(assignmentRes.value.summary || {});
      }

      const failed = [dashboardRes, courseRes, batchRes, assignmentRes].every((res) => res.status === 'rejected');
      if (failed) setError('Unable to load dashboard data.');
    } catch {
      setError('Unable to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const recentCourses = useMemo<RecentCourse[]>(() => {
    const source = courses.length ? courses : dashboardData?.courses || [];
    return source.slice(0, 4).map((course: any, index: number) => {
      const batchesForCourse = Array.isArray(course.batches) ? course.batches : [];
      const firstBatch = batchesForCourse[0];
      const batchCode =
        typeof firstBatch === 'object' && firstBatch
          ? firstBatch.code || firstBatch.name
          : `B${String(index + 1).padStart(3, '0')}`;

      return {
        id: String(course._id || course.id || index),
        title: course.title || bankingCourseFallbacks[index % bankingCourseFallbacks.length],
        batchCode,
        studentCount: Number(course.enrollmentCount ?? course.currentEnrollments ?? 0),
        progress: progressForCourse(course),
        status: statusLabel(course),
        thumbnail: course.thumbnail,
      };
    });
  }, [courses, dashboardData]);

  const upcomingEvents = useMemo<UpcomingEvent[]>(() => {
    const assignmentEvents = assignments
      .filter((item) => item.dueDate || item.assignment?.dueDate)
      .slice(0, 4)
      .map((item, index) => {
        const dueDate = item.dueDate || item.assignment?.dueDate;
        return {
          id: String(item.assignmentId || item._id || index),
          date: formatDateLabel(dueDate),
          title: item.title || item.assignment?.title || 'Assignment Due',
          courseName: item.courseTitle || item.course?.title || 'Banking Fundamentals',
          time: formatTime(dueDate),
          targetPage: 'assignments-review',
        };
      });

    if (assignmentEvents.length) return assignmentEvents;

    return batches.slice(0, 3).map((batch, index) => ({
      id: String(batch._id || index),
      date: formatDateLabel(batch.startDate),
      title: batch.name ? 'Batch Session' : 'Course Deadline',
      courseName: batch.code || batch.name || bankingCourseFallbacks[index],
      time: formatTime(batch.startDate),
      targetPage: 'batches',
    }));
  }, [assignments, batches]);

  const totalCourses = Number(dashboardData?.summary?.totalCourses ?? courses.length ?? 0);
  const activeBatches = batches.length;
  const totalStudents = Number(
    dashboardData?.summary?.totalStudents ??
      batches.reduce((sum, batch) => sum + Number(batch.students?.length || batch.studentCount || batch.currentStudents || 0), 0)
  );
  const pendingTasks = Number(assignmentSummary.pendingReview || 0) + Number(assignmentSummary.overdue || 0);

  const currentDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  });

  if (loading) return <TrainerDashboardSkeleton />;

  if (error) {
    return (
      <ErrorState
        title="Unable to load dashboard data."
        description="Please try again."
        onRetry={loadDashboard}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-5 py-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Trainer Workspace</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
            Welcome back, {trainer.name?.split(' ')[0] || 'Trainer'}!
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Here's what's happening in your learning environment today.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
          {currentDate}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="My Courses"
          value={totalCourses}
          subtitle="Active courses"
          icon={BookOpen}
          accent="violet"
          onClick={() => onNavigate?.('courses')}
        />
        <StatCard
          title="Active Batches"
          value={activeBatches}
          subtitle="Running batches"
          icon={Users}
          accent="green"
          onClick={() => onNavigate?.('batches')}
        />
        <StatCard
          title="Total Students"
          value={totalStudents}
          subtitle="Across all batches"
          icon={Users}
          accent="blue"
          onClick={() => onNavigate?.('student-activity-tracker')}
        />
        <StatCard
          title="Pending Tasks"
          value={pendingTasks}
          subtitle="Assignments to review"
          icon={ClipboardCheck}
          accent="orange"
          onClick={() => onNavigate?.('assignments-review')}
        />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.35fr_0.9fr]">
        <RecentCourses courses={recentCourses} onNavigate={onNavigate} />
        <UpcomingEvents events={upcomingEvents} onNavigate={onNavigate} />
      </section>

      <QuickActions onNavigate={onNavigate} />
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent,
  onClick,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: any;
  accent: 'violet' | 'green' | 'orange' | 'blue';
  onClick?: () => void;
}) {
  const tones = {
    violet: 'bg-violet-50 text-violet-700 border-violet-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    orange: 'bg-orange-50 text-orange-700 border-orange-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-violet-100"
    >
      <div className="flex items-start justify-between gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-lg border ${tones[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
      </div>
      <p className="mt-5 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
      <h2 className="mt-1 text-sm font-semibold text-slate-800">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    </button>
  );
}

function RecentCourses({ courses, onNavigate }: { courses: RecentCourse[]; onNavigate?: (page: string) => void }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Recent Courses</h2>
          <p className="text-sm text-slate-500">Banking training programs you manage</p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate?.('courses')}
          className="text-sm font-semibold text-violet-700 hover:text-violet-800 focus:outline-none focus:underline"
        >
          View all
        </button>
      </div>

      <div className="divide-y divide-slate-100">
        {courses.length ? (
          courses.map((course) => (
            <button
              key={course.id}
              type="button"
              onClick={() => onNavigate?.('courses')}
              className="flex w-full flex-col gap-3 px-5 py-4 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-inset focus:ring-violet-100 md:flex-row md:items-center"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {course.thumbnail ? (
                  <img src={course.thumbnail} alt="" className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-violet-50 text-sm font-bold text-violet-700">
                    {course.title.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-950">{course.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {course.batchCode} - {course.studentCount} Students
                  </p>
                </div>
              </div>
              <div className="w-full md:w-48">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600">{course.status}</span>
                  <span className="font-bold text-slate-800">{course.progress}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-violet-600" style={{ width: `${course.progress}%` }} />
                </div>
              </div>
            </button>
          ))
        ) : (
          <EmptyState
            icon={BookOpen}
            title="No courses created yet."
            description="Create your first course to start training learners."
            actionLabel="Create Course"
            onAction={() => onNavigate?.('courses')}
          />
        )}
      </div>
    </section>
  );
}

function UpcomingEvents({ events, onNavigate }: { events: UpcomingEvent[]; onNavigate?: (page: string) => void }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Upcoming</h2>
          <p className="text-sm text-slate-500">Your next trainer activities</p>
        </div>
        <button
          type="button"
          disabled
          className="text-sm font-semibold text-slate-400"
          title="Calendar route is not available yet"
        >
          View calendar
        </button>
      </div>

      <div className="divide-y divide-slate-100">
        {events.length ? (
          events.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => onNavigate?.(event.targetPage)}
              className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-inset focus:ring-violet-100"
            >
              <div className="flex h-12 w-14 flex-shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-xs font-bold uppercase text-blue-700">
                {event.date}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-950">{event.title}</p>
                <p className="mt-1 truncate text-xs text-slate-500">{event.courseName}</p>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                {event.time}
                <ArrowRight className="h-4 w-4" />
              </div>
            </button>
          ))
        ) : (
          <EmptyState icon={CalendarDays} title="No upcoming activity." description="Schedules and due dates will appear here." />
        )}
      </div>

      <div className="border-t border-slate-100 px-5 py-3">
        <button
          type="button"
          disabled
          className="text-sm font-semibold text-slate-400"
          title="Calendar route is not available yet"
        >
          View all schedules
        </button>
      </div>
    </section>
  );
}

function QuickActions({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const actions = [
    { label: 'Create Course', icon: Plus, page: 'courses', enabled: true },
    { label: 'Create Batch', icon: Users, page: 'batches', enabled: true },
    { label: 'Add Assignment', icon: ClipboardCheck, page: 'assignments-review', enabled: true },
    { label: 'Community Forum', icon: MessageSquare, page: 'forum', enabled: true },
  ];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-950">Quick Actions</h2>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              type="button"
              disabled={!action.enabled}
              onClick={() => onNavigate?.(action.page)}
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-violet-200 hover:bg-violet-50 focus:outline-none focus:ring-4 focus:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-sm font-semibold text-slate-800">{action.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: any;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="px-5 py-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 focus:outline-none focus:ring-4 focus:ring-violet-100"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function ErrorState({ title, description, onRetry }: { title: string; description: string; onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-xl rounded-lg border border-rose-200 bg-white p-6 text-center shadow-sm">
      <h1 className="text-lg font-bold text-slate-950">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 focus:outline-none focus:ring-4 focus:ring-violet-100"
      >
        <RefreshCw className="h-4 w-4" />
        Retry
      </button>
    </div>
  );
}

function TrainerDashboardSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="mt-3 h-8 w-72" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <Skeleton className="mt-5 h-8 w-16" />
            <Skeleton className="mt-3 h-4 w-28" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.35fr_0.9fr]">
        {[0, 1].map((card) => (
          <div key={card} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-40" />
              <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
            </div>
            <div className="mt-5 space-y-4">
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-14 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-100 ${className}`} />;
}
