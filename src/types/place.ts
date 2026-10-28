export type PlaceCategory = 'cafe' | 'restaurant' | 'store' | 'vet_spa' | 'park';

export type PetPolicyStatus = 'allowed' | 'conditional' | 'not_allowed';

export type PetConditionId =
  | 'leash_required'
  | 'outdoor_only'
  | 'small_pets_only'
  | 'carrier_required'
  | 'muzzle_for_large'
  | 'diaper_required'
  | 'vaccinated'
  | 'pet_menu'
  | 'pet_playground'
  | 'ac_indoor_allowed';

export type PetType = 'dog' | 'cat' | 'other';
export type PetGender = 'male' | 'female' | 'unknown';

export interface Place {
  id: string;
  name: string;
  category: PlaceCategory;
  address: string;
  district: string;
  lat: number;
  lng: number;
  petPolicy: PetPolicyStatus;
  petConditions: PetConditionId[];
  petPolicyNotes: string;
  allowedPetTypes: PetType[];
  maxWeightKg?: number | null;
  googleMapsUrl?: string;
  websiteUrl?: string;
  phone?: string;
  openingHours?: string;
  imageUrl?: string;
  rating?: number;
  reviewCount?: number;
  verified?: boolean;
  createdAt?: string;
}

export interface PlaceReview {
  id: string;
  placeId: string;
  authorName: string;
  petInfo: string;
  rating: number;
  comment: string;
  policyAccurate: boolean;
  /** Ảnh đính kèm review (tuỳ chọn) */
  imageUrl?: string;
  /** Số lượt "hữu ích" */
  helpfulCount?: number;
  visitedAt?: string;
  createdAt: string;
}

/** Lượt check-in tại quán (xác thực bằng QR + GPS) */
export interface CheckIn {
  id: string;
  placeId: string;
  placeName: string;
  petId?: string;
  petName?: string;
  userId?: string;
  authorName: string;
  rating: number;
  comment: string;
  /** Đã xác thực bằng QR + GPS (đứng trong bán kính quán) */
  verified: boolean;
  /** 'qr_gps' = QR+GPS khớp, 'qr' = chỉ QR, 'gps' = chỉ GPS */
  method: 'qr_gps' | 'qr' | 'gps';
  createdAt: string;
}

export type PlaceReportReason =
  | 'policy_changed'
  | 'closed_permanently'
  | 'wrong_conditions'
  | 'wrong_location'
  | 'other';

export interface PlaceReport {
  id: string;
  placeId: string;
  placeName: string;
  reason: PlaceReportReason;
  suggestedPolicy?: PetPolicyStatus | null;
  details: string;
  reporterName: string;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: string;
}

export const PLACE_REPORT_REASONS: Record<
  PlaceReportReason,
  { label: string; emoji: string }
> = {
  policy_changed: {
    emoji: '🐾',
    label: 'Quán đã thay đổi quy định cho phép Pet',
  },
  wrong_conditions: {
    emoji: '⚖️',
    label: 'Điều kiện đem Pet (kg, máy lạnh, bỉm...) chưa đúng',
  },
  closed_permanently: {
    emoji: '🚪',
    label: 'Quán đã đóng cửa hoặc chuyển địa điểm',
  },
  wrong_location: {
    emoji: '📍',
    label: 'Ghim sai vị trí trên bản đồ',
  },
  other: {
    emoji: '💬',
    label: 'Thông tin khác cần cập nhật',
  },
};

export interface GeocodingSuggestion {
  displayName: string;
  shortAddress: string;
  district: string;
  lat: number;
  lng: number;
}

export interface PetProfile {
  id?: string;
  /** Mã định danh thú cưng (Optional: Microchip ID, Mã sổ sức khoẻ, hoặc PetTag ID) */
  identityCode?: string;
  name: string;
  type: PetType;
  breed: string;
  weightKg: number;
  /** Ngày sinh của Boss (ISO yyyy-mm-dd) — hiển thị trên thẻ căn cước */
  birthDate?: string;
  /** Giới tính của Boss */
  gender?: PetGender;
  vaccinated: boolean;
  hasCarrier: boolean;
  hasMuzzle: boolean;
  hasDiaper: boolean;
  /** Ảnh đại diện thật của Boss (Task #7) */
  avatarUrl?: string;
  /** Số điện thoại liên hệ khẩn cấp của Chủ nuôi trên Thẻ Căn Cước (Task #8) */
  ownerPhone?: string;
  /** Đánh dấu hồ sơ đã đồng bộ lên bảng pet_profiles của Supabase */
  syncedToCloud?: boolean;
}

