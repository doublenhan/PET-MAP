import React, { useState } from 'react';
import QRCode from 'qrcode';
import {
  ShieldCheck,
  Share2,
  Check,
  Printer,
  RotateCw,
  Phone,
  Cloud,
  AlertCircle,
  Camera,
  Download,
} from 'lucide-react';
import { PetProfile } from '../types/place';

interface PetIdCardViewProps {
  pet: PetProfile;
  compact?: boolean;
  onSelectAvatarFile?: (file: File) => void;
  uploadingAvatar?: boolean;
}

const DEFAULT_PET_PORTRAITS: Record<string, string> = {
  dog: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=500&q=80',
  cat: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=500&q=80',
  other:
    'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?auto=format&fit=crop&w=500&q=80',
};

// Ruột SVG quốc huy (viewBox 0 0 120 120) — dùng chung cho bản in & ảnh PNG.
const PET_EMBLEM_INNER = `
  <defs>
    <radialGradient id="emBg" cx="50%" cy="30%" r="80%">
      <stop offset="0%" stop-color="#10b981"/><stop offset="100%" stop-color="#065f46"/>
    </radialGradient>
    <linearGradient id="emGold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fff3c4"/><stop offset="45%" stop-color="#fbbf24"/><stop offset="100%" stop-color="#b45309"/>
    </linearGradient>
  </defs>
  <circle cx="60" cy="60" r="58" fill="url(#emBg)"/>
  <circle cx="60" cy="60" r="57" fill="none" stroke="url(#emGold)" stroke-width="3.5"/>
  <circle cx="60" cy="60" r="48" fill="none" stroke="#fcd34d" stroke-width="1" opacity="0.5"/>
  <path d="M60 15 l3 6.4 7 1 -5 4.9 1.2 7 -6.2 -3.3 -6.2 3.3 1.2 -7 -5 -4.9 7 -1 Z" fill="url(#emGold)"/>
  <g stroke="url(#emGold)" stroke-width="2.2" fill="none" stroke-linecap="round">
    <path d="M40 99 Q 27 74 34 46"/>
    <path d="M80 99 Q 93 74 86 46"/>
  </g>
  <g fill="url(#emGold)">
    <ellipse cx="31" cy="52" rx="3.1" ry="6.4" transform="rotate(-50 31 52)"/>
    <ellipse cx="29" cy="64" rx="3.1" ry="6.4" transform="rotate(-32 29 64)"/>
    <ellipse cx="31" cy="76" rx="3.1" ry="6.4" transform="rotate(-16 31 76)"/>
    <ellipse cx="36" cy="88" rx="3" ry="6" transform="rotate(-4 36 88)"/>
    <ellipse cx="89" cy="52" rx="3.1" ry="6.4" transform="rotate(50 89 52)"/>
    <ellipse cx="91" cy="64" rx="3.1" ry="6.4" transform="rotate(32 91 64)"/>
    <ellipse cx="89" cy="76" rx="3.1" ry="6.4" transform="rotate(16 89 76)"/>
    <ellipse cx="84" cy="88" rx="3" ry="6" transform="rotate(4 84 88)"/>
  </g>
  <g fill="url(#emGold)">
    <path d="M60 58 C 71 58 78 66 78 74 C 78 82 70 86 60 86 C 50 86 42 82 42 74 C 42 66 49 58 60 58 Z"/>
    <ellipse cx="43" cy="55" rx="5" ry="7.4" transform="rotate(-18 43 55)"/>
    <ellipse cx="53" cy="47" rx="5.3" ry="8" transform="rotate(-6 53 47)"/>
    <ellipse cx="67" cy="47" rx="5.3" ry="8" transform="rotate(6 67 47)"/>
    <ellipse cx="77" cy="55" rx="5" ry="7.4" transform="rotate(18 77 55)"/>
  </g>`;

/** Quốc huy Thú cưng (Pet National Emblem) v2 — dùng chung cho thẻ hiển thị & bản in */
const PetNationalEmblem: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 120 120" className={className} aria-label="Quốc huy Thú cưng PetMap" role="img">
    <defs>
      <radialGradient id="petEmBg" cx="50%" cy="30%" r="80%">
        <stop offset="0%" stopColor="#10b981" />
        <stop offset="100%" stopColor="#065f46" />
      </radialGradient>
      <linearGradient id="petEmGold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#fff3c4" />
        <stop offset="45%" stopColor="#fbbf24" />
        <stop offset="100%" stopColor="#b45309" />
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="58" fill="url(#petEmBg)" />
    <circle cx="60" cy="60" r="57" fill="none" stroke="url(#petEmGold)" strokeWidth="3.5" />
    <circle cx="60" cy="60" r="48" fill="none" stroke="#fcd34d" strokeWidth="1" opacity="0.5" />
    <path
      d="M60 15 l3 6.4 7 1 -5 4.9 1.2 7 -6.2 -3.3 -6.2 3.3 1.2 -7 -5 -4.9 7 -1 Z"
      fill="url(#petEmGold)"
    />
    <g stroke="url(#petEmGold)" strokeWidth="2.2" fill="none" strokeLinecap="round">
      <path d="M40 99 Q 27 74 34 46" />
      <path d="M80 99 Q 93 74 86 46" />
    </g>
    <g fill="url(#petEmGold)">
      <ellipse cx="31" cy="52" rx="3.1" ry="6.4" transform="rotate(-50 31 52)" />
      <ellipse cx="29" cy="64" rx="3.1" ry="6.4" transform="rotate(-32 29 64)" />
      <ellipse cx="31" cy="76" rx="3.1" ry="6.4" transform="rotate(-16 31 76)" />
      <ellipse cx="36" cy="88" rx="3" ry="6" transform="rotate(-4 36 88)" />
      <ellipse cx="89" cy="52" rx="3.1" ry="6.4" transform="rotate(50 89 52)" />
      <ellipse cx="91" cy="64" rx="3.1" ry="6.4" transform="rotate(32 91 64)" />
      <ellipse cx="89" cy="76" rx="3.1" ry="6.4" transform="rotate(16 89 76)" />
      <ellipse cx="84" cy="88" rx="3" ry="6" transform="rotate(4 84 88)" />
    </g>
    <g fill="url(#petEmGold)">
      <path d="M60 58 C 71 58 78 66 78 74 C 78 82 70 86 60 86 C 50 86 42 82 42 74 C 42 66 49 58 60 58 Z" />
      <ellipse cx="43" cy="55" rx="5" ry="7.4" transform="rotate(-18 43 55)" />
      <ellipse cx="53" cy="47" rx="5.3" ry="8" transform="rotate(-6 53 47)" />
      <ellipse cx="67" cy="47" rx="5.3" ry="8" transform="rotate(6 67 47)" />
      <ellipse cx="77" cy="55" rx="5" ry="7.4" transform="rotate(18 77 55)" />
    </g>
  </svg>
);

