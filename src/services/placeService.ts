import { getSupabaseClient, isSupabaseReady } from '../lib/supabase';
import { INITIAL_PLACES } from '../data/mockPlaces';
import { INITIAL_REVIEWS } from '../data/mockReviews';
import {
  Place,
  PlaceCategory,
  PetConditionId,
  PetPolicyStatus,
  PetType,
  PlaceReview,
  PlaceReport,
  PlaceReportReason,
} from '../types/place';

const LOCAL_STORAGE_KEY = 'petmap_places_v1';
const LOCAL_REVIEWS_KEY = 'petmap_reviews_v1';
const LOCAL_SAVED_IDS_KEY = 'petmap_saved_place_ids_v1';
const LOCAL_REPORTS_KEY = 'petmap_place_reports_v1';

interface PlaceRow {
  id: string;
  name: string;
  category: PlaceCategory;
  address: string;
  district: string;
  lat: number;
  lng: number;
  pet_policy: PetPolicyStatus;
  pet_conditions: PetConditionId[];
  pet_policy_notes: string | null;
  allowed_pet_types: PetType[];
  max_weight_kg: number | null;
  google_maps_url: string | null;
  website_url: string | null;
  phone: string | null;
  opening_hours: string | null;
  image_url: string | null;
  rating: number | null;
  review_count: number | null;
  verified: boolean | null;
  created_at: string;
}

function mapRowToPlace(row: PlaceRow): Place {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    address: row.address,
    district: row.district,
    lat: row.lat,
    lng: row.lng,
    petPolicy: row.pet_policy,
    petConditions: row.pet_conditions || [],
    petPolicyNotes: row.pet_policy_notes || '',
    allowedPetTypes: row.allowed_pet_types || ['dog', 'cat'],
    maxWeightKg: row.max_weight_kg,
    googleMapsUrl: row.google_maps_url || '',
    websiteUrl: row.website_url || '',
    phone: row.phone || '',
    openingHours: row.opening_hours || '',
    imageUrl: row.image_url || '',
    rating: row.rating ?? 4.8,
    reviewCount: row.review_count ?? 1,
    verified: row.verified ?? false,
    createdAt: row.created_at,
  };
}

function mapPlaceToInsertRow(place: Omit<Place, 'id' | 'createdAt'>) {
  return {
    name: place.name,
    category: place.category,
    address: place.address,
    district: place.district,
    lat: place.lat,
    lng: place.lng,
    pet_policy: place.petPolicy,
    pet_conditions: place.petConditions,
    pet_policy_notes: place.petPolicyNotes,
    allowed_pet_types: place.allowedPetTypes,
    max_weight_kg: place.maxWeightKg ?? null,
    google_maps_url: place.googleMapsUrl || '',
    website_url: place.websiteUrl || '',
    phone: place.phone || '',
    opening_hours: place.openingHours || '',
    image_url: place.imageUrl || '',
    rating: place.rating ?? 5.0,
    review_count: place.reviewCount ?? 1,
    verified: place.verified ?? false,
  };
}

function getLocalPlaces(): Place[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_PLACES));
      return INITIAL_PLACES;
    }
    const parsed = JSON.parse(raw) as Place[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_PLACES;
  } catch {
    return INITIAL_PLACES;
  }
}

