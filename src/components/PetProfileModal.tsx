import React, { useState, useEffect } from 'react';
import {
  X,
  PawPrint,
  Dog,
  Cat,
  Trash2,
  CheckCircle2,
  Plus,
  QrCode,
  Sparkles,
  Search,
  Loader2,
  CreditCard,
  Upload,
  Phone,
  LogIn,
  Calendar,
  Venus,
  Mars,
} from 'lucide-react';
import { PetProfile, PetType } from '../types/place';
import { lookupPetByIdentityCode, getLastPetSyncError } from '../services/authPetService';
import { isValidPhone, isValidUrl, clampWeightKg } from '../utils/validation';
import { uploadPlaceImage } from '../services/imageUploadService';
import { PetIdCardView } from './PetIdCardView';
import { BossCheckinHistory } from './BossCheckinHistory';
import { getPetHealthReminder } from '../utils/petHealth';
import { useConfirm } from './ConfirmDialog';

interface PetProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  pets: PetProfile[];
  activePetId: string | null;
  onSelectActivePet: (petId: string) => void;
  onSavePet: (pet: PetProfile) => Promise<void>;
  onDeletePet: (petId: string) => Promise<void>;
  initialLookupCode?: string;
  initialTab?: 'my_pets' | 'lookup';
  isAuthenticated?: boolean;
  onRequestLogin?: () => void;
}

