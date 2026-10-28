export interface RouteResult {
  /** Danh sách toạ độ [lat, lng] bám sát từng ngã rẽ trên đường phố thực tế */
  coordinates: [number, number][];
  /** Tổng quãng đường di chuyển thực tế (km) */
  distanceKm: number;
  /** Thời gian di chuyển ước tính (phút) */
  durationMinutes: number;
  /** Các bước rẽ chính trên lộ trình */
  steps: {
    instruction: string;
    streetName: string;
    distanceMeters: number;
  }[];
  isRealRoad: boolean;
}

interface OsrmStep {
  name?: string;
  distance: number;
  maneuver?: {
    type?: string;
    modifier?: string;
  };
}

interface OsrmResponse {
  code: string;
  routes?: {
    distance: number;
    duration: number;
    geometry: {
      coordinates: [number, number][];
    };
    legs?: {
      steps?: OsrmStep[];
    }[];
  }[];
}

function formatManeuverVi(type?: string, modifier?: string, streetName?: string): string {
  const road = streetName ? ` vào ${streetName}` : '';
  if (type === 'depart') return `Xuất phát${road}`;
  if (type === 'arrive') return 'Đến điểm đích';
  if (modifier?.includes('left')) return `Rẽ trái${road}`;
  if (modifier?.includes('right')) return `Rẽ phải${road}`;
  if (modifier === 'uturn') return `Quay đầu${road}`;
  return `Đi thẳng${road}`;
}

/**
 * Lấy đường dẫn thực tế theo làn đường (Turn-by-turn road geometry) từ OSRM.
 * Nếu mạng lỗi sẽ tự động fallback về đường nối thẳng để không bao giờ bị mất đường dẫn.
 */
export async function fetchRoadRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<RouteResult> {
  const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&steps=true`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = (await res.json()) as OsrmResponse;
      const route = data.routes?.[0];
      if (route && route.geometry?.coordinates?.length > 0) {
        const latLngs: [number, number][] = route.geometry.coordinates.map(
          ([lng, lat]) => [lat, lng]
        );

        const rawSteps = route.legs?.[0]?.steps || [];
        const steps = rawSteps
          .filter((s) => s.distance > 15 || s.maneuver?.type === 'arrive')
          .map((s) => ({
            instruction: formatManeuverVi(s.maneuver?.type, s.maneuver?.modifier, s.name),
            streetName: s.name || '',
            distanceMeters: Math.round(s.distance),
          }));

        return {
          coordinates: latLngs,
          distanceKm: Number((route.distance / 1000).toFixed(1)),
          durationMinutes: Math.max(1, Math.round(route.duration / 60)),
          steps,
          isRealRoad: true,
        };
      }
    }
  } catch {
    clearTimeout(timer);
  }

  // Fallback nếu không gọi được server định tuyến
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(toLat - fromLat);
  const dLng = toRad(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.sin(dLng / 2) ** 2;
  const straightKm = Number((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));

  return {
    coordinates: [
      [fromLat, fromLng],
      [toLat, toLng],
    ],
    distanceKm: straightKm,
    durationMinutes: Math.max(2, Math.round(straightKm * 3)),
    steps: [],
    isRealRoad: false,
  };
}
