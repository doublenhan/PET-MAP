// Dịch vụ Check-in tại quán (xác thực QR + GPS). Theo mẫu hybrid: Supabase + localStorage fallback.
import { CheckIn } from '../types/place';
import { getSupabaseClient, isSupabaseReady } from '../lib/supabase';

const LOCAL_CHECKINS_KEY = 'petmap_checkins_v1';

// Tiền tố payload QR (dạng text, tương thích ngược khi quét bằng camera trong app).
export const CHECKIN_QR_PREFIX = 'PETMAP-CHECKIN:';

/**
 * Tạo nội dung QR cho một quán để in dán tại quầy — là một ĐƯỜNG LINK.
 * Khi khách quét bằng camera mặc định của điện thoại, link mở webapp và tự check-in.
 */
export function buildVenueCheckinPayload(placeId: string): string {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://petmap.app';
  return `${origin}/?checkin=${encodeURIComponent(placeId)}`;
}

/** Bóc placeId từ nội dung QR quét được (chấp nhận link ?checkin= / /checkin/ hoặc text cũ). */
export function parseCheckinQr(raw: string): string | null {
  const text = (raw || '').trim();
  if (text.startsWith(CHECKIN_QR_PREFIX)) {
    const id = text.slice(CHECKIN_QR_PREFIX.length).trim();
    return id || null;
  }
  // Dạng link có query ?checkin=<id>
  const q = text.match(/[?&]checkin=([^&#\s]+)/i);
  if (q) return decodeURIComponent(q[1]);
  // Dạng link path /checkin/<id>
  const m = text.match(/\/checkin\/([^/?#\s]+)/i);
  if (m) return decodeURIComponent(m[1]);
  return null;
}

/** Khoảng cách Haversine (mét) giữa 2 toạ độ. */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Bán kính cho phép coi là "đang ở quán" (mét). */
export const CHECKIN_RADIUS_METERS = 150;

function getLocalCheckins(): CheckIn[] {
  try {
    const raw = localStorage.getItem(LOCAL_CHECKINS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CheckIn[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalCheckins(list: CheckIn[]): void {
  try {
    localStorage.setItem(LOCAL_CHECKINS_KEY, JSON.stringify(list));
  } catch {
    // ignore quota
  }
}

interface CheckinRow {
  id: string;
  place_id: string;
  place_name: string | null;
  pet_id: string | null;
  pet_name: string | null;
  user_id: string | null;
  author_name: string | null;
  rating: number;
  comment: string | null;
  verified: boolean;
  method: string | null;
  created_at: string;
}

function mapRowToCheckin(row: CheckinRow): CheckIn {
  return {
    id: row.id,
    placeId: row.place_id,
    placeName: row.place_name || '',
    petId: row.pet_id || undefined,
    petName: row.pet_name || undefined,
    userId: row.user_id || undefined,
    authorName: row.author_name || 'Người dùng PetMap',
    rating: Number(row.rating) || 5,
    comment: row.comment || '',
    verified: Boolean(row.verified),
    method: (row.method as CheckIn['method']) || 'qr',
    createdAt: row.created_at,
  };
}

/** Lấy danh sách check-in mới nhất (feed hoạt động). */
export async function fetchRecentCheckins(limit = 50): Promise<CheckIn[]> {
  const supabase = getSupabaseClient();
  if (isSupabaseReady() && supabase) {
    const { data, error } = await supabase
      .from('check_ins')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (!error && data) return (data as CheckinRow[]).map(mapRowToCheckin);
  }
  return getLocalCheckins()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

/** Lấy check-in theo petId (lịch sử của một Boss). */
export async function fetchCheckinsByPet(petId: string): Promise<CheckIn[]> {
  const all = await fetchRecentCheckins(200);
  return all.filter((c) => c.petId === petId);
}

/** Tạo một lượt check-in. */
export async function createCheckin(input: Omit<CheckIn, 'id' | 'createdAt'>): Promise<CheckIn> {
  const supabase = getSupabaseClient();
  if (
    isSupabaseReady() &&
    supabase &&
    !input.placeId.startsWith('local-') &&
    !input.placeId.startsWith('place-') &&
    !input.placeId.startsWith('osm-')
  ) {
    const { data, error } = await supabase
      .from('check_ins')
      .insert([
        {
          place_id: input.placeId,
          place_name: input.placeName,
          pet_id: input.petId || null,
          pet_name: input.petName || null,
          user_id: input.userId || null,
          author_name: input.authorName,
          rating: input.rating,
          comment: input.comment,
          verified: input.verified,
          method: input.method,
        },
      ])
      .select('*')
      .single();
    if (!error && data) return mapRowToCheckin(data as CheckinRow);
  }

  const created: CheckIn = {
    ...input,
    id: `chk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  saveLocalCheckins([created, ...getLocalCheckins()]);
  return created;
}
