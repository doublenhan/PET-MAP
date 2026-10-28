import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  X,
  MapPin,
  Clock,
  Phone,
  ExternalLink,
  Globe,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Edit3,
  Save,
  Star,
  Dog,
  Cat,
  Scale,
  Share2,
  Heart,
  MessageSquarePlus,
  ShieldCheck,
  ThumbsUp,
  ThumbsDown,
  Camera,
  Loader2,
  Route,
  Flag,
  QrCode,
} from 'lucide-react';
import {
  Place,
  PlaceReview,
  PetProfile,
  PLACE_CATEGORIES,
  PET_POLICIES,
  PET_CONDITIONS,
  PetConditionId,
  PetPolicyStatus,
  PetType,
  PlaceReportReason,
  PLACE_REPORT_REASONS,
} from '../types/place';
import {
  fetchReviewsByPlace,
  addPlaceReview,
  createPlaceReport,
  markReviewHelpful,
  getHelpfulVotedIds,
} from '../services/placeService';
import { uploadPlaceImage } from '../services/imageUploadService';
import { buildVenueCheckinPayload } from '../services/checkinService';
import {
  evaluatePetCompatibility,
  calculateDistanceKm,
  evaluateOpeningStatus,
  getCategoryFallbackImage,
} from '../utils/petCompatibility';
import { ConditionBadge } from './ConditionBadge';
import { useConfirm } from './ConfirmDialog';
import { isValidUrl } from '../utils/validation';

interface PlaceDetailSheetProps {
  place: Place | null;
  onClose: () => void;
  isSaved: boolean;
  onToggleSave: (placeId: string) => void;
  petProfile: PetProfile | null;
  userLocation: { lat: number; lng: number } | null;
  isRoutingThisPlace: boolean;
  onShowRouteOnApp: (place: Place) => void;
  onPlaceUpdated?: (place: Place) => void;
  collections?: { id: string; name: string; placeIds: string[] }[];
  onTogglePlaceInCollection?: (collectionId: string, placeId: string) => void;
  onCreateCollection?: (name: string) => void;
  onRequestCheckIn?: () => void;
  onUpdatePolicy: (
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
    >
  ) => Promise<void>;
}

