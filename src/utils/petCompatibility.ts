import { Place, PlaceCategory, PetProfile, PetCompatibilityResult } from '../types/place';

const PET_PROFILE_STORAGE_KEY = 'petmap_my_pet_profile_v1';

/**
 * Chuẩn hoá chuỗi Tiếng Việt không dấu để tìm kiếm chính xác (Task #1)
 * Hỗ trợ: "quan 1" -> "quận 1", "thao dien" -> "thảo điền", "ca phe" -> "cà phê"
 */
export function normalizeSearchText(input: string): string {
  if (!input) return '';
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface OpeningStatusInfo {
  isOpen: boolean;
  is24h: boolean;
  label: string;
  shortLabel: string;
  badgeClass: string;
  dotClass: string;
}

/**
 * Tự động phân tích khung giờ mở cửa theo giờ thực tế (Task #6)
 * Ví dụ: "07:30 - 22:00", "24/24 (Cấp cứu Thú Y)", "08:00 - 21:30"
 */
export function evaluateOpeningStatus(
  openingHours?: string,
  nowDate: Date = new Date()
): OpeningStatusInfo | null {
  if (!openingHours || !openingHours.trim()) return null;
  const raw = openingHours.trim().toLowerCase();

  if (
    raw.includes('24/24') ||
    raw.includes('24/7') ||
    raw.includes('24h') ||
    raw.includes('cả ngày')
  ) {
    return {
      isOpen: true,
      is24h: true,
      label: 'Mở cửa 24/7 • Trực cấp cứu',
      shortLabel: 'Mở 24/7',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dotClass: 'bg-emerald-500',
    };
  }

  const match = raw.match(/(\d{1,2})[:h](\d{2})\s*[-–~tođến]+\s*(\d{1,2})[:h](\d{2})/);
  if (!match) {
    return {
      isOpen: true,
      is24h: false,
      label: `Giờ mở cửa: ${openingHours}`,
      shortLabel: openingHours,
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      dotClass: 'bg-emerald-500',
    };
  }

  const openHour = parseInt(match[1], 10);
  const openMin = parseInt(match[2], 10);
  const closeHour = parseInt(match[3], 10);
  const closeMin = parseInt(match[4], 10);

  const currentMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  const openMinutes = openHour * 60 + openMin;
  let closeMinutes = closeHour * 60 + closeMin;
  if (closeMinutes <= openMinutes) {
    closeMinutes += 24 * 60;
  }

  const adjustedCurrent =
    currentMinutes < openMinutes && closeMinutes > 24 * 60
      ? currentMinutes + 24 * 60
      : currentMinutes;

  const isOpen = adjustedCurrent >= openMinutes && adjustedCurrent <= closeMinutes;
  const minsUntilClose = closeMinutes - adjustedCurrent;

  if (isOpen && minsUntilClose <= 45) {
    return {
      isOpen: true,
      is24h: false,
      label: `Sắp đóng cửa • Đóng lúc ${match[3].padStart(2, '0')}:${match[4]}`,
      shortLabel: 'Sắp đóng cửa',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      dotClass: 'bg-amber-500',
    };
  }

  if (isOpen) {
    return {
      isOpen: true,
      is24h: false,
      label: `Đang mở cửa • Đóng lúc ${match[3].padStart(2, '0')}:${match[4]}`,
      shortLabel: 'Đang mở cửa',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dotClass: 'bg-emerald-500',
    };
  }

  return {
    isOpen: false,
    is24h: false,
    label: `Đã đóng cửa • Mở lại lúc ${match[1].padStart(2, '0')}:${match[2]}`,
    shortLabel: 'Đã đóng cửa',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    dotClass: 'bg-rose-500',
  };
}

/**
 * Ảnh minh hoạ chất lượng cao theo danh mục khi ảnh quán bị lỗi hoặc trống (Task #19)
 */
const CATEGORY_FALLBACK_IMAGES: Record<PlaceCategory, string> = {
  cafe: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=900&q=80',
  restaurant:
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80',
  store:
    'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=900&q=80',
  vet_spa:
    'https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?auto=format&fit=crop&w=900&q=80',
  park: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=900&q=80',
};

export function getCategoryFallbackImage(category: PlaceCategory): string {
  return CATEGORY_FALLBACK_IMAGES[category] || CATEGORY_FALLBACK_IMAGES.cafe;
}

export function getSavedPetProfile(): PetProfile | null {
  try {
    const raw = localStorage.getItem(PET_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PetProfile;
  } catch {
    return null;
  }
}

export function savePetProfile(profile: PetProfile | null): void {
  try {
    if (!profile) {
      localStorage.removeItem(PET_PROFILE_STORAGE_KEY);
    } else {
      localStorage.setItem(PET_PROFILE_STORAGE_KEY, JSON.stringify(profile));
    }
  } catch {
    // ignore storage errors
  }
}

/**
 * Đánh giá mức độ phù hợp của một địa điểm với Hồ sơ Boss (My Pet Profile)
 */
export function evaluatePetCompatibility(
  place: Place,
  pet: PetProfile | null
): PetCompatibilityResult | null {
  if (!pet) return null;

  if (place.petPolicy === 'not_allowed') {
    return {
      compatible: false,
      status: 'forbidden',
      label: `${pet.name} không được vào`,
      reasons: ['Địa điểm này quy định không nhận thú cưng.'],
    };
  }

  // Kiểm tra loại thú cưng
  if (place.allowedPetTypes.length > 0 && !place.allowedPetTypes.includes(pet.type)) {
    const typeName = pet.type === 'dog' ? 'Chó' : pet.type === 'cat' ? 'Mèo' : 'Thú nhỏ khác';
    return {
      compatible: false,
      status: 'forbidden',
      label: `Không nhận ${typeName}`,
      reasons: [`Quán không nằm trong danh sách nhận ${typeName}.`],
    };
  }

  // Kiểm tra cân nặng
  const effectiveMaxWeight =
    place.maxWeightKg ?? (place.petConditions.includes('small_pets_only') ? 10 : null);

  if (effectiveMaxWeight !== null && pet.weightKg > effectiveMaxWeight) {
    return {
      compatible: false,
      status: 'warning',
      label: `Vượt giới hạn ${effectiveMaxWeight}kg`,
      reasons: [
        `${pet.name} nặng ${pet.weightKg}kg, nhưng quán chỉ nhận pet tối đa ${effectiveMaxWeight}kg.`,
      ],
    };
  }

  const missingPrepare: string[] = [];

  if (place.petConditions.includes('vaccinated') && !pet.vaccinated) {
    missingPrepare.push('Quán yêu cầu đã tiêm phòng đầy đủ');
  }
  if (place.petConditions.includes('carrier_required') && !pet.hasCarrier) {
    missingPrepare.push('Cần chuẩn bị túi vận chuyển / xe đẩy');
  }
  if (place.petConditions.includes('diaper_required') && !pet.hasDiaper) {
    missingPrepare.push('Cần mặc bỉm / tã vệ sinh cho bé');
  }
  if (
    place.petConditions.includes('muzzle_for_large') &&
    pet.type === 'dog' &&
    pet.weightKg >= 15 &&
    !pet.hasMuzzle
  ) {
    missingPrepare.push('Chó >= 15kg bắt buộc đeo rọ mõm');
  }

  if (missingPrepare.length > 0) {
    return {
      compatible: true,
      status: 'conditional_ok',
      label: `Cần chuẩn bị (${missingPrepare.length})`,
      reasons: missingPrepare,
    };
  }

  return {
    compatible: true,
    status: 'perfect',
    label: `Phù hợp với ${pet.name}`,
    reasons: [`${pet.name} (${pet.weightKg}kg) đáp ứng đầy đủ điều kiện của quán!`],
  };
}

/**
 * Tính khoảng cách đường chim bay (km) giữa 2 toạ độ theo công thức Haversine
 */
export function calculateDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Bán kính Trái Đất (km)
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}
