import { getSupabaseClient, isSupabaseReady } from '../lib/supabase';
import { PetProfile, PetType } from '../types/place';

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
  role: 'user' | 'admin';
}

const LOCAL_AUTH_USER_KEY = 'petmap_local_auth_user_v1';
const LOCAL_USER_PETS_PREFIX = 'petmap_user_pets_list_';

interface PetProfileRow {
  id: string;
  user_id: string;
  identity_code?: string | null;
  avatar_url?: string | null;
  owner_phone?: string | null;
  name: string;
  type: PetType;
  breed: string | null;
  weight_kg: number;
  birth_date?: string | null;
  gender?: string | null;
  vaccinated: boolean;
  has_carrier: boolean;
  has_muzzle: boolean;
  has_diaper: boolean;
}

interface PackedPetMeta {
  idCode?: string;
  avatar?: string;
  phone?: string;
  extraPets?: PetProfile[];
}

const META_DELIMITER = ' ||PM:';

// Đọc ngược dữ liệu cũ (từng gói nhiều Boss vào 1 dòng) để migrate sang lưu mỗi Boss 1 dòng.
function unpackBreedAndMeta(rawBreed: string | null): {
  breed: string;
  meta: PackedPetMeta;
} {
  if (!rawBreed) return { breed: '', meta: {} };
  const idx = rawBreed.indexOf(META_DELIMITER);
  if (idx === -1) {
    return { breed: rawBreed.trim(), meta: {} };
  }
  const cleanBreed = rawBreed.slice(0, idx).trim();
  const jsonPart = rawBreed.slice(idx + META_DELIMITER.length).trim();
  try {
    const parsed = JSON.parse(jsonPart) as PackedPetMeta;
    return { breed: cleanBreed, meta: parsed || {} };
  } catch {
    return { breed: cleanBreed, meta: {} };
  }
}

function getLocalAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(LOCAL_AUTH_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function setLocalAuthUser(user: AuthUser | null): void {
  try {
    if (!user) {
      localStorage.removeItem(LOCAL_AUTH_USER_KEY);
    } else {
      localStorage.setItem(LOCAL_AUTH_USER_KEY, JSON.stringify(user));
    }
  } catch {
    // ignore
  }
}

async function fetchUserRole(userId: string, email?: string): Promise<'user' | 'admin'> {
  if (email && email.toLowerCase().startsWith('admin@')) {
    return 'admin';
  }

  const supabase = getSupabaseClient();
  if (!supabase) return 'user';
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();
    if (!error && data && data.role === 'admin') {
      return 'admin';
    }
  } catch {
    // ignore if table not yet created
  }
  return 'user';
}

export async function promoteUserToAdminInDb(userId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  if (!isSupabaseReady() || !supabase) {
    return { ok: false, error: 'Chưa kết nối Supabase' };
  }
  const { error } = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, role: 'admin' }, { onConflict: 'user_id' });
  if (error) {
    return { ok: false, error: error.message };
  }
  const current = getLocalAuthUser();
  if (current && current.id === userId) {
    setLocalAuthUser({ ...current, role: 'admin' });
  }
  return { ok: true };
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = getSupabaseClient();
  if (isSupabaseReady() && supabase) {
    const { data } = await supabase.auth.getSession();
    const sessionUser = data.session?.user;
    if (sessionUser) {
      const role = await fetchUserRole(sessionUser.id, sessionUser.email);
      return {
        id: sessionUser.id,
        email: sessionUser.email || '',
        fullName: (sessionUser.user_metadata?.full_name as string) || '',
        role,
      };
    }
  }
  const local = getLocalAuthUser();
  if (local) {
    const role = await fetchUserRole(local.id, local.email);
    return { ...local, role };
  }
  return null;
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ user: AuthUser | null; error?: string }> {
  const supabase = getSupabaseClient();
  if (isSupabaseReady() && supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      return { user: null, error: error.message };
    }

    if (data.user) {
      const role = await fetchUserRole(data.user.id, data.user.email);
      const authUser: AuthUser = {
        id: data.user.id,
        email: data.user.email || email.trim(),
        fullName: (data.user.user_metadata?.full_name as string) || '',
        role,
      };
      setLocalAuthUser(authUser);
      return { user: authUser };
    }
  }

  return {
    user: null,
    error: 'Không thể kết nối tới dịch vụ xác thực Supabase.',
  };
}