export const PlaceDetailSheet: React.FC<PlaceDetailSheetProps> = ({
  place,
  onClose,
  isSaved,
  onToggleSave,
  petProfile,
  userLocation,
  isRoutingThisPlace,
  onShowRouteOnApp,
  onPlaceUpdated,
  onUpdatePolicy,
  collections,
  onTogglePlaceInCollection,
  onCreateCollection,
  onRequestCheckIn,
}) => {
  const confirm = useConfirm();
  const [isEditing, setIsEditing] = useState(false);
  const [petPolicy, setPetPolicy] = useState<PetPolicyStatus>('allowed');
  const [petConditions, setPetConditions] = useState<PetConditionId[]>([]);
  const [petPolicyNotes, setPetPolicyNotes] = useState('');
  const [allowedPetTypes, setAllowedPetTypes] = useState<PetType[]>(['dog', 'cat']);
  const [maxWeightKg, setMaxWeightKg] = useState<string>('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploadingCover, setUploadingCover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reviews states
  const [reviews, setReviews] = useState<PlaceReview[]>([]);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [authorName, setAuthorName] = useState('');
  const [petInfo, setPetInfo] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewImageUrl, setReviewImageUrl] = useState('');
  const [uploadingReviewImg, setUploadingReviewImg] = useState(false);
  const [votedReviewIds, setVotedReviewIds] = useState<string[]>(() => getHelpfulVotedIds());
  const [policyAccurate, setPolicyAccurate] = useState(true);
  const [submittingReview, setSubmittingReview] = useState(false);

  // Report Issue states
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState<PlaceReportReason>('policy_changed');
  const [reportDetails, setReportDetails] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportSubmittedSuccess, setReportSubmittedSuccess] = useState(false);

  // Bộ sưu tập (collections)
  const [showNewColInput, setShowNewColInput] = useState(false);
  const [newColName, setNewColName] = useState('');

  // Mã QR check-in của quán (để in dán tại quầy)
  const [venueQr, setVenueQr] = useState<string | null>(null);
  const [showVenueQr, setShowVenueQr] = useState(false);

  useEffect(() => {
    if (place) {
      setIsEditing(false);
      setShowReviewForm(false);
      setShowReportForm(false);
      setReportSubmittedSuccess(false);
      setPetPolicy(place.petPolicy);
      setPetConditions(place.petConditions);
      setPetPolicyNotes(place.petPolicyNotes);
      setAllowedPetTypes(place.allowedPetTypes);
      setMaxWeightKg(place.maxWeightKg ? String(place.maxWeightKg) : '');
      setGoogleMapsUrl(place.googleMapsUrl || '');
      setWebsiteUrl(place.websiteUrl || '');
      setImageUrl(place.imageUrl || '');
      if (petProfile) {
        setPetInfo((prev) =>
          prev ? prev : `${petProfile.name} (${petProfile.breed} ${petProfile.weightKg}kg)`
        );
      }
      fetchReviewsByPlace(place.id).then(setReviews);
    }
  }, [place, petProfile]);

  if (!place) return null;

  const compatibility = evaluatePetCompatibility(place, petProfile);
  const distanceKm = userLocation
    ? calculateDistanceKm(userLocation.lat, userLocation.lng, place.lat, place.lng)
    : null;

  const handleUploadNewCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const res = await uploadPlaceImage(file);
      setImageUrl(res.url);
      await onUpdatePolicy(place.id, {
        petPolicy: place.petPolicy,
        petConditions: place.petConditions,
        petPolicyNotes: place.petPolicyNotes,
        allowedPetTypes: place.allowedPetTypes,
        maxWeightKg: place.maxWeightKg,
        googleMapsUrl: place.googleMapsUrl,
        websiteUrl: place.websiteUrl,
        imageUrl: res.url,
      });
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewComment.trim()) return;
    setSubmittingReview(true);
    try {
      const res = await addPlaceReview({
        placeId: place.id,
        authorName: authorName.trim() || 'Sen ẩn danh',
        petInfo: petInfo.trim() || 'Boss cưng',
        rating: reviewRating,
        comment: reviewComment.trim(),
        policyAccurate,
        imageUrl: reviewImageUrl || undefined,
        visitedAt: new Date().toISOString().slice(0, 10),
      });
      setReviews((prev) => [res.review, ...prev]);
      if (res.updatedPlace && onPlaceUpdated) {
        onPlaceUpdated(res.updatedPlace);
      }
      setReviewComment('');
      setReviewImageUrl('');
      setShowReviewForm(false);
    } finally {
      setSubmittingReview(false);
    }
  };

  // Bấm "hữu ích" cho một review (chống bấm nhiều lần trên cùng thiết bị).
  const handleHelpful = async (rev: PlaceReview) => {
    if (votedReviewIds.includes(rev.id)) return;
    const next = (rev.helpfulCount || 0) + 1;
    setVotedReviewIds((prev) => [...prev, rev.id]);
    setReviews((prev) =>
      prev.map((r) => (r.id === rev.id ? { ...r, helpfulCount: next } : r))
    );
    await markReviewHelpful(rev.id, next);
  };

  const handleUploadReviewImage = async (file: File) => {
    setUploadingReviewImg(true);
    try {
      const res = await uploadPlaceImage(file);
      setReviewImageUrl(res.url);
    } catch {
      // ignore upload errors
    } finally {
      setUploadingReviewImg(false);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingReport(true);
    try {
      await createPlaceReport({
        placeId: place.id,
        placeName: place.name,
        reason: reportReason,
        details: reportDetails.trim(),
        reporterName: reporterName.trim() || 'Sen cộng đồng',
      });
      setReportDetails('');
      setShowReportForm(false);
      setReportSubmittedSuccess(true);
      setTimeout(() => setReportSubmittedSuccess(false), 4500);
    } finally {
      setSubmittingReport(false);
    }
  };

  const categoryMeta = PLACE_CATEGORIES[place.category];
  const policyMeta = PET_POLICIES[place.petPolicy];
  const openStatus = evaluateOpeningStatus(place.openingHours);
  const fallbackCoverUrl = getCategoryFallbackImage(place.category);

  const toggleCondition = (cid: PetConditionId) => {
    setPetConditions((prev) =>
      prev.includes(cid) ? prev.filter((item) => item !== cid) : [...prev, cid]
    );
  };

  const togglePetType = (type: PetType) => {
    setAllowedPetTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSave = async () => {
    if (!isValidUrl(googleMapsUrl) || !isValidUrl(websiteUrl) || !isValidUrl(imageUrl)) {
      await confirm({
        title: 'Link không hợp lệ',
        message: 'Các link (Google Maps / Website / Ảnh) phải bắt đầu bằng http:// hoặc https://',
        confirmLabel: 'Đã hiểu',
      });
      return;
    }
    const ok = await confirm({
      title: 'Cập nhật chính sách Pet?',
      message: 'Thay đổi sẽ được lưu và hiển thị cho cả cộng đồng. Xác nhận cập nhật?',
      confirmLabel: 'Lưu cập nhật',
    });
    if (!ok) return;
    setSaving(true);
    try {
      await onUpdatePolicy(place.id, {
        petPolicy,
        petConditions: petPolicy === 'not_allowed' ? [] : petConditions,
        petPolicyNotes,
        allowedPetTypes: petPolicy === 'not_allowed' ? [] : allowedPetTypes,
        maxWeightKg: maxWeightKg ? Number(maxWeightKg) : null,
        googleMapsUrl,
        websiteUrl,
        imageUrl,
      });
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleShare = () => {
    const shareText = `${place.name} (${place.address}) — ${policyMeta.label}: ${place.petPolicyNotes}`;
    navigator.clipboard?.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };


  return (
    <div className="fixed inset-x-0 bottom-0 z-[1020] flex max-h-[84dvh] w-full flex-col overflow-hidden rounded-t-3xl border-t border-slate-200 bg-white shadow-[0_-12px_40px_rgba(15,23,42,0.22)] sm:absolute sm:inset-x-auto sm:top-4 sm:right-4 sm:bottom-4 sm:max-h-none sm:w-[400px] sm:rounded-3xl sm:border sm:shadow-2xl">
      {/* Mobile Pull Handle */}
      <div
        onClick={onClose}
        className="flex sm:hidden w-full items-center justify-center bg-slate-900 pt-2 pb-1 cursor-pointer"
      >
        <div className="h-1.5 w-12 rounded-full bg-white/40" />
      </div>

      {/* Header Cover Image (Redesign 5 + Task #19 Fallback) */}
      <div className="relative h-48 sm:h-52 w-full shrink-0 bg-slate-900 overflow-hidden">
        <img
          src={place.imageUrl || fallbackCoverUrl}
          alt={place.name}
          loading="lazy"
          onError={(e) => {
            const target = e.currentTarget;
            if (target.src !== fallbackCoverUrl) {
              target.src = fallbackCoverUrl;
            }
          }}
          className="h-full w-full object-cover opacity-95 transition-transform duration-500 hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-slate-950/15" />

        {/* Close, Upload Photo, Save & Share buttons */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <label
            title="Tải ảnh thực tế của quán lên Supabase"
            className="flex h-8 items-center gap-1 rounded-full bg-black/45 px-2.5 text-[11px] font-semibold text-white backdrop-blur hover:bg-black/65 transition cursor-pointer"
          >
            {uploadingCover ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
            <span>{uploadingCover ? 'Đang tải...' : 'Đổi ảnh'}</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleUploadNewCover}
              className="hidden"
            />
          </label>
          <button
            onClick={() => onToggleSave(place.id)}
            title={isSaved ? 'Bỏ lưu khỏi danh sách yêu thích' : 'Lưu vào quán yêu thích'}
            className={`flex h-8 w-8 items-center justify-center rounded-full backdrop-blur transition cursor-pointer ${
              isSaved
                ? 'bg-rose-500 text-white shadow-md'
                : 'bg-black/45 text-white hover:bg-black/65'
            }`}
          >
            <Heart className={`h-4 w-4 ${isSaved ? 'fill-white' : ''}`} />
          </button>
          <button
            onClick={handleShare}
            title="Sao chép thông tin quán"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/65 transition cursor-pointer"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/65 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {copied && (
          <div className="absolute top-3 left-3 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white shadow">
            Đã sao chép thông tin!
          </div>
        )}

        {/* Title overlay on image */}
        <div className="absolute bottom-3.5 left-4 right-4 text-white">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-lg bg-white/20 px-2 py-0.5 text-[11px] font-semibold backdrop-blur-md">
              <span>{categoryMeta.emoji}</span>
              <span>{categoryMeta.label}</span>
            </span>
            {openStatus && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900/75 border border-white/15 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur-md">
                <span className={`h-2 w-2 rounded-full ${openStatus.dotClass}`} />
                <span>{openStatus.shortLabel}</span>
              </span>
            )}
            {place.rating && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-400/25 px-2 py-0.5 text-[11px] font-bold text-amber-300 backdrop-blur-md">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {place.rating.toFixed(1)} ({place.reviewCount || reviews.length || 1})
              </span>
            )}
            {place.verified && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/30 px-2 py-0.5 text-[11px] font-semibold text-emerald-200 backdrop-blur-md">
                <ShieldCheck className="h-3.5 w-3.5" /> Đã xác thực
              </span>
            )}
          </div>
          <h2 className="mt-1.5 text-lg font-extrabold leading-snug tracking-tight">
            {place.name}
          </h2>
          <p className="text-xs text-slate-200 opacity-90 line-clamp-1">
            {place.address} • {place.district}
          </p>
        </div>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Check-in tại quán (QR + GPS) */}
        {onRequestCheckIn && (
          <button
            onClick={onRequestCheckIn}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-sm font-extrabold text-white shadow-sm hover:from-emerald-500 hover:to-teal-500 transition cursor-pointer"
          >
            <QrCode className="h-4 w-4" />
            <span>Check-in tại đây (quét QR)</span>
          </button>
        )}

        {/* Mã QR của quán — để chủ quán/Admin in dán tại quầy */}
        {place && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <button
              onClick={async () => {
                if (!showVenueQr && !venueQr) {
                  try {
                    const url = await QRCode.toDataURL(buildVenueCheckinPayload(place.id), {
                      width: 320,
                      margin: 2,
                      color: { dark: '#0f172a', light: '#ffffff' },
                    });
                    setVenueQr(url);
                  } catch {
                    /* ignore */
                  }
                }
                setShowVenueQr((v) => !v);
              }}
              className="flex w-full items-center justify-between gap-2 text-xs font-bold text-slate-700 cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <QrCode className="h-4 w-4 text-slate-500" />
                Mã QR check-in của quán (để in dán tại quầy)
              </span>
              <span className="text-slate-400">{showVenueQr ? '▲' : '▼'}</span>
            </button>
            {showVenueQr && venueQr && (
              <div className="mt-3 flex flex-col items-center gap-2">
                <img
                  src={venueQr}
                  alt={`QR check-in ${place.name}`}
                  className="h-40 w-40 rounded-xl border border-slate-200 bg-white p-1.5"
                />
                <p className="text-center text-[11px] text-slate-500">
                  Khách quét mã này bằng <strong>camera điện thoại</strong> (hoặc trong app) để tự
                  mở trang check-in cùng Boss — không cần cài app.
                </p>
                <a
                  href={venueQr}
                  download={`PetMap-QR-${place.name.replace(/[^a-zA-Z0-9]/g, '_')}.png`}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
                >
                  Tải ảnh QR
                </a>
              </div>
            )}
          </div>
        )}

        {/* Bộ sưu tập: lưu địa điểm vào danh sách đặt tên */}
        {onTogglePlaceInCollection && (
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-3">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-indigo-900">
              <span>📁</span>
              <span>Lưu vào bộ sưu tập</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {(collections || []).map((col) => {
                const inCol = col.placeIds.includes(place.id);
                return (
                  <button
                    key={col.id}
                    onClick={() => onTogglePlaceInCollection(col.id, place.id)}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                      inCol
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-100'
                    }`}
                  >
                    {inCol ? <CheckCircle2 className="h-3 w-3" /> : null}
                    <span>{col.name}</span>
                  </button>
                );
              })}
              {showNewColInput && onCreateCollection ? (
                <input
                  autoFocus
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newColName.trim()) {
                      onCreateCollection(newColName.trim());
                      setNewColName('');
                      setShowNewColInput(false);
                    }
                    if (e.key === 'Escape') {
                      setShowNewColInput(false);
                      setNewColName('');
                    }
                  }}
                  onBlur={() => {
                    if (newColName.trim()) onCreateCollection(newColName.trim());
                    setNewColName('');
                    setShowNewColInput(false);
                  }}
                  placeholder="Tên bộ sưu tập mới..."
                  className="w-40 rounded-lg border border-indigo-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              ) : (
                onCreateCollection && (
                  <button
                    onClick={() => setShowNewColInput(true)}
                    className="inline-flex items-center gap-0.5 rounded-lg border border-dashed border-indigo-300 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 transition cursor-pointer"
                  >
                    <span className="text-sm leading-none">+</span>
                    <span>Tạo mới</span>
                  </button>
                )
              )}
            </div>
          </div>
        )}

        {/* My Pet Compatibility Card */}
        {compatibility && petProfile && (
          <div
            className={`rounded-2xl border p-3 ${
              compatibility.status === 'perfect'
                ? 'border-emerald-200 bg-emerald-50/80 text-emerald-900'
                : compatibility.status === 'conditional_ok'
                ? 'border-amber-200 bg-amber-50/80 text-amber-900'
                : 'border-rose-200 bg-rose-50/80 text-rose-900'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold">
                🐾 Đánh giá cho {petProfile.name} ({petProfile.weightKg}kg):{' '}
                {compatibility.label}
              </span>
              {petProfile.identityCode && (
                <span className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700 border border-slate-200/70">
                  #{petProfile.identityCode}
                </span>
              )}
            </div>
            <ul className="mt-1 list-disc list-inside text-xs space-y-0.5 opacity-90">
              {compatibility.reasons.map((r, idx) => (
                <li key={idx}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Pet Policy Status Banner */}
        <div
          className={`rounded-2xl border p-3.5 ${policyMeta.badgeBg} ${policyMeta.badgeBorder}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm`}
                style={{ backgroundColor: policyMeta.markerColor }}
              >
                {place.petPolicy === 'allowed' && <CheckCircle2 className="h-5 w-5" />}
                {place.petPolicy === 'conditional' && <AlertTriangle className="h-5 w-5" />}
                {place.petPolicy === 'not_allowed' && <XCircle className="h-5 w-5" />}
              </div>
              <div>
                <div className={`text-sm font-bold ${policyMeta.badgeText}`}>
                  {policyMeta.label}
                </div>
                <p className="text-xs text-slate-600 mt-0.5">{policyMeta.description}</p>
              </div>
            </div>

            <button
              onClick={() => setIsEditing((prev) => !prev)}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-300/80 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <Edit3 className="h-3 w-3" />
              <span>{isEditing ? 'Huỷ' : 'Sửa'}</span>
            </button>
          </div>

          {/* Allowed Pet Types & Weight Limit */}
          {place.petPolicy !== 'not_allowed' && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200/70 pt-2.5 text-xs">
              <span className="font-medium text-slate-500">Nhận:</span>
              {place.allowedPetTypes.includes('dog') && (
                <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 font-medium text-slate-700 shadow-2xs">
                  <Dog className="h-3.5 w-3.5 text-amber-600" /> Chó
                </span>
              )}
              {place.allowedPetTypes.includes('cat') && (
                <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 font-medium text-slate-700 shadow-2xs">
                  <Cat className="h-3.5 w-3.5 text-indigo-600" /> Mèo
                </span>
              )}
              {place.allowedPetTypes.includes('other') && (
                <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 font-medium text-slate-700 shadow-2xs">
                  🐰 Thú nhỏ khác
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 font-medium text-slate-700 shadow-2xs">
                <Scale className="h-3.5 w-3.5 text-teal-600" />
                {place.maxWeightKg ? `Tối đa ${place.maxWeightKg}kg` : 'Không giới hạn kg'}
              </span>
            </div>
          )}
        </div>

        {/* Inline Editor for Pet Policy & Links */}
        {isEditing ? (
          <div className="space-y-3 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-3.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900">
              Cập nhật chính sách Pet & Link
            </h4>

            <div className="grid grid-cols-3 gap-1.5">
              {(['allowed', 'conditional', 'not_allowed'] as PetPolicyStatus[]).map((status) => {
                const meta = PET_POLICIES[status];
                const active = petPolicy === status;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setPetPolicy(status)}
                    className={`rounded-xl border px-2 py-2 text-center text-xs font-semibold transition cursor-pointer ${
                      active
                        ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {meta.shortLabel}
                  </button>
                );
              })}
            </div>

            {petPolicy !== 'not_allowed' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Loại thú cưng & Cân nặng tối đa (kg)
                  </label>
                  <div className="flex items-center gap-2">
                    {(['dog', 'cat', 'other'] as PetType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => togglePetType(t)}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-medium cursor-pointer ${
                          allowedPetTypes.includes(t)
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        {t === 'dog' ? '🐶 Chó' : t === 'cat' ? '🐱 Mèo' : '🐰 Khác'}
                      </button>
                    ))}
                    <input
                      type="number"
                      placeholder="Không giới hạn kg"
                      value={maxWeightKg}
                      onChange={(e) => setMaxWeightKg(e.target.value)}
                      className="w-28 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Chọn các điều kiện & tiện ích khi đem Pet theo:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(PET_CONDITIONS) as PetConditionId[]).map((cid) => {
                      const selected = petConditions.includes(cid);
                      return (
                        <button
                          key={cid}
                          type="button"
                          onClick={() => toggleCondition(cid)}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition cursor-pointer ${
                            selected
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
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ghi chú chi tiết khi dẫn Pet đến quán:
              </label>
              <textarea
                rows={3}
                value={petPolicyNotes}
                onChange={(e) => setPetPolicyNotes(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                placeholder="VD: Chỉ được ngồi khu sân vườn, nhớ mang theo dây dắt..."
              />
            </div>

            <div className="grid grid-cols-1 gap-2">
              <input
                type="url"
                value={googleMapsUrl}
                onChange={(e) => setGoogleMapsUrl(e.target.value)}
                placeholder="Link Google Maps (https://maps.google.com/...)"
                className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
              />
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="Link Fanpage / Instagram / Website"
                className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
              />
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{saving ? 'Đang lưu...' : 'Lưu cập nhật'}</span>
            </button>
          </div>
        ) : (
          <>
            {/* Pet Policy Notes */}
            {place.petPolicyNotes && (
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Lưu ý thực tế cho hội nuôi Pet
                </div>
                <p className="mt-1 text-xs sm:text-sm text-slate-700 leading-relaxed">
                  {place.petPolicyNotes}
                </p>
              </div>
            )}

            {/* Detailed Conditions List */}
            {place.petConditions.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Điều kiện & Tiện ích đem Pet theo ({place.petConditions.length})
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {place.petConditions.map((cid) => (
                    <ConditionBadge key={cid} conditionId={cid} showDescription />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Store Location & Contact Info — Redesign 5 Bento Grid */}
        <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Thông tin & Liên kết địa điểm
            </h3>
            {openStatus && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${openStatus.badgeClass}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${openStatus.dotClass}`} />
                <span>{openStatus.label}</span>
              </span>
            )}
          </div>

          {/* 2x2 Bento Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="col-span-2 flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  Địa chỉ ({place.district})
                </div>
                <div className="font-semibold text-slate-900 leading-snug">{place.address}</div>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase text-slate-400">Giờ mở cửa</div>
                <div className="font-semibold text-slate-800 truncate">
                  {place.openingHours || '08:00 - 22:00'}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase text-slate-400">Điện thoại</div>
                {place.phone ? (
                  <a
                    href={`tel:${place.phone}`}
                    className="font-bold text-indigo-600 hover:underline truncate block"
                  >
                    {place.phone}
                  </a>
                ) : (
                  <span className="text-slate-500">Chưa cập nhật</span>
                )}
              </div>
            </div>
          </div>

          {/* Action Links: In-App Route vs Google Maps Redirect */}
          <div className="pt-2 flex flex-col gap-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onShowRouteOnApp(place)}
                className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold text-white shadow-xs transition cursor-pointer ${
                  isRoutingThisPlace
                    ? 'bg-blue-700 ring-2 ring-blue-300'
                    : 'bg-blue-600 hover:bg-blue-500'
                }`}
              >
                <Route className="h-4 w-4 shrink-0" />
                <span>
                  {isRoutingThisPlace ? 'Đang hiện đường đi' : 'Chỉ đường'}{' '}
                  {distanceKm !== null ? `(${distanceKm} km)` : ''}
                </span>
              </button>

              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                <span>Chỉ đường Google Maps</span>
              </a>
            </div>

            {place.websiteUrl && (
              <a
                href={place.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                <Globe className="h-3.5 w-3.5 text-indigo-600" />
                <span>Website / Fanpage của quán</span>
              </a>
            )}
          </div>
        </div>

        {/* Community Reviews & Policy Verification Section */}
        <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-3.5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Đánh giá & Xác thực từ Cộng đồng ({reviews.length})
              </h3>
              <p className="text-[11px] text-slate-500">
                Chia sẻ trải nghiệm thực tế khi dẫn Boss tới quán
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowReviewForm((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition cursor-pointer"
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
              <span>{showReviewForm ? 'Đóng' : 'Viết review'}</span>
            </button>
          </div>

          {showReviewForm && (
            <form
              onSubmit={handleSubmitReview}
              className="space-y-2.5 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3"
            >
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="Tên của bạn (VD: Minh Anh)"
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                />
                <input
                  type="text"
                  value={petInfo}
                  onChange={(e) => setPetInfo(e.target.value)}
                  placeholder="Bé cưng (VD: Corgi 10kg)"
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-slate-600 mr-1">Chấm điểm:</span>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      className="p-0.5 cursor-pointer"
                    >
                      <Star
                        className={`h-4 w-4 ${
                          star <= reviewRating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPolicyAccurate(true)}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold cursor-pointer ${
                      policyAccurate
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <ThumbsUp className="h-3 w-3" /> Đúng quy định Pet
                  </button>
                  <button
                    type="button"
                    onClick={() => setPolicyAccurate(false)}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold cursor-pointer ${
                      !policyAccurate
                        ? 'border-rose-600 bg-rose-600 text-white'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <ThumbsDown className="h-3 w-3" /> Đã thay đổi
                  </button>
                </div>
              </div>

              <textarea
                rows={2}
                required
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Chia sẻ trải nghiệm chỗ ngồi, thái độ nhân viên với bé cưng..."
                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs focus:border-emerald-500 focus:outline-none"
              />

              {/* Đính kèm ảnh cho review */}
              <div className="flex items-center gap-2">
                {reviewImageUrl ? (
                  <div className="relative">
                    <img
                      src={reviewImageUrl}
                      alt="Ảnh đính kèm"
                      className="h-14 w-14 rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setReviewImageUrl('')}
                      className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 text-white cursor-pointer"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ) : (
                  <label className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
                    {uploadingReviewImg ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Camera className="h-3 w-3" />
                    )}
                    <span>{uploadingReviewImg ? 'Đang tải...' : 'Thêm ảnh'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadReviewImage(f);
                      }}
                    />
                  </label>
                )}
              </div>

              <button
                type="submit"
                disabled={submittingReview}
                className="w-full rounded-lg bg-slate-900 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                {submittingReview ? 'Đang gửi...' : 'Gửi đánh giá & Xác thực'}
              </button>
            </form>
          )}

          {reviews.length === 0 ? (
            <p className="py-2 text-center text-xs text-slate-400">
              Chưa có đánh giá nào. Hãy là người đầu tiên review địa điểm này!
            </p>
          ) : (
            <div className="space-y-2.5">
              {reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-slate-800">
                      {rev.authorName}{' '}
                      {rev.petInfo && (
                        <span className="font-normal text-slate-500">• 🐾 {rev.petInfo}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 text-amber-500">
                      {Array.from({ length: rev.rating }).map((_, idx) => (
                        <Star key={idx} className="h-3 w-3 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                  </div>

        {/* Report Issue / Outdated Info Section */}
        <div className="rounded-2xl border border-rose-200/70 bg-rose-50/40 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-rose-600 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-slate-800">
                  Phát hiện thông tin chưa chính xác?
                </h4>
                <p className="text-[11px] text-slate-500">
                  Báo cho Admin nếu quán đổi quy định Pet hoặc đóng cửa
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowReportForm((prev) => !prev)}
              className="shrink-0 rounded-xl border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
            >
              {showReportForm ? 'Huỷ' : '🚩 Báo cáo'}
            </button>
          </div>

          {reportSubmittedSuccess && (
            <div className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">
              ✓ Cảm ơn bạn! Báo cáo đã được gửi tới Admin Portal để kiểm tra và cập nhật.
            </div>
          )}

          {showReportForm && (
            <form onSubmit={handleSubmitReport} className="space-y-2.5 pt-1">
              <div className="grid grid-cols-1 gap-1.5">
                {(Object.keys(PLACE_REPORT_REASONS) as PlaceReportReason[]).map((rKey) => {
                  const item = PLACE_REPORT_REASONS[rKey];
                  const active = reportReason === rKey;
                  return (
                    <button
                      key={rKey}
                      type="button"
                      onClick={() => setReportReason(rKey)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition cursor-pointer ${
                        active
                          ? 'border-rose-600 bg-rose-600 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>{item.emoji}</span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              <input
                type="text"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                placeholder="Tên của bạn (Tuỳ chọn)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-rose-500 focus:outline-none"
              />

              <textarea
                rows={2}
                required
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Mô tả chi tiết (VD: Quán vừa thông báo từ tháng này không nhận chó trên 10kg...)"
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs focus:border-rose-500 focus:outline-none"
              />

              <button
                type="submit"
                disabled={submittingReport}
                className="w-full rounded-xl bg-rose-600 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-500 disabled:opacity-50 cursor-pointer"
              >
                {submittingReport ? 'Đang gửi báo cáo...' : 'Gửi báo cáo cho Admin'}
              </button>
            </form>
          )}
        </div>
                  <p className="mt-1 text-slate-700 leading-relaxed">{rev.comment}</p>
                  {rev.imageUrl && (
                    <img
                      src={rev.imageUrl}
                      alt="Ảnh review"
                      loading="lazy"
                      className="mt-2 h-32 w-full rounded-lg object-cover"
                    />
                  )}
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                    <span
                      className={
                        rev.policyAccurate
                          ? 'font-medium text-emerald-600'
                          : 'font-medium text-rose-600'
                      }
                    >
                      {rev.policyAccurate
                        ? '✓ Xác nhận chính sách Pet chính xác'
                        : '⚠ Báo cáo chính sách Pet đã thay đổi'}
                    </span>
                    {rev.visitedAt && <span>{rev.visitedAt}</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleHelpful(rev)}
                    disabled={votedReviewIds.includes(rev.id)}
                    className={`mt-2 inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition cursor-pointer disabled:cursor-default ${
                      votedReviewIds.includes(rev.id)
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <ThumbsUp
                      className={`h-3 w-3 ${
                        votedReviewIds.includes(rev.id) ? 'fill-emerald-500 text-emerald-500' : ''
                      }`}
                    />
                    <span>Hữu ích{rev.helpfulCount ? ` (${rev.helpfulCount})` : ''}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
