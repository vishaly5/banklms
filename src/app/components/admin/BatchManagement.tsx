import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
  ChevronDown,
  Download,
  Edit2,
  Eye,
  Loader2,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import axiosInstance from '../../../utils/axiosConfig';
import {
  assignStudentsToBatch,
  createBatch,
  deleteBatch,
  getAssignableStudents,
  getBatches,
  getBatchStudents,
  removeStudentsFromBatch,
  updateBatch,
  type Batch,
  type BatchStudent,
  type CreateBatchData,
  type UpdateBatchData,
} from '../../services/batchService';
import { getDepartments, type Department } from '../../services/departmentService';

type BatchStatus = 'all' | 'active' | 'completed' | 'draft' | 'archived';
type StudentModalTab = 'assign' | 'assigned';

interface BatchFormData {
  name: string;
  code: string;
  department: string;
  year: number;
  startDate: string;
  endDate: string;
  maxStudents: number;
  trainers: string[];
}

interface Filters {
  department: string;
  year: string;
  status: BatchStatus;
  search: string;
}

const EMPTY_FORM: BatchFormData = {
  name: '',
  code: '',
  department: '',
  year: new Date().getFullYear(),
  startDate: '',
  endDate: '',
  maxStudents: 50,
  trainers: [],
};

const ROWS_PER_PAGE_OPTIONS = [10, 20, 50];

const initials = (value = '') =>
  value
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'BA';

const trainerName = (trainer: any) =>
  trainer ? `${trainer.firstName || ''} ${trainer.lastName || ''}`.trim() || trainer.fullName || trainer.name || trainer.email || 'Trainer' : '';

const getBatchStatus = (batch: Batch): Exclude<BatchStatus, 'all'> => {
  if (batch.isActive === false) return 'archived';
  if (batch.endDate && new Date(batch.endDate) < new Date()) return 'completed';
  if (batch.startDate && new Date(batch.startDate) > new Date()) return 'draft';
  return 'active';
};