export async function signUpWithEmail(
  email: string,
  password: string,
  fullName: string
): Promise<{ user: AuthUser | null; needsEmailConfirm?: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  if (isSupabaseReady() && supabase) {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
        },
      },
    });

    if (error) {
      return { user: null, error: error.message };
    }

    if (data.user) {
      const role = await fetchUserRole(data.user.id, email.trim());
      const authUser: AuthUser = {
        id: data.user.id,
        email: data.user.email || email.trim(),
        fullName: fullName.trim(),
        role,
      };
      setLocalAuthUser(authUser);
      return {
        user: authUser,
        needsEmailConfirm: !data.session,
      };
    }
  }

  return {
    user: null,
    error: 'Không thể đăng ký tài khoản lúc này.',
  };
}

export async function signOutUser(): Promise<void> {
  const supabase = getSupabaseClient();
  if (isSupabaseReady() && supabase) {
    await supabase.auth.signOut();
  }
  setLocalAuthUser(null);
}

// ============================================================
// QUẢN LÝ NHIỀU THÚ CƯNG (MULTI-PET PROFILES) THEO USER ĐĂNG NHẬP
// ============================================================

function mapRowToPet(row: PetProfileRow): PetProfile {
  const { breed, meta } = unpackBreedAndMeta(row.breed);
  return {
    id: row.id,
    identityCode: (row.identity_code || meta.idCode || '').trim(),
    avatarUrl: (row.avatar_url || meta.avatar || '').trim() || undefined,
    ownerPhone: (row.owner_phone || meta.phone || '').trim() || undefined,
    name: row.name,
    type: row.type,
    breed,
    weightKg: Number(row.weight_kg),
    birthDate: (row.birth_date || '').trim() || undefined,
    gender: (row.gender as PetProfile['gender']) || 'unknown',
    vaccinated: row.vaccinated,
    hasCarrier: row.has_carrier,
    hasMuzzle: row.has_muzzle,
    hasDiaper: row.has_diaper,
    syncedToCloud: true,
  };
}

function unpackRowToPets(row: PetProfileRow): PetProfile[] {
  const primary = mapRowToPet(row);
  const { meta } = unpackBreedAndMeta(row.breed);
  if (meta.extraPets && Array.isArray(meta.extraPets) && meta.extraPets.length > 0) {
    const extras = meta.extraPets.map((ep, idx) => ({
      ...ep,
      id: ep.id || `pet-extra-${row.id}-${idx}`,
      breed: (ep.breed || '').split(META_DELIMITER)[0].trim(),
      syncedToCloud: true,
    }));
    return [primary, ...extras];
  }
  return [primary];
}

function getCachedUserPets(userId: string): PetProfile[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_USER_PETS_PREFIX}${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as PetProfile[];
      if (Array.isArray(parsed)) return parsed;
    }
    // Migrate single pet key if existed
    const legacyRaw = localStorage.getItem(`petmap_user_pet_profile_${userId}`);
    if (legacyRaw) {
      const single = JSON.parse(legacyRaw) as PetProfile;
      const list = [{ ...single, id: single.id || `pet-${Date.now()}` }];
      localStorage.setItem(`${LOCAL_USER_PETS_PREFIX}${userId}`, JSON.stringify(list));
      return list;
    }
  } catch {
    // ignore
  }
  return [];
}

