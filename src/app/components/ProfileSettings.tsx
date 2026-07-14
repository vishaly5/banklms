import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Bell,
  Briefcase,
  Building2,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Eye,
  EyeOff,
  FileText,
  Globe,
  IdCard,
  Languages,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Monitor,
  MoreHorizontal,
  Phone,
  Printer,
  RefreshCw,
  Save,
  Settings,
  Shield,
  Smartphone,
  Upload,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import axiosInstance from '../../utils/axiosConfig';

interface ProfileSettingsProps {
  userRole: 'admin' | 'trainer' | 'participant';
}

interface UserProfile {
  _id: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  name?: string;
  email: string;
  mobile?: string;
  location?: string;
  role: string;
  profilePicture?: string;
  isActive?: boolean;
  createdAt?: string;
  organization?: string;
  designation?: string;
  specialization?: string[];
  experience?: number;
}

type TabId = 'personal' | 'professional' | 'security' | 'preferences' | 'notifications' | 'activity';

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  location: string;
  organization: string;
  department: string;
  designation: string;
  specialization: string[];
  experience: number;
  reportingManager: string;
  officeLocation: string;
  summary: string;
  dateOfBirth: string;
  gender: string;
  employeeId: string;
  profilePicture: string;
};

const tabs: Array<{ id: TabId; label: string; icon: any }> = [
  { id: 'personal', label: 'Personal Information', icon: User },
  { id: 'professional', label: 'Professional', icon: Briefcase },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'preferences', label: 'Preferences', icon: Globe },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'activity', label: 'Activity', icon: Clock },
];

const emptyForm: FormData = {
  firstName: '',
  lastName: '',
  email: '',
  mobile: '',
  location: '',
  organization: '',
  department: '',
  designation: '',
  specialization: [],
  experience: 0,
  reportingManager: '',
  officeLocation: '',
  summary: '',
  dateOfBirth: '',
  gender: '',
  employeeId: '',
  profilePicture: '',
};

const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

const getFullName = (profile?: UserProfile | null, form?: FormData) =>
  profile?.fullName || profile?.name || `${form?.firstName || profile?.firstName || ''} ${form?.lastName || profile?.lastName || ''}`.trim() || 'Trainer';

const getInitials = (name = 'Trainer') =>
  name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'TR';

