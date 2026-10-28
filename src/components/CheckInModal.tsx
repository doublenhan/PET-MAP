import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  X,
  QrCode,
  MapPin,
  ShieldCheck,
  AlertTriangle,
  Star,
  Loader2,
  CheckCircle2,
  PawPrint,
} from 'lucide-react';
import { Place, PetProfile, CheckIn } from '../types/place';
import {
  parseCheckinQr,
  distanceMeters,
  CHECKIN_RADIUS_METERS,
  createCheckin,
} from '../services/checkinService';
import { addPlaceReview } from '../services/placeService';

interface CheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  places: Place[];
  pets: PetProfile[];
  activePetId: string | null;
  authorName: string;
  userId?: string;
  initialPlaceId?: string | null;
  onCheckedIn: (checkin: CheckIn, place: Place) => void;
}

type Phase = 'scanning' | 'form' | 'done';
type GpsStatus = 'checking' | 'near' | 'far' | 'denied';

const QR_REGION_ID = 'petmap-qr-reader';

export const CheckInModal: React.FC<CheckInModalProps> = ({
  isOpen,
  onClose,
  places,
  pets,
  activePetId,
  authorName,
  userId,
  initialPlaceId,
  onCheckedIn,
}) => {
  const [phase, setPhase] = useState<Phase>('scanning');
  const [scanError, setScanError] = useState('');
  const [scannedPlace, setScannedPlace] = useState<Place | null>(null);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('checking');
  const [distance, setDistance] = useState<number | null>(null);

  const [petId, setPetId] = useState<string | null>(activePetId);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);

  // Kiểm tra GPS: so khoảng cách tới quán. Chỉ đạt khi <= bán kính cho phép.
  const verifyGps = (place: Place) => {
    setGpsStatus('checking');
    setDistance(null);
    if (!navigator.geolocation) {
      setGpsStatus('denied');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const d = distanceMeters(pos.coords.latitude, pos.coords.longitude, place.lat, place.lng);
        setDistance(Math.round(d));
        setGpsStatus(d <= CHECKIN_RADIUS_METERS ? 'near' : 'far');
      },
      () => setGpsStatus('denied'),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const stopScanner = async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner) {
      try {
        await scanner.stop();
        scanner.clear();
      } catch {
        // ignore stop errors
      }
    }
  };

  // Khi quét được QR hợp lệ: tìm quán + kiểm tra GPS
  const handleDecoded = async (decodedText: string) => {
    if (handledRef.current) return;
    const placeId = parseCheckinQr(decodedText);
    if (!placeId) {
      setScanError('Mã QR không phải mã check-in của PetMap.');
      return;
    }
    const place = places.find((p) => p.id === placeId);
    if (!place) {
      setScanError('Quán của mã QR này chưa có trên PetMap.');
      return;
    }
    handledRef.current = true;
    setScanError('');
    setScannedPlace(place);
    await stopScanner();
    setPhase('form');

    // Xác thực vị trí GPS (bắt buộc)
    verifyGps(place);
  };

  // Khi mở từ LINK QR (có sẵn placeId): vào thẳng form + xác thực GPS, bỏ qua camera.
  useEffect(() => {
    if (!isOpen || handledRef.current) return;
    if (initialPlaceId) {
      if (places.length === 0) return; // chờ danh sách quán tải xong
      const place = places.find((p) => p.id === initialPlaceId);
      if (place) {
        handledRef.current = true;
        setScannedPlace(place);
        setPhase('form');
        verifyGps(place);
        return;
      }
      handledRef.current = true;
      setScanError('Không tìm thấy quán từ mã QR. Hãy quét trực tiếp mã tại quầy.');
      setPhase('scanning');
      return;
    }
    setPhase('scanning');
  }, [isOpen, initialPlaceId, places]);

  // Khởi động camera khi ở pha quét
  useEffect(() => {
    if (!isOpen || phase !== 'scanning') return;
    let cancelled = false;
    const start = async () => {
      try {
        const scanner = new Html5Qrcode(QR_REGION_ID);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (text) => handleDecoded(text),
          () => {}
        );
        if (cancelled) await stopScanner();
      } catch {
        setScanError('Không mở được camera. Hãy cấp quyền camera hoặc dùng trình duyệt khác.');
      }
    };
    start();
    return () => {
      cancelled = true;
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, phase]);

  // Reset khi đóng
  useEffect(() => {
    if (!isOpen) {
      setPhase('scanning');
      setScannedPlace(null);
      setScanError('');
      setGpsStatus('checking');
      setDistance(null);
      setPetId(activePetId);
      setRating(5);
      setComment('');
      setSaving(false);
      handledRef.current = false;
    }
  }, [isOpen, activePetId]);

  if (!isOpen) return null;

  const selectedPet = pets.find((p) => p.id === petId) || null;
  const gpsVerified = gpsStatus === 'near';
  const method: CheckIn['method'] = 'qr_gps';

  const handleSubmit = async () => {
    if (!scannedPlace || !gpsVerified) return;
    setSaving(true);
    try {
      const petLabel = selectedPet
        ? `${selectedPet.name} (${selectedPet.breed || 'Boss'} ${selectedPet.weightKg}kg)`
        : '';
      const checkin = await createCheckin({
        placeId: scannedPlace.id,
        placeName: scannedPlace.name,
        petId: selectedPet?.id,
        petName: selectedPet?.name,
        userId,
        authorName,
        rating,
        comment: comment.trim(),
        verified: true,
        method,
      });

      // Tạo review ĐÃ XÁC THỰC gắn với check-in
      if (comment.trim()) {
        await addPlaceReview({
          placeId: scannedPlace.id,
          authorName: `${authorName} ✓`,
          petInfo: petLabel,
          rating,
          comment: comment.trim(),
          policyAccurate: true,
        });
      }

      onCheckedIn(checkin, scannedPlace);
      setPhase('done');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[3500] flex items-end sm:items-center justify-center bg-slate-950/60 p-0 sm:p-4 backdrop-blur-xs">
      <div className="w-full max-w-md overflow-hidden rounded-t-3xl sm:rounded-3xl border border-slate-200 bg-white shadow-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            <div>
              <div className="text-sm font-extrabold leading-none">Check-in tại quán</div>
              <div className="text-[11px] text-emerald-100 mt-0.5">
                Quét mã QR tại quầy để xác nhận bạn đã đến
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-full bg-white/20 p-1.5 hover:bg-white/30 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-4">
          {/* PHA 1: QUÉT QR */}
          {phase === 'scanning' && (
            <div className="space-y-3">
              <div
                id={QR_REGION_ID}
                className="mx-auto w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-900"
              />
              <p className="text-center text-xs text-slate-500">
                Hướng camera vào mã QR PetMap dán tại quán.
              </p>
              {scanError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{scanError}</span>
                </div>
              )}
            </div>
          )}

          {/* PHA 2: FORM CHECK-IN */}
          {phase === 'form' && scannedPlace && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-sm font-extrabold text-slate-900">{scannedPlace.name}</div>
                <div className="text-xs text-slate-500">{scannedPlace.address}</div>
                {/* Trạng thái xác thực GPS */}
                <div className="mt-2">
                  {gpsStatus === 'checking' && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600">
                      <Loader2 className="h-3 w-3 animate-spin" /> Đang xác thực vị trí GPS...
                    </span>
                  )}
                  {gpsStatus === 'near' && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-700">
                      <ShieldCheck className="h-3.5 w-3.5" /> Đã xác thực QR + GPS
                      {distance !== null ? ` (cách ~${distance}m)` : ''}
                    </span>
                  )}
                  {gpsStatus === 'far' && (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-700">
                        <MapPin className="h-3.5 w-3.5" /> Bạn đang cách quán
                        {distance !== null ? ` ~${distance}m` : ''} — cần ở trong phạm vi{' '}
                        {CHECKIN_RADIUS_METERS}m để check-in.
                      </span>
                      <button
                        onClick={() => verifyGps(scannedPlace)}
                        className="rounded-lg bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-rose-500"
                      >
                        Thử lại GPS
                      </button>
                    </div>
                  )}
                  {gpsStatus === 'denied' && (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-700">
                        <AlertTriangle className="h-3.5 w-3.5" /> Chưa bật GPS / bị từ chối quyền. Hãy
                        bật định vị để check-in.
                      </span>
                      <button
                        onClick={() => verifyGps(scannedPlace)}
                        className="rounded-lg bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-rose-500"
                      >
                        Bật lại GPS
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Chọn Boss đi cùng */}
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Đi cùng Boss nào?
                </label>
                {pets.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    Chưa có hồ sơ Boss — bạn vẫn có thể check-in cá nhân.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPetId(null)}
                      className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                        petId === null
                          ? 'border-slate-700 bg-slate-700 text-white'
                          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      Chỉ mình tôi
                    </button>
                    {pets.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPetId(p.id || null)}
                        className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                          petId === p.id
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <PawPrint className="h-3 w-3" />
                        <span>{p.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Đánh giá sao */}
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Đánh giá trải nghiệm
                </label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setRating(s)}
                      aria-label={`${s} sao`}
                      className="cursor-pointer"
                    >
                      <Star
                        className={`h-7 w-7 transition ${
                          s <= rating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Ghi chú / review */}
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Chia sẻ (tuỳ chọn)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder="Boss được chào đón thế nào? Có khu vui chơi, nước cho bé không?"
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={saving || !gpsVerified}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-emerald-500 transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                <span>
                  {saving
                    ? 'Đang check-in...'
                    : gpsVerified
                    ? 'Check-in ngay'
                    : gpsStatus === 'checking'
                    ? 'Đang xác thực vị trí...'
                    : 'Cần bật GPS & ở trong phạm vi quán'}
                </span>
              </button>
            </div>
          )}

          {/* PHA 3: HOÀN TẤT */}
          {phase === 'done' && scannedPlace && (
            <div className="py-6 text-center space-y-3">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <div className="text-base font-extrabold text-slate-900">
                Đã check-in thành công!
              </div>
              <p className="text-sm text-slate-500">
                {selectedPet ? `${selectedPet.name} & bạn` : 'Bạn'} đã ghé{' '}
                <strong className="text-slate-800">{scannedPlace.name}</strong>
                {gpsVerified ? ' — đã xác thực QR + GPS ✓' : '.'}
              </p>
              <button
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 cursor-pointer"
              >
                Xong
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
