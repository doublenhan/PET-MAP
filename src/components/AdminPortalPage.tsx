import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Database,
  UploadCloud,
  RotateCcw,
  Search,
  Lock,
  Mail,
  LogOut,
  ArrowLeft,
  Loader2,
  LayoutDashboard,
  Clock,
  ExternalLink,
  Copy,
  Check,
  Edit3,
  Flag,
  MessageSquare,
  PawPrint,
  Star,
  X,
  Save,
} from 'lucide-react';
import {
  Place,
  PlaceCategory,
  PetPolicyStatus,
  PetConditionId,
  PetType,
  PlaceReview,
  PlaceReport,
  PetProfile,
  PLACE_CATEGORIES,
  PET_POLICIES,
  PET_CONDITIONS,
  PLACE_REPORT_REASONS,
} from '../types/place';
import { normalizeSearchText } from '../utils/petCompatibility';
import {
  AuthUser,
  signInWithEmail,
  signOutUser,
  fetchAllRegisteredPets,
  cleanDuplicatePetProfiles,
} from '../services/authPetService';
import {
  fetchAllReviews,
  deleteReviewById,
  fetchPlaceReports,
  updatePlaceReportStatus,
  deletePlaceReport,
  getDuplicatePlaceIds,
} from '../services/placeService';
import { PetIdCardView } from './PetIdCardView';
import { useConfirm } from './ConfirmDialog';

interface AdminPortalPageProps {
  currentUser: AuthUser | null;
  places: Place[];
  dataSource: 'supabase' | 'local';
  onAuthChange: (user: AuthUser | null) => void;
  onApprovePlace: (placeId: string) => Promise<void>;
  onDeletePlace: (placeId: string) => Promise<void>;
  onUpdatePlaceFull: (placeId: string, updates: Partial<Omit<Place, 'id'>>) => Promise<void>;
  onSeedSupabase: () => Promise<void>;
  onResetLocal: () => void;
  onExitAdminPage: () => void;
}

