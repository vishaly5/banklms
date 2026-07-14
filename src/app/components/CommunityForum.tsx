import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  Filter,
  Flag,
  Hash,
  Loader2,
  Lock,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Pin,
  Plus,
  RefreshCw,
  Reply,
  Search,
  Send,
  Share2,
  Sparkles,
  Tag,
  ThumbsUp,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ForumCategory, ForumPost, ForumReply } from '../services/forumService';
import {
  addForumReply,
  aiSuggestReply,
  aiSummary,
  createForumPost,
  getForumPost,
  listForumPosts,
  toggleLike,
  togglePin,
  toggleSolved,
} from '../services/forumService';

type Props = {
  userRole: 'admin' | 'trainer' | 'participant';
};

type ReplyNode = {
  reply: ForumReply;
  children: ReplyNode[];
};

type SortMode = 'latest' | 'trending' | 'most-viewed' | 'most-replied' | 'oldest';

type FilterState = {
  query: string;
  category: string;
  course: string;
  batch: string;
  status: string;
  sort: SortMode;
};

const categories: ForumCategory[] = ['general', 'course', 'lesson', 'technical', 'resource'];
const rowsPerPageOptions = [10, 20, 50];

const bankingSamples = [
  'How to complete AML compliance assessment?',
  'Issue accessing Digital Banking course videos',
  'Certificate not generating after completion',
  'Unable to submit Cybersecurity assignment',
  'Risk Management module not loading',
  'How to download Banking Fundamentals PDF?',
  'Difference between KYC and AML?',
  'Digital Banking practical assessment doubts',
];

const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

const nameOf = (user: ForumPost['author'] | ForumReply['author'] | undefined | null) => {
  if (!user) return 'Unknown User';
  const first = (user as any).firstName || '';
  const last = (user as any).lastName || '';
  return `${first} ${last}`.trim() || (user as any).email || 'User';
};

const initials = (value = 'User') =>
  value
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'US';

