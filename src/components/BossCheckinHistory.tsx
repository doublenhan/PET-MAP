import React, { useEffect, useState } from 'react';
import { MapPin, ShieldCheck, Star, Loader2, Footprints } from 'lucide-react';
import { CheckIn } from '../types/place';
import { fetchCheckinsByPet } from '../services/checkinService';

interface BossCheckinHistoryProps {
  petId: string;
  petName: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}

export const BossCheckinHistory: React.FC<BossCheckinHistoryProps> = ({ petId, petName }) => {
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchCheckinsByPet(petId)
      .then((list) => {
        if (!cancelled) setCheckins(list);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [petId]);

  const uniquePlaces = new Set(checkins.map((c) => c.placeId)).size;

  // Huy hiệu/cấp độ theo số quán đã ghé
  const level =
    uniquePlaces >= 25
      ? { emoji: '👑', name: 'Huyền thoại', cls: 'bg-amber-100 text-amber-800' }
      : uniquePlaces >= 10
      ? { emoji: '🏆', name: 'Thổ địa vàng', cls: 'bg-yellow-100 text-yellow-800' }
      : uniquePlaces >= 5
      ? { emoji: '🥇', name: 'Thổ địa', cls: 'bg-emerald-100 text-emerald-800' }
      : uniquePlaces >= 1
      ? { emoji: '🧭', name: 'Nhà khám phá', cls: 'bg-sky-100 text-sky-800' }
      : { emoji: '🐣', name: 'Tân binh', cls: 'bg-slate-100 text-slate-600' };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800">
          <Footprints className="h-4 w-4 text-emerald-600" />
          <span>Hành trình của {petName}</span>
        </div>
        {!loading && (
          <span className={`rounded-lg px-2 py-0.5 text-[11px] font-bold ${level.cls}`}>
            {level.emoji} {level.name}
          </span>
        )}
      </div>

      {!loading && (
        <div className="mt-1.5 text-[11px] font-semibold text-slate-500">
          {checkins.length} lượt check-in • {uniquePlaces} quán đã ghé
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-5 text-xs text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải lịch sử...
        </div>
      ) : checkins.length === 0 ? (
        <p className="mt-2 text-xs text-slate-400">
          {petName} chưa check-in tại quán nào. Hãy quét QR tại quán để ghi lại hành trình nhé!
        </p>
      ) : (
        <div className="mt-2 max-h-44 space-y-1.5 overflow-y-auto">
          {checkins.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-2.5 py-1.5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-xs font-bold text-slate-800">
                  <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                  <span className="truncate">{c.placeName}</span>
                  {c.verified && <ShieldCheck className="h-3 w-3 shrink-0 text-emerald-600" />}
                </div>
                <div className="mt-0.5 flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`h-2.5 w-2.5 ${
                        s <= c.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <span className="shrink-0 text-[10px] font-medium text-slate-400">
                {timeAgo(c.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