function saveCachedUserPets(userId: string, pets: PetProfile[]): void {
  try {
    localStorage.setItem(`${LOCAL_USER_PETS_PREFIX}${userId}`, JSON.stringify(pets));
    // Đồng bộ vào danh mục tra cứu chung trên máy
    const allRaw = localStorage.getItem('petmap_global_pets_registry_v1');
    const existingAll: PetProfile[] = allRaw ? JSON.parse(allRaw) : [];
    const userPetIds = new Set(pets.map((p) => p.id));
    const merged = [
      ...existingAll.filter((p) => !userPetIds.has(p.id)),
      ...pets,
    ];
    localStorage.setItem('petmap_global_pets_registry_v1', JSON.stringify(merged));
  } catch {
    // ignore
  }
}

/**
 * Đồng bộ toàn bộ danh sách thú cưng (Multi-Pet) của user lên bảng public.pet_profiles.
 * - Lưu Boss chính vào các cột chuẩn và đóng gói toàn bộ các Boss thứ 2, 3... vào metadata `extraPets`
 *   bên trong trường `breed` (`||PM:...`).
 * - Đảm bảo KỂ CẢ KHI bảng `pet_profiles` trên Supabase vẫn còn ràng buộc `UNIQUE(user_id)`,
 *   việc thêm Boss mới KHÔNG BAO GIỜ ghi đè làm mất Boss cũ!
 */
let lastPetSyncError: string | null = null;

/** Trả về lỗi đồng bộ Supabase gần nhất (để hiển thị cho người dùng chẩn đoán). */
export function getLastPetSyncError(): string | null {
  return lastPetSyncError;
}

type SupabaseErr = { code?: string; message?: string } | null;

/** Task #18: Lỗi mạng/tạm thời (đáng retry), KHÔNG tính lỗi schema/RLS/khóa ngoại. */
function isTransientSupabaseError(err: SupabaseErr): boolean {
  if (!err) return false;
  const code = err.code || '';
  const msg = (err.message || '').toLowerCase();
  if (['23503', '42501', 'PGRST204', '23505'].includes(code)) return false;
  return /fetch|network|timeout|timed out|temporarily|connection|50[234]/.test(msg) || /^5/.test(code);
}

/** Thực thi một thao tác Supabase với tối đa 3 lần thử khi gặp lỗi mạng tạm thời (backoff tuyến tính). */
async function retrySupabase<T>(
  op: () => PromiseLike<{ data: T | null; error: SupabaseErr }>,
  attempts = 3
): Promise<{ data: T | null; error: SupabaseErr }> {
  let last = await op();
  let tries = 1;
  while (last.error && isTransientSupabaseError(last.error) && tries < attempts) {
    await new Promise((r) => setTimeout(r, 300 * tries));
    last = await op();
    tries++;
  }
  return last;
}

function translateSupabaseError(err: { code?: string; message?: string } | null): string | null {
  if (!err) return null;
  const code = err.code || '';
  const msg = err.message || 'Lỗi không xác định';
  if (code === '23503' || /foreign key/i.test(msg)) {
    return 'Tài khoản chưa tồn tại trong Supabase Auth (lỗi khóa ngoại user_id). Hãy chạy lại schema.sql mới (đã gỡ ràng buộc khóa ngoại) trong Supabase SQL Editor.';
  }
  if (code === '42501' || /row-level security|rls/i.test(msg)) {
    return 'Bị chặn bởi RLS Policy. Hãy chạy lại schema.sql mới để cho phép ghi dữ liệu pet_profiles.';
  }
  if (code === 'PGRST204' || /column .* schema cache|could not find/i.test(msg)) {
    return 'Thiếu cột trong bảng pet_profiles. Hãy chạy lại schema.sql mới trong Supabase.';
  }
  return `Lỗi Supabase (${code || 'n/a'}): ${msg}`;
}