export const AdminPortalPage: React.FC<AdminPortalPageProps> = ({
  currentUser,
  places,
  dataSource,
  onAuthChange,
  onApprovePlace,
  onDeletePlace,
  onUpdatePlaceFull,
  onSeedSupabase,
  onResetLocal,
  onExitAdminPage,
}) => {
  const confirm = useConfirm();
  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Dashboard state
  const [activeTab, setActiveTab] = useState<
    'pending' | 'all' | 'reports' | 'reviews' | 'pets' | 'database'
  >('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Extended Admin Data: Reports, Reviews, Pets
  const [reports, setReports] = useState<PlaceReport[]>([]);
  const [allReviews, setAllReviews] = useState<PlaceReview[]>([]);
  const [registeredPets, setRegisteredPets] = useState<PetProfile[]>([]);
  const [petSearchQuery, setPetSearchQuery] = useState('');
  const [petPage, setPetPage] = useState(1);
  const [selectedPetCard, setSelectedPetCard] = useState<PetProfile | null>(null);

  // Place Editor Modal State
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<PlaceCategory>('cafe');
  const [editAddress, setEditAddress] = useState('');
  const [editDistrict, setEditDistrict] = useState('');
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');
  const [editPetPolicy, setEditPetPolicy] = useState<PetPolicyStatus>('allowed');
  const [editPetConditions, setEditPetConditions] = useState<PetConditionId[]>([]);
  const [editAllowedPetTypes, setEditAllowedPetTypes] = useState<PetType[]>(['dog', 'cat']);
  const [editMaxWeight, setEditMaxWeight] = useState('');
  const [editOpeningHours, setEditOpeningHours] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (currentUser && currentUser.role === 'admin') {
      fetchPlaceReports().then(setReports);
      fetchAllReviews().then(setAllReviews);
      fetchAllRegisteredPets().then(setRegisteredPets);
    }
  }, [currentUser]);

  const openEditPlaceModal = (place: Place) => {
    setEditingPlace(place);
    setEditName(place.name);
    setEditCategory(place.category);
    setEditAddress(place.address);
    setEditDistrict(place.district);
    setEditLat(String(place.lat));
    setEditLng(String(place.lng));
    setEditPetPolicy(place.petPolicy);
    setEditPetConditions(place.petConditions || []);
    setEditAllowedPetTypes(place.allowedPetTypes || ['dog', 'cat']);
    setEditMaxWeight(place.maxWeightKg ? String(place.maxWeightKg) : '');
    setEditOpeningHours(place.openingHours || '');
    setEditPhone(place.phone || '');
    setEditNotes(place.petPolicyNotes || '');
  };

  const toggleEditCondition = (cid: PetConditionId) => {
    setEditPetConditions((prev) =>
      prev.includes(cid) ? prev.filter((item) => item !== cid) : [...prev, cid]
    );
  };

  const toggleEditPetType = (t: PetType) => {
    setEditAllowedPetTypes((prev) =>
      prev.includes(t) ? prev.filter((item) => item !== t) : [...prev, t]
    );
  };

  const handleSavePlaceEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlace) return;
    const ok = await confirm({
      title: 'Lưu thay đổi địa điểm?',
      message: `Cập nhật thông tin "${editName.trim() || editingPlace.name}" sẽ được áp dụng ngay cho toàn bộ người dùng.`,
      confirmLabel: 'Lưu thay đổi',
    });
    if (!ok) return;
    setSavingEdit(true);
    try {
      await onUpdatePlaceFull(editingPlace.id, {
        name: editName.trim(),
        category: editCategory,
        address: editAddress.trim(),
        district: editDistrict.trim(),
        lat: parseFloat(editLat) || editingPlace.lat,
        lng: parseFloat(editLng) || editingPlace.lng,
        petPolicy: editPetPolicy,
        petConditions: editPetPolicy === 'not_allowed' ? [] : editPetConditions,
        allowedPetTypes: editPetPolicy === 'not_allowed' ? [] : editAllowedPetTypes,
        maxWeightKg: editMaxWeight ? parseFloat(editMaxWeight) : null,
        openingHours: editOpeningHours.trim() || undefined,
        phone: editPhone.trim() || undefined,
        petPolicyNotes: editNotes.trim(),
      });
      setEditingPlace(null);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleReportStatus = async (
    reportId: string,
    status: 'resolved' | 'dismissed'
  ) => {
    await updatePlaceReportStatus(reportId, status);
    setReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, status } : r))
    );
  };

  const handleDeleteReportItem = async (reportId: string) => {
    const ok = await confirm({
      title: 'Xoá báo cáo này?',
      message: 'Báo cáo sẽ bị xoá vĩnh viễn khỏi hệ thống. Hành động này không thể hoàn tác.',
      confirmLabel: 'Xoá báo cáo',
      tone: 'danger',
    });
    if (!ok) return;
    await deletePlaceReport(reportId);
    setReports((prev) => prev.filter((r) => r.id !== reportId));
  };

  const handleDeleteReviewItem = async (reviewId: string) => {
    const ok = await confirm({
      title: 'Xoá đánh giá này?',
      message: 'Review sẽ bị xoá vĩnh viễn và điểm sao của quán sẽ được tính lại.',
      confirmLabel: 'Xoá review',
      tone: 'danger',
    });
    if (!ok) return;
    setBusyId(reviewId);
    try {
      const res = await deleteReviewById(reviewId);
      setAllReviews((prev) => prev.filter((r) => r.id !== reviewId));
      if (res.updatedPlace) {
        await onUpdatePlaceFull(res.updatedPlace.id, {
          rating: res.updatedPlace.rating,
          reviewCount: res.updatedPlace.reviewCount,
        });
      }
    } finally {
      setBusyId(null);
    }
  };

  const pendingPlaces = useMemo(
    () => places.filter((p) => !p.verified && !p.id.startsWith('osm-')),
    [places]
  );

  const verifiedPlaces = useMemo(
    () => places.filter((p) => p.verified),
    [places]
  );

  // Task #1: Tìm kiếm Tiếng Việt không dấu trong Admin
  const filteredPlaces = useMemo(() => {
    const q = normalizeSearchText(searchQuery);
    return places.filter((p) => {
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        normalizeSearchText(p.name).includes(q) ||
        normalizeSearchText(p.address).includes(q) ||
        normalizeSearchText(p.district).includes(q)
      );
    });
  }, [places, searchQuery, categoryFilter]);

  // Task #19: Lọc không dấu + phân trang danh sách Hồ sơ Thú cưng
  const PETS_PER_PAGE = 12;
  const filteredPets = useMemo(() => {
    const q = normalizeSearchText(petSearchQuery);
    if (!q) return registeredPets;
    return registeredPets.filter(
      (p) =>
        normalizeSearchText(p.name).includes(q) ||
        normalizeSearchText(p.breed).includes(q) ||
        (p.identityCode && normalizeSearchText(p.identityCode).includes(q))
    );
  }, [registeredPets, petSearchQuery]);

  const petTotalPages = Math.max(1, Math.ceil(filteredPets.length / PETS_PER_PAGE));
  const petPageSafe = Math.min(petPage, petTotalPages);
  const pagedPets = useMemo(
    () => filteredPets.slice((petPageSafe - 1) * PETS_PER_PAGE, petPageSafe * PETS_PER_PAGE),
    [filteredPets, petPageSafe]
  );

  useEffect(() => {
    setPetPage(1);
  }, [petSearchQuery]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await signInWithEmail(email, password);
      if (res.error || !res.user) {
        setAuthError(res.error || 'Email hoặc mật khẩu không chính xác.');
        return;
      }
      onAuthChange(res.user);
      if (res.user.role !== 'admin') {
        setAuthError(
          'Tài khoản này chưa được cấp quyền Admin trong bảng user_roles trên Supabase.'
        );
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAdminLogout = async () => {
    await signOutUser();
    onAuthChange(null);
  };

  const handleApprove = async (id: string) => {
    setBusyId(id);
    try {
      await onApprovePlace(id);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    const place = places.find((p) => p.id === id);
    const ok = await confirm({
      title: 'Xoá địa điểm này?',
      message: `"${place?.name || 'Địa điểm'}" sẽ bị xoá vĩnh viễn khỏi bản đồ. Hành động này không thể hoàn tác.`,
      confirmLabel: 'Xoá địa điểm',
      tone: 'danger',
    });
    if (!ok) return;
    setBusyId(id);
    try {
      await onDeletePlace(id);
    } finally {
      setBusyId(null);
    }
  };

  const handleSeed = async () => {
    const ok = await confirm({
      title: 'Đồng bộ dữ liệu mẫu?',
      message: 'Sẽ đẩy các địa điểm mẫu lên Supabase (bỏ qua quán đã tồn tại). Tiếp tục?',
      confirmLabel: 'Đồng bộ ngay',
    });
    if (!ok) return;
    setSeeding(true);
    try {
      await onSeedSupabase();
    } finally {
      setSeeding(false);
    }
  };

  // Xoá VẬT LÝ các địa điểm trùng (giữ 1 bản mỗi nhóm trùng tên + vị trí).
  const [cleaning, setCleaning] = useState(false);
  const handleCleanDuplicates = async () => {
    const dupIds = getDuplicatePlaceIds(places);
    if (dupIds.length === 0) {
      await confirm({
        title: 'Không có địa điểm trùng',
        message: 'Hệ thống không phát hiện bản ghi trùng nào để dọn.',
        confirmLabel: 'OK',
      });
      return;
    }
    const ok = await confirm({
      title: `Xoá ${dupIds.length} bản ghi trùng?`,
      message: `Sẽ XOÁ VĨNH VIỄN ${dupIds.length} địa điểm trùng (giữ lại 1 bản mỗi nhóm). Hành động không thể hoàn tác.`,
      confirmLabel: 'Xoá bản trùng',
      tone: 'danger',
    });
    if (!ok) return;
    setCleaning(true);
    try {
      for (const id of dupIds) {
        await onDeletePlace(id);
      }
    } finally {
      setCleaning(false);
    }
  };

  // Xoá VẬT LÝ các hồ sơ Boss trùng trên Supabase (giữ 1 bản mỗi nhóm).
  const [cleaningPets, setCleaningPets] = useState(false);
  const handleCleanDuplicatePets = async () => {
    const ok = await confirm({
      title: 'Dọn hồ sơ Boss trùng?',
      message:
        'Sẽ XOÁ VĨNH VIỄN các hồ sơ Boss trùng trên Supabase (giữ lại 1 bản mỗi nhóm theo Mã Định Danh / Tên). Không thể hoàn tác.',
      confirmLabel: 'Dọn trùng',
      tone: 'danger',
    });
    if (!ok) return;
    setCleaningPets(true);
    try {
      const removed = await cleanDuplicatePetProfiles();
      const fresh = await fetchAllRegisteredPets();
      setRegisteredPets(fresh);
      await confirm({
        title: 'Hoàn tất',
        message:
          removed > 0 ? `Đã xoá ${removed} hồ sơ Boss trùng.` : 'Không có hồ sơ Boss trùng để dọn.',
        confirmLabel: 'OK',
      });
    } finally {
      setCleaningPets(false);
    }
  };

  // ============================================================================
  // CASE 1 & 2: CHƯA LOGIN HOẶC TÀI KHOẢN KHÔNG PHẢI ROLE 'admin' -> CHẶN TRUY CẬP
  // ============================================================================
  if (!currentUser || currentUser.role !== 'admin') {
    const grantSql = currentUser
      ? `insert into public.user_roles (user_id, role)\nvalues ('${currentUser.id}', 'admin')\non conflict (user_id) do update set role = 'admin';`
      : '';

    return (
      <div className="flex min-h-dvh w-screen flex-col items-center justify-center bg-slate-950 p-4 text-slate-100">
        <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl">
          {/* Header */}
          <div className="border-b border-slate-800 bg-slate-900/80 px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-base font-extrabold tracking-tight text-white">
                    PetMap Admin Portal
                  </h1>
                  <p className="text-xs text-slate-400">
                    Yêu cầu xác thực tài khoản Quản trị viên
                  </p>
                </div>
              </div>
              <button
                onClick={onExitAdminPage}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Về Bản đồ</span>
              </button>
            </div>
          </div>

          {/* Nếu đã đăng nhập nhưng tài khoản chỉ là 'user' thường */}
          {currentUser && currentUser.role !== 'admin' ? (
            <div className="p-6 space-y-4">
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-sm text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Truy cập bị từ chối (403 Forbidden)</span>
                </div>
                <p className="leading-relaxed">
                  Tài khoản <strong>{currentUser.email}</strong> hiện đang có quyền{' '}
                  <code className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono">user</code>.
                  Chỉ tài khoản có role{' '}
                  <code className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-emerald-300">
                    admin
                  </code>{' '}
                  mới được phép truy cập Dashboard này.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="font-semibold">
                    Cách cấp quyền Admin trên Supabase SQL Editor:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(grantSql);
                      setCopiedSql(true);
                      setTimeout(() => setCopiedSql(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
                  >
                    {copiedSql ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedSql ? 'Đã copy' : 'Copy SQL'}</span>
                  </button>
                </div>
                <pre className="overflow-x-auto font-mono text-[11px] text-emerald-400 leading-relaxed">
                  {grantSql}
                </pre>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleAdminLogout}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-bold text-white hover:bg-slate-700 cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Đăng xuất & Đổi tài khoản Admin</span>
                </button>
              </div>
            </div>
          ) : (
            /* Form Đăng nhập dành riêng cho Admin */
            <form onSubmit={handleAdminLogin} className="p-6 space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
                🔒 Trang quản trị không cho phép truy cập trực tiếp. Vui lòng đăng nhập bằng tài khoản Admin của hệ thống.
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Email Quản trị viên *
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@petmap.vn"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pr-3.5 pl-10 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Mật khẩu *
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pr-3.5 pl-10 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {authError && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs font-medium text-rose-300">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-xs font-extrabold uppercase tracking-wider text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 disabled:opacity-50 cursor-pointer"
              >
                {authLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                <span>{authLoading ? 'Đang xác thực...' : 'Đăng nhập vào Admin Dashboard'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // CASE 3: ĐÃ ĐĂNG NHẬP VỚI QUYỀN ADMIN -> HIỂN THỊ FULL-PAGE ADMIN DASHBOARD
  // ============================================================================
  return (
    <div className="flex h-dvh w-screen flex-col overflow-hidden bg-slate-100 text-slate-900">
      {/* Top Admin Navbar */}
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-900 px-4 sm:px-8 py-3.5 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500 text-slate-950 shadow-sm">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-tight">PetMap Admin Dashboard</h1>
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                {dataSource === 'supabase' ? 'Supabase Cloud' : 'Local DB'}
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Quản trị địa điểm, kiểm duyệt đóng góp cộng đồng & đồng bộ dữ liệu
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden md:flex flex-col items-end text-right mr-1">
            <span className="text-xs font-bold text-white">{currentUser.email}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
              ● Quản trị viên (Admin)
            </span>
          </div>

          <button
            onClick={onExitAdminPage}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-700 transition cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Về Bản đồ PetMap</span>
          </button>

          <button
            onClick={handleAdminLogout}
            title="Đăng xuất Admin"
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/20 transition cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Đăng xuất</span>
          </button>
        </div>
      </header>

      {/* Main Dashboard Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="text-xs font-semibold text-slate-500">Tổng số địa điểm</div>
              <div className="mt-1 text-2xl font-extrabold text-slate-900">{places.length}</div>
              <div className="mt-1 text-[11px] text-slate-400">Trên toàn TP.HCM</div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900">Đang chờ duyệt</span>
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <div className="mt-1 text-2xl font-extrabold text-amber-700">
                {pendingPlaces.length}
              </div>
              <div className="mt-1 text-[11px] text-amber-700/80">Cần Admin kiểm duyệt</div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900">Đã xác thực</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="mt-1 text-2xl font-extrabold text-emerald-700">
                {verifiedPlaces.length}
              </div>
              <div className="mt-1 text-[11px] text-emerald-700/80">Hiển thị uy tín</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="text-xs font-semibold text-slate-500">Cho phép Pet / Cấm Pet</div>
              <div className="mt-1 text-2xl font-extrabold text-slate-900">
                {places.filter((p) => p.petPolicy !== 'not_allowed').length}{' '}
                <span className="text-sm font-normal text-slate-400">
                  / {places.filter((p) => p.petPolicy === 'not_allowed').length}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-slate-400">Thân thiện vs Hạn chế</div>
            </div>
          </div>

          {/* Tabs Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('pending')}
                className={`rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                  activeTab === 'pending'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                Chờ duyệt ({pendingPlaces.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                Tất cả quán ({places.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('reports')}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                  activeTab === 'reports'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Flag className="h-3.5 w-3.5" />
                <span>
                  Báo cáo ({reports.filter((r) => r.status === 'pending').length})
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('reviews')}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                  activeTab === 'reviews'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Review ({allReviews.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('pets')}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                  activeTab === 'pets'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <PawPrint className="h-3.5 w-3.5" />
                <span>Hồ sơ Boss ({registeredPets.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('database')}
                className={`rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                  activeTab === 'database'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                Đồng bộ DB
              </button>
            </div>

            {activeTab === 'all' && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm tên quán, địa chỉ, quận..."
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-3 pl-9 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  <option value="all">Mọi loại hình</option>
                  {Object.values(PLACE_CATEGORIES).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji} {c.shortLabel}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* TAB 1: PENDING APPROVAL */}
          {activeTab === 'pending' && (
            <div className="space-y-3">
              {pendingPlaces.length === 0 ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center space-y-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div className="text-sm font-bold text-slate-900">
                    Không có địa điểm nào đang chờ duyệt
                  </div>
                  <p className="text-xs text-slate-500">
                    Mọi địa điểm do người dùng đóng góp mới sẽ xuất hiện tại đây để bạn kiểm duyệt.
                  </p>
                </div>
              ) : (
                pendingPlaces.map((place) => {
                  const cat = PLACE_CATEGORIES[place.category];
                  const pol = PET_POLICIES[place.petPolicy];
                  return (
                    <div
                      key={place.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-white p-4 shadow-2xs"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className={`rounded-md border px-2 py-0.5 font-bold ${cat.colorClass}`}>
                            {cat.emoji} {cat.shortLabel}
                          </span>
                          <span className={`rounded-full border px-2.5 py-0.5 font-bold ${pol.badgeBg} ${pol.badgeText} ${pol.badgeBorder}`}>
                            {pol.shortLabel}
                          </span>
                          <span className="text-slate-500 font-medium">• {place.district}</span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900">{place.name}</h3>
                        <p className="text-xs text-slate-600">{place.address}</p>
                        {place.petPolicyNotes && (
                          <p className="text-xs italic text-slate-500 bg-slate-50 p-2 rounded-xl border border-slate-100">
                            "{place.petPolicyNotes}"
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditPlaceModal(place)}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Sửa</span>
                        </button>
                        <button
                          type="button"
                          disabled={busyId === place.id}
                          onClick={() => handleApprove(place.id)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Duyệt quán</span>
                        </button>
                        <button
                          type="button"
                          disabled={busyId === place.id}
                          onClick={() => handleDelete(place.id)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>Xoá</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: ALL PLACES TABLE */}
          {activeTab === 'all' && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
              <div className="divide-y divide-slate-100">
                {filteredPlaces.map((place) => {
                  const cat = PLACE_CATEGORIES[place.category];
                  const pol = PET_POLICIES[place.petPolicy];
                  return (
                    <div
                      key={place.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-slate-50/80 transition"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{place.name}</span>
                          {place.verified ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                              <CheckCircle2 className="h-3 w-3" /> Đã duyệt
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                              Chờ duyệt
                            </span>
                          )}
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${pol.badgeBg} ${pol.badgeText} ${pol.badgeBorder}`}>
                            {pol.shortLabel}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">
                          {cat.emoji} {cat.shortLabel} • {place.address} ({place.district})
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {!place.verified && (
                          <button
                            type="button"
                            disabled={busyId === place.id}
                            onClick={() => handleApprove(place.id)}
                            className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer"
                          >
                            Duyệt
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditPlaceModal(place)}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Sửa</span>
                        </button>
                        {place.googleMapsUrl && (
                          <a
                            href={place.googleMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          disabled={busyId === place.id}
                          onClick={() => handleDelete(place.id)}
                          className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Xoá</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: REPORTS FROM COMMUNITY */}
          {activeTab === 'reports' && (
            <div className="space-y-3">
              {reports.length === 0 ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center space-y-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <Flag className="h-6 w-6" />
                  </div>
                  <div className="text-sm font-bold text-slate-900">
                    Chưa có báo cáo sai lệch nào từ cộng đồng
                  </div>
                  <p className="text-xs text-slate-500">
                    Khi người dùng bấm "🚩 Báo cáo" ở trang chi tiết quán, thông tin sẽ xuất hiện tại đây.
                  </p>
                </div>
              ) : (
                reports.map((rep) => {
                  const reasonMeta =
                    PLACE_REPORT_REASONS[rep.reason] || PLACE_REPORT_REASONS.other;
                  const targetPlace = places.find((p) => p.id === rep.placeId);
                  return (
                    <div
                      key={rep.id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border p-4 shadow-2xs ${
                        rep.status === 'pending'
                          ? 'border-rose-200 bg-white'
                          : 'border-slate-200 bg-slate-50/70 opacity-80'
                      }`}
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-lg bg-rose-100 px-2.5 py-0.5 font-bold text-rose-800">
                            {reasonMeta.emoji} {reasonMeta.label}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              rep.status === 'pending'
                                ? 'bg-amber-100 text-amber-800'
                                : rep.status === 'resolved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {rep.status === 'pending'
                              ? 'Chờ xử lý'
                              : rep.status === 'resolved'
                              ? 'Đã xử lý'
                              : 'Đã bỏ qua'}
                          </span>
                          <span className="text-slate-400">
                            • Báo bởi: {rep.reporterName || 'Sen cộng đồng'}
                          </span>
                        </div>
                        <div className="text-sm font-bold text-slate-900">
                          Địa điểm: {rep.placeName}
                        </div>
                        <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                          "{rep.details}"
                        </p>
                      </div>

                      <div className="flex flex-wrap shrink-0 items-center gap-2">
                        {targetPlace && (
                          <button
                            type="button"
                            onClick={() => openEditPlaceModal(targetPlace)}
                            className="inline-flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 cursor-pointer"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>Mở sửa quán</span>
                          </button>
                        )}
                        {rep.status !== 'resolved' && (
                          <button
                            type="button"
                            onClick={() => handleReportStatus(rep.id, 'resolved')}
                            className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Đã xử lý</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteReportItem(rep.id)}
                          className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 4: REVIEWS MODERATION */}
          {activeTab === 'reviews' && (
            <div className="space-y-3">
              {allReviews.length === 0 ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-500">
                  Chưa có đánh giá nào trên hệ thống.
                </div>
              ) : (
                allReviews.map((rev) => {
                  const targetPlace = places.find((p) => p.id === rev.placeId);
                  return (
                    <div
                      key={rev.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-bold text-slate-900">{rev.authorName}</span>
                          {rev.petInfo && (
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">
                              🐾 {rev.petInfo}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-0.5 font-bold text-amber-500">
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            {rev.rating}/5
                          </span>
                          <span className="text-slate-400">
                            • Quán:{' '}
                            <strong className="text-slate-700">
                              {targetPlace ? targetPlace.name : rev.placeId}
                            </strong>
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed">{rev.comment}</p>
                      </div>

                      <button
                        type="button"
                        disabled={busyId === rev.id}
                        onClick={() => handleDeleteReviewItem(rev.id)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100 disabled:opacity-50 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Xoá Review</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 5: PETS REGISTRY & IDENTITY CODE LOOKUP */}
          {activeTab === 'pets' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Cơ sở dữ liệu Hồ sơ Thú cưng & Mã Định Danh
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tra cứu nhanh theo Tên Boss, Giống hoặc Mã Định Danh / Microchip
                  </p>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={petSearchQuery}
                    onChange={(e) => setPetSearchQuery(e.target.value)}
                    placeholder="Tìm tên Boss hoặc mã VN-DOG-..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-xs focus:border-emerald-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={cleaningPets}
                  onClick={handleCleanDuplicatePets}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>{cleaningPets ? 'Đang dọn...' : 'Dọn hồ sơ Boss trùng'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pagedPets.map((pet, idx) => (
                    <div
                      key={pet.id || idx}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-xl">
                          {pet.type === 'dog' ? '🐶' : pet.type === 'cat' ? '🐱' : '🐰'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-bold text-slate-900">{pet.name}</span>
                            {pet.identityCode && (
                              <span className="rounded bg-emerald-100 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-900">
                                #{pet.identityCode}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500">
                            {pet.breed} • {pet.weightKg}kg •{' '}
                            {pet.vaccinated ? 'Đã tiêm phòng' : 'Chưa rõ tiêm phòng'}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedPetCard(pet)}
                        className="shrink-0 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-600 transition cursor-pointer"
                      >
                        Xem Thẻ QR
                      </button>
                    </div>
                  ))}
              </div>

              {filteredPets.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-500">
                  Không tìm thấy hồ sơ thú cưng nào khớp từ khóa.
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2.5">
                  <span className="text-xs text-slate-500">
                    Hiển thị{' '}
                    <strong className="text-slate-800">{pagedPets.length}</strong> /{' '}
                    {filteredPets.length} hồ sơ — Trang {petPageSafe}/{petTotalPages}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPetPage((p) => Math.max(1, p - 1))}
                      disabled={petPageSafe <= 1}
                      aria-label="Trang trước"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      ← Trước
                    </button>
                    <button
                      type="button"
                      onClick={() => setPetPage((p) => Math.min(petTotalPages, p + 1))}
                      disabled={petPageSafe >= petTotalPages}
                      aria-label="Trang sau"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Sau →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: DATABASE & SEED */}
          {activeTab === 'database' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Đồng bộ & Quản lý Cơ sở dữ liệu Supabase
                  </h3>
                  <p className="text-xs text-slate-500">
                    Đẩy dữ liệu mẫu lên bảng places hoặc làm mới bộ nhớ đệm
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  disabled={seeding}
                  onClick={handleSeed}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
                >
                  <UploadCloud className="h-4 w-4" />
                  <span>{seeding ? 'Đang đồng bộ...' : 'Seed dữ liệu mẫu lên Supabase'}</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Khôi phục Local Cache?',
                      message:
                        'Dữ liệu địa điểm & review trên trình duyệt sẽ được đặt lại về mặc định. Dữ liệu trên Supabase không bị ảnh hưởng.',
                      confirmLabel: 'Khôi phục',
                      tone: 'danger',
                    });
                    if (ok) onResetLocal();
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Khôi phục Local Cache</span>
                </button>

                <button
                  type="button"
                  disabled={cleaning}
                  onClick={handleCleanDuplicates}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>
                    {cleaning
                      ? 'Đang dọn...'
                      : `Dọn địa điểm trùng (${getDuplicatePlaceIds(places).length})`}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: CHỈNH SỬA TOÀN DIỆN ĐỊA ĐIỂM (ADMIN FULL PLACE EDITOR) */}
      {editingPlace && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Chỉnh sửa địa điểm (Admin)
                </h3>
                <p className="text-xs text-slate-500">ID: {editingPlace.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingPlace(null)}
                className="rounded-full bg-slate-100 p-1.5 text-slate-500 hover:bg-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSavePlaceEdit} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tên địa điểm *</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Loại hình *</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as PlaceCategory)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2"
                  >
                    {Object.values(PLACE_CATEGORIES).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.emoji} {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Địa chỉ *</label>
                  <input
                    type="text"
                    required
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Quận / Khu vực *</label>
                  <input
                    type="text"
                    required
                    value={editDistrict}
                    onChange={(e) => setEditDistrict(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Vĩ độ (Lat)</label>
                  <input
                    type="number"
                    step="any"
                    value={editLat}
                    onChange={(e) => setEditLat(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kinh độ (Lng)</label>
                  <input
                    type="number"
                    step="any"
                    value={editLng}
                    onChange={(e) => setEditLng(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Chính sách Pet</label>
                  <select
                    value={editPetPolicy}
                    onChange={(e) => setEditPetPolicy(e.target.value as PetPolicyStatus)}
                    className="w-full rounded-xl border border-slate-200 px-2.5 py-2"
                  >
                    <option value="allowed">Cho phép tự do</option>
                    <option value="conditional">Có điều kiện</option>
                    <option value="not_allowed">Không nhận Pet</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Max Kg</label>
                  <input
                    type="number"
                    placeholder="Không GH"
                    value={editMaxWeight}
                    onChange={(e) => setEditMaxWeight(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Giờ mở cửa</label>
                  <input
                    type="text"
                    value={editOpeningHours}
                    onChange={(e) => setEditOpeningHours(e.target.value)}
                    placeholder="VD: 07:30 - 22:00"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Số điện thoại</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="VD: 0909 123 456"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2"
                  />
                </div>
              </div>

              {/* Task #16: Bộ chọn Loại thú cưng & 10 Điều kiện Pet trong Admin */}
              {editPetPolicy !== 'not_allowed' && (
                <div className="space-y-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-slate-700">
                      Loại thú cưng nhận & 10 Điều kiện Pet:
                    </span>
                    <div className="flex items-center gap-1.5">
                      {(['dog', 'cat', 'other'] as PetType[]).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => toggleEditPetType(t)}
                          className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                            editAllowedPetTypes.includes(t)
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : 'border-slate-200 bg-white text-slate-600'
                          }`}
                        >
                          {t === 'dog' ? '🐶 Chó' : t === 'cat' ? '🐱 Mèo' : '🐰 Khác'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(PET_CONDITIONS) as PetConditionId[]).map((cid) => {
                      const active = editPetConditions.includes(cid);
                      return (
                        <button
                          key={cid}
                          type="button"
                          onClick={() => toggleEditCondition(cid)}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                            active
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {active ? '✓ ' : '+ '}
                          {PET_CONDITIONS[cid].label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Ghi chú quy định Pet tại quán
                </label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPlace(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 font-bold text-white hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{savingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: XEM THẺ CĂN CƯỚC QR CỦA BOSS TRONG ADMIN */}
      {selectedPetCard && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">
                Thẻ Định Danh Điện Tử Thú Cưng
              </h3>
              <button
                type="button"
                onClick={() => setSelectedPetCard(null)}
                className="rounded-full bg-slate-100 p-1.5 text-slate-500 hover:bg-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <PetIdCardView pet={selectedPetCard} />
          </div>
        </div>
      )}
    </div>
  );
};
