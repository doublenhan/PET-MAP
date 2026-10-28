import React, { useState, useEffect } from 'react';
import {
  X,
  MapPin,
  QrCode,
  PawPrint,
  Heart,
  ChevronRight,
  ChevronLeft,
  Star,
  Sparkles,
  Search,
  ShieldCheck,
} from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Step {
  icon: React.ComponentType<{ className?: string }>;
  emoji: string;
  title: string;
  desc: string;
  bullets: string[];
}

const STEPS: Step[] = [
  {
    icon: Search,
    emoji: '🔍',
    title: 'Tìm & lọc quán cho Boss',
    desc: 'Tìm quán cà phê, nhà hàng, cửa hàng, công viên, spa-thú y chào đón thú cưng quanh bạn.',
    bullets: [
      'Tìm theo tên quán / tên đường (không dấu cũng được)',
      'Lọc theo khu vực, loại hình, chính sách: Cho Pet / Có điều kiện / Cấm',
      'Bật "Đang mở cửa" và "Hợp với Boss" theo cân nặng, giống loài',
      'Sắp xếp: Quán hot 🔥, Đánh giá cao, Mới nhất, Gần nhất',
    ],
  },
  {
    icon: MapPin,
    emoji: '🗺️',
    title: 'Bản đồ thông minh',
    desc: 'Xem toàn bộ quán trên bản đồ Google với ghim màu theo mức độ thân thiện thú cưng.',
    bullets: [
      'Marker gom cụm khi zoom xa — bấm để xem danh sách trong khu',
      'Định vị "Vị trí của tôi" và tìm quán gần nhất',
      'Chỉ đường ngay trên app (có cả quãng đường & thời gian)',
      'Đổi lớp bản đồ: Google Maps ↔ Vệ tinh',
    ],
  },
  {
    icon: PawPrint,
    emoji: '🐾',
    title: 'Hồ sơ & Thẻ Căn Cước Boss',
    desc: 'Tạo hồ sơ thú cưng và nhận Thẻ Căn Cước chuẩn kích thước CCCD có mã QR quét được.',
    bullets: [
      'Thêm nhiều Boss: tên, giống, cân nặng, ngày sinh, giới tính, phụ kiện',
      'In thẻ 2 mặt (có quốc huy thú cưng) hoặc lưu ảnh PNG để chia sẻ',
      'Nhắc tiêm phòng / tiêm nhắc lại định kỳ',
      'Mã QR trên thẻ giúp tra cứu khi bé đi lạc',
    ],
  },
  {
    icon: QrCode,
    emoji: '📷',
    title: 'Check-in cùng Boss (QR + GPS)',
    desc: 'Đến quán, quét mã QR tại quầy bằng camera điện thoại để check-in cùng Boss.',
    bullets: [
      'Quét QR bằng camera thường → tự mở trang check-in (không cần cài app)',
      'Xác thực vị trí GPS trong 150m để chống check-in ảo',
      'Chọn Boss đi cùng, chấm sao và viết cảm nhận',
      'Tạo review "đã xác thực ✓" đáng tin cho cộng đồng',
    ],
  },
  {
    icon: Star,
    emoji: '⭐',
    title: 'Đánh giá & Review có ảnh',
    desc: 'Chia sẻ trải nghiệm thật khi dẫn Boss tới quán để giúp cộng đồng.',
    bullets: [
      'Đính kèm ảnh thực tế vào review',
      'Bấm "Hữu ích" 👍 cho review chất lượng',
      'Xác nhận hoặc báo chính sách Pet đã thay đổi',
      'Báo cáo thông tin sai / quán đóng cửa cho Admin',
    ],
  },
  {
    icon: Heart,
    emoji: '💚',
    title: 'Lưu & Bộ sưu tập',
    desc: 'Lưu quán yêu thích và sắp xếp thành các bộ sưu tập riêng của bạn.',
    bullets: [
      'Nhấn ❤️ để lưu quán yêu thích',
      'Tạo bộ sưu tập: "Cà phê cuối tuần", "Công viên dắt chó"...',
      'Lọc nhanh danh sách theo từng bộ sưu tập',
    ],
  },
  {
    icon: Sparkles,
    emoji: '🏆',
    title: 'Huy hiệu & Cộng đồng',
    desc: 'Theo dõi hành trình của Boss và cùng cộng đồng khám phá.',
    bullets: [
      'Huy hiệu Boss theo số quán đã ghé: Nhà khám phá → Thổ địa → 👑 Huyền thoại',
      'Lịch sử check-in của từng Boss',
      'Feed hoạt động cộng đồng & Bảng xếp hạng người check-in nhiều nhất',
      'Badge 🔥 cho quán hot nhiều lượt ghé',
    ],
  },
  {
    icon: ShieldCheck,
    emoji: '🎉',
    title: 'Sẵn sàng khám phá!',
    desc: 'Dữ liệu được lưu an toàn trên đám mây (hoặc ngay trên máy khi offline). Bắt đầu tìm quán pet-friendly cho Boss của bạn ngay thôi!',
    bullets: [
      'Mẹo: bật định vị để tìm quán gần nhất',
      'Mẹo: tạo hồ sơ Boss để lọc quán "hợp với bé"',
      'Mẹo: quét QR tại quán để check-in và nhận huy hiệu',
    ],
  },
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(0);
  // Luôn bắt đầu từ bước 1 mỗi khi mở lại
  useEffect(() => {
    if (isOpen) setStep(0);
  }, [isOpen]);
  if (!isOpen) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-[4200] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[92vh] w-full max-w-sm flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="relative shrink-0 bg-gradient-to-br from-emerald-600 to-teal-600 px-6 pt-7 pb-8 text-center text-white">
          <button
            onClick={onClose}
            aria-label="Bỏ qua"
            className="absolute right-3 top-3 rounded-full bg-white/20 p-1.5 hover:bg-white/30 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="mx-auto mb-2.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-3xl">
            {current.emoji}
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <Icon className="h-4 w-4" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-100">
              PetMap • Bước {step + 1}/{STEPS.length}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <h3 className="text-center text-lg font-extrabold text-slate-900">{current.title}</h3>
          <p className="mt-2 text-center text-sm leading-relaxed text-slate-600">{current.desc}</p>

          <ul className="mt-4 space-y-2">
            {current.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[9px] font-bold text-emerald-700">
                  ✓
                </span>
                <span className="leading-relaxed">{b}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="shrink-0 border-t border-slate-100 px-6 py-4">
          <div className="mb-4 flex items-center justify-center gap-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                aria-label={`Bước ${i + 1}`}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  i === step ? 'w-6 bg-emerald-600' : 'w-1.5 bg-slate-200 hover:bg-slate-300'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            {step > 0 ? (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Quay lại</span>
              </button>
            ) : (
              <button
                onClick={onClose}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Bỏ qua
              </button>
            )}
            <button
              onClick={() => (isLast ? onClose() : setStep((s) => s + 1))}
              className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 transition cursor-pointer"
            >
              <span>{isLast ? 'Bắt đầu khám phá' : 'Tiếp tục'}</span>
              {!isLast && <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