export const PetProfileModal: React.FC<PetProfileModalProps> = ({
  isOpen,
  onClose,
  pets,
  activePetId,
  onSelectActivePet,
  onSavePet,
  onDeletePet,
  initialLookupCode,
  initialTab,
  isAuthenticated = true,
  onRequestLogin,
}) => {
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<'my_pets' | 'lookup'>('my_pets');
  const [editingPetId, setEditingPetId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const [name, setName] = useState('Mochi');
  const [identityCode, setIdentityCode] = useState('');
  const [type, setType] = useState<PetType>('dog');
  const [breed, setBreed] = useState('Corgi');
  const [weightKg, setWeightKg] = useState('11');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'unknown'>('male');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [vaccinated, setVaccinated] = useState(true);
  const [hasCarrier, setHasCarrier] = useState(false);
  const [hasMuzzle, setHasMuzzle] = useState(false);
  const [hasDiaper, setHasDiaper] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Lookup state
  const [lookupInput, setLookupInput] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<PetProfile | null>(null);
  const [lookupNotFound, setLookupNotFound] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setFormError('');
    setSaveSuccessMsg('');
    if (initialLookupCode) {
      setActiveTab('lookup');
      setLookupInput(initialLookupCode);
      handleRunLookup(initialLookupCode);
      return;
    }
    if (initialTab) {
      setActiveTab(initialTab);
    } else {
      setActiveTab(isAuthenticated ? 'my_pets' : 'lookup');
    }

    if (pets.length === 0) {
      setIsCreatingNew(true);
      setEditingPetId(null);
      setName('Mochi');
      setIdentityCode('');
      setType('dog');
      setBreed('Corgi');
      setWeightKg('11');
      setBirthDate('');
      setGender('male');
      setAvatarUrl('');
      setOwnerPhone('');
      setVaccinated(true);
      setHasCarrier(false);
      setHasMuzzle(false);
      setHasDiaper(true);
    } else {
      const target = pets.find((p) => p.id === activePetId) || pets[0];
      setIsCreatingNew(false);
      setEditingPetId(target.id || null);
      setName(target.name);
      setIdentityCode(target.identityCode || '');
      setType(target.type);
      setBreed(target.breed);
      setWeightKg(String(target.weightKg));
      setBirthDate(target.birthDate || '');
      setGender(target.gender || 'unknown');
      setAvatarUrl(target.avatarUrl || '');
      setOwnerPhone(target.ownerPhone || '');
      setVaccinated(target.vaccinated);
      setHasCarrier(target.hasCarrier);
      setHasMuzzle(target.hasMuzzle);
      setHasDiaper(target.hasDiaper);
    }
  }, [isOpen, pets, activePetId, initialLookupCode, initialTab, isAuthenticated]);

  const handleRunLookup = async (codeToSearch: string) => {
    if (!codeToSearch.trim()) return;
    setLookupLoading(true);
    setLookupNotFound(false);
    try {
      const found = await lookupPetByIdentityCode(codeToSearch);
      setLookupResult(found);
      if (!found) setLookupNotFound(true);
    } finally {
      setLookupLoading(false);
    }
  };

  if (!isOpen) return null;

  const startAddNewPet = () => {
    setFormError('');
    setSaveSuccessMsg('');
    setIsCreatingNew(true);
    setEditingPetId(null);
    setName('');
    setIdentityCode('');
    setType('dog');
    setBreed('');
    setWeightKg('5');
    setBirthDate('');
    setGender('male');
    setAvatarUrl('');
    setOwnerPhone('');
    setVaccinated(true);
    setHasCarrier(false);
    setHasMuzzle(false);
    setHasDiaper(false);
  };

  const selectPetForEdit = (pet: PetProfile) => {
    setFormError('');
    setSaveSuccessMsg('');
    setIsCreatingNew(false);
    setEditingPetId(pet.id || null);
    if (pet.id) onSelectActivePet(pet.id);
    setName(pet.name);
    setIdentityCode(pet.identityCode || '');
    setType(pet.type);
    setBreed(pet.breed);
    setWeightKg(String(pet.weightKg));
    setBirthDate(pet.birthDate || '');
    setGender(pet.gender || 'unknown');
    setAvatarUrl(pet.avatarUrl || '');
    setOwnerPhone(pet.ownerPhone || '');
    setVaccinated(pet.vaccinated);
    setHasCarrier(pet.hasCarrier);
    setHasMuzzle(pet.hasMuzzle);
    setHasDiaper(pet.hasDiaper);
  };

  const generateSuggestedPetCode = () => {
    const prefix = type === 'dog' ? 'VN-DOG' : type === 'cat' ? 'VN-CAT' : 'VN-PET';
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    setIdentityCode(`${prefix}-${randomDigits}`);
  };

  const handleAvatarFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    setFormError('');
    try {
      const res = await uploadPlaceImage(file);
      setAvatarUrl(res.url);
    } catch {
      setFormError('Không thể tải ảnh đại diện lên. Vui lòng thử ảnh khác.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!isValidPhone(ownerPhone)) {
      setFormError('Số điện thoại liên hệ không hợp lệ (9–15 chữ số).');
      return;
    }
    if (!isValidUrl(avatarUrl)) {
      setFormError('Link ảnh đại diện phải bắt đầu bằng http(s)://');
      return;
    }
    setSaving(true);
    setFormError('');
    setSaveSuccessMsg('');
    try {
      await onSavePet({
        id: isCreatingNew ? undefined : editingPetId || undefined,
        identityCode: identityCode.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
        ownerPhone: ownerPhone.trim() || undefined,
        name: name.trim(),
        type,
        breed: breed.trim() || 'Boss cưng',
        weightKg: clampWeightKg(weightKg, 5),
        birthDate: birthDate || undefined,
        gender,
        vaccinated,
        hasCarrier,
        hasMuzzle,
        hasDiaper,
      });
      setIsCreatingNew(false);
      const syncErr = getLastPetSyncError();
      if (syncErr) {
        setFormError(`Đã lưu tạm trên máy, nhưng CHƯA đồng bộ được lên Supabase: ${syncErr}`);
      } else {
        setSaveSuccessMsg('✓ Đã lưu hồ sơ & đồng bộ vào bảng pet_profiles thành công!');
        setTimeout(() => setSaveSuccessMsg(''), 3800);
      }
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Có lỗi khi lưu hồ sơ thú cưng.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center bg-slate-950/60 p-0 sm:p-4 backdrop-blur-xs">
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
              <PawPrint className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Danh sách Thú cưng ({pets.length} Boss)
              </h3>
              <p className="text-xs text-slate-500">
                Quản lý nhiều bé cưng & chọn bé đi chơi để lọc quán chuẩn xác
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          {/* Switch Tabs: Hồ sơ & Thẻ Căn Cước vs Tra cứu Mã Định Danh */}
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('my_pets')}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition cursor-pointer ${
                activeTab === 'my_pets'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <CreditCard className="h-3.5 w-3.5 text-emerald-600" />
              <span>Hồ sơ & Thẻ Căn Cước</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('lookup')}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition cursor-pointer ${
                activeTab === 'lookup'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Search className="h-3.5 w-3.5 text-indigo-600" />
              <span>Tra cứu Mã Định Danh</span>
            </button>
          </div>

          {activeTab === 'lookup' ? (
            <div className="space-y-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleRunLookup(lookupInput);
                }}
                className="space-y-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Nhập Mã Định Danh / Microchip của Thú cưng:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={lookupInput}
                    onChange={(e) => setLookupInput(e.target.value)}
                    placeholder="VD: VN-DOG-123456 hoặc mã Microchip..."
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-xs sm:text-sm uppercase focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={lookupLoading}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50 transition cursor-pointer"
                  >
                    {lookupLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    <span>Tra cứu</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Dành cho Phòng khám Thú y, Pet Spa/Hotel hoặc người nhặt được thú lạc kiểm tra nhanh thông tin tiêm phòng & hồ sơ Boss.
                </p>
              </form>

              {lookupResult && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-emerald-700">
                    ✓ Đã tìm thấy Hồ sơ Định danh Thú cưng:
                  </div>
                  <PetIdCardView pet={lookupResult} />
                </div>
              )}

              {lookupNotFound && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-center text-xs text-rose-800">
                  Không tìm thấy thú cưng nào khớp với mã định danh{' '}
                  <strong className="font-mono">"{lookupInput}"</strong>. Vui lòng kiểm tra lại mã số.
                </div>
              )}
            </div>
          ) : !isAuthenticated ? (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-2xl">
                🪪
              </div>
              <div className="text-sm font-extrabold text-slate-900">
                Đăng nhập để tạo Thẻ Căn Cước Điện Tử cho Boss
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Bạn có thể tra cứu Mã Định Danh tự do ở tab bên cạnh, hoặc đăng nhập để lưu trữ danh sách Boss lên Cloud.
              </p>
              {onRequestLogin && (
                <button
                  type="button"
                  onClick={onRequestLogin}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition cursor-pointer"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Đăng nhập / Tạo tài khoản ngay</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Horizontal Multi-Pet Switcher */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Chọn Boss dẫn đi chơi hôm nay:
                  </span>
                  <button
                    type="button"
                    onClick={startAddNewPet}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Thêm Boss mới</span>
                  </button>
                </div>

                {pets.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {pets.map((p) => {
                      const isSelected = !isCreatingNew && p.id === (editingPetId || activePetId);
                      return (
                        <button
                          key={p.id || p.name}
                          type="button"
                          onClick={() => selectPetForEdit(p)}
                          className={`shrink-0 flex items-center gap-2 rounded-2xl border px-3 py-2 text-left transition cursor-pointer ${
                            isSelected
                              ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                              : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className="text-base">
                            {p.type === 'dog' ? '🐶' : p.type === 'cat' ? '🐱' : '🐰'}
                          </span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold leading-tight">{p.name}</span>
                              {p.identityCode && (
                                <span
                                  className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-bold ${
                                    isSelected
                                      ? 'bg-white/20 text-white'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  #{p.identityCode}
                                </span>
                              )}
                            </div>
                            <div
                              className={`text-[10px] ${
                                isSelected ? 'text-emerald-100' : 'text-slate-400'
                              }`}
                            >
                              {p.weightKg}kg • {p.breed || 'Boss'}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Digital Pet ID Card Preview (live preview of current pet) */}
              {name.trim() && (
                <PetIdCardView
                  pet={{
                    id: editingPetId || undefined,
                    identityCode: identityCode.trim() || undefined,
                    avatarUrl: avatarUrl.trim() || undefined,
                    ownerPhone: ownerPhone.trim() || undefined,
                    name: name.trim(),
                    type,
                    breed: breed.trim() || 'Boss cưng',
                    weightKg: Math.max(0.5, parseFloat(weightKg) || 5),
                    birthDate: birthDate || undefined,
                    gender,
                    vaccinated,
                    hasCarrier,
                    hasMuzzle,
                    hasDiaper,
                    syncedToCloud: Boolean(editingPetId),
                  }}
                  uploadingAvatar={uploadingAvatar}
                  onSelectAvatarFile={async (file) => {
                    setUploadingAvatar(true);
                    setFormError('');
                    try {
                      const res = await uploadPlaceImage(file);
                      setAvatarUrl(res.url);
                    } catch {
                      setFormError('Không thể tải ảnh đại diện lên. Vui lòng thử ảnh khác.');
                    } finally {
                      setUploadingAvatar(false);
                    }
                  }}
                />
              )}

              {/* Lịch sử check-in của Boss (chỉ hiện với hồ sơ đã lưu) */}
              {editingPetId && !isCreatingNew && (
                <BossCheckinHistory petId={editingPetId} petName={name.trim() || 'Boss'} />
              )}

              {/* Nhắc nhở sức khỏe / tiêm phòng */}
              {name.trim() &&
                (() => {
                  const reminder = getPetHealthReminder({
                    name: name.trim(),
                    type,
                    breed: breed.trim(),
                    weightKg: Math.max(0.5, parseFloat(weightKg) || 5),
                    birthDate: birthDate || undefined,
                    vaccinated,
                    hasCarrier,
                    hasMuzzle,
                    hasDiaper,
                  });
                  if (!reminder) return null;
                  return (
                    <div
                      className={`flex items-start gap-2 rounded-2xl border p-3 text-xs font-semibold ${
                        reminder.level === 'warn'
                          ? 'border-amber-200 bg-amber-50 text-amber-800'
                          : 'border-sky-200 bg-sky-50 text-sky-800'
                      }`}
                    >
                      <span className="text-base leading-none">{reminder.emoji}</span>
                      <span>{reminder.text}</span>
                    </div>
                  );
                })()}

              {/* Pet Form — Redesigned Clean 2-Column Layout */}
              <form
                onSubmit={handleSubmit}
                className="space-y-3.5 rounded-2xl border border-slate-200/90 bg-slate-50/60 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-slate-800">
                    {isCreatingNew ? '✨ Thêm hồ sơ Boss mới' : `Chỉnh sửa hồ sơ: ${name}`}
                  </span>

                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 transition cursor-pointer">
                      {uploadingAvatar ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Upload className="h-3 w-3" />
                      )}
                      <span>{uploadingAvatar ? 'Đang tải...' : 'Đổi ảnh thẻ'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarFileUpload}
                        className="hidden"
                      />
                    </label>

                    {!isCreatingNew && editingPetId && (
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await confirm({
                            title: `Xoá hồ sơ ${name || 'Boss'}?`,
                            message:
                              'Hồ sơ & Thẻ Căn Cước của bé này sẽ bị xoá vĩnh viễn. Hành động này không thể hoàn tác.',
                            confirmLabel: 'Xoá bé này',
                            tone: 'danger',
                          });
                          if (ok) onDeletePet(editingPetId);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-100 transition cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Xoá</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Chọn loài */}
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'dog', label: 'Chó (Cún)', icon: <Dog className="h-4 w-4" /> },
                      { id: 'cat', label: 'Mèo (Miu)', icon: <Cat className="h-4 w-4" /> },
                      { id: 'other', label: 'Thú nhỏ khác', icon: <span>🐰</span> },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setType(item.id)}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 px-2 text-xs font-bold transition cursor-pointer ${
                        type === item.id
                          ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>

                {/* Hàng 1: Tên của bé & Cân nặng (2 cột cân đối) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Tên của bé *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="VD: Mochi, Mèo, Bơ..."
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Cân nặng (kg) *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="100"
                      required
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      placeholder="VD: 2.5"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Hàng 2: Giống loài & SĐT Liên hệ Chủ (2 cột cân đối) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Giống (Breed)
                    </label>
                    <input
                      type="text"
                      value={breed}
                      onChange={(e) => setBreed(e.target.value)}
                      placeholder="VD: Phốc Sóc, Corgi, Poodle..."
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      <Phone className="h-3 w-3 text-emerald-600" />
                      <span>SĐT Liên hệ Chủ (In trên thẻ)</span>
                    </label>
                    <input
                      type="tel"
                      value={ownerPhone}
                      onChange={(e) => setOwnerPhone(e.target.value)}
                      placeholder="VD: 0909 123 456"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Hàng 2b: Ngày sinh & Giới tính (hiển thị trên thẻ căn cước) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Ngày sinh
                    </label>
                    <div className="relative">
                      <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
                      <input
                        type="date"
                        value={birthDate}
                        max={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => setBirthDate(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-3 pl-9 text-xs sm:text-sm font-semibold text-slate-700 transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:outline-none [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Giới tính
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { val: 'male', label: 'Đực', Icon: Mars, active: 'bg-blue-500 border-blue-500 text-white' },
                          { val: 'female', label: 'Cái', Icon: Venus, active: 'bg-pink-500 border-pink-500 text-white' },
                          { val: 'unknown', label: 'Chưa rõ', Icon: null, active: 'bg-slate-700 border-slate-700 text-white' },
                        ] as const
                      ).map(({ val, label, Icon, active }) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setGender(val)}
                          className={`inline-flex items-center justify-center gap-1 rounded-xl border px-1.5 py-2.5 text-xs font-bold transition cursor-pointer ${
                            gender === val
                              ? active
                              : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-white hover:border-slate-300'
                          }`}
                        >
                          {Icon && <Icon className="h-3.5 w-3.5" />}
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Hàng 3: Mã Định Danh Thú Cưng gọn gàng */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      <QrCode className="h-3 w-3 text-emerald-600" />
                      <span>Mã Định Danh / Microchip (Tuỳ chọn)</span>
                    </label>
                    <button
                      type="button"
                      onClick={generateSuggestedPetCode}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                    >
                      <Sparkles className="h-3 w-3" />
                      <span>Tạo mã tự động</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={identityCode}
                    onChange={(e) => setIdentityCode(e.target.value)}
                    placeholder="VD: VN-DOG-889900 hoặc mã Microchip 15 số..."
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs sm:text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Hàng 4: Phụ kiện & Tiêm phòng */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Hành trang sẵn có khi đi chơi cùng bé:
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      {
                        checked: vaccinated,
                        set: setVaccinated,
                        label: 'Đã tiêm phòng đầy đủ',
                      },
                      {
                        checked: hasCarrier,
                        set: setHasCarrier,
                        label: 'Có túi / balo / xe đẩy',
                      },
                      {
                        checked: hasDiaper,
                        set: setHasDiaper,
                        label: 'Có chuẩn bị bỉm / tã',
                      },
                      {
                        checked: hasMuzzle,
                        set: setHasMuzzle,
                        label: 'Có rọ mõm (nếu cần)',
                      },
                    ].map((opt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => opt.set(!opt.checked)}
                        className={`flex items-center gap-2 rounded-xl border p-2.5 text-left font-semibold transition cursor-pointer ${
                          opt.checked
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <CheckCircle2
                          className={`h-4 w-4 shrink-0 ${
                            opt.checked ? 'text-emerald-600' : 'text-slate-300'
                          }`}
                        />
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {formError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700">
                    ⚠️ {formError}
                  </div>
                )}

                {saveSuccessMsg && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800">
                    {saveSuccessMsg}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
                  >
                    {saving
                      ? 'Đang lưu...'
                      : isCreatingNew
                      ? 'Thêm Boss vào tài khoản'
                      : 'Lưu cập nhật Boss'}
                  </button>
                </div>
              </form>
          </>
          )}
        </div>
      </div>
    </div>
  );
};
