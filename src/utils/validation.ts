// Các hàm validate & chuẩn hóa dữ liệu đầu vào dùng chung cho mọi form (Task #3)

/** Toạ độ TP.HCM & lân cận hợp lệ (biên rộng để không chặn nhầm). */
export function isValidLat(lat: number): boolean {
  return Number.isFinite(lat) && lat >= 8 && lat <= 24;
}

export function isValidLng(lng: number): boolean {
  return Number.isFinite(lng) && lng >= 102 && lng <= 110;
}

/** Cân nặng thú cưng hợp lệ: 0.1kg – 120kg. */
export function clampWeightKg(input: number | string, fallback = 5): number {
  const n = typeof input === 'string' ? parseFloat(input) : input;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(120, Math.max(0.1, n));
}

/** SĐT Việt Nam: cho phép rỗng (tuỳ chọn), nếu có thì 9–15 chữ số (bỏ khoảng trắng, +, -, .). */
export function isValidPhone(phone: string): boolean {
  const clean = phone.trim();
  if (!clean) return true;
  const digits = clean.replace(/[\s+\-.()]/g, '');
  return /^\d{9,15}$/.test(digits);
}

/** URL hợp lệ: cho phép rỗng; nếu có thì phải http(s). */
export function isValidUrl(url: string): boolean {
  const clean = url.trim();
  if (!clean) return true;
  try {
    const u = new URL(clean);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Cắt khoảng trắng thừa & giới hạn độ dài để tránh dữ liệu rác. */
export function sanitizeText(input: string, maxLen = 500): string {
  return input.trim().replace(/\s+/g, ' ').slice(0, maxLen);
}

export interface PlaceFormInput {
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone?: string;
  googleMapsUrl?: string;
  websiteUrl?: string;
  imageUrl?: string;
}

/** Validate toàn bộ form thêm/sửa địa điểm. Trả về thông báo lỗi tiếng Việt đầu tiên (hoặc null nếu hợp lệ). */
export function validatePlaceForm(input: PlaceFormInput): string | null {
  if (!input.name.trim()) return 'Vui lòng nhập tên địa điểm.';
  if (!input.address.trim()) return 'Vui lòng nhập địa chỉ.';
  if (!isValidLat(input.lat)) return 'Vĩ độ (lat) không hợp lệ.';
  if (!isValidLng(input.lng)) return 'Kinh độ (lng) không hợp lệ.';
  if (input.phone && !isValidPhone(input.phone)) return 'Số điện thoại không hợp lệ (9–15 chữ số).';
  if (input.googleMapsUrl && !isValidUrl(input.googleMapsUrl))
    return 'Link Google Maps phải bắt đầu bằng http(s)://';
  if (input.websiteUrl && !isValidUrl(input.websiteUrl))
    return 'Link website/fanpage phải bắt đầu bằng http(s)://';
  if (input.imageUrl && !isValidUrl(input.imageUrl))
    return 'Link ảnh phải bắt đầu bằng http(s)://';
  return null;
}
