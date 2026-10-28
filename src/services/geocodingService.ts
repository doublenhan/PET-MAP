import { GeocodingSuggestion, HCMC_DISTRICTS } from '../types/place';

interface NominatimItem {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    road?: string;
    house_number?: string;
    suburb?: string;
    quarter?: string;
    city_district?: string;
    county?: string;
    city?: string;
  };
}

function inferHcmcDistrict(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('thảo điền') || lower.includes('thao dien')) {
    return 'Thảo Điền (TP. Thủ Đức)';
  }
  if (lower.includes('an phú') || lower.includes('an phu') || lower.includes('quận 2')) {
    return 'Quận 2 (An Phú)';
  }
  if (lower.includes('quận 10') || lower.includes('district 10')) {
    return 'Quận 10';
  }
  if (lower.includes('quận 1') || lower.includes('district 1') || lower.includes('bến nghé') || lower.includes('bến thành')) {
    return 'Quận 1';
  }
  if (lower.includes('quận 3') || lower.includes('district 3') || lower.includes('võ thị sáu')) {
    return 'Quận 3';
  }
  if (lower.includes('quận 7') || lower.includes('district 7') || lower.includes('phú mỹ hưng') || lower.includes('tân phú') || lower.includes('tân quy')) {
    return 'Quận 7 (Phú Mỹ Hưng)';
  }
  if (lower.includes('bình thạnh') || lower.includes('binh thanh')) {
    return 'Bình Thạnh';
  }
  if (lower.includes('phú nhuận') || lower.includes('phu nhuan')) {
    return 'Phú Nhuận';
  }
  return HCMC_DISTRICTS[1];
}

export async function searchAddressInHcmc(query: string): Promise<GeocodingSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const searchQuery = trimmed.toLowerCase().includes('hồ chí minh') || trimmed.toLowerCase().includes('tphcm')
    ? trimmed
    : `${trimmed}, Hồ Chí Minh, Việt Nam`;

  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=vn&q=${encodeURIComponent(
    searchQuery
  )}`;

  try {
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'vi',
      },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as NominatimItem[];

    return data.map((item) => {
      const parts = item.display_name.split(',').map((s) => s.trim());
      const shortAddress = parts.slice(0, 3).join(', ');
      return {
        displayName: item.display_name,
        shortAddress,
        district: inferHcmcDistrict(item.display_name),
        lat: Number(parseFloat(item.lat).toFixed(6)),
        lng: Number(parseFloat(item.lon).toFixed(6)),
      };
    });
  } catch {
    return [];
  }
}

export async function reverseGeocodeCoords(
  lat: number,
  lng: number
): Promise<GeocodingSuggestion | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${lat}&lon=${lng}`;
  try {
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'vi',
      },
    });
    if (!res.ok) return null;
    const item = (await res.json()) as NominatimItem;
    if (!item || !item.display_name) return null;

    const parts = item.display_name.split(',').map((s) => s.trim());
    return {
      displayName: item.display_name,
      shortAddress: parts.slice(0, 3).join(', '),
      district: inferHcmcDistrict(item.display_name),
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
    };
  } catch {
    return null;
  }
}
