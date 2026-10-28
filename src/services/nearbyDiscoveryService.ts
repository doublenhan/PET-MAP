import { Place, PlaceCategory, PetConditionId, PetPolicyStatus, DISTRICT_COORDINATES } from '../types/place';
import { calculateDistanceKm } from '../utils/petCompatibility';

interface OverpassElement {
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/**
 * Tìm quận gần nhất tại TP.HCM dựa trên toạ độ lat/lng
 */
export function inferNearestHcmcDistrict(lat: number, lng: number): string {
  let bestDistrict = 'Quận 1';
  let minDistance = Infinity;

  for (const [districtName, coords] of Object.entries(DISTRICT_COORDINATES)) {
    if (districtName === 'Tất cả khu vực') continue;
    const dist = calculateDistanceKm(lat, lng, coords.lat, coords.lng);
    if (dist < minDistance) {
      minDistance = dist;
      bestDistrict = districtName;
    }
  }

  return bestDistrict;
}

/**
 * Tự động quét các quán Cafe, Nhà hàng, Pet Shop, Công viên thực tế quanh toạ độ GPS của người dùng
 * qua Overpass API (OpenStreetMap).
 */
export async function discoverNearbyOsmPlaces(
  lat: number,
  lng: number,
  radiusMeters = 1500
): Promise<Place[]> {
  const query = `[out:json][timeout:6];(node["amenity"~"cafe|restaurant"](around:${radiusMeters},${lat},${lng});node["shop"~"pet|mall"](around:${radiusMeters},${lat},${lng});node["leisure"="park"](around:${radiusMeters},${lat},${lng}););out body 25;`;

  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];

  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) continue;
      const data = (await res.json()) as { elements?: OverpassElement[] };
      if (!data.elements || data.elements.length === 0) continue;

      const discovered: Place[] = [];

      for (const el of data.elements) {
        const name = el.tags?.name || el.tags?.['name:vi'];
        const elLat = el.lat ?? el.center?.lat;
        const elLng = el.lon ?? el.center?.lon;
        if (!name || elLat === undefined || elLng === undefined) continue;

        const amenity = el.tags?.amenity || '';
        const shop = el.tags?.shop || '';
        const leisure = el.tags?.leisure || '';

        let category: PlaceCategory = 'cafe';
        if (amenity === 'restaurant') category = 'restaurant';
        else if (shop === 'pet') category = 'vet_spa';
        else if (shop === 'mall') category = 'store';
        else if (leisure === 'park') category = 'park';

        // Xác định chính sách Pet từ tag OSM hoặc suy luận theo loại hình
        const dogTag = el.tags?.dog;
        let petPolicy: PetPolicyStatus = 'conditional';
        let petConditions: PetConditionId[] = ['leash_required', 'outdoor_only'];
        let notes =
          'Địa điểm thực tế quét quanh vị trí của bạn. Hãy hỏi nhân viên khu vực ngồi ngoài trời hoặc cập nhật chính sách Pet giúp cộng đồng!';

        if (dogTag === 'yes' || shop === 'pet' || leisure === 'park') {
          petPolicy = 'allowed';
          petConditions =
            leisure === 'park'
              ? ['leash_required', 'pet_playground']
              : ['leash_required', 'ac_indoor_allowed'];
          notes =
            shop === 'pet'
              ? 'Cửa hàng / dịch vụ thú cưng quanh vị trí của bạn — chào đón các bé cún và mèo.'
              : 'Địa điểm thân thiện với thú cưng quanh vị trí của bạn.';
        } else if (dogTag === 'no') {
          petPolicy = 'not_allowed';
          petConditions = [];
          notes = 'Địa điểm này có ghi chú hạn chế thú cưng.';
        }

        const street = el.tags?.['addr:street'] || '';
        const houseNumber = el.tags?.['addr:housenumber'] || '';
        const district =
          el.tags?.['addr:district'] || inferNearestHcmcDistrict(elLat, elLng);
        const address =
          [houseNumber, street].filter(Boolean).join(' ') ||
          `Khu vực ${district} (Cách bạn ${calculateDistanceKm(lat, lng, elLat, elLng)} km)`;

        discovered.push({
          id: `osm-${el.id}`,
          name,
          category,
          address,
          district,
          lat: elLat,
          lng: elLng,
          petPolicy,
          petConditions,
          petPolicyNotes: notes,
          allowedPetTypes: petPolicy === 'not_allowed' ? [] : ['dog', 'cat'],
          maxWeightKg: petPolicy === 'conditional' ? 12 : null,
          googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            `${name} ${district}`
          )}`,
          websiteUrl: el.tags?.website || '',
          phone: el.tags?.phone || '',
          openingHours: el.tags?.opening_hours || '08:00 - 22:00',
          imageUrl: '',
          rating: 4.6,
          reviewCount: 1,
          verified: false,
        });
      }

      if (discovered.length > 0) {
        return discovered;
      }
    } catch {
      clearTimeout(timer);
    }
  }

  return [];
}