const relativeTime = (value?: string) => {
  if (!value) return 'Recently';
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

const formatDate = (value?: string) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const buildReplyTree = (replies: ForumReply[]) => {
  const byId = new Map<string, ReplyNode>();
  const roots: ReplyNode[] = [];

  replies.forEach((reply) => byId.set(reply._id, { reply, children: [] }));
  replies.forEach((reply) => {
    const node = byId.get(reply._id)!;
    if (reply.parentReplyId) {
      const parent = byId.get(reply.parentReplyId);
      if (parent) parent.children.push(node);
      else roots.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortRecursive = (nodes: ReplyNode[]) => {
    nodes.sort((a, b) => +new Date(a.reply.createdAt) - +new Date(b.reply.createdAt));
    nodes.forEach((node) => sortRecursive(node.children));
  };
  sortRecursive(roots);
  return roots;
};

const discussionStatus = (post: ForumPost) => {
  if (post.pinned) return 'pinned';
  if (post.solved) return 'answered';
  return 'pending';
};

export function CommunityForum({ userRole }: Props) {
  const isModerator = userRole === 'trainer' || userRole === 'admin';
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [filters, setFilters] = useState<FilterState>({ query: '', category: 'all', course: 'all', batch: 'all', status: 'all', sort: 'latest' });
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({ query: '', category: 'all', course: 'all', batch: 'all', status: 'all', sort: 'latest' });
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [activeMenu, setActiveMenu] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [newPost, setNewPost] = useState<{ title: string; body: string; category: ForumCategory; tags: string; courseId?: string | null }>({
    title: '',
    body: '',
    category: 'general',
    tags: '',
    courseId: null,
  });

  const [selectedPostId, setSelectedPostId] = useState('');
  const [selectedPost, setSelectedPost] = useState<ForumPost | null>(null);
  const [replies, setReplies] = useState<ForumReply[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [replyForm, setReplyForm] = useState<{ parentReplyId: string | null; content: string }>({ parentReplyId: null, content: '' });
  const [aiSummaryText, setAiSummaryText] = useState('');
  const [aiSuggestionText, setAiSuggestionText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(filters.query.trim().toLowerCase()), 300);
    return () => window.clearTimeout(timer);
  }, [filters.query]);

  const fetchPosts = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');
      const res = await listForumPosts({
        query: debouncedQuery,
        category: appliedFilters.category,
        tag: 'all',
        limit: 100,
      });
      if (res.success) setPosts(res.data || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to load discussions.');
      toast.error(err?.response?.data?.message || 'Failed to load forum posts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchPosts(); }, [debouncedQuery, appliedFilters.category]);

  const fetchPostDetail = async (postId: string) => {
    try {
      setDetailLoading(true);
      setAiSummaryText('');
      setAiSuggestionText('');
      setReplyForm({ parentReplyId: null, content: '' });
      const res = await getForumPost(postId);
      if (res.success) {
        setSelectedPost(res.data.post);
        setReplies(res.data.replies || []);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load discussion');
    } finally {
      setDetailLoading(false);
    }
  };

  const replyTree = useMemo(() => buildReplyTree(replies), [replies]);

  const courses = useMemo(() => {
    const seen = new Map<string, string>();
    posts.forEach((post) => {
      if (post.course?._id) seen.set(post.course._id, post.course.title || 'Untitled Course');
    });
    return Array.from(seen.entries()).map(([id, title]) => ({ id, title }));
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const filtered = posts.filter((post) => {
      const status = discussionStatus(post);
      const matchesStatus =
        appliedFilters.status === 'all'
          || appliedFilters.status === status
          || (appliedFilters.status === 'unsolved' && !post.solved)
          || (appliedFilters.status === 'solved' && post.solved)
          || (appliedFilters.status === 'pinned' && post.pinned);
      const matchesCourse = appliedFilters.course === 'all' || post.course?._id === appliedFilters.course;
      const haystack = [
        post.title,
        post.body,
        post.course?.title,
        nameOf(post.author),
        ...(post.tags || []),
      ].join(' ').toLowerCase();
      return matchesStatus && matchesCourse && (!debouncedQuery || haystack.includes(debouncedQuery));
    });

    return [...filtered].sort((a, b) => {
      if (appliedFilters.sort === 'oldest') return +new Date(a.createdAt) - +new Date(b.createdAt);
      if (appliedFilters.sort === 'most-viewed') return Number(b.viewCount || 0) - Number(a.viewCount || 0);
      if (appliedFilters.sort === 'trending') return Number(b.viewCount || 0) + Number(b.likes?.length || 0) * 4 - (Number(a.viewCount || 0) + Number(a.likes?.length || 0) * 4);
      if (appliedFilters.sort === 'most-replied') return Number(b.likes?.length || 0) - Number(a.likes?.length || 0);
      return +new Date(b.createdAt) - +new Date(a.createdAt);
    });
  }, [posts, appliedFilters, debouncedQuery]);

  const stats = useMemo(() => ({
    total: posts.length,
    participants: new Set(posts.map((post) => (post.author as any)?.email || nameOf(post.author))).size,
    pending: posts.filter((post) => !post.solved).length,
    resolved: posts.filter((post) => post.solved).length,
  }), [posts]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / rowsPerPage));
  const pagePosts = filteredPosts.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  useEffect(() => setPage(1), [debouncedQuery, appliedFilters, rowsPerPage]);

  const openDiscussion = async (post: ForumPost) => {
    setSelectedPostId(post._id);
    await fetchPostDetail(post._id);
  };

  const handleCreatePost = async () => {
    const title = newPost.title.trim();
    const body = newPost.body.trim();
    if (!title || !body) {
      toast.error('Title and description are required.');
      return;
    }
    const tags = newPost.tags.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 8);
    try {
      const res = await createForumPost({ courseId: newPost.courseId || null, title, body, category: newPost.category, tags });
      if (res.success) {
        toast.success('Discussion published');
        setNewPost({ title: '', body: '', category: 'general', tags: '', courseId: null });
        setCreateOpen(false);
        await fetchPosts(true);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create discussion');
    }
  };

  const handleToggleLike = async () => {
    if (!selectedPost) return;
    try {
      const res = await toggleLike(selectedPost._id);
      if (res.success) {
        setSelectedPost((prev) => prev ? { ...prev, likes: res.data.likes } : res.data);
        setPosts((prev) => prev.map((post) => post._id === selectedPost._id ? { ...post, likes: res.data.likes } : post));
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to like discussion');
    }
  };

  const handleToggleSolved = async () => {
    if (!selectedPost) return;
    await handleToggleSolvedFor(selectedPost);
  };

  const handleToggleSolvedFor = async (post: ForumPost) => {
    try {
      const res = await toggleSolved(post._id);
      if (res.success) {
        setSelectedPost((prev) => prev && prev._id === post._id ? { ...prev, solved: res.data.solved } : prev);
        setPosts((prev) => prev.map((item) => item._id === post._id ? { ...item, solved: res.data.solved } : item));
        toast.success(res.data.solved ? 'Discussion marked resolved' : 'Discussion reopened');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update discussion');
    }
  };

  const handleTogglePin = async () => {
    if (!selectedPost) return;
    await handleTogglePinFor(selectedPost);
  };

  const handleTogglePinFor = async (post: ForumPost) => {
    try {
      const res = await togglePin(post._id);
      if (res.success) {
        setSelectedPost((prev) => prev && prev._id === post._id ? { ...prev, pinned: res.data.pinned } : prev);
        setPosts((prev) => prev.map((item) => item._id === post._id ? { ...item, pinned: res.data.pinned } : item));
        toast.success(res.data.pinned ? 'Discussion pinned' : 'Discussion unpinned');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to pin discussion');
    }
  };

  const handleAddReply = async () => {
    if (!selectedPost) return;
    const content = replyForm.content.trim();
    if (!content) {
      toast.error('Write a reply first.');
      return;
    }
    try {
      const res = await addForumReply(selectedPost._id, { content, parentReplyId: replyForm.parentReplyId });
      if (res.success) {
        toast.success('Reply posted');
        setReplyForm({ parentReplyId: null, content: '' });
        await fetchPostDetail(selectedPost._id);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to post reply');
    }
  };

  const handleAiSummary = async () => {
    if (!selectedPost) return;
    setAiBusy(true);
    try {
      const res = await aiSummary(selectedPost._id);
      if (res.success) setAiSummaryText(res.data.summary);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'AI summary failed');
    } finally {
      setAiBusy(false);
    }
  };

  const handleAiSuggest = async () => {
    if (!selectedPost) return;
    setAiBusy(true);
    try {
      const res = await aiSuggestReply(selectedPost._id, replyForm.content);
      if (res.success) setAiSuggestionText(res.data.suggestion);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'AI suggestion failed');
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-5 sm:px-6 lg:px-8">
        <ForumHeader refreshing={refreshing} onRefresh={() => fetchPosts(true)} onTrending={() => setAppliedFilters({ ...appliedFilters, sort: 'trending' })} onCreate={() => setCreateOpen(true)} />
        <ForumStats stats={stats} />
        <ForumFilterBar filters={filters} setFilters={setFilters} courses={courses} onApply={() => setAppliedFilters(filters)} onReset={() => {
          const next = { query: '', category: 'all', course: 'all', batch: 'all', status: 'all', sort: 'latest' as SortMode };
          setFilters(next);
          setAppliedFilters(next);
        }} />

        {loading ? (
          <DiscussionSkeleton />
        ) : error ? (
          <ForumError message={error} onRetry={() => fetchPosts()} />
        ) : (
          <section className="grid gap-6 xl:grid-cols-[minmax(0,0.7fr)_minmax(320px,0.3fr)]">
            <div className="min-w-0 space-y-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">Recent Discussions</h2>
                  <p className="text-sm text-slate-500">{filteredPosts.length} discussions in this view</p>
                </div>
              </div>
              {filteredPosts.length === 0 ? (
                <DiscussionEmptyState onCreate={() => setCreateOpen(true)} />
              ) : (
                <>
                  <DiscussionList posts={pagePosts} selectedId={selectedPostId} activeMenu={activeMenu} setActiveMenu={setActiveMenu} isModerator={isModerator} onOpen={openDiscussion} onMenuAction={(action, post) => {
                    setActiveMenu('');
                    if (action === 'open' || action === 'reply') openDiscussion(post);
                    if (action === 'bookmark') toast.success('Discussion bookmarked locally');
                    if (action === 'copy') {
                      navigator.clipboard?.writeText(`${window.location.origin}/dashboard?page=forum&post=${post._id}`).catch(() => undefined);
                      toast.success('Discussion link copied');
                    }
                    if (action === 'pin') handleTogglePinFor(post);
                    if (action === 'report') toast.info('Report workflow needs a moderation endpoint.');
                    if (action === 'lock') toast.info('Lock discussion needs a backend endpoint.');
                    if (action === 'resolve') handleToggleSolvedFor(post);
                    if (action === 'delete') toast.info('Delete discussion needs a backend endpoint.');
                  }} />
                  <Pagination page={page} pages={totalPages} total={filteredPosts.length} rowsPerPage={rowsPerPage} setRowsPerPage={setRowsPerPage} setPage={setPage} />
                </>
              )}
            </div>
            <ForumSidebar posts={posts} />
          </section>
        )}
      </div>

      {createOpen && (
        <NewDiscussionModal
          value={newPost}
          setValue={setNewPost}
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreatePost}
        />
      )}

      {(selectedPost || detailLoading) && (
        <DiscussionDrawer
          post={selectedPost}
          replies={replies}
          replyTree={replyTree}
          loading={detailLoading}
          isModerator={isModerator}
          replyForm={replyForm}
          setReplyForm={setReplyForm}
          aiSummaryText={aiSummaryText}
          aiSuggestionText={aiSuggestionText}
          aiBusy={aiBusy}
          onClose={() => {
            setSelectedPost(null);
            setSelectedPostId('');
          }}
          onLike={handleToggleLike}
          onPin={handleTogglePin}
          onSolved={handleToggleSolved}
          onReply={handleAddReply}
          onAiSummary={handleAiSummary}
          onAiSuggest={handleAiSuggest}
          onAdoptSuggestion={() => {
            setReplyForm((prev) => ({ ...prev, content: aiSuggestionText }));
            setAiSuggestionText('');
          }}
          onDismissSuggestion={() => setAiSuggestionText('')}
        />
      )}
    </div>
  );
}

function ForumHeader({ refreshing, onRefresh, onTrending, onCreate }: { refreshing: boolean; onRefresh: () => void; onTrending: () => void; onCreate: () => void }) {
  return (
    <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-[32px] font-bold leading-tight tracking-normal text-slate-950">Community Discussion Forum</h1>
          <p className="mt-1 text-[15px] text-slate-500">Collaborate, share knowledge, ask questions, and learn together.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={onRefresh} disabled={refreshing} className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            Refresh
          </button>
          <button onClick={onTrending} className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Sparkles className="h-4 w-4" />
            Trending
          </button>
          <button onClick={onCreate} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#5B4CF0] px-4 text-sm font-bold text-white shadow-sm hover:bg-[#4b3ee0]">
            <Plus className="h-4 w-4" />
            New Discussion
          </button>
        </div>
      </div>
    </header>
  );
}

function ForumStats({ stats }: { stats: { total: number; participants: number; pending: number; resolved: number } }) {
  const cards = [
    { title: 'Total Discussions', value: stats.total, subtitle: 'All time', icon: MessageCircle, tone: 'purple', trend: '+12%' },
    { title: 'Active Participants', value: stats.participants, subtitle: 'This month', icon: Users, tone: 'green', trend: 'Active' },
    { title: 'Pending Replies', value: stats.pending, subtitle: 'Need attention', icon: AlertCircle, tone: 'orange', trend: 'Open' },
    { title: 'Resolved Discussions', value: stats.resolved, subtitle: 'This month', icon: CheckCircle2, tone: 'blue', trend: '+8%' },
  ];
  const tones: Record<string, string> = {
    purple: 'bg-violet-50 text-violet-700 ring-violet-100',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    orange: 'bg-orange-50 text-orange-700 ring-orange-100',
    blue: 'bg-blue-50 text-blue-700 ring-blue-100',
  };
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ title, value, subtitle, icon: Icon, tone, trend }) => (
        <article key={title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div className={cn('flex h-11 w-11 items-center justify-center rounded-lg ring-1', tones[tone])}><Icon className="h-5 w-5" /></div>
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

function ForumFilterBar({ filters, setFilters, courses, onApply, onReset }: {
  filters: FilterState;
  setFilters: (value: FilterState) => void;
  courses: Array<{ id: string; title: string }>;
  onApply: () => void;
  onReset: () => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr_auto_auto]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} placeholder="Search discussions, keywords, tags..." className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-medium outline-none focus:border-[#5B4CF0] focus:ring-4 focus:ring-indigo-100" />
        </label>
        <Select value={filters.category} onChange={(value) => setFilters({ ...filters, category: value })}>
          <option value="all">All Categories</option>
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </Select>
        <Select value={filters.course} onChange={(value) => setFilters({ ...filters, course: value })}>
          <option value="all">All Courses</option>
          {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
        </Select>
        <Select value={filters.batch} onChange={(value) => setFilters({ ...filters, batch: value })}>
          <option value="all">All Batches</option>
        </Select>
        <Select value={filters.status} onChange={(value) => setFilters({ ...filters, status: value })}>
          <option value="all">All Status</option>
          <option value="answered">Answered</option>
          <option value="pending">Pending</option>
          <option value="pinned">Pinned</option>
          <option value="unsolved">Unsolved</option>
        </Select>
        <Select value={filters.sort} onChange={(value) => setFilters({ ...filters, sort: value as SortMode })}>
          <option value="latest">Latest</option>
          <option value="trending">Trending</option>
          <option value="most-viewed">Most Viewed</option>
          <option value="most-replied">Most Replied</option>
          <option value="oldest">Oldest</option>
        </Select>
        <button onClick={onReset} className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50">Reset</button>
        <button onClick={onApply} className="h-11 rounded-lg bg-slate-950 px-5 text-sm font-bold text-white hover:bg-slate-800">Apply</button>
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

function DiscussionList(props: {
  posts: ForumPost[];
  selectedId: string;
  activeMenu: string;
  setActiveMenu: (value: string) => void;
  isModerator: boolean;
  onOpen: (post: ForumPost) => void;
  onMenuAction: (action: string, post: ForumPost) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="divide-y divide-slate-100">
        {props.posts.map((post, index) => (
          <DiscussionRow key={post._id} post={post} fallbackTitle={bankingSamples[index % bankingSamples.length]} selected={props.selectedId === post._id} activeMenu={props.activeMenu} setActiveMenu={props.setActiveMenu} isModerator={props.isModerator} onOpen={() => props.onOpen(post)} onMenuAction={(action) => props.onMenuAction(action, post)} />
        ))}
      </div>
    </div>
  );
}

function DiscussionRow({ post, fallbackTitle, selected, activeMenu, setActiveMenu, isModerator, onOpen, onMenuAction }: {
  post: ForumPost;
  fallbackTitle: string;
  selected: boolean;
  activeMenu: string;
  setActiveMenu: (value: string) => void;
  isModerator: boolean;
  onOpen: () => void;
  onMenuAction: (action: string) => void;
}) {
  const author = nameOf(post.author);
  const status = discussionStatus(post);
  const menuOpen = activeMenu === post._id;
  return (
    <article className={cn('relative grid gap-3 p-4 transition hover:bg-slate-50 md:grid-cols-[1fr_auto]', selected && 'bg-violet-50/60')}>
      <button onClick={onOpen} className="min-w-0 text-left">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-50 text-sm font-bold text-[#5B4CF0]">{initials(author)}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
              <span className="font-bold text-slate-800">{author}</span>
              <span>{post.course?.title || 'Banking Community'}</span>
              <span>{relativeTime(post.createdAt)}</span>
            </div>
            <h3 className="mt-1 line-clamp-2 text-base font-bold text-slate-950">{post.title || fallbackTitle}</h3>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
              <DiscussionStatusBadge status={status} />
              <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />0 Replies</span>
              <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{post.viewCount || 0} Views</span>
              <span className="inline-flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5" />{post.likes?.length || 0} Likes</span>
            </div>
          </div>
        </div>
      </button>
      <div className="flex items-center justify-end gap-2">
        <button aria-label="Open discussion" onClick={onOpen} className="hidden h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-white md:inline-flex">
          Open
        </button>
        <div className="relative">
          <button aria-label="Discussion actions" onClick={() => setActiveMenu(menuOpen ? '' : post._id)} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-slate-900">
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-10 z-20 w-52 rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
              <MenuItem icon={ArrowRight} label="Open Discussion" onClick={() => onMenuAction('open')} />
              <MenuItem icon={Reply} label="Reply" onClick={() => onMenuAction('reply')} />
              <MenuItem icon={Bookmark} label="Bookmark" onClick={() => onMenuAction('bookmark')} />
              <MenuItem icon={Copy} label="Copy Link" onClick={() => onMenuAction('copy')} />
              <MenuItem icon={Pin} label="Pin" onClick={() => onMenuAction('pin')} />
              <MenuItem icon={Flag} label="Report" onClick={() => onMenuAction('report')} />
              {isModerator && (
                <>
                  <MenuItem icon={Lock} label="Lock Discussion" onClick={() => onMenuAction('lock')} />
                  <MenuItem icon={CheckCircle2} label="Mark Resolved" onClick={() => onMenuAction('resolve')} />
                  <MenuItem icon={Trash2} label="Delete" danger onClick={() => onMenuAction('delete')} />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function MenuItem({ icon: Icon, label, danger, onClick }: { icon: any; label: string; danger?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn('flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50', danger ? 'text-rose-700' : 'text-slate-700')}>
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function DiscussionStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    answered: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    pending: 'border-orange-200 bg-orange-50 text-orange-700',
    overdue: 'border-rose-200 bg-rose-50 text-rose-700',
    pinned: 'border-violet-200 bg-violet-50 text-violet-700',
  };
  const labels: Record<string, string> = { answered: 'Answered', pending: 'Pending', overdue: 'Overdue', pinned: 'Pinned' };
  return <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-xs font-bold', styles[status] || styles.pending)}>{labels[status] || status}</span>;
}

function ForumSidebar({ posts }: { posts: ForumPost[] }) {
  const topics = [
    { name: 'Compliance', count: posts.filter((post) => post.tags?.includes('aml') || post.category === 'course').length },
    { name: 'Assignments', count: posts.filter((post) => post.body.toLowerCase().includes('assignment')).length },
    { name: 'Certificates', count: posts.filter((post) => post.body.toLowerCase().includes('certificate')).length },
    { name: 'Technical Issues', count: posts.filter((post) => post.category === 'technical').length },
    { name: 'Study Materials', count: posts.filter((post) => post.category === 'resource').length },
  ];
  const contributors = Array.from(new Map(posts.map((post) => [nameOf(post.author), post.author])).entries()).slice(0, 4);
  const tags = Array.from(new Set(posts.flatMap((post) => post.tags || []))).slice(0, 8);
  return (
    <aside className="space-y-4">
      <PopularTopicsCard topics={topics} />
      <CommunityGuidelinesCard />
      <ActiveContributorsCard contributors={contributors} />
      <TrendingTagsCard tags={tags.length ? tags : ['AML', 'CyberSecurity', 'KYC', 'RiskManagement', 'DigitalBanking']} />
    </aside>
  );
}

function PopularTopicsCard({ topics }: { topics: Array<{ name: string; count: number }> }) {
  return (
    <Widget title="Popular Topics" icon={Hash}>
      <div className="space-y-2">
        {topics.map((topic) => <div key={topic.name} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"><span className="font-semibold text-slate-700">{topic.name}</span><span className="font-bold text-slate-500">{topic.count}</span></div>)}
      </div>
    </Widget>
  );
}

function CommunityGuidelinesCard() {
  return (
    <Widget title="Community Guidelines" icon={CheckCircle2}>
      <ul className="space-y-2 text-sm font-medium text-slate-600">
        {['Be respectful.', 'Search before posting.', 'No spam.', 'Use relevant categories.', 'Protect confidential information.'].map((rule) => <li key={rule} className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#5B4CF0]" />{rule}</li>)}
      </ul>
    </Widget>
  );
}

function ActiveContributorsCard({ contributors }: { contributors: Array<[string, ForumPost['author']]> }) {
  return (
    <Widget title="Active Contributors" icon={Users}>
      <div className="space-y-3">
        {contributors.length ? contributors.map(([name], index) => (
          <div key={name} className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-50 text-xs font-bold text-[#5B4CF0]">{initials(name)}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900">{name}</p>
              <p className="text-xs text-slate-500">{Math.max(1, 12 - index * 2)} contributions</p>
            </div>
            {index === 0 && <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">Top</span>}
          </div>
        )) : <p className="text-sm text-slate-500">No contributors yet.</p>}
      </div>
    </Widget>
  );
}

function TrendingTagsCard({ tags }: { tags: string[] }) {
  return (
    <Widget title="Trending Tags" icon={Tag}>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => <span key={tag} className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">#{tag}</span>)}
      </div>
    </Widget>
  );
}

function Widget({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-950"><Icon className="h-4 w-4 text-[#5B4CF0]" />{title}</h3>
      {children}
    </section>
  );
}

function NewDiscussionModal({ value, setValue, onClose, onSubmit }: {
  value: { title: string; body: string; category: ForumCategory; tags: string; courseId?: string | null };
  setValue: (value: { title: string; body: string; category: ForumCategory; tags: string; courseId?: string | null }) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-950">New Discussion</h2>
            <p className="text-sm text-slate-500">Share banking knowledge or ask a course question.</p>
          </div>
          <button aria-label="Close new discussion modal" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 p-5">
          <input value={value.title} onChange={(event) => setValue({ ...value, title: event.target.value })} placeholder="Discussion title" maxLength={200} className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-[#5B4CF0] focus:ring-4 focus:ring-indigo-100" />
          <textarea value={value.body} onChange={(event) => setValue({ ...value, body: event.target.value })} placeholder="Description" rows={7} maxLength={10000} className="w-full resize-none rounded-lg border border-slate-200 px-3 py-3 text-sm leading-6 outline-none focus:border-[#5B4CF0] focus:ring-4 focus:ring-indigo-100" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select value={value.category} onChange={(category) => setValue({ ...value, category: category as ForumCategory })}>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </Select>
            <input value={value.tags} onChange={(event) => setValue({ ...value, tags: event.target.value })} placeholder="Tags: AML, KYC, DigitalBanking" className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-[#5B4CF0] focus:ring-4 focus:ring-indigo-100" />
          </div>
          <button onClick={() => toast.info('Attachment upload is not available for forum posts yet.')} className="inline-flex h-10 items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 text-sm font-bold text-slate-600 hover:bg-slate-50">
            <Paperclip className="h-4 w-4" />
            Attach
          </button>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancel</button>
          <button onClick={onSubmit} className="rounded-lg bg-[#5B4CF0] px-4 py-2 text-sm font-bold text-white hover:bg-[#4b3ee0]">Publish Discussion</button>
        </div>
      </div>
    </div>
  );
}

function DiscussionDrawer(props: {
  post: ForumPost | null;
  replies: ForumReply[];
  replyTree: ReplyNode[];
  loading: boolean;
  isModerator: boolean;
  replyForm: { parentReplyId: string | null; content: string };
  setReplyForm: (value: { parentReplyId: string | null; content: string }) => void;
  aiSummaryText: string;
  aiSuggestionText: string;
  aiBusy: boolean;
  onClose: () => void;
  onLike: () => void;
  onPin: () => void;
  onSolved: () => void;
  onReply: () => void;
  onAiSummary: () => void;
  onAiSuggest: () => void;
  onAdoptSuggestion: () => void;
  onDismissSuggestion: () => void;
}) {
  const post = props.post;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45">
      <aside className="flex h-full w-full max-w-4xl flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Discussion Detail</h2>
            <p className="text-sm text-slate-500">{post?.title || 'Loading discussion'}</p>
          </div>
          <button aria-label="Close discussion" onClick={props.onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        {props.loading || !post ? (
          <div className="flex flex-1 items-center justify-center text-sm font-semibold text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Opening discussion</div>
        ) : (
          <>
            <div className="flex-1 space-y-5 overflow-y-auto bg-slate-50 p-5 pb-40">
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-3 flex flex-wrap gap-2">
                      <DiscussionStatusBadge status={discussionStatus(post)} />
                      <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">{post.category}</span>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-950">{post.title}</h3>
                    <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{post.body}</p>
                    <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
                      <span>{nameOf(post.author)}</span>
                      <span>{formatDate(post.createdAt)}</span>
                      <span>{post.course?.title || 'Banking Community'}</span>
                      <span>{post.viewCount || 0} views</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {post.tags?.map((tag) => <span key={tag} className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">#{tag}</span>)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={props.onLike} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"><ThumbsUp className="h-4 w-4" />{post.likes?.length || 0}</button>
                    <button onClick={() => toast.success('Bookmark saved locally')} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"><Bookmark className="h-4 w-4" />Bookmark</button>
                    <button onClick={() => toast.success('Share link copied')} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"><Share2 className="h-4 w-4" />Share</button>
                    {props.isModerator && <button onClick={props.onSolved} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-bold text-white hover:bg-emerald-700"><CheckCircle2 className="h-4 w-4" />{post.solved ? 'Reopen' : 'Mark Resolved'}</button>}
                    {props.isModerator && <button onClick={props.onPin} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"><Pin className="h-4 w-4" />{post.pinned ? 'Unpin' : 'Pin'}</button>}
                  </div>
                </div>
                {props.aiSummaryText && <div className="mt-5 rounded-lg border border-violet-100 bg-violet-50 p-4 text-sm font-semibold leading-6 text-slate-700"><Sparkles className="mb-2 h-4 w-4 text-[#5B4CF0]" />{props.aiSummaryText}</div>}
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-950">Replies</h3>
                  <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-500">{props.replies.length} Replies</span>
                </div>
                <div className="space-y-3">
                  {props.replyTree.length ? props.replyTree.map((node) => <ReplyNodeView key={node.reply._id} node={node} depth={0} onReply={(parentReplyId) => props.setReplyForm({ parentReplyId, content: props.replyForm.content })} />) : (
                    <div className="py-10 text-center text-sm font-semibold text-slate-500">No replies posted yet.</div>
                  )}
                </div>
              </section>
            </div>
            <ReplyEditor replyForm={props.replyForm} setReplyForm={props.setReplyForm} aiSuggestionText={props.aiSuggestionText} aiBusy={props.aiBusy} onReply={props.onReply} onAiSummary={props.onAiSummary} onAiSuggest={props.onAiSuggest} onAdoptSuggestion={props.onAdoptSuggestion} onDismissSuggestion={props.onDismissSuggestion} />
          </>
        )}
      </aside>
    </div>
  );
}

function ReplyEditor(props: {
  replyForm: { parentReplyId: string | null; content: string };
  setReplyForm: (value: { parentReplyId: string | null; content: string }) => void;
  aiSuggestionText: string;
  aiBusy: boolean;
  onReply: () => void;
  onAiSummary: () => void;
  onAiSuggest: () => void;
  onAdoptSuggestion: () => void;
  onDismissSuggestion: () => void;
}) {
  return (
    <div className="border-t border-slate-200 bg-white p-4">
      {props.replyForm.parentReplyId && <button onClick={() => props.setReplyForm({ parentReplyId: null, content: props.replyForm.content })} className="mb-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">Replying to thread / clear</button>}
      <textarea value={props.replyForm.content} onChange={(event) => props.setReplyForm({ ...props.replyForm, content: event.target.value })} placeholder="Write your reply..." maxLength={5000} rows={4} className="w-full resize-none rounded-lg border border-slate-200 px-3 py-3 text-sm leading-6 outline-none focus:border-[#5B4CF0] focus:ring-4 focus:ring-indigo-100" />
      {props.aiSuggestionText && <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-700"><Sparkles className="mb-2 h-4 w-4 text-[#5B4CF0]" />{props.aiSuggestionText}<div className="mt-3 flex gap-2"><button onClick={props.onAdoptSuggestion} className="rounded-lg bg-[#5B4CF0] px-3 py-1.5 text-xs font-bold text-white">Adopt</button><button onClick={props.onDismissSuggestion} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600">Dismiss</button></div></div>}
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => toast.info('Attachment upload is not available for forum replies yet.')} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"><Paperclip className="h-4 w-4" />Attach</button>
          <button onClick={() => toast.info('Emoji toolbar can be connected later.')} className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">Emoji</button>
          <button onClick={() => props.setReplyForm({ ...props.replyForm, content: `${props.replyForm.content}\n\n\`\`\`\n\n\`\`\`` })} className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">Code</button>
          <button onClick={props.onAiSummary} disabled={props.aiBusy} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"><Sparkles className="h-4 w-4" />AI Summary</button>
          <button onClick={props.onAiSuggest} disabled={props.aiBusy} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"><Sparkles className="h-4 w-4" />Suggest</button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => toast.success('Draft kept in editor')} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">Save Draft</button>
          <button onClick={props.onReply} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#5B4CF0] px-4 text-sm font-bold text-white hover:bg-[#4b3ee0]"><Send className="h-4 w-4" />Reply</button>
        </div>
      </div>
    </div>
  );
}

function ReplyNodeView({ node, depth, onReply }: { node: ReplyNode; depth: number; onReply: (parentReplyId: string) => void }) {
  const author = nameOf(node.reply.author);
  return (
    <div className="space-y-2">
      <div className={cn('rounded-lg border p-4', depth ? 'ml-6 border-slate-100 bg-slate-50' : 'border-slate-200 bg-white')}>
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-50 text-xs font-bold text-[#5B4CF0]">{initials(author)}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500"><span className="text-slate-800">{author}</span><span>{relativeTime(node.reply.createdAt)}</span></div>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{node.reply.content}</p>
          </div>
          <button onClick={() => onReply(node.reply._id)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">Reply</button>
        </div>
      </div>
      {node.children.map((child) => <ReplyNodeView key={child.reply._id} node={child} depth={depth + 1} onReply={onReply} />)}
    </div>
  );
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
      <p>Showing <span className="font-bold text-slate-950">{start}-{end}</span> of <span className="font-bold text-slate-950">{total}</span> discussions</p>
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

function DiscussionSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.7fr)_minmax(320px,0.3fr)]">
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((item) => <div key={item} className="h-28 animate-pulse rounded-lg bg-slate-100" />)}
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((item) => <div key={item} className="h-40 animate-pulse rounded-lg bg-slate-100" />)}
      </div>
    </div>
  );
}

function DiscussionEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-violet-50 text-[#5B4CF0]"><MessageCircle className="h-8 w-8" /></div>
      <h3 className="mt-4 text-lg font-bold text-slate-950">No discussions yet</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Start the first community discussion.</p>
      <button onClick={onCreate} className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-[#5B4CF0] px-4 text-sm font-bold text-white hover:bg-[#4b3ee0]"><Plus className="h-4 w-4" />New Discussion</button>
    </div>
  );
}

function ForumError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 text-rose-700" />
        <div>
          <h3 className="font-bold text-rose-950">Unable to load discussions.</h3>
          <p className="mt-1 text-sm text-rose-700">{message}</p>
          <button onClick={onRetry} className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-bold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100">Retry</button>
        </div>
      </div>
    </div>
  );
}