const formatDate = (value?: string) => {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const occupancy = (batch: Batch) => {
  const max = Number(batch.maxStudents || 0);
  if (!max) return 0;
  return Math.min(100, Math.round((Number(batch.currentStudents || 0) / max) * 100));
};

export function BatchManagement() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [trainers, setTrainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ department: '', year: '', status: 'all', search: '' });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [formData, setFormData] = useState<BatchFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Batch | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [batchStudents, setBatchStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const [studentModalBatch, setStudentModalBatch] = useState<Batch | null>(null);
  const [studentModalTab, setStudentModalTab] = useState<StudentModalTab>('assign');
  const [assignableStudents, setAssignableStudents] = useState<BatchStudent[]>([]);
  const [assignedStudents, setAssignedStudents] = useState<BatchStudent[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedRemoveIds, setSelectedRemoveIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [assignedSearch, setAssignedSearch] = useState('');
  const [onlyUnassigned, setOnlyUnassigned] = useState(true);
  const [loadingAssignable, setLoadingAssignable] = useState(false);
  const [loadingAssigned, setLoadingAssigned] = useState(false);
  const [assigningStudents, setAssigningStudents] = useState(false);
  const [removingStudents, setRemovingStudents] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(filters.search.trim().toLowerCase()), 300);
    return () => window.clearTimeout(timer);
  }, [filters.search]);

  const fetchBatches = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const response = await getBatches({ isActive: undefined, limit: 500 });
      setBatches(response.data || []);
    } catch (err: any) {
      setError(err.message || 'Unable to load batches.');
      toast.error(err.message || 'Failed to load batches');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await getDepartments({ isActive: true, limit: 500 });
      setDepartments(response.data || []);
    } catch (err) {
      console.error('Error fetching departments:', err);
    }
  };

  const fetchTrainers = async () => {
    try {
      const response = await axiosInstance.get('/admin/users', { params: { role: 'trainer', isApproved: true } });
      if (response.data.success) setTrainers(response.data.data || []);
    } catch (err) {
      console.error('Error fetching trainers:', err);
    }
  };

  useEffect(() => {
    fetchDepartments();
    fetchTrainers();
    fetchBatches();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filters.department, filters.year, filters.status, debouncedSearch, rowsPerPage]);

  const filteredBatches = useMemo(() => {
    return batches.filter((batch) => {
      const status = getBatchStatus(batch);
      const trainerText = (batch.trainers || []).map(trainerName).join(' ');
      const searchText = `${batch.name} ${batch.code} ${batch.department?.name || ''} ${trainerText} ${batch.year}`.toLowerCase();
      const matchesSearch = !debouncedSearch || searchText.includes(debouncedSearch);
      const matchesDepartment = !filters.department || batch.department?._id === filters.department;
      const matchesYear = !filters.year || String(batch.year) === filters.year;
      const matchesStatus = filters.status === 'all' || status === filters.status;
      return matchesSearch && matchesDepartment && matchesYear && matchesStatus;
    });
  }, [batches, debouncedSearch, filters]);

  const stats = useMemo(() => {
    const totalCapacity = batches.reduce((sum, batch) => sum + Number(batch.maxStudents || 0), 0);
    const activeLearners = batches.reduce((sum, batch) => sum + Number(batch.currentStudents || 0), 0);
    return {
      total: batches.length,
      learners: activeLearners,
      utilization: totalCapacity ? Math.round((activeLearners / totalCapacity) * 100) : 0,
      completed: batches.filter((batch) => getBatchStatus(batch) === 'completed').length,
    };
  }, [batches]);

  const totalPages = Math.max(1, Math.ceil(filteredBatches.length / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * rowsPerPage;
  const pageBatches = filteredBatches.slice(start, start + rowsPerPage);
  const years = Array.from(new Set(batches.map((batch) => batch.year))).sort((a, b) => b - a);

  const openModal = (batch?: Batch) => {
    if (batch) {
      setEditingBatch(batch);
      setFormData({
        name: batch.name,
        code: batch.code,
        department: batch.department?._id || '',
        year: batch.year,
        startDate: batch.startDate ? batch.startDate.split('T')[0] : '',
        endDate: batch.endDate ? batch.endDate.split('T')[0] : '',
        maxStudents: batch.maxStudents || 50,
        trainers: batch.trainers?.map((trainer) => trainer._id) || [],
      });
    } else {
      setEditingBatch(null);
      setFormData(EMPTY_FORM);
    }
    setShowModal(true);
  };

  const duplicateBatch = (batch: Batch) => {
    setEditingBatch(null);
    setFormData({
      name: `${batch.name} Copy`,
      code: `${batch.code}-COPY`.slice(0, 24),
      department: batch.department?._id || '',
      year: batch.year,
      startDate: batch.startDate ? batch.startDate.split('T')[0] : '',
      endDate: batch.endDate ? batch.endDate.split('T')[0] : '',
      maxStudents: batch.maxStudents || 50,
      trainers: batch.trainers?.map((trainer) => trainer._id) || [],
    });
    setShowModal(true);
    setActiveMenu(null);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingBatch(null);
    setFormData(EMPTY_FORM);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.name.trim()) return toast.error('Batch name is required');
    if (!formData.code.trim()) return toast.error('Batch code is required');
    if (!formData.department) return toast.error('Department is required');

    setSubmitting(true);
    try {
      const payload: CreateBatchData | UpdateBatchData = {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        department: formData.department,
        year: formData.year,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        maxStudents: formData.maxStudents,
        trainers: formData.trainers,
      };
      if (editingBatch) {
        const response = await updateBatch(editingBatch._id, payload);
        setBatches((prev) => prev.map((batch) => (batch._id === editingBatch._id ? response.data : batch)));
        toast.success('Batch updated successfully');
      } else {
        const response = await createBatch(payload as CreateBatchData);
        setBatches((prev) => [response.data, ...prev]);
        toast.success('Batch created successfully');
      }
      closeModal();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save batch');
    } finally {
      setSubmitting(false);
    }
  };

  const archiveBatch = async (batch: Batch) => {
    setActionLoading(batch._id);
    try {
      const response = await updateBatch(batch._id, { isActive: false });
      setBatches((prev) => prev.map((item) => (item._id === batch._id ? response.data : item)));
      toast.success('Batch archived');
      setActiveMenu(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to archive batch');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(deleteTarget._id);
    try {
      await deleteBatch(deleteTarget._id);
      setBatches((prev) => prev.filter((batch) => batch._id !== deleteTarget._id));
      toast.success('Batch deleted successfully');
      setDeleteTarget(null);
      setActiveMenu(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete batch');
    } finally {
      setActionLoading(null);
    }
  };

  const viewBatchDetails = async (batch: Batch) => {
    setSelectedBatch(batch);
    setLoadingStudents(true);
    try {
      const response = await getBatchStudents(batch._id, { limit: 100 });
      setBatchStudents(response.data?.students || response.data || []);
    } catch {
      setBatchStudents([]);
      toast.error('Failed to load batch students');
    } finally {
      setLoadingStudents(false);
    }
  };

  const refreshBatchCount = (batchId: string, currentStudents: number) => {
    setBatches((prev) => prev.map((batch) => (batch._id === batchId ? { ...batch, currentStudents } : batch)));
    setStudentModalBatch((prev) => (prev && prev._id === batchId ? { ...prev, currentStudents } : prev));
  };

  const loadAssignableStudents = async (batch: Batch, searchValue = studentSearch, unassignedOnly = onlyUnassigned) => {
    setLoadingAssignable(true);
    try {
      const response = await getAssignableStudents(batch._id, {
        search: searchValue || undefined,
        page: 1,
        limit: 50,
        onlyUnassigned: unassignedOnly,
      });
      setAssignableStudents(response.data?.students || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load assignable students');
      setAssignableStudents([]);
    } finally {
      setLoadingAssignable(false);
    }
  };

  const loadAssignedStudents = async (batch: Batch, searchValue = assignedSearch) => {
    setLoadingAssigned(true);
    try {
      const response = await getBatchStudents(batch._id, { search: searchValue || undefined, page: 1, limit: 100 });
      setAssignedStudents(response.data?.students || response.data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load assigned students');
      setAssignedStudents([]);
    } finally {
      setLoadingAssigned(false);
    }
  };

  const openStudentAssignmentModal = (batch: Batch, tab: StudentModalTab = 'assign') => {
    setStudentModalBatch(batch);
    setStudentModalTab(tab);
    setSelectedStudentIds([]);
    setSelectedRemoveIds([]);
    setStudentSearch('');
    setAssignedSearch('');
    setOnlyUnassigned(true);
    loadAssignableStudents(batch, '', true);
    loadAssignedStudents(batch, '');
    setActiveMenu(null);
  };

  const handleAssignStudents = async () => {
    if (!studentModalBatch || selectedStudentIds.length === 0) return toast.error('Please select students to assign');
    setAssigningStudents(true);
    try {
      const response = await assignStudentsToBatch(studentModalBatch._id, selectedStudentIds);
      toast.success(response.message || 'Students assigned successfully');
      refreshBatchCount(studentModalBatch._id, response.data?.currentStudents ?? studentModalBatch.currentStudents);
      setSelectedStudentIds([]);
      await Promise.all([loadAssignableStudents(studentModalBatch), loadAssignedStudents(studentModalBatch)]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign students');
    } finally {
      setAssigningStudents(false);
    }
  };

  const handleRemoveStudents = async () => {
    if (!studentModalBatch || selectedRemoveIds.length === 0) return toast.error('Please select students to remove');
    setRemovingStudents(true);
    try {
      const response = await removeStudentsFromBatch(studentModalBatch._id, selectedRemoveIds);
      toast.success(response.message || 'Students removed from batch');
      refreshBatchCount(studentModalBatch._id, response.data?.currentStudents ?? studentModalBatch.currentStudents);
      setSelectedRemoveIds([]);
      await Promise.all([loadAssignableStudents(studentModalBatch), loadAssignedStudents(studentModalBatch)]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove students');
    } finally {
      setRemovingStudents(false);
    }
  };

  useEffect(() => {
    if (!studentModalBatch) return;
    const timer = window.setTimeout(() => loadAssignableStudents(studentModalBatch, studentSearch, onlyUnassigned), 300);
    return () => window.clearTimeout(timer);
  }, [studentSearch, onlyUnassigned, studentModalBatch?._id]);

  useEffect(() => {
    if (!studentModalBatch) return;
    const timer = window.setTimeout(() => loadAssignedStudents(studentModalBatch, assignedSearch), 300);
    return () => window.clearTimeout(timer);
  }, [assignedSearch, studentModalBatch?._id]);

  const resetFilters = () => setFilters({ department: '', year: '', status: 'all', search: '' });

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
      <BatchHeader onCreate={() => openModal()} onRefresh={() => fetchBatches(true)} refreshing={refreshing} />

      {loading ? (
        <BatchSkeleton />
      ) : error ? (
        <ErrorState onRetry={() => fetchBatches()} />
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <BatchStatsCard title="Total Batches" value={stats.total} subtitle="Running batches" icon={BookOpen} tone="purple" progress={100} />
            <BatchStatsCard title="Active Learners" value={stats.learners} subtitle="Across all batches" icon={Users} tone="green" progress={Math.min(100, stats.learners)} />
            <BatchStatsCard title="Capacity Utilization" value={`${stats.utilization}%`} subtitle="Average occupancy" icon={BarChart3} tone="blue" progress={stats.utilization} />
            <BatchStatsCard title="Completed Batches" value={stats.completed} subtitle="Archived successfully" icon={Archive} tone="orange" progress={stats.total ? Math.round((stats.completed / stats.total) * 100) : 0} />
          </section>

          <BatchFilterBar
            filters={filters}
            departments={departments}
            years={years}
            open={filtersOpen}
            setOpen={setFiltersOpen}
            setFilters={setFilters}
            reset={resetFilters}
          />

          <QuickChips value={filters.status} onChange={(status) => setFilters((prev) => ({ ...prev, status }))} />

          {pageBatches.length ? (
            <>
              <div className="hidden md:block">
                <BatchTable
                  batches={pageBatches}
                  activeMenu={activeMenu}
                  actionLoading={actionLoading}
                  onMenu={setActiveMenu}
                  onView={viewBatchDetails}
                  onEdit={openModal}
                  onAssign={openStudentAssignmentModal}
                  onDuplicate={duplicateBatch}
                  onArchive={archiveBatch}
                  onDelete={setDeleteTarget}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:hidden">
                {pageBatches.map((batch) => (
                  <BatchCard
                    key={batch._id}
                    batch={batch}
                    activeMenu={activeMenu}
                    actionLoading={actionLoading}
                    onMenu={setActiveMenu}
                    onView={viewBatchDetails}
                    onEdit={openModal}
                    onAssign={openStudentAssignmentModal}
                    onDuplicate={duplicateBatch}
                    onArchive={archiveBatch}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </div>
            </>
          ) : (
            <BatchEmptyState onCreate={() => openModal()} />
          )}

          <BatchPagination
            page={safePage}
            totalPages={totalPages}
            rowsPerPage={rowsPerPage}
            total={filteredBatches.length}
            start={filteredBatches.length ? start + 1 : 0}
            end={Math.min(start + rowsPerPage, filteredBatches.length)}
            onPage={setPage}
            onRowsPerPage={setRowsPerPage}
          />

          <QuickActions onCreate={() => openModal()} onAssign={() => pageBatches[0] && openStudentAssignmentModal(pageBatches[0])} />
        </>
      )}

      {showModal && (
        <BatchFormModal
          editingBatch={editingBatch}
          formData={formData}
          setFormData={setFormData}
          departments={departments}
          trainers={trainers}
          submitting={submitting}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      )}

      {deleteTarget && (
        <DeleteDialog
          batch={deleteTarget}
          loading={actionLoading === deleteTarget._id}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}

      {selectedBatch && (
        <BatchDetailsModal
          batch={selectedBatch}
          students={batchStudents}
          loading={loadingStudents}
          onClose={() => setSelectedBatch(null)}
          onAssign={() => {
            openStudentAssignmentModal(selectedBatch);
            setSelectedBatch(null);
          }}
        />
      )}

      {studentModalBatch && (
        <StudentAssignmentModal
          batch={studentModalBatch}
          tab={studentModalTab}
          setTab={setStudentModalTab}
          assignableStudents={assignableStudents}
          assignedStudents={assignedStudents}
          selectedStudentIds={selectedStudentIds}
          selectedRemoveIds={selectedRemoveIds}
          setSelectedStudentIds={setSelectedStudentIds}
          setSelectedRemoveIds={setSelectedRemoveIds}
          studentSearch={studentSearch}
          assignedSearch={assignedSearch}
          setStudentSearch={setStudentSearch}
          setAssignedSearch={setAssignedSearch}
          onlyUnassigned={onlyUnassigned}
          setOnlyUnassigned={setOnlyUnassigned}
          loadingAssignable={loadingAssignable}
          loadingAssigned={loadingAssigned}
          assigningStudents={assigningStudents}
          removingStudents={removingStudents}
          onAssign={handleAssignStudents}
          onRemove={handleRemoveStudents}
          onClose={() => setStudentModalBatch(null)}
        />
      )}
    </div>
  );
}

function BatchHeader({ onCreate, onRefresh, refreshing }: { onCreate: () => void; onRefresh: () => void; refreshing: boolean }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">Batch Management</h1>
        <p className="mt-1 text-sm text-slate-600">Manage learner batches and trainer assignments.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onRefresh} disabled={refreshing} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-violet-100 disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        <button type="button" onClick={() => toast.info('Export will be available once backend export is connected.')} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-violet-100">
          <Download className="h-4 w-4" />
          Export
        </button>
        <button type="button" onClick={onCreate} className="inline-flex h-10 items-center gap-2 rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-700 focus:outline-none focus:ring-4 focus:ring-violet-100">
          <Plus className="h-4 w-4" />
          Create Batch
        </button>
      </div>
    </section>
  );
}

function BatchStatsCard({ title, value, subtitle, icon: Icon, tone, progress }: { title: string; value: number | string; subtitle: string; icon: any; tone: 'purple' | 'green' | 'blue' | 'orange'; progress: number }) {
  const tones = {
    purple: 'bg-violet-50 text-violet-700 border-violet-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    orange: 'bg-orange-50 text-orange-700 border-orange-100',
  };
  const bars = {
    purple: 'bg-violet-600',
    green: 'bg-emerald-600',
    blue: 'bg-blue-600',
    orange: 'bg-orange-500',
  };
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg border ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-xs font-bold text-slate-400">{progress}%</span>
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
      <h2 className="mt-1 text-sm font-semibold text-slate-800">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      <div className="mt-4 h-1.5 rounded-full bg-slate-100">
        <div className={`h-1.5 rounded-full ${bars[tone]}`} style={{ width: `${Math.min(100, progress)}%` }} />
      </div>
    </article>
  );
}

function BatchFilterBar({ filters, departments, years, open, setOpen, setFilters, reset }: { filters: Filters; departments: Department[]; years: number[]; open: boolean; setOpen: (open: boolean) => void; setFilters: React.Dispatch<React.SetStateAction<Filters>>; reset: () => void }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <button type="button" onClick={() => setOpen(!open)} className="inline-flex items-center gap-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-violet-100">
          Filters
          <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
        </button>
        <label className="relative w-full lg:max-w-lg">
          <span className="sr-only">Search batches</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            placeholder="Search by batch name, department, trainer, or code..."
            className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-slate-800 outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
          />
          {filters.search && (
            <button type="button" onClick={() => setFilters((prev) => ({ ...prev, search: '' }))} aria-label="Clear search" className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
      </div>
      {open && (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1fr_auto_auto]">
          <Select label="Department" value={filters.department} onChange={(value) => setFilters((prev) => ({ ...prev, department: value }))}>
            <option value="">All Departments</option>
            {departments.map((department) => <option key={department._id} value={department._id}>{department.name}</option>)}
          </Select>
          <Select label="Year" value={filters.year} onChange={(value) => setFilters((prev) => ({ ...prev, year: value }))}>
            <option value="">All Years</option>
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </Select>
          <Select label="Status" value={filters.status} onChange={(value) => setFilters((prev) => ({ ...prev, status: value as BatchStatus }))}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </Select>
          <button type="button" onClick={reset} className="h-11 self-end rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-violet-100">Reset</button>
          <button type="button" className="h-11 self-end rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200">Apply Filters</button>
        </div>
      )}
    </section>
  );
}

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100">
        {children}
      </select>
    </label>
  );
}

function QuickChips({ value, onChange }: { value: BatchStatus; onChange: (status: BatchStatus) => void }) {
  const chips: Array<{ value: BatchStatus; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'draft', label: 'Draft' },
    { value: 'completed', label: 'Completed' },
    { value: 'archived', label: 'Archived' },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <button key={chip.value} type="button" onClick={() => onChange(chip.value)} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition focus:outline-none focus:ring-4 focus:ring-violet-100 ${value === chip.value ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
          {chip.label}
        </button>
      ))}
    </div>
  );
}

type BatchActionProps = {
  activeMenu: string | null;
  actionLoading: string | null;
  onMenu: (id: string | null) => void;
  onView: (batch: Batch) => void;
  onEdit: (batch: Batch) => void;
  onAssign: (batch: Batch, tab?: StudentModalTab) => void;
  onDuplicate: (batch: Batch) => void;
  onArchive: (batch: Batch) => void;
  onDelete: (batch: Batch) => void;
};

function BatchTable({ batches, ...actions }: { batches: Batch[] } & BatchActionProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[1040px] w-full border-collapse text-left">
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Batch</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Year</th>
              <th className="px-4 py-3">Trainer</th>
              <th className="px-4 py-3">Enrollment</th>
              <th className="px-4 py-3">Capacity</th>
              <th className="px-4 py-3">Progress</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {batches.map((batch) => (
              <BatchRow key={batch._id} batch={batch} {...actions} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BatchRow({ batch, ...actions }: { batch: Batch } & BatchActionProps) {
  const status = getBatchStatus(batch);
  const trainers = batch.trainers || [];
  return (
    <tr className="transition hover:bg-slate-50">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <BatchAvatar batch={batch} />
          <div>
            <p className="font-semibold text-slate-950">{batch.name}</p>
            <p className="text-xs text-slate-500">{batch.code}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <DepartmentBadge value={batch.department?.name || 'Department'} />
              <StatusBadge status={status} />
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Building2 className="h-4 w-4 text-slate-400" />
          {batch.department?.name || 'Department'}
        </div>
      </td>
      <td className="px-4 py-4 text-sm font-semibold text-slate-700">{batch.year}</td>
      <td className="px-4 py-4">
        {trainers.length ? <TrainerAvatar trainer={trainers[0]} /> : <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">No Trainer Assigned</span>}
      </td>
      <td className="px-4 py-4 text-sm text-slate-600">
        <p className="font-semibold text-slate-900">{batch.currentStudents || 0} Learners</p>
        <p className="text-xs text-slate-500">Capacity {batch.maxStudents || 0}</p>
      </td>
      <td className="px-4 py-4"><CapacityBar value={occupancy(batch)} /></td>
      <td className="px-4 py-4 text-sm text-slate-600">{batch.assignedCoursesCount || batch.courses?.length || 0} courses</td>
      <td className="px-4 py-4"><StatusBadge status={status} /></td>
      <td className="px-5 py-4"><BatchActionMenu batch={batch} {...actions} /></td>
    </tr>
  );
}

function BatchCard({ batch, ...actions }: { batch: Batch } & BatchActionProps) {
  const status = getBatchStatus(batch);
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <BatchAvatar batch={batch} />
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-slate-950">{batch.name}</h2>
            <p className="text-xs text-slate-500">{batch.code}</p>
          </div>
        </div>
        <BatchActionMenu batch={batch} {...actions} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <DepartmentBadge value={batch.department?.name || 'Department'} />
        <StatusBadge status={status} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-3 text-center">
        <Metric label="Year" value={batch.year} />
        <Metric label="Learners" value={batch.currentStudents || 0} />
        <Metric label="Capacity" value={batch.maxStudents || 0} />
      </div>
      <div className="mt-4">
        <CapacityBar value={occupancy(batch)} />
      </div>
    </article>
  );
}

function BatchActionMenu({ batch, activeMenu, actionLoading, onMenu, onView, onEdit, onAssign, onDuplicate, onArchive, onDelete }: { batch: Batch } & BatchActionProps) {
  const open = activeMenu === batch._id;
  const busy = actionLoading === batch._id;
  return (
    <div className="relative flex items-center justify-end gap-2">
      <button type="button" aria-label={`View ${batch.name}`} onClick={() => onView(batch)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-violet-100">
        <Eye className="h-4 w-4" />
      </button>
      <button type="button" aria-label={`Edit ${batch.name}`} onClick={() => onEdit(batch)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-violet-100">
        <Edit2 className="h-4 w-4" />
      </button>
      <button type="button" aria-label={`Open actions for ${batch.name}`} onClick={() => onMenu(open ? null : batch._id)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-violet-100">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-20 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          <ActionItem label="View Batch" icon={Eye} onClick={() => onView(batch)} />
          <ActionItem label="Edit Batch" icon={Edit2} onClick={() => onEdit(batch)} />
          <ActionItem label="Assign Students" icon={UserPlus} onClick={() => onAssign(batch, 'assign')} />
          <ActionItem label="Assign Trainer" icon={Users} onClick={() => onEdit(batch)} />
          <ActionItem label="Duplicate" icon={Plus} onClick={() => onDuplicate(batch)} />
          {batch.isActive !== false && <ActionItem label="Archive" icon={Archive} onClick={() => onArchive(batch)} />}
          <ActionItem label="Delete" icon={Trash2} danger onClick={() => onDelete(batch)} />
        </div>
      )}
    </div>
  );
}

function ActionItem({ label, icon: Icon, onClick, danger }: { label: string; icon: any; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition ${danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-50'}`}>
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function BatchAvatar({ batch }: { batch: Batch }) {
  return <div className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-50 text-sm font-bold text-violet-700">{initials(batch.name)}</div>;
}

function TrainerAvatar({ trainer }: { trainer: any }) {
  const name = trainerName(trainer);
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">{initials(name)}</span>
      <span className="text-sm font-medium text-slate-700">{name}</span>
    </div>
  );
}

function DepartmentBadge({ value }: { value: string }) {
  return <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{value}</span>;
}

function StatusBadge({ status }: { status: Exclude<BatchStatus, 'all'> }) {
  const tones = {
    active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    archived: 'border-slate-200 bg-slate-100 text-slate-700',
    draft: 'border-orange-200 bg-orange-50 text-orange-700',
    completed: 'border-blue-200 bg-blue-50 text-blue-700',
  };
  const label = status[0].toUpperCase() + status.slice(1);
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${tones[status]}`}>{label}</span>;
}

function CapacityBar({ value }: { value: number }) {
  const color = value >= 90 ? 'bg-rose-500' : value >= 70 ? 'bg-orange-500' : value >= 45 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="min-w-[120px]">
      <div className="h-2 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${color}`} style={{ width: `${value}%` }} /></div>
      <p className="mt-1 text-xs font-semibold text-slate-600">{value}%</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div><p className="text-base font-bold text-slate-950">{value}</p><p className="text-[11px] font-medium text-slate-500">{label}</p></div>;
}

function BatchPagination({ page, totalPages, rowsPerPage, total, start, end, onPage, onRowsPerPage }: { page: number; totalPages: number; rowsPerPage: number; total: number; start: number; end: number; onPage: (page: number) => void; onRowsPerPage: (rows: number) => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <p className="text-sm text-slate-600">Showing <span className="font-semibold text-slate-900">{start}</span>-<span className="font-semibold text-slate-900">{end}</span> of <span className="font-semibold text-slate-900">{total}</span> batches</p>
      <div className="flex flex-wrap items-center gap-2">
        <select value={rowsPerPage} onChange={(event) => onRowsPerPage(Number(event.target.value))} className="h-9 rounded-lg border border-slate-200 px-2 text-sm text-slate-700">
          {ROWS_PER_PAGE_OPTIONS.map((option) => <option key={option} value={option}>{option} rows</option>)}
        </select>
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 disabled:opacity-40">&lt;</button>
        {Array.from({ length: Math.min(totalPages, 3) }, (_, index) => index + 1).map((item) => <button key={item} type="button" onClick={() => onPage(item)} className={`h-9 w-9 rounded-lg text-sm font-bold ${page === item ? 'bg-violet-600 text-white' : 'border border-slate-200 text-slate-700'}`}>{item}</button>)}
        <button type="button" disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 disabled:opacity-40">&gt;</button>
      </div>
    </div>
  );
}

function QuickActions({ onCreate, onAssign }: { onCreate: () => void; onAssign: () => void }) {
  const actions = [
    { title: 'Create Batch', desc: 'Open a new learner cohort', icon: Plus, onClick: onCreate },
    { title: 'Assign Trainer', desc: 'Attach a trainer to a batch', icon: Users, onClick: onCreate },
    { title: 'Enroll Students', desc: 'Add learners to a batch', icon: UserPlus, onClick: onAssign },
  ];
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-950">Quick Actions</h2>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button key={action.title} type="button" onClick={action.onClick} className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 text-left transition hover:border-violet-200 hover:bg-violet-50 focus:outline-none focus:ring-4 focus:ring-violet-100">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700"><Icon className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-950">{action.title}</span><span className="block truncate text-xs text-slate-500">{action.desc}</span></span>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function BatchEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white px-5 py-14 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-violet-50 text-violet-700"><BookOpen className="h-6 w-6" /></div>
      <h2 className="mt-4 text-lg font-bold text-slate-950">No batches created</h2>
      <p className="mt-2 text-sm text-slate-500">Create your first learner batch.</p>
      <button type="button" onClick={onCreate} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 focus:outline-none focus:ring-4 focus:ring-violet-100"><Plus className="h-4 w-4" />Create Batch</button>
    </section>
  );
}

function BatchSkeleton() {
  return (
    <>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-36" />)}</section>
      <Skeleton className="h-28" />
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><div className="space-y-3">{[0, 1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-16" />)}</div></section>
    </>
  );
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-100 ${className}`} />;
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="rounded-lg border border-rose-200 bg-white px-5 py-10 text-center shadow-sm">
      <h2 className="text-lg font-bold text-slate-950">Unable to load batches.</h2>
      <p className="mt-2 text-sm text-slate-500">Please try again.</p>
      <button type="button" onClick={onRetry} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 focus:outline-none focus:ring-4 focus:ring-violet-100"><RefreshCw className="h-4 w-4" />Retry</button>
    </section>
  );
}

function BatchFormModal({ editingBatch, formData, setFormData, departments, trainers, submitting, onClose, onSubmit }: { editingBatch: Batch | null; formData: BatchFormData; setFormData: React.Dispatch<React.SetStateAction<BatchFormData>>; departments: Department[]; trainers: any[]; submitting: boolean; onClose: () => void; onSubmit: (event: React.FormEvent) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div><h2 className="text-lg font-bold text-slate-950">{editingBatch ? 'Edit Batch' : 'Create Batch'}</h2><p className="text-sm text-slate-500">Manage learner cohort details and trainer assignment.</p></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid max-h-[70vh] gap-4 overflow-y-auto p-6 md:grid-cols-2">
          <Input label="Batch Name" value={formData.name} onChange={(value) => setFormData((prev) => ({ ...prev, name: value }))} required />
          <Input label="Batch Code" value={formData.code} onChange={(value) => setFormData((prev) => ({ ...prev, code: value.toUpperCase() }))} required />
          <label className="text-sm font-medium text-slate-700">Department<select value={formData.department} onChange={(event) => setFormData((prev) => ({ ...prev, department: event.target.value }))} className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100" required><option value="">Select Department</option>{departments.map((department) => <option key={department._id} value={department._id}>{department.name}</option>)}</select></label>
          <Input label="Year" type="number" value={String(formData.year)} onChange={(value) => setFormData((prev) => ({ ...prev, year: Number(value) }))} required />
          <Input label="Start Date" type="date" value={formData.startDate} onChange={(value) => setFormData((prev) => ({ ...prev, startDate: value }))} />
          <Input label="End Date" type="date" value={formData.endDate} onChange={(value) => setFormData((prev) => ({ ...prev, endDate: value }))} />
          <Input label="Capacity" type="number" value={String(formData.maxStudents)} onChange={(value) => setFormData((prev) => ({ ...prev, maxStudents: Number(value) }))} />
          <label className="text-sm font-medium text-slate-700">Trainers<select multiple value={formData.trainers} onChange={(event) => setFormData((prev) => ({ ...prev, trainers: Array.from(event.target.selectedOptions).map((option) => option.value) }))} className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100">{trainers.map((trainer) => <option key={trainer._id} value={trainer._id}>{trainerName(trainer)}</option>)}</select><span className="mt-1 block text-xs text-slate-500">Hold Ctrl to select multiple trainers.</span></label>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60">{submitting && <Loader2 className="h-4 w-4 animate-spin" />}{editingBatch ? 'Save Changes' : 'Create Batch'}</button>
        </div>
      </form>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text', required }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <label className="text-sm font-medium text-slate-700">{label}<input type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100" /></label>;
}

function DeleteDialog({ batch, loading, onCancel, onConfirm }: { batch: Batch; loading: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-slate-950">Delete batch?</h2>
        <p className="mt-2 text-sm text-slate-600">This will delete <strong>{batch.name}</strong>. This action cannot be undone.</p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">{loading && <Loader2 className="h-4 w-4 animate-spin" />}Delete</button>
        </div>
      </div>
    </div>
  );
}

function BatchDetailsModal({ batch, students, loading, onClose, onAssign }: { batch: Batch; students: any[]; loading: boolean; onClose: () => void; onAssign: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div><h2 className="text-lg font-bold text-slate-950">{batch.name}</h2><p className="text-sm text-slate-500">{batch.code} - {batch.department?.name}</p></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto p-6">
          {loading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-violet-600" /></div> : students.length ? (
            <div className="overflow-x-auto"><table className="min-w-[720px] w-full text-left"><thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Mobile</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{students.map((student) => <tr key={student._id}><td className="px-4 py-3 font-medium text-slate-900">{student.name || `${student.firstName || ''} ${student.lastName || ''}`}</td><td className="px-4 py-3 text-sm text-slate-600">{student.email}</td><td className="px-4 py-3 text-sm text-slate-600">{student.mobile || student.phone || '-'}</td><td className="px-4 py-3"><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">Active</span></td></tr>)}</tbody></table></div>
          ) : <div className="py-12 text-center text-sm text-slate-500">No students found in this batch.</div>}
        </div>
        <div className="flex justify-between border-t border-slate-200 px-6 py-4">
          <p className="text-sm text-slate-600">Showing {students.length} learners</p>
          <button type="button" onClick={onAssign} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">Assign Students</button>
        </div>
      </div>
    </div>
  );
}

function StudentAssignmentModal(props: {
  batch: Batch;
  tab: StudentModalTab;
  setTab: (tab: StudentModalTab) => void;
  assignableStudents: BatchStudent[];
  assignedStudents: BatchStudent[];
  selectedStudentIds: string[];
  selectedRemoveIds: string[];
  setSelectedStudentIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedRemoveIds: React.Dispatch<React.SetStateAction<string[]>>;
  studentSearch: string;
  assignedSearch: string;
  setStudentSearch: (value: string) => void;
  setAssignedSearch: (value: string) => void;
  onlyUnassigned: boolean;
  setOnlyUnassigned: (value: boolean) => void;
  loadingAssignable: boolean;
  loadingAssigned: boolean;
  assigningStudents: boolean;
  removingStudents: boolean;
  onAssign: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const list = props.tab === 'assign' ? props.assignableStudents : props.assignedStudents;
  const selected = props.tab === 'assign' ? props.selectedStudentIds : props.selectedRemoveIds;
  const setSelected = props.tab === 'assign' ? props.setSelectedStudentIds : props.setSelectedRemoveIds;
  const loading = props.tab === 'assign' ? props.loadingAssignable : props.loadingAssigned;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div><h2 className="text-lg font-bold text-slate-950">Assign Students</h2><p className="text-sm text-slate-500">{props.batch.name} - {props.batch.code}</p></div>
          <button type="button" onClick={props.onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="border-b border-slate-200 px-6 py-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => props.setTab('assign')} className={`rounded-lg px-3 py-2 text-sm font-bold ${props.tab === 'assign' ? 'bg-violet-50 text-violet-700' : 'text-slate-600 hover:bg-slate-50'}`}>Assign Learners</button>
            <button type="button" onClick={() => props.setTab('assigned')} className={`rounded-lg px-3 py-2 text-sm font-bold ${props.tab === 'assigned' ? 'bg-violet-50 text-violet-700' : 'text-slate-600 hover:bg-slate-50'}`}>Assigned Learners</button>
          </div>
        </div>
        <div className="border-b border-slate-200 px-6 py-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={props.tab === 'assign' ? props.studentSearch : props.assignedSearch} onChange={(event) => props.tab === 'assign' ? props.setStudentSearch(event.target.value) : props.setAssignedSearch(event.target.value)} placeholder="Search learners..." className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-100" />
          </label>
          {props.tab === 'assign' && <label className="mt-3 flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={props.onlyUnassigned} onChange={(event) => props.setOnlyUnassigned(event.target.checked)} />Only unassigned learners</label>}
        </div>
        <div className="overflow-y-auto p-6">
          {loading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-violet-600" /></div> : list.length ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {list.map((student) => {
                const checked = selected.includes(student._id);
                return (
                  <label key={student._id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${checked ? 'border-violet-200 bg-violet-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                    <input type="checkbox" checked={checked} onChange={() => setSelected((prev) => prev.includes(student._id) ? prev.filter((id) => id !== student._id) : [...prev, student._id])} />
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">{initials(student.name || student.fullName || student.email)}</span>
                    <span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-900">{student.name || student.fullName || student.email}</span><span className="block truncate text-xs text-slate-500">{student.email}</span></span>
                  </label>
                );
              })}
            </div>
          ) : <div className="py-12 text-center text-sm text-slate-500">No learners found.</div>}
        </div>
        <div className="flex justify-between border-t border-slate-200 px-6 py-4">
          <p className="text-sm text-slate-600">{selected.length} selected</p>
          {props.tab === 'assign' ? <button type="button" onClick={props.onAssign} disabled={props.assigningStudents || !selected.length} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60">{props.assigningStudents && <Loader2 className="h-4 w-4 animate-spin" />}Assign Students</button> : <button type="button" onClick={props.onRemove} disabled={props.removingStudents || !selected.length} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">{props.removingStudents && <Loader2 className="h-4 w-4 animate-spin" />}Remove from Batch</button>}
        </div>
      </div>
    </div>
  );
}