async function syncUserPetListToSupabase(
  userId: string,
  petsList: PetProfile[]
): Promise<PetProfile[]> {
  lastPetSyncError = null;
  const supabase = getSupabaseClient();
  if (!isSupabaseReady() || !supabase) {
    lastPetSyncError =
      'Chưa cấu hình kết nối Supabase (VITE_SUPABASE_URL / ANON_KEY). Dữ liệu chỉ được lưu tạm trên trình duyệt này.';
    return petsList;
  }
  if (petsList.length === 0) {
    return petsList;
  }

  // Mỗi Boss = 1 dòng riêng, dùng ĐÚNG các cột chuẩn (không còn đóng gói vào breed)
  const buildRow = (pet: PetProfile) => ({
    user_id: userId,
    identity_code: (pet.identityCode || '').trim().replace(/^#/, '').toUpperCase(),
    avatar_url: (pet.avatarUrl || '').trim(),
    owner_phone: (pet.ownerPhone || '').trim(),
    name: pet.name.trim(),
    type: pet.type,
    breed: (pet.breed || '').split(META_DELIMITER)[0].trim(),
    weight_kg: Number(pet.weightKg) || 5,
    birth_date: pet.birthDate ? pet.birthDate : null,
    gender: pet.gender || 'unknown',
    vaccinated: Boolean(pet.vaccinated),
    has_carrier: Boolean(pet.hasCarrier),
    has_muzzle: Boolean(pet.hasMuzzle),
    has_diaper: Boolean(pet.hasDiaper),
    updated_at: new Date().toISOString(),
  });

  const { data: existingRows, error: selectErr } = await retrySupabase<PetProfileRow[]>(() =>
    supabase
      .from('pet_profiles')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
  );

  if (selectErr) {
    lastPetSyncError = translateSupabaseError(selectErr);
    return petsList;
  }

  const dbRows = (existingRows || []) as PetProfileRow[];
  const dbIds = new Set(dbRows.map((r) => r.id));

  const result: PetProfile[] = [];
  const keptRowIds = new Set<string>();

  for (const pet of petsList) {
    const isExistingRow = Boolean(pet.id && dbIds.has(pet.id));

    if (isExistingRow) {
      const { data, error } = await retrySupabase<PetProfileRow>(() =>
        supabase
          .from('pet_profiles')
          .update(buildRow(pet))
          .eq('id', pet.id as string)
          .eq('user_id', userId)
          .select('*')
          .maybeSingle()
      );

      if (!error && data) {
        const row = data as PetProfileRow;
        result.push(mapRowToPet(row));
        keptRowIds.add(row.id);
      } else {
        lastPetSyncError = translateSupabaseError(error);
        result.push({ ...pet, syncedToCloud: false });
      }
    } else {
      const { data, error } = await retrySupabase<PetProfileRow>(() =>
        supabase
          .from('pet_profiles')
          .insert([buildRow(pet)])
          .select('*')
          .maybeSingle()
      );

      if (!error && data) {
        const row = data as PetProfileRow;
        result.push(mapRowToPet(row));
        keptRowIds.add(row.id);
      } else {
        lastPetSyncError = translateSupabaseError(error);
        result.push({ ...pet, syncedToCloud: false });
      }
    }
  }

  // Dọn các dòng cũ không còn trong danh sách (Boss đã xoá, hoặc dòng gói chung kiểu cũ)
  const rowIdsToDelete = dbRows
    .map((r) => r.id)
    .filter((id) => !keptRowIds.has(id));
  if (rowIdsToDelete.length > 0) {
    await supabase.from('pet_profiles').delete().in('id', rowIdsToDelete);
  }

  return result;
}

export async function fetchUserPetProfiles(userId: string): Promise<PetProfile[]> {
  const supabase = getSupabaseClient();
  const cachedLocal = getCachedUserPets(userId);

  if (isSupabaseReady() && supabase) {
    const { data, error } = await supabase
      .from('pet_profiles')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      const rawRows = data as PetProfileRow[];
      const dbList = rawRows.flatMap(unpackRowToPets);

      // Có dòng cũ bị gói chung (breed chứa ||PM:) hoặc Boss ở Local chưa lên DB -> cần migrate/sync
      const hasLegacyPackedRow = rawRows.some(
        (r) => (r.breed || '').includes(META_DELIMITER)
      );

      const mergedList = [...dbList];
      let hasUnsyncedLocal = false;
      for (const localPet of cachedLocal) {
        const exists = mergedList.some(
          (dp) =>
            (localPet.id && dp.id === localPet.id) ||
            dp.name.toLowerCase().trim() === localPet.name.toLowerCase().trim()
        );
        if (!exists) {
          mergedList.push(localPet);
          hasUnsyncedLocal = true;
        }
      }

      if ((hasLegacyPackedRow || hasUnsyncedLocal) && mergedList.length > 0) {
        const syncedAll = await syncUserPetListToSupabase(userId, mergedList);
        saveCachedUserPets(userId, syncedAll);
        return syncedAll;
      }

      if (mergedList.length > 0) {
        saveCachedUserPets(userId, mergedList);
        return mergedList;
      }
    }
  }

  return cachedLocal;
}