export interface PetCompatibilityResult {
  compatible: boolean;
  status: 'perfect' | 'conditional_ok' | 'warning' | 'forbidden';
  label: string;
  reasons: string[];
}

export interface CategoryMeta {
  id: PlaceCategory;
  label: string;
  shortLabel: string;
  emoji: string;
  colorClass: string;
}

export interface PetPolicyMeta {
  id: PetPolicyStatus;
  label: string;
  shortLabel: string;
  description: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  markerColor: string;
  dotColor: string;
}

export interface PetConditionMeta {
  id: PetConditionId;
  label: string;
  description: string;
  type: 'rule' | 'amenity';
  iconName: string;
}

export const PLACE_CATEGORIES: Record<PlaceCategory, CategoryMeta> = {
  cafe: {
    id: 'cafe',
    label: 'Quán Cafe & Tea',
    shortLabel: 'Cafe',
    emoji: '☕',
    colorClass: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  restaurant: {
    id: 'restaurant',
    label: 'Nhà hàng & Bistro',
    shortLabel: 'Nhà hàng',
    emoji: '🍽️',
    colorClass: 'bg-orange-100 text-orange-800 border-orange-200',
  },
  store: {
    id: 'store',
    label: 'Store / TTTM / Cửa hàng',
    shortLabel: 'Store',
    emoji: '🛍️',
    colorClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  },
  vet_spa: {
    id: 'vet_spa',
    label: 'Pet Spa & Thú y',
    shortLabel: 'Pet Spa/Vet',
    emoji: '🐾',
    colorClass: 'bg-pink-100 text-pink-800 border-pink-200',
  },
  park: {
    id: 'park',
    label: 'Công viên & Bãi cỏ',
    shortLabel: 'Công viên',
    emoji: '🌳',
    colorClass: 'bg-teal-100 text-teal-800 border-teal-200',
  },
};

export const PET_POLICIES: Record<PetPolicyStatus, PetPolicyMeta> = {
  allowed: {
    id: 'allowed',
    label: 'Cho phép Pet thoải mái',
    shortLabel: 'Cho phép Pet',
    description: 'Chào đón thú cưng vào quán, có không gian thân thiện cho cả chủ và boss.',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    badgeBorder: 'border-emerald-200',
    markerColor: '#10b981', // emerald-500
    dotColor: 'bg-emerald-500',
  },
  conditional: {
    id: 'conditional',
    label: 'Cho phép có điều kiện',
    shortLabel: 'Có điều kiện',
    description: 'Được đem pet theo nhưng cần tuân thủ quy định (chỉ ngồi ngoài trời, cần xe đẩy/bỉm, giới hạn cân nặng...).',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    badgeBorder: 'border-amber-200',
    markerColor: '#f59e0b', // amber-500
    dotColor: 'bg-amber-500',
  },
  not_allowed: {
    id: 'not_allowed',
    label: 'Không cho phép Pet',
    shortLabel: 'Không cho Pet',
    description: 'Địa điểm không nhận thú cưng. Đánh dấu để cộng đồng biết trước tránh mất công di chuyển.',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-700',
    badgeBorder: 'border-rose-200',
    markerColor: '#f43f5e', // rose-500
    dotColor: 'bg-rose-500',
  },
};

export const PET_CONDITIONS: Record<PetConditionId, PetConditionMeta> = {
  leash_required: {
    id: 'leash_required',
    label: 'Bắt buộc dây dắt',
    description: 'Thú cưng luôn phải đeo dây dắt và trong tầm kiểm soát của chủ.',
    type: 'rule',
    iconName: 'Link',
  },
  outdoor_only: {
    id: 'outdoor_only',
    label: 'Chỉ ngồi ngoài trời / Sân vườn',
    description: 'Pet chỉ được ở khu vực sân vườn hoặc ban công, không vào phòng máy lạnh.',
    type: 'rule',
    iconName: 'Sun',
  },
  ac_indoor_allowed: {
    id: 'ac_indoor_allowed',
    label: 'Được vào phòng máy lạnh',
    description: 'Cho phép thú cưng vào khu vực trong nhà có điều hoà.',
    type: 'amenity',
    iconName: 'Wind',
  },
  small_pets_only: {
    id: 'small_pets_only',
    label: 'Chỉ nhận Pet nhỏ (<10kg)',
    description: 'Giới hạn kích thước thú cưng dưới 10kg.',
    type: 'rule',
    iconName: 'Scale',
  },
  carrier_required: {
    id: 'carrier_required',
    label: 'Cần túi vận chuyển / Xe đẩy',
    description: 'Thú cưng cần ngồi trong balo, túi xách hoặc xe đẩy chuyên dụng khi di chuyển.',
    type: 'rule',
    iconName: 'Briefcase',
  },
  muzzle_for_large: {
    id: 'muzzle_for_large',
    label: 'Rọ mõm với chó lớn',
    description: 'Các giống chó trung bình/lớn bắt buộc đeo rọ mõm để đảm bảo an toàn.',
    type: 'rule',
    iconName: 'ShieldAlert',
  },
  diaper_required: {
    id: 'diaper_required',
    label: 'Bắt buộc mặc bỉm / tã',
    description: 'Thú cưng cần mặc tã/bỉm vệ sinh khi vào khu vực trong quán.',
    type: 'rule',
    iconName: 'Sparkles',
  },
  vaccinated: {
    id: 'vaccinated',
    label: 'Đã tiêm phòng đầy đủ',
    description: 'Yêu cầu thú cưng khoẻ mạnh, đã tiêm phòng dại và các mũi cơ bản.',
    type: 'rule',
    iconName: 'CheckCircle2',
  },
  pet_menu: {
    id: 'pet_menu',
    label: 'Có Menu / Nước cho Pet',
    description: 'Quán có phục vụ bát nước miễn phí, puppuccino hoặc đồ ăn riêng cho thú cưng.',
    type: 'amenity',
    iconName: 'Utensils',
  },
  pet_playground: {
    id: 'pet_playground',
    label: 'Có sân cỏ / Khu chạy nhảy',
    description: 'Không gian rộng rãi, có sân cỏ hoặc khu vực rào chắn cho pet vui chơi.',
    type: 'amenity',
    iconName: 'Trees',
  },
};

export const HCMC_DISTRICTS = [
  'Tất cả khu vực',
  'Quận 1',
  'Quận 3',
  'Quận 4',
  'Quận 5',
  'Quận 7 (Phú Mỹ Hưng)',
  'Quận 10',
  'Quận 11',
  'Bình Thạnh',
  'Phú Nhuận',
  'Tân Bình',
  'Gò Vấp',
  'Thảo Điền (TP. Thủ Đức)',
  'Quận 2 (An Phú)',
];

export const DISTRICT_COORDINATES: Record<string, { lat: number; lng: number; zoom: number }> = {
  'Tất cả khu vực': { lat: 10.7769, lng: 106.6900, zoom: 13 },
  'Quận 1': { lat: 10.7769, lng: 106.7009, zoom: 15 },
  'Quận 3': { lat: 10.7835, lng: 106.6885, zoom: 15 },
  'Quận 4': { lat: 10.7578, lng: 106.7012, zoom: 15 },
  'Quận 5': { lat: 10.7540, lng: 106.6634, zoom: 15 },
  'Quận 7 (Phú Mỹ Hưng)': { lat: 10.7295, lng: 106.7215, zoom: 15 },
  'Quận 10': { lat: 10.7725, lng: 106.6675, zoom: 15 },
  'Quận 11': { lat: 10.7629, lng: 106.6501, zoom: 15 },
  'Bình Thạnh': { lat: 10.7995, lng: 106.7105, zoom: 15 },
  'Phú Nhuận': { lat: 10.7972, lng: 106.6805, zoom: 15 },
  'Tân Bình': { lat: 10.8015, lng: 106.6525, zoom: 15 },
  'Gò Vấp': { lat: 10.8385, lng: 106.6652, zoom: 15 },
  'Thảo Điền (TP. Thủ Đức)': { lat: 10.8035, lng: 106.7345, zoom: 15 },
  'Quận 2 (An Phú)': { lat: 10.7955, lng: 106.7425, zoom: 15 },
};
