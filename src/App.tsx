import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import {
  Search,
  Plus,
  MapPin,
  SlidersHorizontal,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  PawPrint,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  X,
  Heart,
  Navigation,
  LogIn,
  LogOut,
  Compass,
  Route,
  Siren,
  Phone,
  ShieldCheck,
  QrCode,
  Star,
  RotateCw,
  Sparkles,
} from 'lucide-react';
import {
  Place,
  PlaceCategory,
  PetPolicyStatus,
  PetConditionId,
  PetProfile,
  PLACE_CATEGORIES,
  PET_POLICIES,
  PET_CONDITIONS,
  HCMC_DISTRICTS,
  DISTRICT_COORDINATES,
} from './types/place';
import {
  fetchPlaces,
  createPlace,
  updatePlacePolicy,
  updatePlaceFull,
  seedInitialPlacesToSupabase,
  resetLocalPlacesToDefault,
  getSavedPlaceIds,
  toggleSavedPlaceId,
  approvePlaceById,
  deletePlaceById,
  dedupePlaces,
} from './services/placeService';
import {
  PlaceCollection,
  getCollections,
  createCollection,
  deleteCollection,
  togglePlaceInCollection,
} from './services/collectionService';
import {
  evaluatePetCompatibility,
  calculateDistanceKm,
  normalizeSearchText,
  evaluateOpeningStatus,
  getCategoryFallbackImage,
} from './utils/petCompatibility';
import {
  AuthUser,
  getCurrentUser,
  signOutUser,
  fetchUserPetProfiles,
  saveUserPetProfileItem,
  deleteUserPetProfileItem,
} from './services/authPetService';
import {
  discoverNearbyOsmPlaces,
  inferNearestHcmcDistrict,
} from './services/nearbyDiscoveryService';
import { PetMapView } from './components/PetMapView';
import { PlaceDetailSheet } from './components/PlaceDetailSheet';
import { AddPlaceModal } from './components/AddPlaceModal';
import { ConditionBadge } from './components/ConditionBadge';
import { PetProfileModal } from './components/PetProfileModal';
import { AuthModal } from './components/AuthModal';
import { CheckInModal } from './components/CheckInModal';
import { ActivityFeedModal } from './components/ActivityFeedModal';
import { OnboardingModal } from './components/OnboardingModal';
import { fetchRecentCheckins } from './services/checkinService';
import { CheckIn } from './types/place';

// Lazy-load trang Admin (route /admin ít truy cập) để giảm JS tải ban đầu
const AdminPortalPage = lazy(() =>
  import('./components/AdminPortalPage').then((m) => ({ default: m.AdminPortalPage }))
);