/**
 * Tạo ma trận QR SVG 15x15 deterministic từ chuỗi Mã Định Danh (không phụ thuộc mạng ngoài)
 */
function generateDeterministicQrMatrix(seedText: string): boolean[][] {
  const size = 15;
  const grid: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  );

  const drawFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const isBorder = r === 0 || r === 4 || c === 0 || c === 4;
        const isCenter = r === 2 && c === 2;
        grid[r0 + r][c0 + c] = isBorder || isCenter;
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 5);
  drawFinder(size - 5, 0);

  let hash = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    hash ^= seedText.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inTopLeft = r < 6 && c < 6;
      const inTopRight = r < 6 && c >= size - 6;
      const inBottomLeft = r >= size - 6 && c < 6;
      if (inTopLeft || inTopRight || inBottomLeft) continue;

      hash ^= (r * 31 + c * 17) & 0xff;
      hash = Math.imul(hash, 16777619);
      grid[r][c] = Math.abs(hash) % 10 < 5;
    }
  }

  return grid;
}

/** Tạo ma trận QR THẬT (quét được) từ chuỗi; fallback QR trang trí nếu lỗi. */
function buildQrMatrix(text: string): boolean[][] {
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const size = qr.modules.size;
    const data = qr.modules.data;
    const grid: boolean[][] = [];
    for (let r = 0; r < size; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < size; c++) row.push(Boolean(data[r * size + c]));
      grid.push(row);
    }
    return grid;
  } catch {
    return generateDeterministicQrMatrix(text);
  }
}