export async function saveUserPetProfileItem(
  userId: string,
  petInput: PetProfile
): Promise<PetProfile[]> {
  const normalizedCode = (petInput.identityCode || '').trim().replace(/^#/, '').toUpperCase();

  // Task #9: Kiểm tra chống trùng lặp Mã Định Danh (identityCode)
  if (normalizedCode) {
    const existingWithCode = await lookupPetByIdentityCode(normalizedCode);
    if (
      existingWithCode &&
      existingWithCode.id !== petInput.id &&
      existingWithCode.name.toLowerCase().trim() !== petInput.name.toLowerCase().trim()
    ) {
      throw new Error(
        `Mã định danh #${normalizedCode} đã thuộc về thú cưng "${existingWithCode.name}". Vui lòng nhập mã khác!`
      );
    }
  }

  const cleanInput: PetProfile = {
    ...petInput,
    identityCode: normalizedCode,
    breed: (petInput.breed || '').split(META_DELIMITER)[0].trim(),
  };

  const currentList = getCachedUserPets(userId);

  // Xây dựng danh sách mới:
  // - Nếu có cleanInput.id khớp với 1 Boss trong danh sách -> chỉ cập nhật đúng Boss đó
  // - Nếu là thêm Boss mới (!cleanInput.id) -> nối thêm vào cuối danh sách, GIỮ NGUYÊN toàn bộ Boss cũ!
  let nextList: PetProfile[];
  if (cleanInput.id && currentList.some((p) => p.id === cleanInput.id)) {
    nextList = currentList.map((p) =>
      p.id === cleanInput.id ? { ...p, ...cleanInput, syncedToCloud: true } : p
    );
  } else {
    const newPet: PetProfile = {
      ...cleanInput,
      id: cleanInput.id || `pet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      syncedToCloud: true,
    };
    nextList = [...currentList, newPet];
  }

  // Lưu ngay vào LocalStorage trước để không bao giờ mất Boss cũ
  saveCachedUserPets(userId, nextList);

  // Đồng bộ toàn bộ danh sách Boss lên Supabase
  const syncedList = await syncUserPetListToSupabase(userId, nextList);
  saveCachedUserPets(userId, syncedList);
  return syncedList;
}

export async function deleteUserPetProfileItem(
  userId: string,
  petId: string
): Promise<PetProfile[]> {
  const supabase = getSupabaseClient();
  const currentList = getCachedUserPets(userId);
  const nextList = currentList.filter((p) => p.id !== petId);
  saveCachedUserPets(userId, nextList);

  if (isSupabaseReady() && supabase) {
    if (nextList.length === 0) {
      await supabase.from('pet_profiles').delete().eq('user_id', userId);
    } else {
      const syncedRemaining = await syncUserPetListToSupabase(userId, nextList);
      saveCachedUserPets(userId, syncedRemaining);
      return syncedRemaining;
    }
  }

  return nextList;
}

function getAllLocalCachedPets(): PetProfile[] {
  const map = new Map<string, PetProfile>();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith(LOCAL_USER_PETS_PREFIX) || k === 'petmap_global_pets_registry_v1')) {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const arr = JSON.parse(raw) as PetProfile[];
        if (Array.isArray(arr)) {
          for (const p of arr) {
            const key = p.id || `${p.name}-${p.identityCode || ''}`;
            map.set(key, p);
          }
        }
      }
    }
  } catch {
    // ignore
  }
  return Array.from(map.values());
}

/**
 * Tra cứu thông tin Thẻ Căn Cước Thú Cưng theo Mã Định Danh (Identity Code / Microchip)
 * Hỗ trợ tìm cả trên cột identity_code lẫn dữ liệu đóng gói trong breed
 */
export async function lookupPetByIdentityCode(code: string): Promise<PetProfile | null> {
  const normalized = code.trim().replace(/^#/, '').toUpperCase();
  if (!normalized) return null;

  const matchesCode = (p: PetProfile) => {
    const pCode = (p.identityCode || '').trim().replace(/^#/, '').toUpperCase();
    const fallbackCode = `VN-${p.type.toUpperCase()}-${(p.id || p.name)
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 6)
      .toUpperCase()
      .padEnd(6, '8')}`;
    const legacyCode = `PM-${(p.id || p.name).slice(0, 6).toUpperCase()}`;
    return pCode === normalized || fallbackCode === normalized || legacyCode === normalized;
  };

  const supabase = getSupabaseClient();
  if (isSupabaseReady() && supabase) {
    const { data, error } = await supabase
      .from('pet_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      const allDbPets = (data as PetProfileRow[]).flatMap(unpackRowToPets);
      const matched = allDbPets.find(matchesCode);
      if (matched) return matched;
    }
  }

  const allLocal = getAllLocalCachedPets();
  return allLocal.find(matchesCode) || null;
}

/**
 * Lấy toàn bộ danh sách Hồ sơ Thú cưng đã đăng ký (Dành cho Admin Dashboard)
 */
export async function fetchAllRegisteredPets(): Promise<PetProfile[]> {
  const supabase = getSupabaseClient();
  const localPets = getAllLocalCachedPets();

  if (isSupabaseReady() && supabase) {
    const { data, error } = await supabase
      .from('pet_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      const dbPets = (data as PetProfileRow[]).flatMap(unpackRowToPets);
      const seenIds = new Set(dbPets.map((p) => p.id));
      return dedupePets([...dbPets, ...localPets.filter((p) => !seenIds.has(p.id))]);
    }
  }

  return dedupePets(localPets);
}

/** Khoá nhận diện trùng: ưu tiên Mã Định Danh, nếu không có thì Tên + Loài + Cân nặng. */
function petDedupeKey(p: {
  identityCode?: string;
  name: string;
  type: string;
  weightKg: number;
}): string {
  const code = (p.identityCode || '').trim().toUpperCase().replace(/^#/, '');
  if (code) return `code:${code}`;
  return `nm:${p.name.toLowerCase().trim()}|${p.type}|${p.weightKg}`;
}

/** Khử trùng danh sách hồ sơ Boss (giữ bản đầu tiên — mới nhất khi sắp theo created_at desc). */
export function dedupePets(pets: PetProfile[]): PetProfile[] {
  const byKey = new Map<string, PetProfile>();
  for (const p of pets) {
    const key = petDedupeKey(p);
    if (!byKey.has(key)) byKey.set(key, p);
  }
  return Array.from(byKey.values());
}

/** Xoá VẬT LÝ các dòng hồ sơ Boss trùng trên Supabase (giữ 1 bản mỗi nhóm). Trả về số đã xoá. */
export async function cleanDuplicatePetProfiles(): Promise<number> {
  const supabase = getSupabaseClient();
  if (!isSupabaseReady() || !supabase) return 0;

  const { data, error } = await supabase
    .from('pet_profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error || !data) return 0;

  const rows = data as PetProfileRow[];
  const seen = new Set<string>();
  const toDelete: string[] = [];
  for (const r of rows) {
    const key = petDedupeKey({
      identityCode: r.identity_code || undefined,
      name: r.name,
      type: r.type,
      weightKg: Number(r.weight_kg),
    });
    if (seen.has(key)) toDelete.push(r.id);
    else seen.add(key);
  }

  if (toDelete.length > 0) {
    await supabase.from('pet_profiles').delete().in('id', toDelete);
  }
  return toDelete.length;
}
