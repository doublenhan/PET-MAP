// Bộ sưu tập địa điểm (Collections) — lưu cục bộ trên trình duyệt (localStorage).
// Mỗi bộ sưu tập là 1 danh sách đặt tên (vd "Quán cà phê yêu thích", "Công viên").

export interface PlaceCollection {
  id: string;
  name: string;
  placeIds: string[];
  createdAt: string;
}

const COLLECTIONS_KEY = 'petmap_collections_v1';

export function getCollections(): PlaceCollection[] {
  try {
    const raw = localStorage.getItem(COLLECTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PlaceCollection[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(list: PlaceCollection[]): PlaceCollection[] {
  try {
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(list));
  } catch {
    // ignore quota errors
  }
  return list;
}

export function createCollection(name: string): PlaceCollection[] {
  const trimmed = name.trim();
  if (!trimmed) return getCollections();
  const list = getCollections();
  const item: PlaceCollection = {
    id: `col_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: trimmed,
    placeIds: [],
    createdAt: new Date().toISOString(),
  };
  return persist([item, ...list]);
}

export function renameCollection(id: string, name: string): PlaceCollection[] {
  const trimmed = name.trim();
  if (!trimmed) return getCollections();
  return persist(getCollections().map((c) => (c.id === id ? { ...c, name: trimmed } : c)));
}

export function deleteCollection(id: string): PlaceCollection[] {
  return persist(getCollections().filter((c) => c.id !== id));
}

/** Bật/tắt một địa điểm trong bộ sưu tập (thêm nếu chưa có, bỏ nếu đã có). */
export function togglePlaceInCollection(collectionId: string, placeId: string): PlaceCollection[] {
  return persist(
    getCollections().map((c) => {
      if (c.id !== collectionId) return c;
      const has = c.placeIds.includes(placeId);
      return {
        ...c,
        placeIds: has ? c.placeIds.filter((p) => p !== placeId) : [...c.placeIds, placeId],
      };
    })
  );
}