/** Khử trùng lặp địa điểm theo (tên chuẩn hoá + toạ độ làm tròn ~110m); ưu tiên giữ bản đã xác thực. */
export function dedupePlaces(places: Place[]): Place[] {
  const byKey = new Map<string, Place>();
  for (const p of places) {
    const key = `${(p.name || '').toLowerCase().trim()}|${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, p);
    } else if (!existing.verified && p.verified) {
      // Giữ bản đã xác thực nếu bản đang giữ chưa xác thực
      byKey.set(key, p);
    }
  }
  return Array.from(byKey.values());
}

/** Trả về danh sách id các địa điểm TRÙNG (dư thừa) cần xoá — giữ lại 1 bản mỗi nhóm. */
export function getDuplicatePlaceIds(places: Place[]): string[] {
  const kept = new Set(dedupePlaces(places).map((p) => p.id));
  return places.filter((p) => !kept.has(p.id)).map((p) => p.id);
}

function saveLocalPlaces(places: Place[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(places));
  } catch {
    // ignore storage quota errors
  }
}

export async function fetchPlaces(): Promise<{
  places: Place[];
  source: 'supabase' | 'local';
  error?: string;
}> {
  const supabase = getSupabaseClient();
  if (isSupabaseReady() && supabase) {
    const { data, error } = await supabase
      .from('places')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      if (data.length === 0) {
        return { places: [], source: 'supabase' };
      }
      return {
        places: dedupePlaces((data as PlaceRow[]).map(mapRowToPlace)),
        source: 'supabase',
      };
    }

    return {
      places: dedupePlaces(getLocalPlaces()),
      source: 'local',
      error: error?.message,
    };
  }

  return {
    places: dedupePlaces(getLocalPlaces()),
    source: 'local',
  };
}

export async function createPlace(
  newPlaceInput: Omit<Place, 'id' | 'createdAt'>
): Promise<{ place: Place; source: 'supabase' | 'local' }> {
  const supabase = getSupabaseClient();
  if (isSupabaseReady() && supabase) {
    const row = mapPlaceToInsertRow(newPlaceInput);
    const { data, error } = await supabase
      .from('places')
      .insert([row])
      .select('*')
      .single();

    if (!error && data) {
      return {
        place: mapRowToPlace(data as PlaceRow),
        source: 'supabase',
      };
    }
  }

  const created: Place = {
    ...newPlaceInput,
    id: `local-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };

  const current = getLocalPlaces();
  const updated = [created, ...current];
  saveLocalPlaces(updated);

  return { place: created, source: 'local' };
}

export async function updatePlacePolicy(
  placeId: string,
  updates: Pick<
    Place,
    | 'petPolicy'
    | 'petConditions'
    | 'petPolicyNotes'
    | 'allowedPetTypes'
    | 'maxWeightKg'
    | 'googleMapsUrl'
    | 'websiteUrl'
    | 'imageUrl'
  >,
  fallbackBasePlace?: Place
): Promise<Place | null> {
  const supabase = getSupabaseClient();
  if (
    isSupabaseReady() &&
    supabase &&
    !placeId.startsWith('local-') &&
    !placeId.startsWith('place-') &&
    !placeId.startsWith('osm-')
  ) {
    const { data, error } = await supabase
      .from('places')
      .update({
        pet_policy: updates.petPolicy,
        pet_conditions: updates.petConditions,
        pet_policy_notes: updates.petPolicyNotes,
        allowed_pet_types: updates.allowedPetTypes,
        max_weight_kg: updates.maxWeightKg ?? null,
        google_maps_url: updates.googleMapsUrl || '',
        website_url: updates.websiteUrl || '',
        image_url: updates.imageUrl || '',
      })
      .eq('id', placeId)
      .select('*')
      .single();

    if (!error && data) {
      return mapRowToPlace(data as PlaceRow);
    }
  }

  const current = getLocalPlaces();
  const idx = current.findIndex((p) => p.id === placeId);

  // Task #5: Nếu là quán quét từ OpenStreetMap (osm-*) chưa có trong LocalStorage, tự động lưu lại khi user cập nhật
  if (idx === -1) {
    if (fallbackBasePlace) {
      const persistedOsmPlace: Place = {
        ...fallbackBasePlace,
        ...updates,
      };
      saveLocalPlaces([persistedOsmPlace, ...current]);
      return persistedOsmPlace;
    }
    return null;
  }

  const updatedPlace: Place = {
    ...current[idx],
    ...updates,
  };
  current[idx] = updatedPlace;
  saveLocalPlaces(current);
  return updatedPlace;
}

