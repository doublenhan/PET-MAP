import React, { useState, useEffect } from 'react';
import {
  X,
  MapPin,
  PlusCircle,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Link2,
  Search,
  Loader2,
  Upload,
} from 'lucide-react';
import {
  Place,
  PlaceCategory,
  PetPolicyStatus,
  PetConditionId,
  PetType,
  PLACE_CATEGORIES,
  PET_POLICIES,
  PET_CONDITIONS,
  HCMC_DISTRICTS,
  GeocodingSuggestion,
} from '../types/place';
import { searchAddressInHcmc, reverseGeocodeCoords } from '../services/geocodingService';
import { uploadPlaceImage } from '../services/imageUploadService';
import { validatePlaceForm, sanitizeText } from '../utils/validation';

interface AddPlaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCoords: { lat: number; lng: number } | null;
  onRequestPickOnMap: () => void;
  onSubmitPlace: (newPlace: Omit<Place, 'id' | 'createdAt'>) => Promise<void>;
}

/**
 * Tự động tách toạ độ lat, lng nếu người dùng dán link Google Maps
 * Ví dụ: https://www.google.com/maps/place/.../@10.8032,106.7328,17z/...
 */
function extractCoordsFromGoogleMapsUrl(url: string): { lat: number; lng: number } | null {
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  }
  const queryMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (queryMatch) {
    return { lat: parseFloat(queryMatch[1]), lng: parseFloat(queryMatch[2]) };
  }
  return null;
}