export const PetIdCardView: React.FC<PetIdCardViewProps> = ({
  pet,
  onSelectAvatarFile,
  uploadingAvatar,
}) => {
  const [copied, setCopied] = useState(false);
  const [isBackSide, setIsBackSide] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [savingImage, setSavingImage] = useState(false);

  const displayCode =
    pet.identityCode && pet.identityCode.trim()
      ? pet.identityCode.trim().toUpperCase()
      : `VN-${pet.type.toUpperCase()}-${(pet.id || pet.name)
          .replace(/[^a-zA-Z0-9]/g, '')
          .slice(0, 6)
          .toUpperCase()
          .padEnd(6, '8')}`;

  // QR thật trỏ tới trang tra cứu Boss (quét bằng camera điện thoại sẽ mở link này).
  const lookupUrl = `${window.location.origin}/?petId=${encodeURIComponent(displayCode)}`;
  const qrMatrix = buildQrMatrix(lookupUrl);

  const speciesLabel =
    pet.type === 'dog'
      ? 'Chó / Dog'
      : pet.type === 'cat'
      ? 'Mèo / Cat'
      : 'Thú nhỏ / Small Pet';

  const portraitUrl =
    !imgError && pet.avatarUrl && pet.avatarUrl.trim()
      ? pet.avatarUrl.trim()
      : DEFAULT_PET_PORTRAITS[pet.type] || DEFAULT_PET_PORTRAITS.dog;

  const handleCopyShareLink = () => {
    const shareUrl = `${window.location.origin}/?petId=${encodeURIComponent(displayCode)}`;
    const text = `🪪 Căn Cước Thú Cưng PetMap: ${pet.name.toUpperCase()} (Số định danh: ${displayCode}) — ${
      pet.breed || speciesLabel
    }, ${pet.weightKg}kg.${pet.ownerPhone ? ` SĐT Liên hệ: ${pet.ownerPhone}.` : ''} Tra cứu tại: ${shareUrl}`;
    // Ưu tiên chia sẻ gốc (Web Share API) trên điện thoại; fallback sao chép.
    if (navigator.share) {
      navigator
        .share({ title: `Thẻ Boss ${pet.name}`, text, url: shareUrl })
        .catch(() => {
          navigator.clipboard?.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2200);
        });
      return;
    }
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  // Task #17: In Thẻ Căn Cước Boss — CHUẨN KÍCH THƯỚC CCCD (ISO/IEC 7810 ID-1)
  //   • 85,6 × 53,98 mm • bo góc r = 3,18 mm • ảnh chân dung 20 × 30 mm
  //   • Quốc huy Thú cưng (Pet National Emblem) đường kính 12 mm
  const handlePrintIdCard = () => {
    const printWin = window.open('', '_blank', 'width=1000,height=720');
    if (!printWin) {
      window.print();
      return;
    }

    // Chống XSS: escape mọi chuỗi người dùng nhập trước khi chèn vào HTML cửa sổ in
    const esc = (v: string | number | undefined | null) =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const safeName = esc(pet.name);
    const safeBreed = pet.breed && pet.breed.trim() ? esc(pet.breed.trim()) : '-';
    const safeCode = esc(displayCode);
    const safePortrait = esc(portraitUrl);
    const safeSpecies = esc(speciesLabel);
    const safePhone = pet.ownerPhone ? esc(pet.ownerPhone) : '-';

    const vaccineVi = pet.vaccinated ? 'Đã tiêm phòng' : 'Chưa tiêm phòng';
    const equipVi = equipmentSummary && equipmentSummary.trim() ? esc(equipmentSummary) : '-';
    const issueDate = new Date().toLocaleDateString('en-GB');

    // Ngày sinh + Giới tính hiển thị trên thẻ (rỗng -> chỉ 1 dấu "-")
    const birthDisplay = pet.birthDate
      ? new Date(pet.birthDate).toLocaleDateString('en-GB')
      : '-';
    const genderVi =
      pet.gender === 'male' ? '♂ Đực' : pet.gender === 'female' ? '♀ Cái' : '-';

    // Dòng MRZ cho bản in: tự dựng, ESCAPE ký tự "<" (nếu không trình duyệt hiểu là thẻ HTML
    // -> chỉ hiện "IDVNM<"), và chèn thêm "<" để text trải dài hết chiều ngang footer.
    const mrzCodeClean = displayCode.replace(/[^A-Z0-9]/g, '');
    const mrzNameClean = pet.name
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/Đ/g, 'D')
      .replace(/[^A-Z0-9]/g, '');
    const mrzPrint = `IDVNM<<${mrzCodeClean}<<${mrzNameClean}${'<'.repeat(60)}`
      .slice(0, 58)
      .replace(/</g, '&lt;');

    // Quốc huy Thú cưng (Pet National Emblem) — vòng tròn Ø12mm: dấu chân vàng ở tâm,
    // Quốc huy Thú cưng (Pet National Emblem) v2 — dùng ruột SVG dùng chung.
    const petEmblemSvg = `<svg viewBox="0 0 120 120" class="emblem-svg" xmlns="http://www.w3.org/2000/svg">${PET_EMBLEM_INNER}</svg>`;

    // QR THẬT: module vuông đặc màu tối trên nền trắng để camera quét được chính xác.
    const qrSize = qrMatrix.length;
    const qrSvgInner = qrMatrix
      .map((row, r) =>
        row
          .map((cell, c) =>
            cell ? `<rect x="${c}" y="${r}" width="1.02" height="1.02" fill="#0f172a"/>` : ''
          )
          .join('')
      )
      .join('');

    printWin.document.write(`
      <!doctype html>
      <html lang="vi">
      <head>
        <meta charset="utf-8" />
        <title>PetMap ID Card - ${safeName} (${safeCode})</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800;900&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          :root { --card-w: 85.6mm; --card-h: 53.98mm; --card-r: 3.18mm; }
          body { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #e2e8f0; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 96vh; padding: 20px; gap: 14px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

          /* ===== THẺ KÍCH THƯỚC CHUẨN CCCD (ISO ID-1) ===== */
          .card {
            width: var(--card-w); height: var(--card-h); border-radius: var(--card-r);
            position: relative; overflow: hidden; color: #fff; flex-shrink: 0;
            background: linear-gradient(135deg, #0f172a 0%, #0b2e26 55%, #064e3b 100%);
            box-shadow: 0 10px 28px -10px rgba(15,23,42,0.5);
          }
          .guilloche { position: absolute; inset: 0; opacity: 0.08; }
          .inner { position: relative; width: 100%; height: 100%; padding: 2.2mm 3mm; display: flex; flex-direction: column; overflow: hidden; }

          /* Header: quốc huy Ø11mm + tiêu đề */
          .top { display: flex; align-items: center; gap: 2.4mm; border-bottom: 0.3mm solid rgba(255,255,255,0.16); padding-bottom: 1.2mm; flex-shrink: 0; }
          .emblem-svg { width: 11mm; height: 11mm; flex-shrink: 0; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4)); }
          .brand-sub { font-size: 4.2pt; font-weight: 800; letter-spacing: 0.5px; color: #6ee7b7; text-transform: uppercase; }
          .brand-main-vi { font-size: 7.6pt; font-weight: 900; line-height: 1.1; margin-top: 0.9mm; }
          .brand-main-en { font-size: 4.4pt; font-weight: 600; color: #94a3b8; letter-spacing: 0.6px; text-transform: uppercase; margin-top: 0.8mm; }

          .body { display: flex; gap: 2.5mm; margin-top: 1mm; flex: 1; min-height: 0; }
          /* Ảnh chân dung CHUẨN 20 × 30 mm */
          .photo-wrap { position: relative; flex-shrink: 0; }
          .photo { width: 20mm; height: 30mm; object-fit: cover; border-radius: 1mm; border: 0.3mm solid rgba(255,255,255,0.3); }
          .photo-weight { position: absolute; bottom: 0.8mm; right: 0.8mm; background: rgba(2,6,23,0.85); color: #6ee7b7; font-size: 4.4pt; font-weight: 800; padding: 0.3mm 1mm; border-radius: 0.8mm; }

          .main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
          .main-head { display: flex; gap: 2mm; justify-content: space-between; align-items: flex-start; }
          .headinfo { flex: 1; min-width: 0; }
          .id-label { font-size: 4pt; font-weight: 700; letter-spacing: 0.3px; color: #94a3b8; text-transform: uppercase; }
          .id-code { display: inline-block; margin-top: 0.4mm; background: rgba(16,185,129,0.16); border: 0.2mm solid rgba(52,211,153,0.4); color: #6ee7b7; font-family: 'Courier New', monospace; font-weight: 900; font-size: 7pt; letter-spacing: 0.4px; padding: 0.3mm 1mm; border-radius: 0.8mm; white-space: nowrap; }
          .pet-name { font-size: 10.5pt; font-weight: 900; text-transform: uppercase; letter-spacing: -0.3px; margin: 1mm 0 0; line-height: 1; }
          .pet-name-en { font-size: 4.2pt; font-weight: 600; color: #94a3b8; letter-spacing: 0.5px; text-transform: uppercase; margin-top: 0.3mm; }

          .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.7mm 1.6mm; margin-top: auto; border-top: 0.25mm solid rgba(255,255,255,0.1); padding-top: 1mm; align-items: start; }
          .field { min-width: 0; display: flex; flex-direction: column; align-items: flex-start; }
          .field .k { font-size: 3.5pt; font-weight: 700; color: #64748b; text-transform: uppercase; line-height: 1.15; }
          .field .v { font-size: 5.4pt; font-weight: 800; color: #f1f5f9; margin-top: 0.3mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
          .badge-vax { display: inline-flex; align-items: center; gap: 0.6mm; white-space: nowrap; background: rgba(16,185,129,0.2); color: #6ee7b7; font-size: 4.4pt; font-weight: 800; padding: 0.2mm 0.8mm; border-radius: 0.8mm; margin-top: 0.3mm; }
          .badge-vax.no { background: rgba(245,158,11,0.18); color: #fcd34d; }

          /* QR gọn ở góc phải, không đè lưới thông tin */
          .qr-col { flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 0.4mm; }
          .qr-box { background: #fff; border-radius: 1.2mm; padding: 0.8mm; box-shadow: 0 0.6mm 1.4mm rgba(0,0,0,0.25); }
          .qr-box svg { display: block; width: 11mm; height: 11mm; }
          .qr-cap { font-family: 'Courier New', monospace; font-size: 3.4pt; font-weight: 800; letter-spacing: 0.4px; color: #94a3b8; text-transform: uppercase; }

          .mrz { flex-shrink: 0; margin-top: 0.8mm; border-top: 0.25mm dashed rgba(255,255,255,0.2); padding-top: 0.8mm; }
          .mrz-line { font-family: 'Courier New', monospace; font-size: 4.6pt; letter-spacing: 1.3px; color: #94a3b8; white-space: nowrap; }
          .mrz-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 0.5mm; }
          .mrz-verified { font-size: 4.4pt; font-weight: 900; color: #34d399; letter-spacing: 0.5px; }
          .mrz-date { font-size: 3.8pt; color: #64748b; text-align: right; }

          /* ===== MẶT SAU ===== */
          .card.back { background: linear-gradient(135deg, #0f172a 0%, #134e4a 60%, #065f46 100%); }
          .back-watermark { position: absolute; right: -6mm; bottom: -6mm; width: 34mm; height: 34mm; opacity: 0.08; }
          .back-row { display: flex; gap: 2.5mm; margin-top: 1.6mm; flex: 1; position: relative; z-index: 1; }
          .back-col { flex: 1; border: 0.25mm solid rgba(255,255,255,0.12); border-radius: 1.6mm; padding: 1.8mm; display: flex; flex-direction: column; }
          .back-col .h { font-size: 4.6pt; font-weight: 800; text-transform: uppercase; color: #6ee7b7; margin-bottom: 1mm; letter-spacing: 0.3px; }
          .back-col .h.warn { color: #fcd34d; }
          .med-item { display: flex; align-items: center; gap: 1.2mm; font-size: 5pt; color: #e2e8f0; margin-top: 0.9mm; }
          .med-dot { width: 1.4mm; height: 1.4mm; border-radius: 50%; background: #34d399; flex-shrink: 0; }
          .med-item b { color: #fff; }

          /* Liên hệ khẩn cấp — thiết kế mới */
          .contact { align-items: center; justify-content: center; text-align: center; gap: 1.1mm; background: rgba(16,185,129,0.07); border-color: rgba(52,211,153,0.3); }
          .phone-badge { width: 10mm; height: 10mm; border-radius: 50%; background: linear-gradient(135deg,#10b981,#0d9488); display: flex; align-items: center; justify-content: center; box-shadow: 0 1mm 2.4mm rgba(16,185,129,0.45); }
          .phone-badge svg { width: 5.2mm; height: 5.2mm; }
          .contact-sub { font-size: 3.8pt; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.6px; }
          .phone-pill { display: inline-flex; align-items: center; gap: 1.2mm; background: linear-gradient(135deg,#34d399,#10b981); color: #042f2e; font-weight: 900; font-size: 8pt; padding: 1mm 3.2mm; border-radius: 2mm; box-shadow: 0 1mm 2mm rgba(0,0,0,0.3); letter-spacing: 0.5px; }
          .phone-pill svg { width: 3.4mm; height: 3.4mm; }
          .contact-note { font-size: 3.7pt; color: #64748b; max-width: 36mm; line-height: 1.3; margin-top: 0.4mm; }
          .back-note { flex-shrink: 0; font-size: 4pt; color: #64748b; text-align: center; margin-top: 1mm; padding-top: 1mm; font-family: 'Courier New', monospace; letter-spacing: 0.5px; position: relative; z-index: 1; }

          .actions { margin-top: 6px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center; }
          .btn { padding: 10px 22px; border-radius: 11px; border: none; font-family: inherit; font-size: 12px; font-weight: 800; cursor: pointer; }
          .btn-print { background: #059669; color: #fff; }
          .btn-close { background: #fff; color: #334155; border: 1px solid #cbd5e1; }
          .toggle { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 700; color: #334155; background: #fff; border: 1px solid #cbd5e1; border-radius: 11px; padding: 9px 16px; cursor: pointer; }
          .toggle input { width: 15px; height: 15px; accent-color: #059669; cursor: pointer; }
          .hint { font-size: 11px; color: #64748b; font-weight: 600; }

          /* Chỉ in mặt trước: ẩn mặt sau */
          body.front-only .card.back { display: none; }

          @page { size: auto; margin: 8mm; }
          @media print {
            body { background: #fff; min-height: auto; padding: 0; gap: 6mm; }
            .no-print { display: none !important; }
            .card { box-shadow: none; border: 0.2mm solid #cbd5e1; }
          }
        </style>
      </head>
      <body>
        <!-- ===================== MẶT TRƯỚC ===================== -->
        <div class="card">
          <svg class="guilloche" viewBox="0 0 856 540" preserveAspectRatio="none">
            <path d="M0 150 Q 214 60, 428 150 T 856 150 M0 250 Q 214 160, 428 250 T 856 250 M0 350 Q 214 260, 428 350 T 856 350 M0 450 Q 214 360, 428 450 T 856 450" fill="none" stroke="#34d399" stroke-width="2"/>
          </svg>
          <div class="inner">
            <div class="top">
              ${petEmblemSvg}
              <div>
                <div class="brand-sub">Cộng đồng Thú cưng Việt Nam • PetMap Registry</div>
                <div class="brand-main-vi">CĂN CƯỚC ĐỊNH DANH THÚ CƯNG</div>
                <div class="brand-main-en">Digital Pet Identity Card</div>
              </div>
            </div>
            <div class="body">
              <div class="photo-wrap">
                <img class="photo" src="${safePortrait}" alt="${safeName}" />
                <div class="photo-weight">${esc(pet.weightKg)} kg</div>
              </div>
              <div class="main">
                <div class="main-head">
                  <div class="headinfo">
                    <div class="id-label">Số định danh / Personal ID No.</div>
                    <div class="id-code">${safeCode}</div>
                    <div class="id-label" style="margin-top:1.2mm">Họ tên / Full Name</div>
                    <div class="pet-name">${safeName}</div>
                  </div>
                  <div class="qr-col">
                    <div class="qr-box">
                      <svg viewBox="0 0 ${qrSize} ${qrSize}">${qrSvgInner}</svg>
                    </div>
                    <div class="qr-cap">Scan Pet ID</div>
                  </div>
                </div>
                <div class="grid">
                  <div class="field">
                    <div class="k">Phân loài / Species</div>
                    <div class="v">${safeSpecies}</div>
                  </div>
                  <div class="field">
                    <div class="k">Giống / Breed</div>
                    <div class="v">${safeBreed}</div>
                  </div>
                  <div class="field">
                    <div class="k">Giới tính / Sex</div>
                    <div class="v">${genderVi}</div>
                  </div>
                  <div class="field">
                    <div class="k">Ngày sinh / Date of Birth</div>
                    <div class="v">${birthDisplay}</div>
                  </div>
                  <div class="field">
                    <div class="k">Tiêm chủng / Vaccination</div>
                    <div class="badge-vax${pet.vaccinated ? '' : ' no'}">${pet.vaccinated ? '✓' : '✕'} ${vaccineVi}</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="mrz">
              <div class="mrz-line">${mrzPrint}</div>
              <div class="mrz-foot">
                <div class="mrz-verified">✓ VERIFIED BY PETMAP</div>
                <div class="mrz-date">Cấp / Issued: ${issueDate}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- ===================== MẶT SAU ===================== -->
        <div class="card back">
          <svg class="guilloche" viewBox="0 0 856 540" preserveAspectRatio="none">
            <circle cx="700" cy="120" r="160" fill="none" stroke="#14b8a6" stroke-width="2"/>
            <circle cx="120" cy="420" r="140" fill="none" stroke="#34d399" stroke-width="2"/>
          </svg>
          <svg class="back-watermark" viewBox="0 0 120 120">${PET_EMBLEM_INNER}</svg>
          <div class="inner">
            <div class="top">
              ${petEmblemSvg}
              <div>
                <div class="brand-sub">PetMap Verification Pass</div>
                <div class="brand-main-vi" style="font-size:7pt">THÔNG TIN Y TẾ & LIÊN HỆ KHẨN</div>
                <div class="brand-main-en">Medical Record & Emergency Contact</div>
              </div>
            </div>
            <div class="back-row">
              <div class="back-col">
                <div class="h">🩺 Hồ sơ Y tế & Phụ kiện</div>
                <div class="med-item"><span class="med-dot"></span><span>Tiêm chủng: <b>${vaccineVi}</b></span></div>
                <div class="med-item"><span class="med-dot"></span><span>Phân loài: <b>${safeSpecies}</b></span></div>
                <div class="med-item"><span class="med-dot"></span><span>Hành trang: <b>${equipVi}</b></span></div>
                <div class="med-item"><span class="med-dot"></span><span>Cân nặng: <b>${esc(pet.weightKg)} kg</b></span></div>
              </div>
              <div class="back-col contact">
                <div class="phone-badge">
                  <svg viewBox="0 0 24 24" fill="#ffffff"><path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.3 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.3 1l-2.2 2.2z"/></svg>
                </div>
                <div class="h warn">Liên hệ khi bé đi lạc</div>
                <div class="contact-sub">If found, please call the owner</div>
                <div class="phone-pill">
                  <svg viewBox="0 0 24 24" fill="#042f2e"><path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.3 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.3 1l-2.2 2.2z"/></svg>
                  <span>${safePhone}</span>
                </div>
                <div class="contact-note">Quét mã QR ở mặt trước để tra cứu hồ sơ online tại PetMap.vn</div>
              </div>
            </div>
            <div class="back-note">${mrzPrint}</div>
          </div>
        </div>

        <div class="actions no-print">
          <label class="toggle">
            <input type="checkbox" id="frontOnly" onchange="document.body.classList.toggle('front-only', this.checked)" />
            <span>Chỉ in mặt trước</span>
          </label>
          <button class="btn btn-print" onclick="window.print()">🖨️ In Thẻ / Print Card (PDF)</button>
          <button class="btn btn-close" onclick="window.close()">Đóng / Close</button>
        </div>
        <div class="hint no-print">Khổ thẻ chuẩn CCCD 85,6 × 53,98 mm — khi in chọn tỉ lệ 100% (không "Fit to page").</div>
      </body>
      </html>
    `);
    printWin.document.close();
  };

  // Chụp thẻ (mặt trước) thành ảnh PNG để chia sẻ — dựng SVG vector tự chứa rồi rasterize.
  const handleSaveImage = async () => {
    setSavingImage(true);
    try {
      const W = 856;
      const H = 540;
      const xe = (v: string | number | undefined | null) =>
        String(v ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');

      // Nhúng ảnh chân dung thành dataURL để canvas KHÔNG bị taint (mới export được PNG).
      const toDataUrl = async (url: string): Promise<string | null> => {
        try {
          const res = await fetch(url, { mode: 'cors' });
          if (!res.ok) return null;
          const blob = await res.blob();
          return await new Promise((resolve) => {
            const fr = new FileReader();
            fr.onload = () => resolve(typeof fr.result === 'string' ? fr.result : null);
            fr.onerror = () => resolve(null);
            fr.readAsDataURL(blob);
          });
        } catch {
          return null;
        }
      };
      const portraitData = await toDataUrl(portraitUrl);

      const n = qrMatrix.length;
      const qrRects = qrMatrix
        .map((row, r) =>
          row
            .map((c, ci) =>
              c ? `<rect x="${ci}" y="${r}" width="1.02" height="1.02" fill="#0f172a"/>` : ''
            )
            .join('')
        )
        .join('');

      const codeClean = displayCode.replace(/[^A-Z0-9]/g, '');
      const nameClean = pet.name
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/Đ/g, 'D')
        .replace(/[^A-Z0-9]/g, '');
      const mrz = xe(`IDVNM<<${codeClean}<<${nameClean}${'<'.repeat(60)}`.slice(0, 58));

      const birthTxt = pet.birthDate ? new Date(pet.birthDate).toLocaleDateString('en-GB') : '-';
      const genderTxt =
        pet.gender === 'male' ? 'Duc (M)' : pet.gender === 'female' ? 'Cai (F)' : '-';
      const vaxTxt = pet.vaccinated ? 'Đã tiêm phòng' : 'Chưa tiêm phòng';
      const breedTxt = pet.breed && pet.breed.trim() ? pet.breed.trim() : '-';
      const portraitEl = portraitData
        ? `<image x="28" y="150" width="200" height="300" href="${portraitData}" preserveAspectRatio="xMidYMid slice" clip-path="url(#pc)"/>`
        : `<rect x="28" y="150" width="200" height="300" rx="12" fill="#1e293b"/><text x="128" y="305" text-anchor="middle" font-size="60">🐾</text>`;

      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="'Plus Jakarta Sans','Segoe UI',sans-serif">` +
        `<defs><linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f172a"/><stop offset="55%" stop-color="#0b2e26"/><stop offset="100%" stop-color="#064e3b"/></linearGradient><clipPath id="pc"><rect x="28" y="150" width="200" height="300" rx="12"/></clipPath></defs>` +
        `<rect x="0" y="0" width="${W}" height="${H}" rx="34" fill="url(#bgGrad)"/>` +
        `<svg x="24" y="20" width="104" height="104" viewBox="0 0 120 120">${PET_EMBLEM_INNER}</svg>` +
        `<text x="146" y="46" font-size="13" font-weight="800" fill="#6ee7b7" letter-spacing="0.5">CỘNG ĐỒNG THÚ CƯNG VIỆT NAM • PETMAP REGISTRY</text>` +
        `<text x="146" y="78" font-size="27" font-weight="900" fill="#ffffff">CĂN CƯỚC ĐỊNH DANH THÚ CƯNG</text>` +
        `<text x="146" y="99" font-size="12.5" font-weight="600" fill="#94a3b8" letter-spacing="1">DIGITAL PET IDENTITY CARD</text>` +
        `<line x1="24" y1="122" x2="832" y2="122" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>` +
        portraitEl +
        `<rect x="150" y="418" width="70" height="26" rx="7" fill="rgba(2,6,23,0.85)"/><text x="185" y="436" text-anchor="middle" font-size="12.5" font-weight="800" fill="#6ee7b7">${xe(pet.weightKg)} kg</text>` +
        `<text x="252" y="176" font-size="12" font-weight="700" fill="#94a3b8" letter-spacing="0.4">SỐ ĐỊNH DANH / PERSONAL ID NO.</text>` +
        `<rect x="252" y="186" width="240" height="36" rx="9" fill="rgba(16,185,129,0.16)" stroke="rgba(52,211,153,0.4)"/><text x="264" y="211" font-family="'Courier New',monospace" font-size="20" font-weight="900" fill="#6ee7b7" letter-spacing="1">${xe(displayCode)}</text>` +
        `<text x="252" y="252" font-size="12" font-weight="700" fill="#94a3b8" letter-spacing="0.4">HỌ TÊN / FULL NAME</text>` +
        `<text x="252" y="292" font-size="34" font-weight="900" fill="#ffffff">${xe(pet.name)}</text>` +
        `<text x="252" y="342" font-size="11" font-weight="700" fill="#64748b">PHÂN LOÀI / SPECIES</text><text x="252" y="362" font-size="15" font-weight="800" fill="#f1f5f9">${xe(speciesLabel)}</text>` +
        `<text x="452" y="342" font-size="11" font-weight="700" fill="#64748b">GIỐNG / BREED</text><text x="452" y="362" font-size="15" font-weight="800" fill="#f1f5f9">${xe(breedTxt)}</text>` +
        `<text x="640" y="342" font-size="11" font-weight="700" fill="#64748b">GIỚI TÍNH / SEX</text><text x="640" y="362" font-size="15" font-weight="800" fill="#f1f5f9">${xe(genderTxt)}</text>` +
        `<text x="252" y="404" font-size="11" font-weight="700" fill="#64748b">NGÀY SINH / DATE OF BIRTH</text><text x="252" y="424" font-size="15" font-weight="800" fill="#f1f5f9">${xe(birthTxt)}</text>` +
        `<rect x="452" y="408" width="150" height="24" rx="7" fill="rgba(16,185,129,0.2)"/><text x="462" y="425" font-size="13" font-weight="800" fill="#6ee7b7">${pet.vaccinated ? '✓' : '✕'} ${xe(vaxTxt)}</text>` +
        `<rect x="688" y="150" width="140" height="140" rx="14" fill="#ffffff"/><svg x="700" y="162" width="116" height="116" viewBox="0 0 ${n} ${n}">${qrRects}</svg>` +
        `<text x="758" y="306" text-anchor="middle" font-family="'Courier New',monospace" font-size="11" font-weight="800" fill="#94a3b8" letter-spacing="1">SCAN PET ID</text>` +
        `<line x1="24" y1="486" x2="832" y2="486" stroke="rgba(255,255,255,0.18)" stroke-width="1" stroke-dasharray="4 4"/>` +
        `<text x="28" y="505" font-family="'Courier New',monospace" font-size="13" fill="#94a3b8" letter-spacing="2">${mrz}</text>` +
        `<text x="28" y="526" font-size="12" font-weight="900" fill="#34d399" letter-spacing="0.5">✓ VERIFIED BY PETMAP</text>` +
        `<text x="832" y="526" text-anchor="end" font-size="11" fill="#64748b">Cấp / Issued: ${xe(
          new Date().toLocaleDateString('en-GB')
        )}</text>` +
        `</svg>`;

      const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('svg load failed'));
        img.src = svgUrl;
      });

      const scale = 3;
      const canvas = document.createElement('canvas');
      canvas.width = W * scale;
      canvas.height = H * scale;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, W, H);
      }
      URL.revokeObjectURL(svgUrl);

      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return;
        const a = document.createElement('a');
        const href = URL.createObjectURL(pngBlob);
        a.href = href;
        a.download = `PetID-${codeClean || 'card'}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(href), 1500);
      }, 'image/png');
    } catch {
      // Lặng lẽ bỏ qua: nếu trình duyệt chặn (CORS ảnh), người dùng vẫn dùng được nút In.
    } finally {
      setSavingImage(false);
    }
  };

  const mrzLine = `IDVNM<<${displayCode.replace(/[^A-Z0-9]/g, '')}<<${pet.name
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Z0-9]/g, '')}<<<<<<<<<<<<<<<<`.slice(0, 36);

  const equipmentSummary =
    [
      pet.hasCarrier ? 'Balo' : null,
      pet.hasDiaper ? 'Bỉm' : null,
      pet.hasMuzzle ? 'Rọ mõm' : null,
    ]
      .filter(Boolean)
      .join(' • ') || 'Dây dắt';

  return (
    <div className="space-y-2">
      {/* Compact Single-Row Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700">
            <span>🪪 Thẻ Định Danh</span>
          </span>
          {pet.syncedToCloud && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200/80 px-2 py-1 text-[10px] font-bold text-emerald-700">
              <Cloud className="h-3 w-3" />
              <span>Đã đồng bộ</span>
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setIsBackSide((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
          >
            <RotateCw className="h-3 w-3 text-slate-500" />
            <span>{isBackSide ? 'Mặt trước' : 'Mặt sau'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrintIdCard}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
          >
            <Printer className="h-3 w-3 text-slate-500" />
            <span>In</span>
          </button>

          <button
            type="button"
            onClick={handleSaveImage}
            disabled={savingImage}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer disabled:opacity-60"
          >
            <Download className="h-3 w-3 text-slate-500" />
            <span>{savingImage ? '...' : 'Lưu ảnh'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyShareLink}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-600 transition cursor-pointer"
          >
            {copied ? (
              <Check className="h-3 w-3 text-emerald-300" />
            ) : (
              <Share2 className="h-3 w-3" />
            )}
            <span>{copied ? 'Đã chép' : 'Chia sẻ'}</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          SLEEK HORIZONTAL SMART PET ID CARD (Proportional Credit-Card Style)
         ===================================================================== */}
      {!isBackSide ? (
        <div className="relative overflow-hidden rounded-2xl border border-slate-700/80 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 p-4 text-white shadow-lg">
          {/* Subtle Ambient Glow */}
          <div className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-emerald-500/15 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-teal-500/10 blur-2xl" />

          {/* Header Strip: Brand Title on Left + ID Code Pill on Right */}
          <div className="relative flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/95 shadow-xs ring-1 ring-emerald-400/40 overflow-hidden">
                <PetNationalEmblem className="h-full w-full" />
              </div>
              <div className="min-w-0">
                <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-emerald-400 leading-none">
                  PETMAP VIETNAM • PET ID PASS
                </div>
                <div className="mt-0.5 text-xs font-extrabold uppercase tracking-wide text-white truncate">
                  THẺ CĂN CƯỚC THÚ CƯNG
                </div>
              </div>
            </div>

            <div className="shrink-0 rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-1 font-mono text-xs font-black tracking-wider text-emerald-300">
              #{displayCode}
            </div>
          </div>

          {/* Main Card Content: Left Portrait (84px) + Center Info (Flex-1) + Right Compact QR (68px) */}
          <div className="relative mt-3.5 flex items-center gap-3.5">
            {/* Left: Portrait Photo with Weight Badge & Direct Upload Option */}
            <div className="relative h-24 w-21 shrink-0 overflow-hidden rounded-xl border-2 border-white/20 bg-slate-800 shadow-md group">
              <img
                src={portraitUrl}
                alt={pet.name}
                loading="lazy"
                onError={() => setImgError(true)}
                className="h-full w-full object-cover"
              />
              <span className="absolute bottom-1 right-1 rounded bg-slate-950/80 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-300 backdrop-blur-xs">
                {pet.weightKg}kg
              </span>
              {onSelectAvatarFile && (
                <label
                  title="Bấm để đổi ảnh chân dung của bé"
                  className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/65 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[10px] font-bold text-white"
                >
                  <Camera className="h-4 w-4 mb-0.5 text-emerald-400" />
                  <span>{uploadingAvatar ? '...' : 'Đổi ảnh'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onSelectAvatarFile(f);
                    }}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Center: Pet Name + Clean 2x2 Info Grid (Ample width, zero cramped wrapping) */}
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-base sm:text-lg font-black uppercase tracking-tight text-white leading-none truncate">
                  {pet.name}
                </h4>
                {pet.vaccinated ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    <ShieldCheck className="h-3 w-3 text-emerald-400" />
                    <span>Đã tiêm phòng</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-400/30 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                    <AlertCircle className="h-3 w-3 text-amber-400" />
                    <span>Chưa tiêm phòng</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <div className="min-w-0">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Loài & Giống
                  </span>
                  <span className="font-bold text-slate-100 truncate block">
                    {pet.type === 'dog' ? 'Chó' : pet.type === 'cat' ? 'Mèo' : 'Thú nhỏ'} •{' '}
                    {pet.breed || 'Boss cưng'}
                  </span>
                </div>

                <div className="min-w-0">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Giới tính
                  </span>
                  <span className="font-bold text-slate-100 truncate block">
                    {pet.gender === 'male'
                      ? '♂ Đực'
                      : pet.gender === 'female'
                      ? '♀ Cái'
                      : '-'}
                  </span>
                </div>

                <div className="min-w-0">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Ngày sinh
                  </span>
                  <span className="font-bold text-slate-100 truncate block">
                    {pet.birthDate
                      ? new Date(pet.birthDate).toLocaleDateString('vi-VN')
                      : '-'}
                  </span>
                </div>

                <div className="col-span-2 flex items-center justify-between border-t border-white/10 pt-1.5 text-[11px]">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Liên hệ Chủ (Sen):
                  </span>
                  {pet.ownerPhone ? (
                    <a
                      href={`tel:${pet.ownerPhone}`}
                      className="inline-flex items-center gap-1 font-extrabold text-emerald-300 hover:underline"
                    >
                      <Phone className="h-3 w-3" />
                      <span>{pet.ownerPhone}</span>
                    </a>
                  ) : (
                    <span className="text-[11px] font-medium text-slate-400">
                      Chưa cập nhật SĐT
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Compact Square QR Box (No tall empty white tower!) */}
            <div className="flex flex-col items-center justify-center rounded-xl bg-white p-2 text-slate-900 shadow-md shrink-0">
              <svg
                viewBox={`0 0 ${qrMatrix.length} ${qrMatrix.length}`}
                className="h-14 w-14 sm:h-16 sm:w-16"
                shapeRendering="crispEdges"
              >
                {qrMatrix.map((row, rIdx) =>
                  row.map((cell, cIdx) =>
                    cell ? (
                      <rect
                        key={`${rIdx}-${cIdx}`}
                        x={cIdx}
                        y={rIdx}
                        width={1}
                        height={1}
                        fill="#0f172a"
                      />
                    ) : null
                  )
                )}
              </svg>
              <span className="mt-1 font-mono text-[8px] font-extrabold uppercase tracking-wider text-slate-500">
                PETMAP QR
              </span>
            </div>
          </div>

          {/* Compact Bottom MRZ Line */}
          <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2 font-mono text-[9px] tracking-widest text-slate-400">
            <span className="truncate">{mrzLine}</span>
            <span className="shrink-0 font-bold text-emerald-400 ml-2">VERIFIED ID</span>
          </div>
        </div>
      ) : (
        /* MẶT SAU (BACK SIDE) */
        <div className="relative overflow-hidden rounded-2xl border border-slate-700/80 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 p-4 text-white shadow-lg">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 text-[10px] font-mono text-emerald-400">
            <span>PETMAP VERIFICATION PASS • MẶT SAU</span>
            <span>#{displayCode}</span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 space-y-1">
              <div className="text-[10px] font-bold uppercase text-emerald-400">
                Hồ sơ Y tế & Phụ kiện
              </div>
              <div className="text-[11px] text-slate-200">
                • Tiêm chủng:{' '}
                <strong className={pet.vaccinated ? 'text-emerald-300' : 'text-amber-300'}>
                  {pet.vaccinated ? 'Đầy đủ' : 'Chưa rõ'}
                </strong>
              </div>
              <div className="text-[11px] text-slate-200">
                • Phụ kiện: <strong>{equipmentSummary}</strong>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 flex flex-col justify-between">
              <div className="text-[10px] font-bold uppercase text-amber-300">
                Liên hệ khi bé đi lạc
              </div>
              {pet.ownerPhone ? (
                <a
                  href={`tel:${pet.ownerPhone}`}
                  className="mt-1 inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-500 py-1.5 text-xs font-black text-slate-950 hover:bg-emerald-400 transition"
                >
                  <Phone className="h-3 w-3" />
                  <span>{pet.ownerPhone}</span>
                </a>
              ) : (
                <p className="text-[11px] text-slate-300">
                  Nhập SĐT ở form bên dưới để hiển thị trên thẻ.
                </p>
              )}
            </div>
          </div>

          <div className="mt-2.5 border-t border-white/10 pt-2 font-mono text-[9px] tracking-widest text-slate-400 truncate">
            {mrzLine}
          </div>
        </div>
      )}
    </div>
  );
};