export async function seedInitialPlacesToSupabase(): Promise<{
  count: number;
  skippedCount?: number;
  error?: string;
}> {
  const supabase = getSupabaseClient();
  if (!isSupabaseReady() || !supabase) {
    return { count: 0, error: 'Chưa cấu hình Supabase URL và Anon Key.' };
  }

  // Task #18: Chống nhân đôi dữ liệu khi bấm Seed nhiều lần
  const { data: existingRows } = await supabase.from('places').select('name');
  const existingNames = new Set(
    (existingRows || []).map((r: { name: string }) => r.name.toLowerCase().trim())
  );

  const newPlaces = INITIAL_PLACES.filter(
    (p) => !existingNames.has(p.name.toLowerCase().trim())
  );

  if (newPlaces.length === 0) {
    return {
      count: 0,
      skippedCount: INITIAL_PLACES.length,
    };
  }

  const rows = newPlaces.map((p) => mapPlaceToInsertRow(p));
  const { data, error } = await supabase.from('places').insert(rows).select('*');

  if (error) {
    return { count: 0, error: error.message };
  }

  return {
    count: data?.length ?? 0,
    skippedCount: INITIAL_PLACES.length - newPlaces.length,
  };
}

export function resetLocalPlacesToDefault(): Place[] {
  saveLocalPlaces(INITIAL_PLACES);
  localStorage.setItem(LOCAL_REVIEWS_KEY, JSON.stringify(INITIAL_REVIEWS));
  return INITIAL_PLACES;
}

export async function approvePlaceById(placeId: string): Promise<Place | null> {
  const supabase = getSupabaseClient();
  if (
    isSupabaseReady() &&
    supabase &&
    !placeId.startsWith('local-') &&
    !placeId.startsWith('place-') &&
    !placeId.startsWith('osm-')
  ) {
    const { data, error } = await supabase
      .from('places')
      .update({ verified: true })
      .eq('id', placeId)
      .select('*')
      .single();

    if (!error && data) {
      return mapRowToPlace(data as PlaceRow);
    }
  }

  const current = getLocalPlaces();
  const idx = current.findIndex((p) => p.id === placeId);
  if (idx !== -1) {
    current[idx] = { ...current[idx], verified: true };
    saveLocalPlaces(current);
    return current[idx];
  }
  return null;
}

export async function deletePlaceById(placeId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (
    isSupabaseReady() &&
    supabase &&
    !placeId.startsWith('local-') &&
    !placeId.startsWith('place-') &&
    !placeId.startsWith('osm-')
  ) {
    const { error } = await supabase.from('places').delete().eq('id', placeId);
    if (!error) return true;
  }

  const current = getLocalPlaces();
  const next = current.filter((p) => p.id !== placeId);
  saveLocalPlaces(next);
  return true;
}

// ============================================================
// QUẢN LÝ ĐÁNH GIÁ (REVIEWS) & XÁC THỰC CHÍNH SÁCH PET
// ============================================================

interface ReviewRow {
  id: string;
  place_id: string;
  author_name: string;
  pet_info: string | null;
  rating: number;
  comment: string;
  policy_accurate: boolean;
  image_url: string | null;
  helpful_count: number | null;
  visited_at: string | null;
  created_at: string;
}

function getLocalReviews(): PlaceReview[] {
  try {
    const raw = localStorage.getItem(LOCAL_REVIEWS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_REVIEWS_KEY, JSON.stringify(INITIAL_REVIEWS));
      return INITIAL_REVIEWS;
    }
    const parsed = JSON.parse(raw) as PlaceReview[];
    return Array.isArray(parsed) ? parsed : INITIAL_REVIEWS;
  } catch {
    return INITIAL_REVIEWS;
  }
}

function saveLocalReviews(reviews: PlaceReview[]): void {
  try {
    localStorage.setItem(LOCAL_REVIEWS_KEY, JSON.stringify(reviews));
  } catch {
    // ignore
  }
}

const HELPFUL_VOTED_KEY = 'petmap_helpful_voted_v1';