const formatMemberSince = (value?: string) => {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

export function ProfileSettings({ userRole }: ProfileSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [savedSnapshot, setSavedSnapshot] = useState<FormData>(emptyForm);
  const [activeTab, setActiveTab] = useState<TabId>('personal');
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState({ current: false, next: false, confirm: false });
  const [preferences, setPreferences] = useState({
    language: 'English',
    timezone: 'IST (UTC +5:30)',
    theme: 'System',
    dateFormat: 'DD MMM YYYY',
    timeFormat: '12 hour',
    lowBandwidth: false,
    videoQuality: 'Auto',
  });
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    courseUpdates: true,
    assignmentAlerts: true,
    forumReplies: true,
    communityMessages: true,
    certificates: true,
    securityAlerts: true,
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const mapProfileToForm = (userData: any): FormData => ({
    firstName: userData.firstName || '',
    lastName: userData.lastName || '',
    email: userData.email || '',
    mobile: userData.mobile || '',
    location: userData.location || '',
    organization: userData.organization || '',
    department: userData.department || '',
    designation: userData.designation || '',
    specialization: userData.specialization || [],
    experience: Number(userData.experience || 0),
    reportingManager: userData.reportingManager || '',
    officeLocation: userData.officeLocation || userData.location || '',
    summary: userData.summary || '',
    dateOfBirth: userData.dateOfBirth || '',
    gender: userData.gender || '',
    employeeId: userData.employeeId || userData.employeeCode || '',
    profilePicture: userData.profilePicture || '',
  });

  const fetchProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axiosInstance.get('/auth/me');
      if (response.data.success && response.data.data) {
        const userData = response.data.data;
        const nextForm = mapProfileToForm(userData);
        setProfile(userData);
        setFormData(nextForm);
        setSavedSnapshot(nextForm);
        localStorage.setItem('user', JSON.stringify(userData));
      } else {
        throw new Error(response.data.message || 'Failed to load profile data');
      }
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || 'Failed to load profile data';
      setError(message);
      toast.error(message);
      try {
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        if (storedUser._id) {
          const nextForm = mapProfileToForm(storedUser);
          setProfile(storedUser);
          setFormData(nextForm);
          setSavedSnapshot(nextForm);
          toast.info('Using cached profile data', { duration: 2000 });
        }
      } catch {
        // ignore local cache parse failure
      }
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = useMemo(() => JSON.stringify(formData) !== JSON.stringify(savedSnapshot), [formData, savedSnapshot]);

  const completion = useMemo(() => {
    const checks = [
      Boolean(formData.profilePicture),
      Boolean(formData.mobile),
      formData.specialization.length > 0,
      Boolean(formData.reportingManager),
      Boolean(formData.organization),
    ];
    const completed = checks.filter(Boolean).length;
    return { percent: Math.round((completed / checks.length) * 100), completed };
  }, [formData]);

  const passwordStrength = useMemo(() => {
    const value = passwordData.newPassword;
    let score = 0;
    if (value.length >= 6) score += 25;
    if (value.length >= 10) score += 25;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 20;
    if (/\d/.test(value)) score += 15;
    if (/[^A-Za-z0-9]/.test(value)) score += 15;
    return Math.min(100, score);
  }, [passwordData.newPassword]);

  const handleField = (field: keyof FormData, value: string | number | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const response = await axiosInstance.put('/users/profile', {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        mobile: formData.mobile,
        location: formData.location,
        organization: formData.organization,
        designation: formData.designation,
        specialization: formData.specialization,
        experience: formData.experience,
        profilePicture: formData.profilePicture,
      });

      if (response.data.success) {
        const nextProfile = response.data.data;
        const nextForm = mapProfileToForm(nextProfile);
        setProfile(nextProfile);
        setFormData((prev) => ({ ...prev, ...nextForm, reportingManager: prev.reportingManager, officeLocation: prev.officeLocation, summary: prev.summary, dateOfBirth: prev.dateOfBirth, gender: prev.gender, employeeId: prev.employeeId }));
        setSavedSnapshot((prev) => ({ ...prev, ...nextForm, reportingManager: formData.reportingManager, officeLocation: formData.officeLocation, summary: formData.summary, dateOfBirth: formData.dateOfBirth, gender: formData.gender, employeeId: formData.employeeId }));
        localStorage.setItem('user', JSON.stringify(nextProfile));
        window.dispatchEvent(new CustomEvent('profileUpdated', { detail: nextProfile }));
        toast.success('Profile updated successfully');
      } else {
        toast.error(response.data.message || 'Failed to update profile');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast.error('Please fill all password fields');
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setUpdatingPassword(true);
    try {
      const response = await axiosInstance.put('/users/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      if (response.data.success) {
        toast.success('Password updated successfully');
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update password');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handlePhotoUpload = async (file?: File) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast.error('Please upload PNG, JPEG, or WEBP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5 MB');
      return;
    }

    setUploadingPhoto(true);
    try {
      const base64String = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const response = await axiosInstance.put('/users/profile', { profilePicture: base64String });
      if (response.data.success) {
        handleField('profilePicture', base64String);
        setSavedSnapshot((prev) => ({ ...prev, profilePicture: base64String }));
        setProfile(response.data.data);
        localStorage.setItem('user', JSON.stringify(response.data.data));
        window.dispatchEvent(new CustomEvent('profileUpdated', { detail: response.data.data }));
        toast.success('Profile photo updated');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (loading) {
    return <ProfileSkeleton />;
  }

  if (!profile) {
    return <ProfileError message={error || 'Failed to load profile'} onRetry={fetchProfile} />;
  }

  const fullName = getFullName(profile, formData);
  const memberSince = formatMemberSince(profile.createdAt);
  const roleLabel = profile.role === 'administrator' ? 'Admin' : profile.role || userRole;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-28">
      <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-5 sm:px-6 lg:px-8">
        <ProfileHeader onRefresh={fetchProfile} />
        <ProfileSummaryCard
          profile={profile}
          formData={formData}
          fullName={fullName}
          memberSince={memberSince}
          roleLabel={roleLabel}
          uploading={uploadingPhoto}
          onUpload={handlePhotoUpload}
          onEdit={() => setActiveTab('personal')}
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <main className="min-w-0 space-y-6">
            <ProfileTabs activeTab={activeTab} setActiveTab={setActiveTab} />
            {activeTab === 'personal' && <PersonalInfoForm formData={formData} onField={handleField} />}
            {activeTab === 'professional' && <ProfessionalForm formData={formData} onField={handleField} />}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <SecurityCard passwordData={passwordData} setPasswordData={setPasswordData} showPassword={showPassword} setShowPassword={setShowPassword} strength={passwordStrength} updating={updatingPassword} onUpdate={handleUpdatePassword} />
                <TwoFactorCard />
              </div>
            )}
            {activeTab === 'preferences' && <PreferenceSettings preferences={preferences} setPreferences={setPreferences} />}
            {activeTab === 'notifications' && <NotificationSettings notifications={notifications} setNotifications={setNotifications} />}
            {activeTab === 'activity' && <ActivityTimeline />}
          </main>

          <aside className="space-y-4">
            <ProfileCompletionCard percent={completion.percent} />
            <ProfilePhotoUploader formData={formData} uploading={uploadingPhoto} onUpload={handlePhotoUpload} onRemove={() => handleField('profilePicture', '')} />
            <QuickActions />
          </aside>
        </div>
      </div>

      <StickySaveBar visible={hasChanges} saving={saving} onSave={handleSaveProfile} onCancel={() => setFormData(savedSnapshot)} onReset={fetchProfile} />
    </div>
  );
}

function ProfileHeader({ onRefresh }: { onRefresh: () => void }) {
  return (
    <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[32px] font-bold leading-tight text-slate-950">Trainer Profile</h1>
          <p className="mt-1 text-[15px] text-slate-500">Manage your account, security and preferences.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => toast.info('Public profile page is not connected yet.')} className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">View Public Profile</button>
          <button onClick={() => toast.info('Profile download needs backend export support.')} className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Download className="h-4 w-4" />Download Profile</button>
          <button onClick={onRefresh} aria-label="Refresh profile" className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><RefreshCw className="h-4 w-4" /></button>
          <button aria-label="More profile actions" className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><MoreHorizontal className="h-4 w-4" /></button>
        </div>
      </div>
    </header>
  );
}

function ProfileSummaryCard(props: {
  profile: UserProfile;
  formData: FormData;
  fullName: string;
  memberSince: string;
  roleLabel: string;
  uploading: boolean;
  onUpload: (file?: File) => void;
  onEdit: () => void;
}) {
  const stats = [
    { label: 'Courses', value: 12, icon: Briefcase },
    { label: 'Students', value: 215, icon: Users },
    { label: 'Average Rating', value: '98%', icon: Award },
    { label: 'Certificates', value: 18, icon: IdCard },
  ];
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative h-28 w-28">
            <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-violet-50 text-3xl font-bold text-[#5B4CF0] ring-4 ring-white shadow-sm">
              {props.formData.profilePicture ? <img src={props.formData.profilePicture} alt="Profile" className="h-full w-full object-cover" /> : getInitials(props.fullName)}
            </div>
            <label className="absolute bottom-1 right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[#5B4CF0] text-white shadow-lg" aria-label="Upload profile photo">
              {props.uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => props.onUpload(event.target.files?.[0])} disabled={props.uploading} />
            </label>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-950">{props.fullName}</h2>
            <p className="mt-1 text-sm text-slate-500">Member since {props.memberSince}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold capitalize text-violet-700 ring-1 ring-violet-100">{props.roleLabel}</span>
              <span className={cn('rounded-full px-3 py-1 text-xs font-bold ring-1', props.profile.isActive !== false ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' : 'bg-rose-50 text-rose-700 ring-rose-100')}>{props.profile.isActive !== false ? 'Active' : 'Inactive'}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <Upload className="h-4 w-4" />
                Change Photo
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => props.onUpload(event.target.files?.[0])} disabled={props.uploading} />
              </label>
              <button onClick={props.onEdit} className="h-10 rounded-lg bg-[#5B4CF0] px-3 text-sm font-bold text-white hover:bg-[#4b3ee0]">Edit Profile</button>
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(({ label, value, icon: Icon }) => (
            <div key={label} className="min-w-[130px] rounded-lg border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-sm">
              <Icon className="h-5 w-5 text-[#5B4CF0]" />
              <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
              <p className="text-xs font-semibold text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProfileTabs({ activeTab, setActiveTab }: { activeTab: TabId; setActiveTab: (tab: TabId) => void }) {
  return (
    <nav className="flex gap-2 overflow-x-auto rounded-lg border border-slate-200 bg-white p-2 shadow-sm" aria-label="Profile sections">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button key={id} onClick={() => setActiveTab(id)} className={cn('inline-flex h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-bold transition focus:outline-none focus:ring-4 focus:ring-violet-100', activeTab === id ? 'bg-[#5B4CF0] text-white' : 'text-slate-600 hover:bg-slate-50')}>
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </nav>
  );
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-5 flex items-center gap-2 text-xl font-bold text-slate-950"><Icon className="h-5 w-5 text-[#5B4CF0]" />{title}</h2>
      {children}
    </section>
  );
}

function PersonalInfoForm({ formData, onField }: { formData: FormData; onField: (field: keyof FormData, value: any) => void }) {
  return (
    <SectionCard title="Personal Information" icon={User}>
      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="First Name" icon={User} value={formData.firstName} onChange={(value) => onField('firstName', value)} helper="Use your legal banking LMS profile name." />
        <TextField label="Last Name" icon={User} value={formData.lastName} onChange={(value) => onField('lastName', value)} />
        <TextField label="Email" icon={Mail} type="email" value={formData.email} onChange={(value) => onField('email', value)} helper="Verified" />
        <TextField label="Phone Number" icon={Phone} value={formData.mobile} onChange={(value) => onField('mobile', value)} />
        <TextField label="Location" icon={MapPin} value={formData.location} onChange={(value) => onField('location', value)} />
        <TextField label="Date of Birth" icon={Clock} type="date" value={formData.dateOfBirth} onChange={(value) => onField('dateOfBirth', value)} />
        <SelectField label="Gender" value={formData.gender} onChange={(value) => onField('gender', value)} options={['', 'Female', 'Male', 'Other', 'Prefer not to say']} />
        <TextField label="Employee ID" icon={IdCard} value={formData.employeeId} onChange={(value) => onField('employeeId', value)} />
      </div>
    </SectionCard>
  );
}

function ProfessionalForm({ formData, onField }: { formData: FormData; onField: (field: keyof FormData, value: any) => void }) {
  return (
    <SectionCard title="Professional Information" icon={Briefcase}>
      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="Organization" icon={Building2} value={formData.organization} onChange={(value) => onField('organization', value)} />
        <TextField label="Department" icon={Building2} value={formData.department} onChange={(value) => onField('department', value)} />
        <TextField label="Designation" icon={Briefcase} value={formData.designation} onChange={(value) => onField('designation', value)} />
        <TextField label="Experience" icon={Award} type="number" value={String(formData.experience)} onChange={(value) => onField('experience', Number(value || 0))} />
        <TextField label="Specialization" icon={TagIcon} value={formData.specialization.join(', ')} onChange={(value) => onField('specialization', value.split(',').map((item) => item.trim()).filter(Boolean))} helper="Separate multiple items with commas." />
        <TextField label="Reporting Manager" icon={User} value={formData.reportingManager} onChange={(value) => onField('reportingManager', value)} />
        <TextField label="Office Location" icon={MapPin} value={formData.officeLocation} onChange={(value) => onField('officeLocation', value)} />
      </div>
      <label className="mt-4 block">
        <span className="text-sm font-bold text-slate-700">Professional Summary</span>
        <textarea value={formData.summary} onChange={(event) => onField('summary', event.target.value)} placeholder="Briefly describe your professional background..." rows={6} className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-3 text-sm leading-6 outline-none focus:border-[#5B4CF0] focus:ring-4 focus:ring-violet-100" />
      </label>
    </SectionCard>
  );
}

function TagIcon(props: any) {
  return <Settings {...props} />;
}

function TextField({ label, icon: Icon, value, onChange, type = 'text', helper }: { label: string; icon: any; value: string; onChange: (value: string) => void; type?: string; helper?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <span className="relative mt-2 block">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm font-medium outline-none focus:border-[#5B4CF0] focus:ring-4 focus:ring-violet-100" />
      </span>
      {helper && <span className="mt-1 block text-xs font-semibold text-emerald-600">{helper}</span>}
    </label>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <span className="relative mt-2 block">
        <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-[#5B4CF0] focus:ring-4 focus:ring-violet-100">
          {options.map((option) => <option key={option} value={option}>{option || 'Select'}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </span>
    </label>
  );
}

function SecurityCard(props: {
  passwordData: { currentPassword: string; newPassword: string; confirmPassword: string };
  setPasswordData: React.Dispatch<React.SetStateAction<{ currentPassword: string; newPassword: string; confirmPassword: string }>>;
  showPassword: { current: boolean; next: boolean; confirm: boolean };
  setShowPassword: React.Dispatch<React.SetStateAction<{ current: boolean; next: boolean; confirm: boolean }>>;
  strength: number;
  updating: boolean;
  onUpdate: () => void;
}) {
  return (
    <SectionCard title="Security" icon={Lock}>
      <div className="grid gap-4 md:grid-cols-3">
        <PasswordField label="Current Password" value={props.passwordData.currentPassword} visible={props.showPassword.current} onToggle={() => props.setShowPassword((prev) => ({ ...prev, current: !prev.current }))} onChange={(value) => props.setPasswordData((prev) => ({ ...prev, currentPassword: value }))} />
        <PasswordField label="New Password" value={props.passwordData.newPassword} visible={props.showPassword.next} onToggle={() => props.setShowPassword((prev) => ({ ...prev, next: !prev.next }))} onChange={(value) => props.setPasswordData((prev) => ({ ...prev, newPassword: value }))} />
        <PasswordField label="Confirm Password" value={props.passwordData.confirmPassword} visible={props.showPassword.confirm} onToggle={() => props.setShowPassword((prev) => ({ ...prev, confirm: !prev.confirm }))} onChange={(value) => props.setPasswordData((prev) => ({ ...prev, confirmPassword: value }))} />
      </div>
      <div className="mt-4">
        <div className="mb-2 flex justify-between text-xs font-bold text-slate-500"><span>Password strength</span><span>{props.strength}%</span></div>
        <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-[#5B4CF0]" style={{ width: `${props.strength}%` }} /></div>
      </div>
      <button onClick={props.onUpdate} disabled={props.updating} className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-[#5B4CF0] px-4 text-sm font-bold text-white hover:bg-[#4b3ee0] disabled:opacity-60">
        {props.updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
        Update Password
      </button>
    </SectionCard>
  );
}

function PasswordField({ label, value, visible, onToggle, onChange }: { label: string; value: string; visible: boolean; onToggle: () => void; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <span className="relative mt-2 block">
        <input type={visible ? 'text' : 'password'} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 pr-10 pl-3 text-sm font-medium outline-none focus:border-[#5B4CF0] focus:ring-4 focus:ring-violet-100" />
        <button type="button" aria-label={visible ? 'Hide password' : 'Show password'} onClick={onToggle} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </span>
    </label>
  );
}

function TwoFactorCard() {
  return (
    <SectionCard title="Two Factor Authentication" icon={Shield}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">Enabled</span></div>
          <p className="mt-2 text-sm text-slate-500">Use an authenticator app, email OTP, SMS OTP, and recovery codes to protect your account.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => toast.info('2FA configuration endpoint is not connected yet.')} className="rounded-lg bg-[#5B4CF0] px-4 py-2 text-sm font-bold text-white">Configure</button>
          <button onClick={() => toast.info('Backup codes endpoint is not connected yet.')} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">View Backup Codes</button>
          <button onClick={() => toast.info('Disable 2FA endpoint is not connected yet.')} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Disable</button>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {['Authenticator App', 'Email OTP', 'SMS OTP', 'Recovery Codes'].map((item) => <div key={item} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700">{item}</div>)}
      </div>
    </SectionCard>
  );
}

function PreferenceSettings({ preferences, setPreferences }: { preferences: any; setPreferences: (value: any) => void }) {
  return (
    <SectionCard title="Preferences" icon={Globe}>
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField label="Language" value={preferences.language} onChange={(value) => setPreferences({ ...preferences, language: value })} options={['English', 'Hindi', 'Bengali', 'Marathi']} />
        <SelectField label="Timezone" value={preferences.timezone} onChange={(value) => setPreferences({ ...preferences, timezone: value })} options={['IST (UTC +5:30)', 'UTC', 'PST (UTC -8:00)', 'EST (UTC -5:00)']} />
        <SelectField label="Theme" value={preferences.theme} onChange={(value) => setPreferences({ ...preferences, theme: value })} options={['Light', 'Dark', 'System']} />
        <SelectField label="Date Format" value={preferences.dateFormat} onChange={(value) => setPreferences({ ...preferences, dateFormat: value })} options={['DD MMM YYYY', 'DD/MM/YYYY', 'MM/DD/YYYY']} />
        <SelectField label="Time Format" value={preferences.timeFormat} onChange={(value) => setPreferences({ ...preferences, timeFormat: value })} options={['12 hour', '24 hour']} />
        <SelectField label="Video Quality" value={preferences.videoQuality} onChange={(value) => setPreferences({ ...preferences, videoQuality: value })} options={['Auto', 'High', 'Medium', 'Low']} />
      </div>
      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <Toggle label="Low Bandwidth Mode" description="Reduce video quality and prioritize text content on slower connections." checked={preferences.lowBandwidth} onChange={(checked) => setPreferences({ ...preferences, lowBandwidth: checked })} />
      </div>
    </SectionCard>
  );
}

function NotificationSettings({ notifications, setNotifications }: { notifications: any; setNotifications: (value: any) => void }) {
  const items = [
    ['email', 'Email Notifications'],
    ['push', 'Push Notifications'],
    ['courseUpdates', 'Course Updates'],
    ['assignmentAlerts', 'Assignment Alerts'],
    ['forumReplies', 'Forum Replies'],
    ['communityMessages', 'Community Messages'],
    ['certificates', 'Certificates'],
    ['securityAlerts', 'Security Alerts'],
  ];
  return (
    <SectionCard title="Notification Settings" icon={Bell}>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map(([key, label]) => (
          <div key={key} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <Toggle label={label} description="Control how this notification reaches you." checked={notifications[key]} onChange={(checked) => setNotifications({ ...notifications, [key]: checked })} />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-bold text-slate-900">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="sr-only" />
      <span className={cn('relative mt-1 h-6 w-11 rounded-full transition', checked ? 'bg-[#5B4CF0]' : 'bg-slate-300')}>
        <span className={cn('absolute top-1 h-4 w-4 rounded-full bg-white transition', checked ? 'left-6' : 'left-1')} />
      </span>
    </label>
  );
}

function ActivityTimeline() {
  const activities = [
    { title: 'Current Device', detail: 'Chrome / Windows / Delhi', time: 'Today', icon: Monitor },
    { title: 'Recent Login', detail: 'Edge / Laptop / Mumbai', time: 'Yesterday', icon: Smartphone },
    { title: 'Password Updated', detail: 'Security settings reviewed', time: 'Last week', icon: Shield },
  ];
  return (
    <SectionCard title="Account Activity" icon={Clock}>
      <div className="space-y-4">
        {activities.map(({ title, detail, time, icon: Icon }) => (
          <div key={title} className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#5B4CF0] ring-1 ring-slate-200"><Icon className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-950">{title}</p>
              <p className="text-sm text-slate-500">{detail}</p>
            </div>
            <span className="text-xs font-bold text-slate-400">{time}</span>
          </div>
        ))}
      </div>
      <button onClick={() => toast.info('Session management endpoint is not connected yet.')} className="mt-5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Logout Other Devices</button>
    </SectionCard>
  );
}

function ProfilePhotoUploader({ formData, uploading, onUpload, onRemove }: { formData: FormData; uploading: boolean; onUpload: (file?: File) => void; onRemove: () => void }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-bold text-slate-950">Profile Photo</h3>
      <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center hover:bg-slate-100">
        {uploading ? <Loader2 className="h-6 w-6 animate-spin text-[#5B4CF0]" /> : <Upload className="h-6 w-6 text-[#5B4CF0]" />}
        <span className="mt-2 text-sm font-bold text-slate-700">Drag & drop or upload</span>
        <span className="mt-1 text-xs text-slate-500">PNG, JPEG, WEBP. Max 5 MB.</span>
        <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => onUpload(event.target.files?.[0])} disabled={uploading} />
      </label>
      {formData.profilePicture && <button onClick={onRemove} className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-rose-600"><X className="h-4 w-4" />Remove photo</button>}
    </section>
  );
}

function ProfileCompletionCard({ percent }: { percent: number }) {
  const checks = ['Photo', 'Phone', 'Specialization', 'Manager', 'Security'];
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-950">Profile Completion</h3>
      <div className="mt-4 flex items-center gap-4">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-violet-50 text-xl font-bold text-[#5B4CF0] ring-1 ring-violet-100">{percent}%</div>
        <div className="min-w-0 flex-1 space-y-1">
          {checks.map((item, index) => <p key={item} className="flex items-center gap-2 text-xs font-semibold text-slate-600"><CheckCircle2 className={cn('h-3.5 w-3.5', index < Math.round(percent / 20) ? 'text-emerald-600' : 'text-slate-300')} />{item}</p>)}
        </div>
      </div>
    </section>
  );
}

function QuickActions() {
  const actions = [
    { title: 'Download Profile', icon: Download },
    { title: 'Print Profile', icon: Printer },
    { title: 'Generate ID Card', icon: IdCard },
    { title: 'Export Settings', icon: FileText },
  ];
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-bold text-slate-950">Quick Actions</h3>
      <div className="grid gap-2">
        {actions.map(({ title, icon: Icon }) => (
          <button key={title} onClick={() => toast.info(`${title} needs backend support.`)} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-50">
            <Icon className="h-4 w-4 text-[#5B4CF0]" />
            {title}
          </button>
        ))}
      </div>
    </section>
  );
}

function StickySaveBar({ visible, saving, onSave, onCancel, onReset }: { visible: boolean; saving: boolean; onSave: () => void; onCancel: () => void; onReset: () => void }) {
  if (!visible) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-2xl backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-slate-700">You have unsaved profile changes.</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={onReset} disabled={saving} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Reset</button>
          <button onClick={onCancel} disabled={saving} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Cancel</button>
          <button onClick={onSave} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#5B4CF0] px-4 py-2 text-sm font-bold text-white hover:bg-[#4b3ee0] disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <div className="h-28 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-48 animate-pulse rounded-lg bg-slate-100" />
        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <div className="h-96 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-96 animate-pulse rounded-lg bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

function ProfileError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-[500px] items-center justify-center bg-[#F8FAFC] p-6">
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-center">
        <p className="font-bold text-rose-950">{message}</p>
        <button onClick={onRetry} className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-bold text-rose-700 ring-1 ring-rose-200">Retry</button>
      </div>
    </div>
  );
}
