import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
  useMapEvents,
  ZoomControl,
} from 'react-leaflet';
import L from 'leaflet';
import {
  Navigation,
  Layers,
  Plus,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Route,
  Star,
  X,
  Maximize,
} from 'lucide-react';
import {
  Place,
  PLACE_CATEGORIES,
  PET_POLICIES,
  PET_CONDITIONS,
} from '../types/place';
import {
  calculateDistanceKm,
  evaluateOpeningStatus,
  getCategoryFallbackImage,
} from '../utils/petCompatibility';
import { fetchRoadRoute, RouteResult } from '../services/routingService';

export type MapTileStyle = 'google_roadmap' | 'google_hybrid';

interface PetMapViewProps {
  places: Place[];
  selectedPlace: Place | null;
  routeTargetPlace: Place | null;
  onSelectPlace: (place: Place) => void;
  onStartRouteOnApp: (place: Place) => void;
  onClearRouteOnApp: () => void;
  mapCenter: { lat: number; lng: number; zoom: number };
  userLocation: { lat: number; lng: number } | null;
  onRequestLocateMe: () => void;
  isPickingLocation: boolean;
  pickedCoords: { lat: number; lng: number } | null;
  onMapPickLocation: (coords: { lat: number; lng: number }) => void;
  onStartAddAtCoords: (coords: { lat: number; lng: number }) => void;
  onCancelPickLocation?: () => void;
}

function createPlaceMarkerIcon(place: Place, isSelected: boolean): L.DivIcon {
  const policyMeta = PET_POLICIES[place.petPolicy];
  const categoryMeta = PLACE_CATEGORIES[place.category];
  const bgColor = policyMeta.markerColor;

  const statusBadgeChar =
    place.petPolicy === 'allowed'
      ? '✓'
      : place.petPolicy === 'conditional'
      ? '!'
      : '✕';

  const scale = isSelected ? 'scale(1.22) translateY(-3px)' : 'scale(1)';
  const zIndex = isSelected ? 1000 : 100;
  const ringStyle = isSelected
    ? `box-shadow: 0 0 0 6px ${bgColor}40, 0 12px 24px -4px rgba(15,23,42,0.42);`
    : 'box-shadow: 0 6px 14px -2px rgba(15,23,42,0.28);';

  const html = `
    <div style="position: relative; width: 44px; height: 52px; display: flex; flex-direction: column; align-items: center; transform: ${scale}; transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1); z-index: ${zIndex};">
      <div style="
        width: 40px;
        height: 40px;
        border-radius: 16px 16px 16px 4px;
        transform: rotate(-45deg);
        background: linear-gradient(135deg, ${bgColor} 0%, ${bgColor}dd 100%);
        border: 2.5px solid #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        ${ringStyle}
      ">
        <span style="transform: rotate(45deg); font-size: 18px; line-height: 1; user-select: none; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.15));">
          ${categoryMeta.emoji}
        </span>
      </div>
      <div style="
        position: absolute;
        top: -3px;
        right: -1px;
        width: 18px;
        height: 18px;
        border-radius: 9999px;
        background: #0f172a;
        color: #ffffff;
        border: 2px solid #ffffff;
        font-size: 10px;
        font-weight: 900;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.25);
      ">${statusBadgeChar}</div>
    </div>
  `;

  return L.divIcon({
    className: 'petmap-custom-pin',
    html,
    iconSize: [44, 52],
    iconAnchor: [22, 46],
    popupAnchor: [0, -42],
  });
}