/** Danh sách id review đã bấm "hữu ích" trên thiết bị này (chống bấm nhiều lần). */
export function getHelpfulVotedIds(): string[] {
  try {
    const raw = localStorage.getItem(HELPFUL_VOTED_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Đánh dấu một review là hữu ích; nextCount do client truyền (current + 1). */
export async function markReviewHelpful(reviewId: string, nextCount: number): Promise<number> {
  const voted = new Set(getHelpfulVotedIds());
  voted.add(reviewId);
  try {
    localStorage.setItem(HELPFUL_VOTED_KEY, JSON.stringify([...voted]));
  } catch {
    // ignore
  }

  const supabase = getSupabaseClient();
  if (isSupabaseReady() && supabase && !reviewId.startsWith('rev-')) {
    await supabase.from('place_reviews').update({ helpful_count: nextCount }).eq('id', reviewId);
  }

  const reviews = getLocalReviews().map((r) =>
    r.id === reviewId ? { ...r, helpfulCount: nextCount } : r
  );
  saveLocalReviews(reviews);
  return nextCount;
}

export async function fetchReviewsByPlace(placeId: string): Promise<PlaceReview[]> {
  const supabase = getSupabaseClient();
  if (
    isSupabaseReady() &&
    supabase &&
    !placeId.startsWith('local-') &&
    !placeId.startsWith('place-')
  ) {
    const { data, error } = await supabase
      .from('place_reviews')
      .select('*')
      .eq('place_id', placeId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      return (data as ReviewRow[]).map((r) => ({
        id: r.id,
        placeId: r.place_id,
        authorName: r.author_name,
        petInfo: r.pet_info || '',
        rating: r.rating,
        comment: r.comment,
        policyAccurate: r.policy_accurate,
        imageUrl: r.image_url || undefined,
        helpfulCount: r.helpful_count || 0,
        visitedAt: r.visited_at || undefined,
        createdAt: r.created_at,
      }));
    }
  }

  return getLocalReviews().filter((r) => r.placeId === placeId);
}

export async function addPlaceReview(
  input: Omit<PlaceReview, 'id' | 'createdAt'>
): Promise<{ review: PlaceReview; updatedPlace?: Place }> {
  const supabase = getSupabaseClient();
  if (
    isSupabaseReady() &&
    supabase &&
    !input.placeId.startsWith('local-') &&
    !input.placeId.startsWith('place-')
  ) {
    const { data, error } = await supabase
      .from('place_reviews')
      .insert([
        {
          place_id: input.placeId,
          author_name: input.authorName,
          pet_info: input.petInfo,
          rating: input.rating,
          comment: input.comment,
          policy_accurate: input.policyAccurate,
          image_url: input.imageUrl || '',
        },
      ])
      .select('*')
      .single();

    if (!error && data) {
      const row = data as ReviewRow;
      return {
        review: {
          id: row.id,
          placeId: row.place_id,
          authorName: row.author_name,
          petInfo: row.pet_info || '',
          rating: row.rating,
          comment: row.comment,
          policyAccurate: row.policy_accurate,
          imageUrl: row.image_url || undefined,
          helpfulCount: row.helpful_count || 0,
          visitedAt: row.visited_at || undefined,
          createdAt: row.created_at,
        },
      };
    }
  }

  const createdReview: PlaceReview = {
    ...input,
    id: `rev-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };

  const allReviews = [createdReview, ...getLocalReviews()];
  saveLocalReviews(allReviews);

  // Recalculate rating & reviewCount in local places
  const places = getLocalPlaces();
  const idx = places.findIndex((p) => p.id === input.placeId);
  let updatedPlace: Place | undefined;
  if (idx !== -1) {
    const placeReviews = allReviews.filter((r) => r.placeId === input.placeId);
    const prevCount = places[idx].reviewCount || 1;
    const prevRating = places[idx].rating || 4.8;
    const newCount = prevCount + 1;
    const newRating = Number(((prevRating * prevCount + input.rating) / newCount).toFixed(1));
    const accurateVotes = placeReviews.filter((r) => r.policyAccurate).length;

    updatedPlace = {
      ...places[idx],
      rating: newRating,
      reviewCount: newCount,
      verified: accurateVotes >= 2 ? true : places[idx].verified,
    };
    places[idx] = updatedPlace;
    saveLocalPlaces(places);
  }

  return { review: createdReview, updatedPlace };
}

// ============================================================
// QUẢN LÝ DANH SÁCH ĐỊA ĐIỂM ĐÃ LƯU (BOOKMARK / SAVED PLACES)
// ============================================================

export function getSavedPlaceIds(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_SAVED_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function toggleSavedPlaceId(placeId: string): string[] {
  const current = getSavedPlaceIds();
  const next = current.includes(placeId)
    ? current.filter((id) => id !== placeId)
    : [...current, placeId];
  try {
    localStorage.setItem(LOCAL_SAVED_IDS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

// ============================================================
// QUẢN LÝ CHỈNH SỬA TOÀN DIỆN ĐỊA ĐIỂM & DUYỆT REVIEW (ADMIN)
// ============================================================

export async function updatePlaceFull(
  placeId: string,
  updates: Partial<Omit<Place, 'id' | 'createdAt'>>
): Promise<Place | null> {
  const supabase = getSupabaseClient();
  if (
    isSupabaseReady() &&
    supabase &&
    !placeId.startsWith('local-') &&
    !placeId.startsWith('place-') &&
    !placeId.startsWith('osm-')
  ) {
    const payload: Record<string, unknown> = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.category !== undefined) payload.category = updates.category;
    if (updates.address !== undefined) payload.address = updates.address;
    if (updates.district !== undefined) payload.district = updates.district;
    if (updates.lat !== undefined) payload.lat = updates.lat;
    if (updates.lng !== undefined) payload.lng = updates.lng;
    if (updates.petPolicy !== undefined) payload.pet_policy = updates.petPolicy;
    if (updates.petConditions !== undefined) payload.pet_conditions = updates.petConditions;
    if (updates.petPolicyNotes !== undefined) payload.pet_policy_notes = updates.petPolicyNotes;
    if (updates.allowedPetTypes !== undefined) payload.allowed_pet_types = updates.allowedPetTypes;
    if (updates.maxWeightKg !== undefined) payload.max_weight_kg = updates.maxWeightKg;
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.openingHours !== undefined) payload.opening_hours = updates.openingHours;
    if (updates.googleMapsUrl !== undefined) payload.google_maps_url = updates.googleMapsUrl;
    if (updates.websiteUrl !== undefined) payload.website_url = updates.websiteUrl;
    if (updates.imageUrl !== undefined) payload.image_url = updates.imageUrl;
    if (updates.verified !== undefined) payload.verified = updates.verified;

    const { data, error } = await supabase
      .from('places')
      .update(payload)
      .eq('id', placeId)
      .select('*')
      .single();

    if (!error && data) {
      return mapRowToPlace(data as PlaceRow);
    }
  }

  const current = getLocalPlaces();
  const idx = current.findIndex((p) => p.id === placeId);
  if (idx === -1) return null;

  const updatedPlace: Place = {
    ...current[idx],
    ...updates,
  };
  current[idx] = updatedPlace;
  saveLocalPlaces(current);
  return updatedPlace;
}

export async function fetchAllReviews(): Promise<PlaceReview[]> {
  const supabase = getSupabaseClient();
  const localReviews = getLocalReviews();

  if (isSupabaseReady() && supabase) {
    const { data, error } = await supabase
      .from('place_reviews')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      const dbReviews = (data as ReviewRow[]).map((r) => ({
        id: r.id,
        placeId: r.place_id,
        authorName: r.author_name,
        petInfo: r.pet_info || '',
        rating: r.rating,
        comment: r.comment,
        policyAccurate: r.policy_accurate,
        imageUrl: r.image_url || undefined,
        helpfulCount: r.helpful_count || 0,
        visitedAt: r.visited_at || undefined,
        createdAt: r.created_at,
      }));
      const seenIds = new Set(dbReviews.map((r) => r.id));
      return [...dbReviews, ...localReviews.filter((r) => !seenIds.has(r.id))];
    }
  }

  return localReviews;
}

export async function deleteReviewById(
  reviewId: string
): Promise<{ deleted: boolean; updatedPlace?: Place }> {
  const supabase = getSupabaseClient();
  const current = getLocalReviews();
  const targetReview = current.find((r) => r.id === reviewId);

  if (isSupabaseReady() && supabase && !reviewId.startsWith('rev-')) {
    await supabase.from('place_reviews').delete().eq('id', reviewId);
  }

  const remaining = current.filter((r) => r.id !== reviewId);
  saveLocalReviews(remaining);

  // Task #17: Tính toán lại điểm rating & reviewCount của quán sau khi xoá Review
  let updatedPlace: Place | undefined;
  if (targetReview) {
    const places = getLocalPlaces();
    const pIdx = places.findIndex((p) => p.id === targetReview.placeId);
    if (pIdx !== -1) {
      const placeRevs = remaining.filter((r) => r.placeId === targetReview.placeId);
      const nextCount = Math.max(1, placeRevs.length);
      const nextRating =
        placeRevs.length > 0
          ? Number(
              (
                placeRevs.reduce((acc, item) => acc + item.rating, 0) / placeRevs.length
              ).toFixed(1)
            )
          : 4.8;

      updatedPlace = {
        ...places[pIdx],
        rating: nextRating,
        reviewCount: nextCount,
      };
      places[pIdx] = updatedPlace;
      saveLocalPlaces(places);
    }
  }

  return { deleted: true, updatedPlace };
}

// ============================================================
// QUẢN LÝ BÁO CÁO CẬP NHẬT TRẠNG THÁI QUÁN (PLACE REPORTS)
// ============================================================

interface PlaceReportRow {
  id: string;
  place_id: string;
  place_name: string;
  reason: PlaceReportReason;
  suggested_policy: PetPolicyStatus | null;
  details: string;
  reporter_name: string;
  status: 'pending' | 'resolved' | 'dismissed';
  created_at: string;
}

function getLocalReports(): PlaceReport[] {
  try {
    const raw = localStorage.getItem(LOCAL_REPORTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PlaceReport[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalReports(reports: PlaceReport[]): void {
  try {
    localStorage.setItem(LOCAL_REPORTS_KEY, JSON.stringify(reports));
  } catch {
    // ignore
  }
}

export async function fetchPlaceReports(): Promise<PlaceReport[]> {
  const supabase = getSupabaseClient();
  const localReports = getLocalReports();

  if (isSupabaseReady() && supabase) {
    const { data, error } = await supabase
      .from('place_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      const dbReports: PlaceReport[] = (data as PlaceReportRow[]).map((row) => ({
        id: row.id,
        placeId: row.place_id,
        placeName: row.place_name,
        reason: row.reason,
        suggestedPolicy: row.suggested_policy,
        details: row.details,
        reporterName: row.reporter_name,
        status: row.status,
        createdAt: row.created_at,
      }));
      const seenIds = new Set(dbReports.map((r) => r.id));
      return [...dbReports, ...localReports.filter((r) => !seenIds.has(r.id))];
    }
  }

  return localReports;
}

export async function createPlaceReport(
  input: Omit<PlaceReport, 'id' | 'status' | 'createdAt'>
): Promise<PlaceReport> {
  const supabase = getSupabaseClient();
  if (
    isSupabaseReady() &&
    supabase &&
    !input.placeId.startsWith('local-') &&
    !input.placeId.startsWith('place-') &&
    !input.placeId.startsWith('osm-')
  ) {
    const { data, error } = await supabase
      .from('place_reports')
      .insert([
        {
          place_id: input.placeId,
          place_name: input.placeName,
          reason: input.reason,
          suggested_policy: input.suggestedPolicy ?? null,
          details: input.details,
          reporter_name: input.reporterName || 'Cộng đồng PetMap',
          status: 'pending',
        },
      ])
      .select('*')
      .single();

    if (!error && data) {
      const row = data as PlaceReportRow;
      return {
        id: row.id,
        placeId: row.place_id,
        placeName: row.place_name,
        reason: row.reason,
        suggestedPolicy: row.suggested_policy,
        details: row.details,
        reporterName: row.reporter_name,
        status: row.status,
        createdAt: row.created_at,
      };
    }
  }

  const created: PlaceReport = {
    ...input,
    id: `rep-${Date.now()}`,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  const current = getLocalReports();
  saveLocalReports([created, ...current]);
  return created;
}

export async function updatePlaceReportStatus(
  reportId: string,
  status: 'resolved' | 'dismissed'
): Promise<void> {
  const supabase = getSupabaseClient();
  if (isSupabaseReady() && supabase && !reportId.startsWith('rep-')) {
    await supabase.from('place_reports').update({ status }).eq('id', reportId);
  }
  const current = getLocalReports();
  const next = current.map((r) => (r.id === reportId ? { ...r, status } : r));
  saveLocalReports(next);
}

export async function deletePlaceReport(reportId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (isSupabaseReady() && supabase && !reportId.startsWith('rep-')) {
    await supabase.from('place_reports').delete().eq('id', reportId);
  }
  const current = getLocalReports();
  saveLocalReports(current.filter((r) => r.id !== reportId));
}