export function App() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [dataSource, setDataSource] = useState<'supabase' | 'local'>('local');

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('Tất cả khu vực');
  const [selectedCategory, setSelectedCategory] = useState<PlaceCategory | 'all'>('all');
  const [selectedPolicy, setSelectedPolicy] = useState<PetPolicyStatus | 'all'>('all');
  const [selectedConditions, setSelectedConditions] = useState<PetConditionId[]>([]);
  const [showConditionFilters, setShowConditionFilters] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>(() => getSavedPlaceIds());
  const [onlySavedFilter, setOnlySavedFilter] = useState(false);
  const [onlyOpenNow, setOnlyOpenNow] = useState(false);
  const [sortMode, setSortMode] = useState<'default' | 'rating' | 'newest' | 'nearest' | 'hot'>(
    'default'
  );
  // Số lượt check-in theo địa điểm (dùng cho "Quán hot" + badge)
  const [checkinCounts, setCheckinCounts] = useState<Record<string, number>>({});

  // Bộ sưu tập địa điểm (Collections)
  const [collections, setCollections] = useState<PlaceCollection[]>(() => getCollections());
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [showNewCollectionInput, setShowNewCollectionInput] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');

  // Auth & Multi-Pet Profile states
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authReason, setAuthReason] = useState<string | undefined>(undefined);
  const [pendingOpenPetModal, setPendingOpenPetModal] = useState(false);

  const [userPets, setUserPets] = useState<PetProfile[]>([]);
  const [activePetId, setActivePetId] = useState<string | null>(null);
  const [onlyCompatibleForMyPet, setOnlyCompatibleForMyPet] = useState(false);
  const [isPetProfileModalOpen, setIsPetProfileModalOpen] = useState(false);
  const [petModalInitialTab, setPetModalInitialTab] = useState<'my_pets' | 'lookup'>('my_pets');
  const [initialLookupPetCode, setInitialLookupPetCode] = useState<string | undefined>(
    undefined
  );

  // Toast Notification state (Task #11 & #20)
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4200);
  };

  // Pagination / Load More state (Task #3)
  const [visibleLimit, setVisibleLimit] = useState(20);

  // Emergency 24/7 Vet Mode state
  const [emergencyVetMode, setEmergencyVetMode] = useState(false);

  const petProfile = useMemo(() => {
    if (userPets.length === 0) return null;
    return userPets.find((p) => p.id === activePetId) || userPets[0];
  }, [userPets, activePetId]);

  const pendingPlacesCount = useMemo(
    () => places.filter((p) => !p.verified && !p.id.startsWith('osm-')).length,
    [places]
  );

  // User Location & Distance Sort states
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [sortByNearest, setSortByNearest] = useState(false);
  const [nearbyRadiusKm, setNearbyRadiusKm] = useState<number | 'all'>(3);
  const [scanningNearby, setScanningNearby] = useState(false);

  // On-demand Explore State
  const [hasTriggeredExplore, setHasTriggeredExplore] = useState(false);

  // Map, Desktop Sidebar & Mobile Bottom Sheet states
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [routeTargetPlace, setRouteTargetPlace] = useState<Place | null>(null);
  const [mapCenter, setMapCenter] = useState(DISTRICT_COORDINATES['Tất cả khu vực']);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSheetMode, setMobileSheetMode] = useState<'peek' | 'half' | 'full'>('half');

  // Add place & Pick location states
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [pickedCoords, setPickedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [checkinPlaceId, setCheckinPlaceId] = useState<string | null>(null);
  const [isFeedOpen, setIsFeedOpen] = useState(false);
  const [feedRefreshToken, setFeedRefreshToken] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem('petmap_onboarded_v1')
  );
  const [isAdminRoute, setIsAdminRoute] = useState(false);

  const navigateToAdminPage = () => {
    window.history.pushState({}, '', '/admin');
    setIsAdminRoute(true);
  };

  const navigateToMapPage = () => {
    window.history.pushState({}, '', '/');
    setIsAdminRoute(false);
  };

  useEffect(() => {
    loadPlaces();
    initAuthAndPetProfile();

    const checkAdminRoute = () => {
      const path = window.location.pathname.toLowerCase();
      const search = window.location.search.toLowerCase();

      // Check if URL has ?petId=... for QR Pet ID Card lookup
      const params = new URLSearchParams(window.location.search);
      const petCode = params.get('petId');
      if (petCode && petCode.trim()) {
        setInitialLookupPetCode(petCode.trim());
        setIsPetProfileModalOpen(true);
      }
      // Quét QR quán bằng camera điện thoại -> link ?checkin=<placeId> -> tự mở check-in
      const checkinId = params.get('checkin');
      if (checkinId && checkinId.trim()) {
        setCheckinPlaceId(checkinId.trim());
        setIsCheckInOpen(true);
      }
      const hash = window.location.hash.toLowerCase();
      const isAtAdmin = path === '/admin' || search.includes('admin=1') || hash === '#admin';
      setIsAdminRoute(isAtAdmin);
    };
    checkAdminRoute();
    window.addEventListener('popstate', checkAdminRoute);
    window.addEventListener('hashchange', checkAdminRoute);
    return () => {
      window.removeEventListener('popstate', checkAdminRoute);
      window.removeEventListener('hashchange', checkAdminRoute);
    };
  }, []);

  const initAuthAndPetProfile = async () => {
    const user = await getCurrentUser();
    setCurrentUser(user);
    if (user) {
      const pets = await fetchUserPetProfiles(user.id);
      setUserPets(pets);
      setActivePetId(pets[0]?.id || null);
    } else {
      setUserPets([]);
      setActivePetId(null);
    }
  };

  // Tải số lượt check-in theo địa điểm (cập nhật lại sau mỗi lần có check-in mới)
  useEffect(() => {
    fetchRecentCheckins(300)
      .then((list) => {
        const counts: Record<string, number> = {};
        for (const c of list) counts[c.placeId] = (counts[c.placeId] || 0) + 1;
        setCheckinCounts(counts);
      })
      .catch(() => {});
  }, [feedRefreshToken]);

  const loadPlaces = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetchPlaces();
      setPlaces(res.places);
      setDataSource(res.source);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const isExploreActive = useMemo(() => {
    return (
      hasTriggeredExplore ||
      searchQuery.trim().length > 0 ||
      userLocation !== null ||
      sortByNearest ||
      onlySavedFilter ||
      onlyCompatibleForMyPet ||
      onlyOpenNow ||
      activeCollectionId !== null ||
      selectedDistrict !== 'Tất cả khu vực' ||
      selectedCategory !== 'all' ||
      selectedPolicy !== 'all' ||
      selectedConditions.length > 0
    );
  }, [
    hasTriggeredExplore,
    searchQuery,
    userLocation,
    sortByNearest,
    onlySavedFilter,
    onlyCompatibleForMyPet,
    onlyOpenNow,
    activeCollectionId,
    selectedDistrict,
    selectedCategory,
    selectedPolicy,
    selectedConditions,
  ]);

  // Task #1 & #2: Lọc danh sách cơ sở (hỗ trợ Tiếng Việt không dấu) trước khi chia theo 3 mức chính sách Pet
  const baseFilteredPlaces = useMemo(() => {
    if (!isExploreActive) {
      return [];
    }

    const normalizedQuery = normalizeSearchText(searchQuery);

    return places.filter((place) => {
      if (onlySavedFilter && !savedIds.includes(place.id)) {
        return false;
      }
      if (activeCollectionId) {
        const col = collections.find((c) => c.id === activeCollectionId);
        if (!col || !col.placeIds.includes(place.id)) return false;
      }
      if (onlyCompatibleForMyPet && petProfile) {
        const comp = evaluatePetCompatibility(place, petProfile);
        if (!comp || !comp.compatible) return false;
      }
      if (onlyOpenNow) {
        const status = evaluateOpeningStatus(place.openingHours);
        if (!status || !status.isOpen) return false;
      }
      if (selectedDistrict !== 'Tất cả khu vực' && place.district !== selectedDistrict) {
        return false;
      }
      if (selectedCategory !== 'all' && place.category !== selectedCategory) {
        return false;
      }
      if (selectedConditions.length > 0) {
        const hasAllConditions = selectedConditions.every((cid) =>
          place.petConditions.includes(cid)
        );
        if (!hasAllConditions) return false;
      }
      if (normalizedQuery) {
        const matchName = normalizeSearchText(place.name).includes(normalizedQuery);
        const matchAddress = normalizeSearchText(place.address).includes(normalizedQuery);
        const matchDistrict = normalizeSearchText(place.district).includes(normalizedQuery);
        const matchNotes = normalizeSearchText(place.petPolicyNotes).includes(normalizedQuery);
        if (!matchName && !matchAddress && !matchDistrict && !matchNotes) {
          return false;
        }
      }
      if (
        sortByNearest &&
        userLocation &&
        nearbyRadiusKm !== 'all' &&
        selectedDistrict === 'Tất cả khu vực' &&
        !normalizedQuery
      ) {
        const dist = calculateDistanceKm(userLocation.lat, userLocation.lng, place.lat, place.lng);
        if (dist > nearbyRadiusKm) {
          return false;
        }
      }
      return true;
    });
  }, [
    isExploreActive,
    places,
    onlySavedFilter,
    savedIds,
    onlyCompatibleForMyPet,
    petProfile,
    sortByNearest,
    userLocation,
    nearbyRadiusKm,
    selectedDistrict,
    selectedCategory,
    selectedConditions,
    searchQuery,
    onlyOpenNow,
    activeCollectionId,
    collections,
  ]);

  // Task #2: Số đếm chính sách phản ánh đúng bộ lọc Quận / Loại hình / Từ khoá hiện tại
  const policyCounts = useMemo(() => {
    if (!isExploreActive) {
      return { all: 0, allowed: 0, conditional: 0, not_allowed: 0 };
    }
    return {
      all: baseFilteredPlaces.length,
      allowed: baseFilteredPlaces.filter((p) => p.petPolicy === 'allowed').length,
      conditional: baseFilteredPlaces.filter((p) => p.petPolicy === 'conditional').length,
      not_allowed: baseFilteredPlaces.filter((p) => p.petPolicy === 'not_allowed').length,
    };
  }, [baseFilteredPlaces, isExploreActive]);

  const allMatchingPlaces = useMemo(() => {
    const list =
      selectedPolicy === 'all'
        ? baseFilteredPlaces
        : baseFilteredPlaces.filter((p) => p.petPolicy === selectedPolicy);

    // Ưu tiên "gần nhất" khi đang bật định vị; nếu không, dùng sortMode người chọn.
    if (sortByNearest && userLocation) {
      return [...list].sort((a, b) => {
        const distA = calculateDistanceKm(userLocation.lat, userLocation.lng, a.lat, a.lng);
        const distB = calculateDistanceKm(userLocation.lat, userLocation.lng, b.lat, b.lng);
        return distA - distB;
      });
    }

    if (sortMode === 'rating') {
      return [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    if (sortMode === 'newest') {
      return [...list].sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
    }
    if (sortMode === 'nearest' && userLocation) {
      return [...list].sort(
        (a, b) =>
          calculateDistanceKm(userLocation.lat, userLocation.lng, a.lat, a.lng) -
          calculateDistanceKm(userLocation.lat, userLocation.lng, b.lat, b.lng)
      );
    }
    if (sortMode === 'hot') {
      return [...list].sort(
        (a, b) => (checkinCounts[b.id] || 0) - (checkinCounts[a.id] || 0)
      );
    }

    return list;
  }, [baseFilteredPlaces, selectedPolicy, sortByNearest, userLocation, sortMode, checkinCounts]);

  // Task #3: Cho phép mở rộng danh sách thay vì cắt cứng mất kết quả
  const filteredPlaces = useMemo(
    () => allMatchingPlaces.slice(0, visibleLimit),
    [allMatchingPlaces, visibleLimit]
  );

  const handleOpenPetProfileClick = () => {
    if (!currentUser) {
      setAuthReason(
        'Vui lòng đăng nhập để tạo và lưu Hồ sơ Thú cưng của bạn lên hệ thống (hoặc bấm "Tra cứu Mã Boss" để kiểm tra thẻ không cần đăng nhập).'
      );
      setPendingOpenPetModal(true);
      setIsAuthModalOpen(true);
      return;
    }
    setPetModalInitialTab('my_pets');
    setIsPetProfileModalOpen(true);
  };

  // Task #4: Mở trực tiếp tab Tra cứu Mã Định Danh không cần đăng nhập
  const handleOpenPetLookupDirect = () => {
    setPetModalInitialTab('lookup');
    setIsPetProfileModalOpen(true);
  };

  const handleAuthSuccess = async (user: AuthUser) => {
    setCurrentUser(user);
    const pets = await fetchUserPetProfiles(user.id);
    setUserPets(pets);
    setActivePetId(pets[0]?.id || null);
    if (pendingOpenPetModal) {
      setPendingOpenPetModal(false);
      setIsPetProfileModalOpen(true);
    }
  };

  const handleLogout = async () => {
    await signOutUser();
    setCurrentUser(null);
    setUserPets([]);
    setActivePetId(null);
    setOnlyCompatibleForMyPet(false);
  };

  const handleSavePetItem = async (petInput: PetProfile) => {
    if (!currentUser) return;
    const updatedList = await saveUserPetProfileItem(currentUser.id, petInput);
    setUserPets(updatedList);
    const targetId = petInput.id || updatedList[updatedList.length - 1]?.id || null;
    setActivePetId(targetId);
  };

  const handleDeletePetItem = async (petId: string) => {
    if (!currentUser) return;
    const updatedList = await deleteUserPetProfileItem(currentUser.id, petId);
    setUserPets(updatedList);
    if (updatedList.length === 0) {
      setActivePetId(null);
      setOnlyCompatibleForMyPet(false);
    } else if (activePetId === petId) {
      setActivePetId(updatedList[0].id || null);
    }
  };

  const handleApprovePlace = async (placeId: string) => {
    const approved = await approvePlaceById(placeId);
    if (approved) {
      setPlaces((prev) => prev.map((p) => (p.id === placeId ? approved : p)));
      if (selectedPlace?.id === placeId) {
        setSelectedPlace(approved);
      }
    }
  };

  const handleDeletePlace = async (placeId: string) => {
    await deletePlaceById(placeId);
    setPlaces((prev) => prev.filter((p) => p.id !== placeId));
    if (selectedPlace?.id === placeId) {
      setSelectedPlace(null);
    }
  };

  const handleTriggerEmergencyVet = () => {
    const nextMode = !emergencyVetMode;
    setEmergencyVetMode(nextMode);
    if (nextMode) {
      setHasTriggeredExplore(true);
      setSelectedCategory('vet_spa');
      setSelectedPolicy('all');
      setSelectedDistrict('Tất cả khu vực');
      setNearbyRadiusKm('all');
      setSortByNearest(true);
      setMobileSheetMode('half');
      if (!userLocation) {
        handleLocateUser();
      }
    } else {
      setSelectedCategory('all');
      setNearbyRadiusKm(3);
    }
  };

  const applyUserCoordinates = async (coords: { lat: number; lng: number }) => {
    setHasTriggeredExplore(true);
    setUserLocation(coords);
    setSortByNearest(true);
    setNearbyRadiusKm(3);
    setMobileSheetMode('half');
    setMapCenter({ ...coords, zoom: 15 });

    setScanningNearby(true);
    try {
      const osmPlaces = await discoverNearbyOsmPlaces(coords.lat, coords.lng, 1500);
      if (osmPlaces.length > 0) {
        setPlaces((prev) => {
          const existingNames = new Set(prev.map((p) => p.name.toLowerCase().trim()));
          const uniqueNew = osmPlaces.filter(
            (p) => !existingNames.has(p.name.toLowerCase().trim())
          );
          return dedupePlaces([...prev, ...uniqueNew]);
        });
      }
    } finally {
      setScanningNearby(false);
    }
  };

  const handleLocateUser = () => {
    setHasTriggeredExplore(true);
    setMobileSheetMode('half');
    if (!navigator.geolocation) {
      showToast('Thiết bị không hỗ trợ GPS — đang hiển thị khu vực trung tâm TP.HCM.');
      const targetCoords =
        selectedDistrict !== 'Tất cả khu vực' && DISTRICT_COORDINATES[selectedDistrict]
          ? DISTRICT_COORDINATES[selectedDistrict]
          : DISTRICT_COORDINATES['Quận 5'];
      applyUserCoordinates({ lat: targetCoords.lat, lng: targetCoords.lng });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        applyUserCoordinates({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {
        // Task #11: Thông báo rõ ràng khi trình duyệt chặn quyền GPS
        showToast(
          'Trình duyệt đang chặn quyền GPS. Đang hiển thị gợi ý tại trung tâm TP.HCM — bạn có thể chọn Quận bất kỳ!'
        );
        const targetCoords =
          selectedDistrict !== 'Tất cả khu vực' && DISTRICT_COORDINATES[selectedDistrict]
            ? DISTRICT_COORDINATES[selectedDistrict]
            : DISTRICT_COORDINATES['Quận 5'];
        applyUserCoordinates({ lat: targetCoords.lat, lng: targetCoords.lng });
      }
    );
  };

  const handleToggleSavePlace = (placeId: string) => {
    const nextIds = toggleSavedPlaceId(placeId);
    setSavedIds(nextIds);
  };

  const handleDistrictChange = (district: string) => {
    setSelectedDistrict(district);
    setMobileSheetMode('half');
    const coords = DISTRICT_COORDINATES[district];
    if (coords) {
      setMapCenter({ ...coords });
    }
  };

  const toggleConditionFilter = (cid: PetConditionId) => {
    setSelectedConditions((prev) =>
      prev.includes(cid) ? prev.filter((item) => item !== cid) : [...prev, cid]
    );
  };

  const handleStartRouteOnApp = (place: Place) => {
    setHasTriggeredExplore(true);
    setRouteTargetPlace(place);

    // Nếu trên mobile đang mở bảng chi tiết hoặc sheet cao, thu gọn để nhìn rõ đường đi trên bản đồ
    if (window.innerWidth < 640) {
      setSelectedPlace(null);
      setMobileSheetMode('peek');
    }

    if (!userLocation) {
      if (!navigator.geolocation) {
        const targetCoords =
          selectedDistrict !== 'Tất cả khu vực' && DISTRICT_COORDINATES[selectedDistrict]
            ? DISTRICT_COORDINATES[selectedDistrict]
            : DISTRICT_COORDINATES['Quận 5'];
        applyUserCoordinates({ lat: targetCoords.lat, lng: targetCoords.lng });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          applyUserCoordinates({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => {
          const targetCoords =
            selectedDistrict !== 'Tất cả khu vực' && DISTRICT_COORDINATES[selectedDistrict]
              ? DISTRICT_COORDINATES[selectedDistrict]
              : DISTRICT_COORDINATES['Quận 5'];
          applyUserCoordinates({ lat: targetCoords.lat, lng: targetCoords.lng });
        }
      );
    }
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedDistrict('Tất cả khu vực');
    setSelectedCategory('all');
    setSelectedPolicy('all');
    setSelectedConditions([]);
    setOnlySavedFilter(false);
    setOnlyCompatibleForMyPet(false);
    setOnlyOpenNow(false);
    setActiveCollectionId(null);
    setEmergencyVetMode(false);
    setSortByNearest(false);
    setUserLocation(null);
    setHasTriggeredExplore(false);
    setSelectedPlace(null);
    setRouteTargetPlace(null);
    setMapCenter(DISTRICT_COORDINATES['Tất cả khu vực']);
  };

  // Bộ sưu tập: tạo, xoá, bật/tắt địa điểm trong bộ sưu tập
  const handleCreateCollection = () => {
    const name = newCollectionName.trim();
    if (!name) return;
    const next = createCollection(name);
    setCollections(next);
    setNewCollectionName('');
    setShowNewCollectionInput(false);
    setActiveCollectionId(next[0]?.id || null);
    showToast(`✓ Đã tạo bộ sưu tập "${name}"`);
  };

  const handleDeleteCollection = (id: string) => {
    setCollections(deleteCollection(id));
    if (activeCollectionId === id) setActiveCollectionId(null);
  };

  const handleTogglePlaceInCollection = (collectionId: string, placeId: string) => {
    const next = togglePlaceInCollection(collectionId, placeId);
    setCollections(next);
    const col = next.find((c) => c.id === collectionId);
    const added = col?.placeIds.includes(placeId);
    showToast(added ? `✓ Đã thêm vào "${col?.name}"` : `Đã gỡ khỏi "${col?.name}"`);
  };

  const handleCreatePlace = async (newPlaceInput: Omit<Place, 'id' | 'createdAt'>) => {
    const { place, source } = await createPlace(newPlaceInput);
    setPlaces((prev) => [place, ...prev]);
    setDataSource(source);
    setHasTriggeredExplore(true);
    setIsPickingLocation(false);
    setPickedCoords(null);
    setSelectedPlace(place);
    setMapCenter({ lat: place.lat, lng: place.lng, zoom: 16 });
  };

  const handleUpdatePlacePolicy = async (
    placeId: string,
    updates: Pick<
      Place,
      | 'petPolicy'
      | 'petConditions'
      | 'petPolicyNotes'
      | 'allowedPetTypes'
      | 'maxWeightKg'
      | 'imageUrl'
      | 'googleMapsUrl'
      | 'websiteUrl'
    >
  ) => {
    const basePlace = places.find((p) => p.id === placeId) || selectedPlace || undefined;
    const updated = await updatePlacePolicy(placeId, updates, basePlace);
    if (updated) {
      setPlaces((prev) => prev.map((p) => (p.id === placeId ? updated : p)));
      setSelectedPlace(updated);
      showToast('✓ Đã lưu cập nhật chính sách Pet cho địa điểm!');
    }
  };

  const handleUpdatePlaceFull = async (
    placeId: string,
    updates: Partial<Omit<Place, 'id'>>
  ) => {
    const updated = await updatePlaceFull(placeId, updates);
    if (updated) {
      setPlaces((prev) => prev.map((p) => (p.id === placeId ? updated : p)));
      if (selectedPlace?.id === placeId) {
        setSelectedPlace(updated);
      }
      showToast('✓ Đã lưu chỉnh sửa thông tin địa điểm!');
    }
  };

  const handleSeedSupabase = async () => {
    const res = await seedInitialPlacesToSupabase();
    if (res.error) {
      showToast(`⚠️ Lỗi khi đẩy dữ liệu: ${res.error}`);
      return;
    }
    if (res.count === 0 && res.skippedCount) {
      showToast(`✓ Toàn bộ ${res.skippedCount} quán mẫu đã có sẵn trên Supabase (không bị trùng lặp).`);
    } else {
      showToast(`✓ Đã đồng bộ thêm ${res.count} địa điểm mới lên Supabase!`);
    }
    await loadPlaces();
  };

  const handleResetLocal = () => {
    const defaults = resetLocalPlacesToDefault();
    setPlaces(defaults);
    setSelectedPlace(null);
  };

  const activeFilterCount =
    (onlySavedFilter ? 1 : 0) +
    (onlyCompatibleForMyPet ? 1 : 0) +
    (sortByNearest ? 1 : 0) +
    (selectedDistrict !== 'Tất cả khu vực' ? 1 : 0) +
    (selectedCategory !== 'all' ? 1 : 0) +
    (selectedPolicy !== 'all' ? 1 : 0) +
    selectedConditions.length;

  const renderPlaceCards = () => (
    <>
      {filteredPlaces.map((place) => {
        const isSelected = selectedPlace?.id === place.id;
        const categoryMeta = PLACE_CATEGORIES[place.category];
        const policyMeta = PET_POLICIES[place.petPolicy];
        const comp = evaluatePetCompatibility(place, petProfile);
        const openStatus = evaluateOpeningStatus(place.openingHours);
        const fallbackImg = getCategoryFallbackImage(place.category);
        const distKm = userLocation
          ? calculateDistanceKm(userLocation.lat, userLocation.lng, place.lat, place.lng)
          : null;

        return (
          <div
            key={place.id}
            onClick={() => {
              setSelectedPlace(place);
            }}
            className={`group cursor-pointer p-3.5 sm:p-4 transition-all duration-200 active:bg-slate-100 hover:bg-slate-50/90 ${
              isSelected
                ? 'bg-emerald-50/70 ring-1 ring-inset ring-emerald-500/40'
                : 'bg-white'
            }`}
          >
            <div className="flex items-start gap-3.5">
              {/* Redesign 3 + Task #19: Larger Editorial Thumbnail with Fallback & Overlays */}
              <div className="relative h-21 w-21 shrink-0 overflow-hidden rounded-2xl bg-slate-100 border border-slate-200/80 shadow-2xs">
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
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                {distKm !== null && (
                  <span className="absolute bottom-1 left-1 rounded-md bg-slate-950/80 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-xs">
                    {distKm} km
                  </span>
                )}
                {place.rating && (
                  <span className="absolute top-1 right-1 inline-flex items-center gap-0.5 rounded-md bg-amber-400/95 px-1.5 py-0.5 text-[9px] font-extrabold text-slate-950 shadow-2xs">
                    <Star className="h-2.5 w-2.5 fill-slate-950" />
                    {place.rating.toFixed(1)}
                  </span>
                )}
                {(checkinCounts[place.id] || 0) > 0 && (
                  <span className="absolute top-1 left-1 inline-flex items-center gap-0.5 rounded-md bg-orange-500/95 px-1.5 py-0.5 text-[9px] font-extrabold text-white shadow-2xs">
                    🔥 {checkinCounts[place.id]}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex flex-wrap items-center gap-1">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${categoryMeta.colorClass}`}
                    >
                      <span>{categoryMeta.emoji}</span>
                      <span>{categoryMeta.shortLabel}</span>
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400 truncate max-w-[115px]">
                      • {place.district}
                    </span>
                  </div>

                  {/* Pet Policy Pill */}
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${policyMeta.badgeBg} ${policyMeta.badgeText} ${policyMeta.badgeBorder}`}
                  >
                    {place.petPolicy === 'allowed' && <CheckCircle2 className="h-3 w-3" />}
                    {place.petPolicy === 'conditional' && <AlertTriangle className="h-3 w-3" />}
                    {place.petPolicy === 'not_allowed' && <XCircle className="h-3 w-3" />}
                    <span>{policyMeta.shortLabel}</span>
                  </span>
                </div>

                <h3 className="mt-1 text-sm font-extrabold text-slate-900 group-hover:text-emerald-700 leading-snug line-clamp-1">
                  {place.name}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 truncate">{place.address}</p>

                {/* Open Status + Pet Compatibility Row */}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {openStatus && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${openStatus.badgeClass}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${openStatus.dotClass}`} />
                      <span>{openStatus.shortLabel}</span>
                    </span>
                  )}
                  {comp && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                        comp.status === 'perfect'
                          ? 'bg-emerald-100 text-emerald-800'
                          : comp.status === 'conditional_ok'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      🐾 {comp.label}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Condition Badges & Sleek Quick Actions */}
            <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
              <div className="flex flex-wrap items-center gap-1 min-w-0">
                {place.petConditions.slice(0, 2).map((cid) => (
                  <ConditionBadge key={cid} conditionId={cid} size="sm" />
                ))}
                {place.petConditions.length > 2 && (
                  <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                    +{place.petConditions.length - 2}
                  </span>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {place.category === 'vet_spa' && place.phone && (
                  <a
                    href={`tel:${place.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl bg-rose-600 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-xs hover:bg-rose-500"
                  >
                    <Phone className="h-3 w-3" />
                    <span>Gọi</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartRouteOnApp(place);
                  }}
                  title="Chỉ đường ngay trên bản đồ PetMap"
                  className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl border px-2.5 py-1.5 text-[11px] font-bold transition cursor-pointer ${
                    routeTargetPlace?.id === place.id
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                  }`}
                >
                  <Route className="h-3 w-3" />
                  <span>Chỉ đường</span>
                </button>

                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title="Mở trên Google Maps"
                  className="inline-flex shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white p-1.5 text-slate-500 hover:border-slate-300 hover:text-slate-900"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleSavePlace(place.id);
                  }}
                  title="Lưu quán yêu thích"
                  className={`inline-flex shrink-0 items-center justify-center rounded-xl border p-1.5 transition cursor-pointer ${
                    savedIds.includes(place.id)
                      ? 'border-rose-200 bg-rose-50 text-rose-600'
                      : 'border-slate-200 bg-white text-slate-400 hover:text-rose-500'
                  }`}
                >
                  <Heart
                    className={`h-3.5 w-3.5 ${
                      savedIds.includes(place.id) ? 'fill-rose-500 text-rose-500' : ''
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* Task #3: Nút Xem thêm kết quả nếu còn địa điểm vượt quá visibleLimit */}
      {allMatchingPlaces.length > visibleLimit && (
        <div className="p-4 text-center bg-slate-50/60">
          <button
            type="button"
            onClick={() => setVisibleLimit((prev) => prev + 20)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-100 transition cursor-pointer"
          >
            <span>
              Xem thêm kết quả (+{allMatchingPlaces.length - visibleLimit} địa điểm)
            </span>
          </button>
        </div>
      )}
    </>
  );

  // Nếu người dùng truy cập route /admin -> Render trang AdminPortalPage riêng biệt (Bắt buộc qua cổng Login Admin)
  if (isAdminRoute) {
    return (
      <Suspense
        fallback={
          <div className="flex h-dvh w-screen items-center justify-center bg-slate-950 text-sm font-semibold text-emerald-300">
            Đang tải trang Quản trị...
          </div>
        }
      >
        <AdminPortalPage
          currentUser={currentUser}
          places={places}
          dataSource={dataSource}
          onAuthChange={async (user) => {
            setCurrentUser(user);
            if (user) {
              const pets = await fetchUserPetProfiles(user.id);
              setUserPets(pets);
              setActivePetId(pets[0]?.id || null);
            } else {
              setUserPets([]);
              setActivePetId(null);
            }
          }}
          onApprovePlace={handleApprovePlace}
          onDeletePlace={handleDeletePlace}
          onUpdatePlaceFull={handleUpdatePlaceFull}
          onSeedSupabase={handleSeedSupabase}
          onResetLocal={handleResetLocal}
          onExitAdminPage={navigateToMapPage}
        />
      </Suspense>
    );
  }

  return (
    <div className="relative h-dvh w-screen overflow-hidden bg-slate-100">
      {/* Task #20: Floating Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-4 left-1/2 z-[2500] -translate-x-1/2 max-w-md w-[92%] pointer-events-auto"
        >
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-900/95 px-4 py-3 text-xs font-semibold text-white shadow-2xl backdrop-blur-md">
            <span>{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              aria-label="Đóng thông báo"
              className="rounded-lg bg-white/10 p-1 text-slate-300 hover:bg-white/20 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          1. FULL-BLEED MAP CANVAS (Luôn hiển thị 100% màn hình trên cả Mobile & Web)
         ===================================================================== */}
      <main className="absolute inset-0 h-full w-full">
        <PetMapView
          places={allMatchingPlaces}
          selectedPlace={selectedPlace}
          routeTargetPlace={routeTargetPlace}
          onSelectPlace={(place) => setSelectedPlace(place)}
          onStartRouteOnApp={handleStartRouteOnApp}
          onClearRouteOnApp={() => setRouteTargetPlace(null)}
          mapCenter={mapCenter}
          userLocation={userLocation}
          onRequestLocateMe={handleLocateUser}
          isPickingLocation={isPickingLocation}
          pickedCoords={pickedCoords}
          onMapPickLocation={(coords) => {
            setPickedCoords(coords);
          }}
          onStartAddAtCoords={(coords) => {
            setPickedCoords(coords);
            setIsAddModalOpen(true);
          }}
          onCancelPickLocation={() => {
            setIsPickingLocation(false);
            setPickedCoords(null);
          }}
        />
      </main>

      {/* =====================================================================
          2. MOBILE TOP FLOATING SEARCH & FILTER CHIPS (< sm)
         ===================================================================== */}
      <header className="pointer-events-none fixed top-2.5 inset-x-3 z-[920] flex flex-col gap-2 sm:hidden">
        {/* Search Pill Bar */}
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-xl backdrop-blur-md">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xs">
            <PawPrint className="h-4 w-4" />
          </div>

          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setMobileSheetMode('half');
              }}
              placeholder="Tìm cafe, nhà hàng, quận..."
              className="w-full bg-transparent py-1.5 pr-6 pl-1 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute top-1/2 right-1 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* District Quick Selector on Mobile */}
          <select
            value={selectedDistrict}
            onChange={(e) => handleDistrictChange(e.target.value)}
            className="max-w-[105px] truncate rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-bold text-slate-700 focus:outline-none"
          >
            {HCMC_DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d === 'Tất cả khu vực' ? 'TP.HCM' : d}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowConditionFilters((prev) => !prev)}
            className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition ${
              selectedConditions.length > 0 || showConditionFilters
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-slate-200 bg-slate-50 text-slate-700'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {selectedConditions.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                {selectedConditions.length}
              </span>
            )}
          </button>
        </div>

        {/* Horizontal Scrollable Filter Chips on Mobile */}
        <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={handleTriggerEmergencyVet}
            className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-extrabold shadow-md backdrop-blur-md transition ${
              emergencyVetMode
                ? 'border-rose-600 bg-rose-600 text-white ring-2 ring-rose-300'
                : 'border-rose-300 bg-rose-50/95 text-rose-700'
            }`}
          >
            <Siren className="h-3.5 w-3.5" />
            <span>Cấp cứu Thú Y 24/7</span>
          </button>

          <button
            onClick={() => {
              if (!userLocation) handleLocateUser();
              else setSortByNearest((prev) => !prev);
            }}
            className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold shadow-md backdrop-blur-md transition ${
              sortByNearest
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-slate-200/90 bg-white/95 text-blue-700'
            }`}
          >
            <Navigation className="h-3 w-3" />
            <span>Gần tôi</span>
          </button>

          <button
            onClick={() => {
              setHasTriggeredExplore(true);
              setSelectedPolicy((prev) => (prev === 'allowed' ? 'all' : 'allowed'));
            }}
            className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold shadow-md backdrop-blur-md transition ${
              selectedPolicy === 'allowed'
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-slate-200/90 bg-white/95 text-emerald-700'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Cho Pet</span>
          </button>

          <button
            onClick={() => {
              setHasTriggeredExplore(true);
              setSelectedPolicy((prev) => (prev === 'conditional' ? 'all' : 'conditional'));
            }}
            className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold shadow-md backdrop-blur-md transition ${
              selectedPolicy === 'conditional'
                ? 'border-amber-500 bg-amber-500 text-white'
                : 'border-slate-200/90 bg-white/95 text-amber-700'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span>Có điều kiện</span>
          </button>

          <button
            onClick={() => {
              setHasTriggeredExplore(true);
              setSelectedPolicy((prev) => (prev === 'not_allowed' ? 'all' : 'not_allowed'));
            }}
            className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold shadow-md backdrop-blur-md transition ${
              selectedPolicy === 'not_allowed'
                ? 'border-rose-600 bg-rose-600 text-white'
                : 'border-slate-200/90 bg-white/95 text-rose-700'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <span>Cấm Pet</span>
          </button>

          {Object.values(PLACE_CATEGORIES).map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setHasTriggeredExplore(true);
                setSelectedCategory((prev) => (prev === cat.id ? 'all' : cat.id));
              }}
              className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold shadow-md backdrop-blur-md transition ${
                selectedCategory === cat.id
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200/90 bg-white/95 text-slate-700'
              }`}
            >
              <span>{cat.emoji}</span>
              <span>{cat.shortLabel}</span>
            </button>
          ))}
        </div>

        {/* Mobile Condition Filter Popover */}
        {showConditionFilters && (
          <div className="pointer-events-auto rounded-2xl border border-slate-200 bg-white/98 p-3 shadow-2xl backdrop-blur-md">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Điều kiện & Tiện ích đem Pet theo:
              </span>
              <button
                onClick={() => setShowConditionFilters(false)}
                className="text-xs font-bold text-indigo-600"
              >
                Xong
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(PET_CONDITIONS) as PetConditionId[]).map((cid) => {
                const active = selectedConditions.includes(cid);
                return (
                  <button
                    key={cid}
                    onClick={() => {
                      setHasTriggeredExplore(true);
                      toggleConditionFilter(cid);
                    }}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                      active
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    {PET_CONDITIONS[cid].label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* =====================================================================
          3. DESKTOP FLOATING SIDEBAR DOCK (hidden on mobile, visible sm+)
         ===================================================================== */}
      <aside
        className={`hidden sm:flex fixed top-4 left-4 bottom-4 z-[920] flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white/96 shadow-2xl backdrop-blur-xl transition-all duration-300 ${
          sidebarOpen ? 'w-[390px] md:w-[420px]' : 'w-0 border-0 opacity-0 pointer-events-none'
        }`}
      >
        {/* Top Brand & Action Header */}
        <div className="border-b border-slate-100 bg-white px-4 pt-4 pb-3">
          {/* Row 1: Logo Brand & Primary Actions */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm ring-2 ring-emerald-50">
                <PawPrint className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-base font-extrabold tracking-tight text-slate-900 leading-none">
                    PetMap
                  </h1>
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                    TP.HCM
                  </span>
                </div>
                <p className="mt-1 truncate text-[11px] font-medium text-slate-400">
                  Bản đồ Cafe, Nhà hàng & Store cho Pet
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {currentUser?.role === 'admin' && (
                <button
                  onClick={navigateToAdminPage}
                  title="Đi tới trang Admin Dashboard"
                  aria-label="Trang Admin"
                  className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition cursor-pointer"
                >
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  {pendingPlacesCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                      {pendingPlacesCount}
                    </span>
                  )}
                </button>
              )}

              <button
                onClick={() => setIsFeedOpen(true)}
                title="Hoạt động check-in cộng đồng"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
              >
                <Sparkles className="h-4 w-4" />
              </button>

              <button
                onClick={() => setIsCheckInOpen(true)}
                title="Check-in tại quán (quét QR)"
                aria-label="Check-in tại quán"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition cursor-pointer"
              >
                <QrCode className="h-4 w-4" />
              </button>

              <button
                onClick={() => {
                  setPickedCoords({ lat: mapCenter.lat, lng: mapCenter.lng });
                  setIsAddModalOpen(true);
                }}
                className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl bg-slate-900 px-3 text-xs font-bold text-white shadow-xs hover:bg-emerald-600 transition cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>Thêm</span>
              </button>
            </div>
          </div>

          {/* Row 2: Unified Multi-Pet Profile, QR Lookup & Account Status Bar */}
          <div className="mt-3 flex items-center justify-between gap-1.5 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-1.5">
            <button
              onClick={handleOpenPetProfileClick}
              className={`flex flex-1 min-w-0 items-center gap-2 rounded-xl px-2.5 py-1.5 text-left transition cursor-pointer ${
                petProfile
                  ? 'bg-amber-100/70 text-amber-950 hover:bg-amber-100'
                  : 'bg-white text-slate-700 shadow-2xs hover:bg-slate-100/80'
              }`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-sm">
                🐾
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-bold leading-tight">
                  {petProfile
                    ? `${petProfile.name} • ${petProfile.weightKg}kg${
                        userPets.length > 1 ? ` (+${userPets.length - 1} Boss)` : ''
                      }`
                    : 'Hồ sơ Boss của bạn'}
                </div>
                <div className="truncate text-[10px] text-slate-500 leading-tight mt-0.5">
                  {petProfile
                    ? `${petProfile.identityCode ? `#${petProfile.identityCode} • ` : ''}${
                        petProfile.breed || 'Đã lưu'
                      } — Bấm để đổi / thêm Boss`
                    : currentUser
                    ? 'Bấm để thêm danh sách thú cưng'
                    : 'Đăng nhập để lưu thông tin thú cưng'}
                </div>
              </div>
            </button>

            <button
              onClick={handleOpenPetLookupDirect}
              title="Tra cứu Mã Định Danh / Thẻ Căn Cước Boss"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
            >
              <QrCode className="h-4 w-4" />
            </button>

            {currentUser ? (
              <div className="flex shrink-0 items-center gap-1.5 pl-1">
                <span className="max-w-[90px] truncate text-[11px] font-semibold text-emerald-700">
                  {currentUser.fullName || currentUser.email.split('@')[0]}
                </span>
                <button
                  onClick={handleLogout}
                  title={`Đang đăng nhập: ${currentUser.email} — Bấm để đăng xuất`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setAuthReason(undefined);
                  setPendingOpenPetModal(false);
                  setIsAuthModalOpen(true);
                }}
                className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition cursor-pointer"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Đăng nhập</span>
              </button>
            )}
          </div>

          {/* Search Input & Pick-on-map Quick Action */}
          <div className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên quán, đường, quận, điều kiện pet..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2 pr-8 pl-9 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <button
              onClick={() => setIsPickingLocation((prev) => !prev)}
              title="Chấm điểm bất kỳ trên bản đồ để thêm quán mới"
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition cursor-pointer ${
                isPickingLocation
                  ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <MapPin className="h-4 w-4" />
            </button>
          </div>

          {/* 3 Pet Policy Status Filter Pills */}
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            <button
              onClick={() => {
                setHasTriggeredExplore(true);
                setSelectedPolicy('all');
              }}
              className={`flex flex-col items-center justify-center rounded-xl border py-1.5 px-1 text-[11px] font-semibold transition cursor-pointer ${
                isExploreActive && selectedPolicy === 'all'
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>Tất cả</span>
              <span className="text-[10px] opacity-80">{policyCounts.all}</span>
            </button>

            <button
              onClick={() => {
                setHasTriggeredExplore(true);
                setSelectedPolicy((prev) => (prev === 'allowed' ? 'all' : 'allowed'));
              }}
              className={`flex flex-col items-center justify-center rounded-xl border py-1.5 px-1 text-[11px] font-semibold transition cursor-pointer ${
                selectedPolicy === 'allowed'
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100/70'
              }`}
            >
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Cho Pet
              </span>
              <span className="text-[10px] opacity-80">{policyCounts.allowed}</span>
            </button>

            <button
              onClick={() => {
                setHasTriggeredExplore(true);
                setSelectedPolicy((prev) => (prev === 'conditional' ? 'all' : 'conditional'));
              }}
              className={`flex flex-col items-center justify-center rounded-xl border py-1.5 px-1 text-[11px] font-semibold transition cursor-pointer ${
                selectedPolicy === 'conditional'
                  ? 'border-amber-500 bg-amber-500 text-white'
                  : 'border-amber-200 bg-amber-50/70 text-amber-800 hover:bg-amber-100/70'
              }`}
            >
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                Điều kiện
              </span>
              <span className="text-[10px] opacity-80">{policyCounts.conditional}</span>
            </button>

            <button
              onClick={() => {
                setHasTriggeredExplore(true);
                setSelectedPolicy((prev) => (prev === 'not_allowed' ? 'all' : 'not_allowed'));
              }}
              className={`flex flex-col items-center justify-center rounded-xl border py-1.5 px-1 text-[11px] font-semibold transition cursor-pointer ${
                selectedPolicy === 'not_allowed'
                  ? 'border-rose-600 bg-rose-600 text-white'
                  : 'border-rose-200 bg-rose-50/70 text-rose-800 hover:bg-rose-100/70'
              }`}
            >
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                Cấm Pet
              </span>
              <span className="text-[10px] opacity-80">{policyCounts.not_allowed}</span>
            </button>
          </div>

          {/* Category Horizontal Pills */}
          <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={handleTriggerEmergencyVet}
              className={`shrink-0 inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-extrabold transition cursor-pointer ${
                emergencyVetMode
                  ? 'border-rose-600 bg-rose-600 text-white shadow-xs'
                  : 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              <Siren className="h-3.5 w-3.5" />
              <span>SOS Thú Y 24/7</span>
            </button>

            <button
              onClick={() => {
                if (!userLocation) handleLocateUser();
                else setSortByNearest((prev) => !prev);
              }}
              className={`shrink-0 inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                sortByNearest
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              <Navigation className="h-3 w-3" />
              <span>Gần tôi nhất</span>
            </button>

            {petProfile && (
              <button
                onClick={() => setOnlyCompatibleForMyPet((prev) => !prev)}
                className={`shrink-0 inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                  onlyCompatibleForMyPet
                    ? 'border-amber-600 bg-amber-600 text-white'
                    : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
              >
                <span>🐾 Hợp với {petProfile.name}</span>
              </button>
            )}

            <button
              onClick={() => setOnlySavedFilter((prev) => !prev)}
              className={`shrink-0 inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                onlySavedFilter
                  ? 'border-rose-600 bg-rose-600 text-white'
                  : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              <Heart className={`h-3 w-3 ${onlySavedFilter ? 'fill-white' : 'fill-rose-500'}`} />
              <span>Đã lưu ({savedIds.length})</span>
            </button>

            <button
              onClick={() => setOnlyOpenNow((prev) => !prev)}
              className={`shrink-0 inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                onlyOpenNow
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${onlyOpenNow ? 'bg-white' : 'bg-emerald-500'}`} />
              <span>Đang mở cửa</span>
            </button>

            {Object.values(PLACE_CATEGORIES).map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setHasTriggeredExplore(true);
                  setSelectedCategory((prev) => (prev === cat.id ? 'all' : cat.id));
                }}
                className={`shrink-0 inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.shortLabel}</span>
              </button>
            ))}
          </div>

          {/* Collections (bộ sưu tập địa điểm) */}
          <div className="mt-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <span className="shrink-0 text-xs">📁</span>
            {collections.length > 0 && (
              <button
                onClick={() => setActiveCollectionId(null)}
                className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                  activeCollectionId === null
                    ? 'bg-indigo-600 text-white'
                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                }`}
              >
                Tất cả
              </button>
            )}
            {collections.map((col) => (
              <span key={col.id} className="group relative shrink-0">
                <button
                  onClick={() =>
                    setActiveCollectionId((prev) => (prev === col.id ? null : col.id))
                  }
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                    activeCollectionId === col.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                  }`}
                >
                  <span>{col.name}</span>
                  <span className="opacity-70">({col.placeIds.length})</span>
                  <X
                    className="h-3 w-3 opacity-0 group-hover:opacity-70 hover:!opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCollection(col.id);
                    }}
                  />
                </button>
              </span>
            ))}
            {showNewCollectionInput ? (
              <input
                autoFocus
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateCollection();
                  if (e.key === 'Escape') {
                    setShowNewCollectionInput(false);
                    setNewCollectionName('');
                  }
                }}
                onBlur={() => {
                  if (newCollectionName.trim()) handleCreateCollection();
                  else setShowNewCollectionInput(false);
                }}
                placeholder="Tên bộ sưu tập..."
                className="shrink-0 w-32 rounded-lg border border-indigo-300 bg-white px-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            ) : (
              <button
                onClick={() => setShowNewCollectionInput(true)}
                className="shrink-0 inline-flex items-center gap-0.5 rounded-lg border border-dashed border-indigo-300 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                <span>Bộ sưu tập</span>
              </button>
            )}
          </div>

          {/* District & Condition Filter Bar */}
          <div className="mt-2 flex items-center justify-between gap-2">
            <select
              value={selectedDistrict}
              onChange={(e) => handleDistrictChange(e.target.value)}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-emerald-500 focus:outline-none"
            >
              {HCMC_DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  📍 {d}
                </option>
              ))}
            </select>

            <button
              onClick={() => setShowConditionFilters((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                selectedConditions.length > 0 || showConditionFilters
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Điều kiện ({selectedConditions.length})</span>
            </button>
          </div>

          {showConditionFilters && (
            <div className="mt-2.5 rounded-2xl border border-slate-200 bg-slate-50/90 p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Lọc theo điều kiện / tiện ích Pet:
                </span>
                {selectedConditions.length > 0 && (
                  <button
                    onClick={() => setSelectedConditions([])}
                    className="text-[11px] font-semibold text-indigo-600 hover:underline cursor-pointer"
                  >
                    Bỏ chọn
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(PET_CONDITIONS) as PetConditionId[]).map((cid) => {
                  const active = selectedConditions.includes(cid);
                  return (
                    <button
                      key={cid}
                      onClick={() => {
                        setHasTriggeredExplore(true);
                        toggleConditionFilter(cid);
                      }}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition cursor-pointer ${
                        active
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {PET_CONDITIONS[cid].label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Results Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-xs text-slate-500">
          <span>
            {isExploreActive ? (
              <>
                Hiển thị <strong className="text-slate-800">{filteredPlaces.length}</strong> địa điểm
                {userLocation
                  ? ` quanh ${inferNearestHcmcDistrict(userLocation.lat, userLocation.lng)}`
                  : ''}
                {scanningNearby ? ' • Đang quét...' : ''}
              </>
            ) : (
              'Nhập từ khoá hoặc bấm "Vị trí của tôi"'
            )}
          </span>
          <div className="flex items-center gap-2">
            {isExploreActive && !sortByNearest && (
              <select
                value={sortMode}
                onChange={(e) =>
                  setSortMode(
                    e.target.value as 'default' | 'rating' | 'newest' | 'nearest' | 'hot'
                  )
                }
                title="Sắp xếp danh sách"
                className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="default">Sắp xếp: Mặc định</option>
                <option value="hot">🔥 Quán hot (nhiều check-in)</option>
                <option value="rating">Đánh giá cao nhất</option>
                <option value="newest">Mới nhất</option>
                {userLocation && <option value="nearest">Gần nhất</option>}
              </select>
            )}
            {sortByNearest && userLocation && (
              <select
                value={String(nearbyRadiusKm)}
                onChange={(e) =>
                  setNearbyRadiusKm(
                    e.target.value === 'all' ? 'all' : Number(e.target.value)
                  )
                }
                className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800 focus:outline-none"
              >
                <option value="2">≤ 2 km</option>
                <option value="3">≤ 3 km</option>
                <option value="5">≤ 5 km</option>
                <option value="all">Toàn TP.HCM</option>
              </select>
            )}
            {(activeFilterCount > 0 || isExploreActive) && (
              <button
                onClick={clearAllFilters}
                className="font-semibold text-emerald-600 hover:underline cursor-pointer"
              >
                Đặt lại
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Store / Cafe / Restaurant List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {loading ? (
            <div className="divide-y divide-slate-100" aria-busy="true" aria-label="Đang tải danh sách địa điểm">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-3 p-4 animate-pulse">
                  <div className="h-16 w-16 shrink-0 rounded-xl bg-slate-200" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3.5 w-3/4 rounded bg-slate-200" />
                    <div className="h-2.5 w-1/2 rounded bg-slate-100" />
                    <div className="flex gap-2 pt-1">
                      <div className="h-4 w-14 rounded-full bg-slate-100" />
                      <div className="h-4 w-10 rounded-full bg-slate-100" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : loadError ? (
            <div className="p-8 text-center space-y-3" role="alert">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-3xl">
                📡
              </div>
              <div className="text-sm font-bold text-slate-800">
                Không tải được dữ liệu địa điểm
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Có thể do mất kết nối mạng hoặc máy chủ đang bận. Vui lòng thử lại.
              </p>
              <button
                onClick={loadPlaces}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition cursor-pointer"
              >
                <RotateCw className="h-3.5 w-3.5" />
                <span>Thử lại</span>
              </button>
            </div>
          ) : !isExploreActive ? (
            <div className="p-8 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-3xl shadow-2xs">
                🗺️
              </div>
              <div className="space-y-1">
                <div className="text-sm font-bold text-slate-800">
                  Khám phá địa điểm cho Boss quanh bạn
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Gõ tên quán, tên đường vào ô tìm kiếm hoặc bật định vị để tải danh sách các quán gần bạn nhất.
                </p>
              </div>
              <div className="flex flex-col gap-2 pt-1">
                <button
                  onClick={handleLocateUser}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-500 transition cursor-pointer"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  <span>Tìm quanh vị trí của tôi</span>
                </button>
                <button
                  onClick={() => setHasTriggeredExplore(true)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  <span>Xem danh sách 20 quán gợi ý</span>
                </button>
              </div>
            </div>
          ) : filteredPlaces.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                🐾
              </div>
              <div className="text-sm font-bold text-slate-800">
                Không tìm thấy địa điểm phù hợp
              </div>
              <p className="text-xs text-slate-500">
                Hãy thử mở rộng bán kính hoặc đổi bộ lọc tìm kiếm!
              </p>
              <button
                onClick={clearAllFilters}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
              >
                Đặt lại tìm kiếm
              </button>
            </div>
          ) : (
            renderPlaceCards()
          )}
        </div>
      </aside>

      {/* Desktop Sidebar Collapse/Expand Toggle Button */}
      <button
        onClick={() => setSidebarOpen((prev) => !prev)}
        title={sidebarOpen ? 'Thu gọn danh sách' : 'Mở danh sách quán'}
        className={`hidden sm:flex fixed top-1/2 z-[930] -translate-y-1/2 h-12 w-6 items-center justify-center rounded-r-xl border border-l-0 border-slate-200 bg-white text-slate-600 shadow-md hover:bg-slate-50 transition-all duration-300 cursor-pointer ${
          sidebarOpen ? 'left-[406px] md:left-[436px]' : 'left-0'
        }`}
      >
        {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      {/* =====================================================================
          4. MOBILE INTERACTIVE BOTTOM SHEET (< sm)
         ===================================================================== */}
      {!selectedPlace && (
        <section
          className={`fixed inset-x-0 bottom-16 z-[910] flex flex-col overflow-hidden rounded-t-3xl border-t border-slate-200/90 bg-white/98 shadow-[0_-10px_35px_rgba(15,23,42,0.16)] backdrop-blur-xl transition-all duration-300 sm:hidden ${
            !isExploreActive
              ? 'max-h-[138px]'
              : mobileSheetMode === 'peek'
              ? 'max-h-[72px]'
              : mobileSheetMode === 'half'
              ? 'max-h-[44dvh]'
              : 'max-h-[78dvh]'
          }`}
        >
          {/* Drag / Tap Handle Bar */}
          <div
            onClick={() => {
              if (!isExploreActive) {
                setHasTriggeredExplore(true);
                setMobileSheetMode('half');
                return;
              }
              setMobileSheetMode((prev) =>
                prev === 'peek' ? 'half' : prev === 'half' ? 'full' : 'peek'
              );
            }}
            className="flex flex-col items-center justify-center border-b border-slate-100 px-4 pt-2 pb-2.5 cursor-pointer"
          >
            <div className="h-1.5 w-10 rounded-full bg-slate-300" />

            {isExploreActive && (
              <div className="mt-2 flex w-full items-center justify-between text-xs">
                <span className="font-bold text-slate-800">
                  {filteredPlaces.length} địa điểm
                  {userLocation
                    ? ` quanh ${inferNearestHcmcDistrict(userLocation.lat, userLocation.lng)}`
                    : ''}
                  {scanningNearby ? ' (Đang quét...)' : ''}
                </span>

                <div className="flex items-center gap-2">
                  {sortByNearest && userLocation && (
                    <select
                      value={String(nearbyRadiusKm)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        setNearbyRadiusKm(
                          e.target.value === 'all' ? 'all' : Number(e.target.value)
                        )
                      }
                      className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-800"
                    >
                      <option value="2">≤ 2 km</option>
                      <option value="3">≤ 3 km</option>
                      <option value="5">≤ 5 km</option>
                      <option value="all">Toàn TP.HCM</option>
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearAllFilters();
                    }}
                    className="text-[11px] font-bold text-emerald-600"
                  >
                    Đặt lại
                  </button>
                  {mobileSheetMode === 'full' ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Mobile Sheet Content */}
          {!isExploreActive ? (
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-extrabold text-slate-900">
                  🐾 Khám phá PetMap quanh bạn
                </div>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                  Bật định vị hoặc tìm kiếm để xem quán cho phép Pet
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={handleLocateUser}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm active:scale-95 transition"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  <span>Gần tôi</span>
                </button>
                <button
                  onClick={() => {
                    setHasTriggeredExplore(true);
                    setMobileSheetMode('half');
                  }}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 active:scale-95 transition"
                >
                  <span>Gợi ý</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {filteredPlaces.length === 0 ? (
                <div className="p-6 text-center space-y-2">
                  <div className="text-sm font-bold text-slate-800">
                    Chưa tìm thấy quán trong bán kính này
                  </div>
                  <div className="flex justify-center gap-2 pt-1">
                    <button
                      onClick={() => setNearbyRadiusKm('all')}
                      className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white"
                    >
                      Mở rộng toàn TP.HCM
                    </button>
                    <button
                      onClick={clearAllFilters}
                      className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
                    >
                      Đặt lại
                    </button>
                  </div>
                </div>
              ) : (
                renderPlaceCards()
              )}
            </div>
          )}
        </section>
      )}

      {/* =====================================================================
          5. MOBILE BOTTOM NAVIGATION BAR (< sm)
         ===================================================================== */}
      <nav className="fixed inset-x-0 bottom-0 z-[940] flex h-16 items-center justify-around border-t border-slate-200/90 bg-white/98 px-2 shadow-[0_-4px_20px_rgba(15,23,42,0.08)] backdrop-blur-lg sm:hidden">
        <button
          onClick={() => {
            setSelectedPlace(null);
            setOnlySavedFilter(false);
            setHasTriggeredExplore(true);
            setMobileSheetMode((prev) => (prev === 'peek' ? 'half' : 'peek'));
          }}
          className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 text-[10px] font-bold transition ${
            isExploreActive && !onlySavedFilter && !sortByNearest
              ? 'text-emerald-600'
              : 'text-slate-500'
          }`}
        >
          <Compass className="h-5 w-5" />
          <span>Khám phá</span>
        </button>

        <button
          onClick={() => {
            setSelectedPlace(null);
            handleLocateUser();
          }}
          className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 text-[10px] font-bold transition ${
            sortByNearest ? 'text-blue-600' : 'text-slate-500'
          }`}
        >
          <Navigation className="h-5 w-5" />
          <span>Gần tôi</span>
        </button>

        {/* Center Floating Add Button */}
        <button
          onClick={() => {
            setPickedCoords({ lat: mapCenter.lat, lng: mapCenter.lng });
            setIsAddModalOpen(true);
          }}
          className="-mt-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-600/30 ring-4 ring-white active:scale-95 transition"
        >
          <Plus className="h-6 w-6 stroke-[2.5]" />
        </button>

        <button
          onClick={() => {
            setSelectedPlace(null);
            setHasTriggeredExplore(true);
            setOnlySavedFilter((prev) => !prev);
            setMobileSheetMode('half');
          }}
          className={`relative flex flex-col items-center justify-center gap-0.5 px-3 py-1 text-[10px] font-bold transition ${
            onlySavedFilter ? 'text-rose-600' : 'text-slate-500'
          }`}
        >
          <Heart className={`h-5 w-5 ${onlySavedFilter ? 'fill-rose-500 text-rose-500' : ''}`} />
          <span>Đã lưu</span>
          {savedIds.length > 0 && (
            <span className="absolute top-0.5 right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
              {savedIds.length}
            </span>
          )}
        </button>

        <button
          onClick={handleOpenPetProfileClick}
          className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 text-[10px] font-bold transition ${
            petProfile || currentUser ? 'text-amber-600' : 'text-slate-500'
          }`}
        >
          <PawPrint className="h-5 w-5" />
          <span className="max-w-[60px] truncate">
            {petProfile ? petProfile.name : currentUser ? 'Hồ sơ Boss' : 'Đăng nhập'}
          </span>
        </button>
      </nav>

      {/* =====================================================================
          6. SELECTED PLACE DETAIL SHEET & MODALS
         ===================================================================== */}
      <PlaceDetailSheet
        place={selectedPlace}
        onClose={() => setSelectedPlace(null)}
        isSaved={selectedPlace ? savedIds.includes(selectedPlace.id) : false}
        isRoutingThisPlace={
          Boolean(selectedPlace && routeTargetPlace?.id === selectedPlace.id)
        }
        onShowRouteOnApp={handleStartRouteOnApp}
        onToggleSave={handleToggleSavePlace}
        petProfile={petProfile}
        userLocation={userLocation}
        onPlaceUpdated={(updated) => {
          setPlaces((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          setSelectedPlace(updated);
        }}
        onUpdatePolicy={handleUpdatePlacePolicy}
        collections={collections}
        onTogglePlaceInCollection={handleTogglePlaceInCollection}
        onCreateCollection={(name) => {
          const next = createCollection(name);
          setCollections(next);
        }}
        onRequestCheckIn={() => {
          if (selectedPlace) setCheckinPlaceId(selectedPlace.id);
          setIsCheckInOpen(true);
        }}
      />

      <AddPlaceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        initialCoords={pickedCoords}
        onRequestPickOnMap={() => {
          setIsPickingLocation(true);
          if (window.innerWidth < 640) setSidebarOpen(false);
        }}
        onSubmitPlace={handleCreatePlace}
      />

      <CheckInModal
        isOpen={isCheckInOpen}
        onClose={() => {
          setIsCheckInOpen(false);
          setCheckinPlaceId(null);
          // Gỡ ?checkin= khỏi URL để không tự mở lại khi tải lại trang
          if (window.location.search.includes('checkin=')) {
            window.history.replaceState({}, '', window.location.pathname);
          }
        }}
        places={places}
        pets={userPets}
        activePetId={activePetId}
        authorName={currentUser?.email?.split('@')[0] || petProfile?.name || 'Người dùng PetMap'}
        userId={currentUser?.id}
        initialPlaceId={checkinPlaceId}
        onCheckedIn={(checkin: CheckIn) => {
          setFeedRefreshToken((t) => t + 1);
          showToast(`✓ Đã check-in tại ${checkin.placeName}!`);
          loadPlaces();
        }}
      />

      <ActivityFeedModal
        isOpen={isFeedOpen}
        onClose={() => setIsFeedOpen(false)}
        refreshToken={feedRefreshToken}
        myStats={{
          saved: savedIds.length,
          collections: collections.length,
          pets: userPets.length,
        }}
        pets={userPets}
        onReopenGuide={() => {
          setIsFeedOpen(false);
          setShowOnboarding(true);
        }}
      />

      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => {
          setShowOnboarding(false);
          localStorage.setItem('petmap_onboarded_v1', '1');
        }}
      />

      <PetProfileModal
        isOpen={isPetProfileModalOpen}
        onClose={() => {
          setIsPetProfileModalOpen(false);
          setInitialLookupPetCode(undefined);
        }}
        pets={userPets}
        activePetId={activePetId}
        onSelectActivePet={(id) => setActivePetId(id)}
        onSavePet={handleSavePetItem}
        onDeletePet={handleDeletePetItem}
        initialLookupCode={initialLookupPetCode}
        initialTab={petModalInitialTab}
        isAuthenticated={Boolean(currentUser)}
        onRequestLogin={() => {
          setIsPetProfileModalOpen(false);
          setPendingOpenPetModal(true);
          setIsAuthModalOpen(true);
        }}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setPendingOpenPetModal(false);
        }}
        reasonMessage={authReason}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}

export default App;