const pickedLocationIcon = L.divIcon({
  className: 'petmap-picked-pin',
  html: `
    <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 40px; height: 40px; border-radius: 9999px; background: rgba(79, 70, 229, 0.25); animation: ping 1.4s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="width: 32px; height: 32px; border-radius: 9999px; background: #4f46e5; border: 3px solid white; color: white; font-weight: bold; font-size: 18px; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 14px rgba(79, 70, 229, 0.45);">
        +
      </div>
    </div>
  `,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

const userGpsIcon = L.divIcon({
  className: 'petmap-gps-pin',
  html: `
    <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 24px; height: 24px; border-radius: 9999px; background: rgba(59, 130, 246, 0.3);"></div>
      <div style="width: 12px; height: 12px; border-radius: 9999px; background: #2563eb; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const MapViewportController: React.FC<{
  center: { lat: number; lng: number; zoom: number };
  selectedPlace: Place | null;
  routeCoordinates: [number, number][] | null;
  fitToken: number;
  fitPlaces: Place[];
}> = ({ center, selectedPlace, routeCoordinates, fitToken, fitPlaces }) => {
  const map = useMap();
  const prevCenterKey = useRef<string>('');
  const prevPlaceId = useRef<string | null>(null);

  // Task #14: Thu toàn bộ địa điểm đang lọc vào khung nhìn
  useEffect(() => {
    if (fitToken > 0 && fitPlaces.length > 0) {
      const bounds = L.latLngBounds(fitPlaces.map((p) => [p.lat, p.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16, animate: true });
    }
  }, [fitToken, fitPlaces, map]);

  useEffect(() => {
    if (routeCoordinates && routeCoordinates.length >= 2) {
      const bounds = L.latLngBounds(routeCoordinates);
      map.fitBounds(bounds, {
        paddingTopLeft: [50, 90],
        paddingBottomRight: [50, 120],
        maxZoom: 16,
        animate: true,
      });
    }
  }, [routeCoordinates, map]);

  // Task #12: Tránh gọi flyTo chồng nhau khi chọn quán vs đổi khu vực
  useEffect(() => {
    if (selectedPlace && selectedPlace.id !== prevPlaceId.current) {
      prevPlaceId.current = selectedPlace.id;
      if (!routeCoordinates || routeCoordinates.length === 0) {
        map.flyTo([selectedPlace.lat, selectedPlace.lng], Math.max(map.getZoom(), 16), {
          duration: 0.65,
        });
      }
    } else if (!selectedPlace) {
      prevPlaceId.current = null;
    }
  }, [selectedPlace, routeCoordinates, map]);

  useEffect(() => {
    const key = `${center.lat.toFixed(5)},${center.lng.toFixed(5)},${center.zoom}`;
    if (key !== prevCenterKey.current) {
      prevCenterKey.current = key;
      map.flyTo([center.lat, center.lng], center.zoom, {
        duration: 0.75,
      });
    }
  }, [center.lat, center.lng, center.zoom, map]);

  return null;
};

const MapClickListener: React.FC<{
  isPickingLocation: boolean;
  onMapPickLocation: (coords: { lat: number; lng: number }) => void;
}> = ({ isPickingLocation, onMapPickLocation }) => {
  useMapEvents({
    click(e) {
      if (isPickingLocation) {
        onMapPickLocation({
          lat: Number(e.latlng.lat.toFixed(6)),
          lng: Number(e.latlng.lng.toFixed(6)),
        });
      }
    },
  });
  return null;
};

// Task #1: Gom cụm marker khi zoom xa (grid theo pixel). Dưới zoom 15 mới gom.
const CLUSTER_CELL_PX = 72;

function createClusterIcon(count: number): L.DivIcon {
  const size = count < 10 ? 38 : count < 50 ? 46 : 54;
  const html = `
    <div style="width:${size}px;height:${size}px;border-radius:9999px;background:linear-gradient(135deg,#059669,#0d9488);border:3px solid #ffffff;color:#ffffff;font-weight:900;font-size:${count < 100 ? 14 : 12}px;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 16px -2px rgba(15,23,42,0.4);">${count}</div>`;
  return L.divIcon({
    className: 'petmap-cluster',
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const ClusterLayer: React.FC<{
  places: Place[];
  selectedId: string | null;
  onClustered: (ids: Set<string>) => void;
  onSelectPlace: (place: Place) => void;
}> = ({ places, selectedId, onClustered, onSelectPlace }) => {
  const map = useMap();
  const [tick, setTick] = useState(0);
  useMapEvents({
    zoomend: () => setTick((t) => t + 1),
    moveend: () => setTick((t) => t + 1),
  });

  const clusters = useMemo(() => {
    const zoom = map.getZoom();
    if (places.length < 2) return [];
    const buckets = new Map<string, Place[]>();
    for (const p of places) {
      if (p.id === selectedId) continue;
      const pt = map.project([p.lat, p.lng], zoom);
      const key = `${Math.floor(pt.x / CLUSTER_CELL_PX)}_${Math.floor(pt.y / CLUSTER_CELL_PX)}`;
      const arr = buckets.get(key);
      if (arr) arr.push(p);
      else buckets.set(key, [p]);
    }
    const out: { lat: number; lng: number; items: Place[] }[] = [];
    buckets.forEach((items) => {
      if (items.length > 1) {
        const lat = items.reduce((s, p) => s + p.lat, 0) / items.length;
        const lng = items.reduce((s, p) => s + p.lng, 0) / items.length;
        out.push({ lat, lng, items });
      }
    });
    return out;
    // tick buộc tính lại cụm mỗi khi zoom/di chuyển bản đồ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, places, selectedId, tick]);

  useEffect(() => {
    const ids = new Set<string>();
    clusters.forEach((c) => c.items.forEach((p) => ids.add(p.id)));
    onClustered(ids);
  }, [clusters, onClustered]);

  const zoomToCluster = (items: Place[]) => {
    const bounds = L.latLngBounds(items.map((p) => [p.lat, p.lng] as [number, number]));
    map.flyToBounds(bounds, { padding: [70, 70], maxZoom: 18 });
  };

  return (
    <>
      {clusters.map((c, i) => (
        <Marker
          key={`cluster-${i}-${c.items.length}`}
          position={[c.lat, c.lng]}
          icon={createClusterIcon(c.items.length)}
        >
          <Popup closeButton={false} className="petmap-popup">
            <div className="w-60">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
                <span className="text-xs font-extrabold text-slate-900">
                  {c.items.length} địa điểm tại đây
                </span>
                <button
                  onClick={() => zoomToCluster(c.items)}
                  className="rounded-lg bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-emerald-500"
                >
                  Phóng to
                </button>
              </div>
              <div className="mt-1 max-h-48 overflow-y-auto divide-y divide-slate-50">
                {c.items.map((p) => {
                  const cat = PLACE_CATEGORIES[p.category];
                  const pol = PET_POLICIES[p.petPolicy];
                  return (
                    <button
                      key={p.id}
                      onClick={() => onSelectPlace(p)}
                      className="flex w-full items-center gap-2 py-1.5 text-left hover:bg-slate-50"
                    >
                      <span className="text-base leading-none">{cat.emoji}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-slate-800">
                          {p.name}
                        </span>
                        <span className={`text-[10px] font-semibold ${pol.badgeText}`}>
                          {pol.shortLabel}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
};

export const PetMapView: React.FC<PetMapViewProps> = ({
  places,
  selectedPlace,
  routeTargetPlace,
  onSelectPlace,
  onStartRouteOnApp,
  onClearRouteOnApp,
  mapCenter,
  userLocation,
  onRequestLocateMe,
  isPickingLocation,
  pickedCoords,
  onMapPickLocation,
  onStartAddAtCoords,
  onCancelPickLocation,
}) => {
  const [mapStyle, setMapStyle] = useState<MapTileStyle>('google_roadmap');
  const [activeViewport, setActiveViewport] = useState(mapCenter);
  const [roadRoute, setRoadRoute] = useState<RouteResult | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [fitToken, setFitToken] = useState(0);
  const [clusteredIds, setClusteredIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setActiveViewport(mapCenter);
  }, [mapCenter]);

  // Task #13: Nhấn phím Escape để thoát chế độ chấm toạ độ trên bản đồ
  useEffect(() => {
    if (!isPickingLocation || !onCancelPickLocation) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancelPickLocation();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPickingLocation, onCancelPickLocation]);

  // Chỉ vẽ đường trên webapp khi user chủ động bấm nút "Chỉ đường" (routeTargetPlace != null)
  useEffect(() => {
    let cancelled = false;
    if (!userLocation || !routeTargetPlace) {
      setRoadRoute(null);
      return;
    }

    setLoadingRoute(true);
    fetchRoadRoute(
      userLocation.lat,
      userLocation.lng,
      routeTargetPlace.lat,
      routeTargetPlace.lng
    ).then((res) => {
      if (!cancelled) {
        setRoadRoute(res);
        setLoadingRoute(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [userLocation, routeTargetPlace]);

  const cycleMapStyle = () => {
    setMapStyle((prev) => (prev === 'google_roadmap' ? 'google_hybrid' : 'google_roadmap'));
  };

  const mapStyleLabel = mapStyle === 'google_roadmap' ? 'Google Maps' : 'Vệ tinh';

  const distanceToRouteTargetKm = roadRoute
    ? roadRoute.distanceKm
    : userLocation && routeTargetPlace
    ? calculateDistanceKm(
        userLocation.lat,
        userLocation.lng,
        routeTargetPlace.lat,
        routeTargetPlace.lng
      )
    : null;

  return (
    <div className="relative h-full w-full select-none overflow-hidden">
      {/* Banner hướng dẫn khi đang ở chế độ chấm điểm trên bản đồ (Task #13) */}
      {isPickingLocation && (
        <div className="pointer-events-none absolute top-28 sm:top-4 left-1/2 z-[950] w-[92%] max-w-md -translate-x-1/2">
          <div className="pointer-events-auto flex items-center justify-between gap-2.5 rounded-2xl border border-indigo-300/60 bg-indigo-950/95 px-3.5 py-2.5 text-white shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold">
                📍
              </span>
              <div className="text-xs leading-snug">
                <span className="font-bold block">Chạm vào bản đồ để đặt ghim</span>
                <span className="text-indigo-200 text-[11px]">
                  {pickedCoords
                    ? `${pickedCoords.lat.toFixed(4)}, ${pickedCoords.lng.toFixed(4)}`
                    : 'Chọn vị trí quán muốn thêm (Nhấn Esc để huỷ)'}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {pickedCoords && (
                <button
                  onClick={() => onStartAddAtCoords(pickedCoords)}
                  className="inline-flex items-center gap-1 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-400 active:scale-95 transition cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Tiếp tục</span>
                </button>
              )}
              {onCancelPickLocation && (
                <button
                  onClick={onCancelPickLocation}
                  title="Huỷ chế độ chấm điểm (Esc)"
                  className="inline-flex items-center gap-1 rounded-xl border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Huỷ</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Map Floating Action Buttons (Right Edge — Mobile-friendly thumb zone) */}
      <div className="absolute right-3 bottom-44 sm:top-4 sm:bottom-auto sm:right-4 z-[850] flex flex-col items-end gap-2">
        {userLocation && routeTargetPlace && (
          <div className="flex items-center gap-1.5 rounded-2xl border border-blue-500 bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-lg backdrop-blur-md">
            <Route className="h-4 w-4 shrink-0" />
            <span className="max-w-[160px] sm:max-w-[220px] truncate">
              {loadingRoute
                ? 'Đang vẽ đường...'
                : `${routeTargetPlace.name}: ${distanceToRouteTargetKm} km${
                    roadRoute ? ` • ${roadRoute.durationMinutes} phút` : ''
                  }`}
            </span>
            <button
              onClick={onClearRouteOnApp}
              title="Tắt chỉ đường trên bản đồ"
              className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] hover:bg-white/30 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        <button
          onClick={onRequestLocateMe}
          title="Định vị vị trí của tôi"
          className={`flex h-11 w-11 sm:h-auto sm:w-auto items-center justify-center sm:gap-1.5 rounded-2xl border sm:px-3.5 sm:py-2.5 text-xs font-bold shadow-lg backdrop-blur-md transition active:scale-95 cursor-pointer ${
            userLocation
              ? 'border-blue-500 bg-blue-600 text-white ring-4 ring-blue-500/20'
              : 'border-slate-200/90 bg-white/95 text-slate-700 hover:bg-white hover:text-blue-600'
          }`}
        >
          <Navigation className="h-4 w-4" />
          <span className="hidden sm:inline">
            {userLocation ? 'Đã định vị' : 'Vị trí của tôi'}
          </span>
        </button>

        <button
          onClick={cycleMapStyle}
          title="Đổi lớp bản đồ (Google Maps / Vệ tinh)"
          className="flex h-11 w-11 sm:h-auto sm:w-auto items-center justify-center sm:gap-1.5 rounded-2xl border border-slate-200/90 bg-white/95 sm:px-3.5 sm:py-2.5 text-xs font-bold text-slate-700 shadow-lg backdrop-blur-md hover:bg-white hover:text-indigo-600 transition active:scale-95 cursor-pointer"
        >
          <Layers className="h-4 w-4 text-indigo-600" />
          <span className="hidden sm:inline">{mapStyleLabel}</span>
        </button>

        {places.length > 1 && (
          <button
            onClick={() => setFitToken((t) => t + 1)}
            title="Thu toàn bộ địa điểm vào khung nhìn"
            aria-label="Thu toàn bộ địa điểm vào khung nhìn"
            className="flex h-11 w-11 sm:h-auto sm:w-auto items-center justify-center sm:gap-1.5 rounded-2xl border border-slate-200/90 bg-white/95 sm:px-3.5 sm:py-2.5 text-xs font-bold text-slate-700 shadow-lg backdrop-blur-md hover:bg-white hover:text-emerald-600 transition active:scale-95 cursor-pointer"
          >
            <Maximize className="h-4 w-4 text-emerald-600" />
            <span className="hidden sm:inline">Thu gọn</span>
          </button>
        )}
      </div>

      {/* Floating Legend (Desktop Bottom Left) */}
      <div className="pointer-events-auto absolute bottom-5 left-4 z-[850] hidden lg:flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white/95 px-3.5 py-2 shadow-lg backdrop-blur-md">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Chú thích:
        </span>
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
          <span>Cho Pet (✓)</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-amber-200" />
          <span>Có điều kiện (!)</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-rose-200" />
          <span>Cấm Pet (✕)</span>
        </div>
      </div>

      <MapContainer
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={mapCenter.zoom}
        zoomControl={false}
        zoomSnap={0.25}
        zoomDelta={0.5}
        wheelPxPerZoomLevel={120}
        wheelDebounceTime={30}
        zoomAnimation={true}
        markerZoomAnimation={true}
        className={`h-full w-full ${isPickingLocation ? 'cursor-crosshair' : ''}`}
      >
        <ZoomControl position="bottomright" />
        <MapViewportController
          center={activeViewport}
          selectedPlace={selectedPlace}
          routeCoordinates={roadRoute?.coordinates || null}
          fitToken={fitToken}
          fitPlaces={places}
        />
        <MapClickListener
          isPickingLocation={isPickingLocation}
          onMapPickLocation={onMapPickLocation}
        />

        <ClusterLayer
          places={places}
          selectedId={selectedPlace?.id ?? null}
          onClustered={setClusteredIds}
          onSelectPlace={onSelectPlace}
        />

        {mapStyle === 'google_roadmap' ? (
          <TileLayer
            attribution='&copy; Google Maps'
            url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=vi"
          />
        ) : (
          <TileLayer
            attribution='&copy; Google Maps Satellite'
            url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=vi"
          />
        )}

        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userGpsIcon}>
            <Popup>
              <div className="text-xs font-semibold text-slate-800">
                📍 Vị trí của bạn ({userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)})
              </div>
            </Popup>
          </Marker>
        )}

        {userLocation && routeTargetPlace && roadRoute && (
          <>
            {/* Lớp viền ngoài (Google Maps Route Casing) */}
            <Polyline
              positions={roadRoute.coordinates}
              pathOptions={{
                color: '#1d4ed8',
                weight: 9,
                opacity: 0.45,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            {/* Lớp lõi đường dẫn chính màu xanh Google Maps */}
            <Polyline
              positions={roadRoute.coordinates}
              pathOptions={{
                color: '#3b82f6',
                weight: 5,
                opacity: 0.98,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </>
        )}

        {pickedCoords && (
          <Marker position={[pickedCoords.lat, pickedCoords.lng]} icon={pickedLocationIcon}>
            <Popup>
              <div className="p-1 text-center">
                <p className="text-xs font-semibold text-slate-800">Vị trí đã chọn</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {pickedCoords.lat.toFixed(5)}, {pickedCoords.lng.toFixed(5)}
                </p>
                <button
                  onClick={() => onStartAddAtCoords(pickedCoords)}
                  className="mt-2 w-full rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-500 cursor-pointer"
                >
                  + Thêm địa điểm tại đây
                </button>
              </div>
            </Popup>
          </Marker>
        )}

        {places.map((place) => {
          if (clusteredIds.has(place.id)) return null;
          const isSelected = selectedPlace?.id === place.id;
          const policyMeta = PET_POLICIES[place.petPolicy];
          const categoryMeta = PLACE_CATEGORIES[place.category];
          const openStatus = evaluateOpeningStatus(place.openingHours);
          const fallbackImg = getCategoryFallbackImage(place.category);

          return (
            <Marker
              key={place.id}
              position={[place.lat, place.lng]}
              icon={createPlaceMarkerIcon(place, isSelected)}
              eventHandlers={{
                click: () => onSelectPlace(place),
              }}
            >
              <Popup closeButton={false} className="petmap-popup">
                <div className="w-68 overflow-hidden rounded-2xl bg-white">
                  {/* Cover Hero inside Popup */}
                  <div className="relative h-28 w-full overflow-hidden bg-slate-100 rounded-xl">
                    <img
                      src={place.imageUrl || fallbackImg}
                      alt={place.name}
                      loading="lazy"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (target.src !== fallbackImg) {
                          target.src = fallbackImg;
                        }
                      }}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-slate-950/20" />
                    <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-white/95 px-2 py-0.5 text-[10px] font-bold text-slate-800 shadow-2xs">
                        <span>{categoryMeta.emoji}</span>
                        <span>{categoryMeta.shortLabel}</span>
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold shadow-2xs ${policyMeta.badgeBg} ${policyMeta.badgeText} ${policyMeta.badgeBorder}`}
                      >
                        {place.petPolicy === 'allowed' && <CheckCircle2 className="h-3 w-3" />}
                        {place.petPolicy === 'conditional' && <AlertTriangle className="h-3 w-3" />}
                        {place.petPolicy === 'not_allowed' && <XCircle className="h-3 w-3" />}
                        {policyMeta.shortLabel}
                      </span>
                    </div>
                    <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-white">
                      {openStatus ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-900/75 px-1.5 py-0.5 text-[10px] font-semibold backdrop-blur-xs">
                          <span className={`h-1.5 w-1.5 rounded-full ${openStatus.dotClass}`} />
                          <span>{openStatus.shortLabel}</span>
                        </span>
                      ) : (
                        <span />
                      )}
                      {place.rating && (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-400/90 px-1.5 py-0.5 text-[10px] font-extrabold text-slate-950">
                          <Star className="h-2.5 w-2.5 fill-slate-950" />
                          {place.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2.5 px-0.5">
                    <h3 className="text-sm font-extrabold text-slate-900 leading-snug line-clamp-1">
                      {place.name}
                    </h3>
                    <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-1">
                      {place.address}
                    </p>

                    {place.petConditions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {place.petConditions.slice(0, 2).map((cid) => (
                          <span
                            key={cid}
                            className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700"
                          >
                            {PET_CONDITIONS[cid]?.label}
                          </span>
                        ))}
                        {place.petConditions.length > 2 && (
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                            +{place.petConditions.length - 2}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="mt-2.5 flex items-center gap-1.5">
                      <button
                        onClick={() => onStartRouteOnApp(place)}
                        className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-blue-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-blue-500 transition cursor-pointer"
                      >
                        <Route className="h-3.5 w-3.5" />
                        <span>Chỉ đường</span>
                      </button>
                      <button
                        onClick={() => onSelectPlace(place)}
                        className="flex-1 rounded-xl bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition cursor-pointer"
                      >
                        Chi tiết
                      </button>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Chỉ đường bằng Google Maps"
                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 p-1.5 text-slate-700 hover:bg-slate-100"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};