export const AddPlaceModal: React.FC<AddPlaceModalProps> = ({
  isOpen,
  onClose,
  initialCoords,
  onRequestPickOnMap,
  onSubmitPlace,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<PlaceCategory>('cafe');
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState(HCMC_DISTRICTS[1]);
  const [lat, setLat] = useState('10.7850');
  const [lng, setLng] = useState('106.7150');
  const [petPolicy, setPetPolicy] = useState<PetPolicyStatus>('allowed');
  const [petConditions, setPetConditions] = useState<PetConditionId[]>(['leash_required']);
  const [petPolicyNotes, setPetPolicyNotes] = useState('');
  const [allowedPetTypes, setAllowedPetTypes] = useState<PetType[]>(['dog', 'cat']);
  const [maxWeightKg, setMaxWeightKg] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [openingHours, setOpeningHours] = useState('08:00 - 22:00');
  const [imageUrl, setImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [extractedNotice, setExtractedNotice] = useState(false);
  const [geoSuggestions, setGeoSuggestions] = useState<GeocodingSuggestion[]>([]);
  const [searchingGeo, setSearchingGeo] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Task #14: Hàm reset toàn bộ dữ liệu form sau khi đóng / gửi thành công
  const resetFormFields = () => {
    setName('');
    setCategory('cafe');
    setAddress('');
    setDistrict(HCMC_DISTRICTS[1]);
    setPetPolicy('allowed');
    setPetConditions(['leash_required']);
    setPetPolicyNotes('');
    setAllowedPetTypes(['dog', 'cat']);
    setMaxWeightKg('');
    setGoogleMapsUrl('');
    setWebsiteUrl('');
    setPhone('');
    setOpeningHours('08:00 - 22:00');
    setImageUrl('');
    setGeoSuggestions([]);
    setUploadError('');
  };

  const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    setUploadError('');
    try {
      const res = await uploadPlaceImage(file);
      setImageUrl(res.url);
    } catch {
      setUploadError('Không thể tải ảnh lên. Vui lòng thử ảnh khác.');
    } finally {
      setUploadingImg(false);
    }
  };

  useEffect(() => {
    if (initialCoords) {
      setLat(String(initialCoords.lat));
      setLng(String(initialCoords.lng));
      reverseGeocodeCoords(initialCoords.lat, initialCoords.lng).then((res) => {
        if (!res) return;
        setAddress((prev) => (prev.trim() ? prev : res.shortAddress));
        setDistrict((prev) => (prev.trim() ? prev : res.district));
      });
    }
  }, [initialCoords]);

  // Task #15: Tự động gợi ý địa chỉ có Debounce 400ms khi gõ địa chỉ
  useEffect(() => {
    if (!isOpen) return;
    const q = address.trim();
    if (q.length < 5) {
      setGeoSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingGeo(true);
      try {
        const results = await searchAddressInHcmc(q);
        setGeoSuggestions(results);
      } finally {
        setSearchingGeo(false);
      }
    }, 420);

    return () => clearTimeout(timer);
  }, [address, isOpen]);

  if (!isOpen) return null;

  const handleSearchAddressGeocode = async () => {
    const query = address.trim() || name.trim();
    if (!query) return;
    setSearchingGeo(true);
    try {
      const results = await searchAddressInHcmc(query);
      setGeoSuggestions(results);
      if (results.length > 0) {
        const first = results[0];
        setLat(String(first.lat));
        setLng(String(first.lng));
        setDistrict(first.district);
      }
    } finally {
      setSearchingGeo(false);
    }
  };

  const handleSelectSuggestion = (sug: GeocodingSuggestion) => {
    setAddress(sug.shortAddress);
    setDistrict(sug.district);
    setLat(String(sug.lat));
    setLng(String(sug.lng));
    setGeoSuggestions([]);
  };

  const handleGoogleMapsUrlChange = (val: string) => {
    setGoogleMapsUrl(val);
    const coords = extractCoordsFromGoogleMapsUrl(val);
    if (coords) {
      setLat(String(coords.lat));
      setLng(String(coords.lng));
      setExtractedNotice(true);
      setTimeout(() => setExtractedNotice(false), 3500);
    }
  };

  const toggleCondition = (cid: PetConditionId) => {
    setPetConditions((prev) =>
      prev.includes(cid) ? prev.filter((item) => item !== cid) : [...prev, cid]
    );
  };

  const togglePetType = (type: PetType) => {
    setAllowedPetTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const validationError = validatePlaceForm({
      name,
      address,
      lat: latNum,
      lng: lngNum,
      phone,
      googleMapsUrl,
      websiteUrl,
      imageUrl,
    });
    if (validationError) {
      setUploadError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmitPlace({
        name: sanitizeText(name, 120),
        category,
        address: sanitizeText(address, 200),
        district,
        lat: latNum || 10.785,
        lng: lngNum || 106.715,
        petPolicy,
        petConditions: petPolicy === 'not_allowed' ? [] : petConditions,
        petPolicyNotes:
          petPolicyNotes.trim() ||
          (petPolicy === 'allowed'
            ? 'Cho phép thú cưng đi cùng chủ.'
            : petPolicy === 'conditional'
            ? 'Cho phép mang thú cưng nhưng cần tuân thủ quy định của quán.'
            : 'Địa điểm không nhận thú cưng.'),
        allowedPetTypes: petPolicy === 'not_allowed' ? [] : allowedPetTypes,
        maxWeightKg: maxWeightKg ? Number(maxWeightKg) : null,
        googleMapsUrl: googleMapsUrl.trim(),
        websiteUrl: websiteUrl.trim(),
        phone: phone.trim(),
        openingHours: openingHours.trim(),
        imageUrl: imageUrl.trim(),
        rating: 5.0,
        reviewCount: 1,
        verified: false,
      });
      resetFormFields();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center bg-slate-950/60 p-0 sm:p-4 backdrop-blur-xs">
      <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Thêm Store / Cafe / Nhà hàng lên PetMap
              </h2>
              <p className="text-xs text-slate-500">
                Đánh dấu địa điểm cho phép Pet, có điều kiện hoặc không nhận Pet
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* 1. Thông tin cơ bản & Link Google Maps */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Tên Store / Quán Cafe / Nhà hàng *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Cộng Cà Phê Thảo Điền, Pizza 4P's..."
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Phân loại địa điểm *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as PlaceCategory)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
              >
                {Object.values(PLACE_CATEGORIES).map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.emoji} {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Khu vực / Quận *
              </label>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
              >
                {HCMC_DISTRICTS.slice(1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Địa chỉ cụ thể * (Nhập địa chỉ và bấm "Tìm toạ độ" để tự động định vị)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="VD: 28 Thảo Điền, Phường Thảo Điền, TP. Thủ Đức"
                  className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSearchAddressGeocode}
                  disabled={searchingGeo}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 cursor-pointer"
                >
                  {searchingGeo ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Search className="h-3.5 w-3.5" />
                  )}
                  <span>Tìm toạ độ</span>
                </button>
              </div>

              {geoSuggestions.length > 0 && (
                <div className="mt-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg space-y-1">
                  <div className="px-2 py-0.5 text-[10px] font-bold uppercase text-slate-400">
                    Gợi ý vị trí thực tế từ OpenStreetMap (Click để chọn):
                  </div>
                  {geoSuggestions.map((sug, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSelectSuggestion(sug)}
                      className="flex w-full items-start gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-emerald-50 transition cursor-pointer"
                    >
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-800 truncate">
                          {sug.shortAddress}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {sug.displayName} ({sug.lat}, {sug.lng})
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 2. Link Store & Toạ độ trên bản đồ */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                <Link2 className="h-4 w-4 text-indigo-600" />
                Liên kết & Vị trí bản đồ
              </span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRequestPickOnMap();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition cursor-pointer"
              >
                <MapPin className="h-3.5 w-3.5" />
                <span>Chấm chọn vị trí trên Bản đồ</span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <input
                  type="url"
                  value={googleMapsUrl}
                  onChange={(e) => handleGoogleMapsUrlChange(e.target.value)}
                  placeholder="Dán link Google Maps của quán (tự động tách toạ độ nếu có @lat,lng)"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm"
                />
                {extractedNotice && (
                  <p className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-600">
                    <Sparkles className="h-3.5 w-3.5" /> Đã tự động lấy toạ độ từ đường dẫn Google Maps!
                  </p>
                )}
              </div>

              <div>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="Link Fanpage Facebook / Instagram / Website"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                />
              </div>

              <div>
                <input
                  type="text"
                  value={openingHours}
                  onChange={(e) => setOpeningHours(e.target.value)}
                  placeholder="Giờ mở cửa (VD: 08:00 - 22:00)"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-0.5">
                  Vĩ độ (Latitude)
                </label>
                <input
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-0.5">
                  Kinh độ (Longitude)
                </label>
                <input
                  type="number"
                  step="any"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                />
              </div>
            </div>
          </div>

          {/* 3. Đánh dấu mức độ cho phép Pet (3 trạng thái) */}
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
              Trạng thái cho phép Pet tại địa điểm *
            </label>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {(['allowed', 'conditional', 'not_allowed'] as PetPolicyStatus[]).map((status) => {
                const meta = PET_POLICIES[status];
                const isSelected = petPolicy === status;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setPetPolicy(status)}
                    className={`flex flex-col items-start rounded-2xl border-2 p-3 text-left transition cursor-pointer ${
                      isSelected
                        ? `${meta.badgeBg} ${meta.badgeBorder} ring-2 ring-offset-1`
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {status === 'allowed' && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      )}
                      {status === 'conditional' && (
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      )}
                      {status === 'not_allowed' && <XCircle className="h-4 w-4 text-rose-600" />}
                      <span className="text-xs font-bold text-slate-900">{meta.shortLabel}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500 leading-snug">
                      {status === 'allowed' && 'Thân thiện, đón tiếp pet thoải mái'}
                      {status === 'conditional' && 'Chỉ ngoài trời, giới hạn kg, cần túi/bỉm...'}
                      {status === 'not_allowed' && 'Cấm mang thú cưng vào địa điểm'}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Các điều kiện chi tiết khi đem Pet theo */}
          {petPolicy !== 'not_allowed' && (
            <div className="space-y-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Điều kiện & Tiện ích khi đem Pet theo
                </label>
                <div className="flex items-center gap-2">
                  {(['dog', 'cat', 'other'] as PetType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => togglePetType(t)}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                        allowedPetTypes.includes(t)
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      {t === 'dog' ? '🐶 Chó' : t === 'cat' ? '🐱 Mèo' : '🐰 Khác'}
                    </button>
                  ))}
                  <input
                    type="number"
                    value={maxWeightKg}
                    onChange={(e) => setMaxWeightKg(e.target.value)}
                    placeholder="Giới hạn kg (nếu có)"
                    className="w-32 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {(Object.keys(PET_CONDITIONS) as PetConditionId[]).map((cid) => {
                  const cond = PET_CONDITIONS[cid];
                  const active = petConditions.includes(cid);
                  return (
                    <button
                      key={cid}
                      type="button"
                      onClick={() => toggleCondition(cid)}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                        active
                          ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {active ? '✓ ' : '+ '}
                      {cond.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. Ghi chú chi tiết */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Ghi chú chi tiết về quy định Pet
            </label>
            <textarea
              rows={3}
              value={petPolicyNotes}
              onChange={(e) => setPetPolicyNotes(e.target.value)}
              placeholder="VD: Quán cho phép cún ngồi ở sân vườn phía trước, nếu vào phòng lạnh cần mặc bỉm và ngồi trong xe đẩy..."
              className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Số điện thoại liên hệ (tuỳ chọn)"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs"
            />
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Link ảnh hoặc tải ảnh từ máy..."
                className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2 text-xs"
              />
              <label className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 cursor-pointer">
                {uploadingImg ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                <span>{uploadingImg ? 'Đang tải...' : 'Tải ảnh'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileSelect}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {uploadError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700">
              ⚠️ {uploadError}
            </div>
          )}

          {imageUrl && (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2">
              <img
                src={imageUrl}
                alt="Preview"
                loading="lazy"
                className="h-14 w-20 rounded-lg object-cover border border-slate-200"
              />
              <div className="flex-1 min-w-0 text-xs text-slate-600">
                <div className="font-semibold text-emerald-700">✓ Đã đính kèm ảnh quán</div>
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="text-[11px] text-rose-600 hover:underline cursor-pointer"
                >
                  Xoá ảnh này
                </button>
              </div>
            </div>
          )}

          {/* Submit Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Huỷ bỏ
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Đang lưu địa điểm...' : 'Lưu địa điểm lên PetMap'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
