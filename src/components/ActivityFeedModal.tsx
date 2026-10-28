import React, { useEffect, useState } from 'react';
import { X, Sparkles, ShieldCheck, Star, PawPrint, MapPin, Loader2, BookOpen } from 'lucide-react';
import { CheckIn, PetProfile } from '../types/place';
import { fetchRecentCheckins } from '../services/checkinService';

interface ActivityFeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  refreshToken: number;
  myStats?: { saved: number; collections: number; pets: number };
  pets?: PetProfile[];
  onReopenGuide?: () => void;
}

/** Huy hiệu/cấp độ Boss theo số quán đã ghé. */
function bossLevel(uniquePlaces: number) {
  if (uniquePlaces >= 25) return { emoji: '👑', name: 'Huyền thoại', cls: 'bg-amber-100 text-amber-800' };
  if (uniquePlaces >= 10) return { emoji: '🏆', name: 'Thổ địa vàng', cls: 'bg-yellow-100 text-yellow-800' };
  if (uniquePlaces >= 5) return { emoji: '🥇', name: 'Thổ địa', cls: 'bg-emerald-100 text-emerald-800' };
  if (uniquePlaces >= 1) return { emoji: '🧭', name: 'Nhà khám phá', cls: 'bg-sky-100 text-sky-800' };
  return { emoji: '🐣', name: 'Tân binh', cls: 'bg-slate-100 text-slate-600' };
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

export const ActivityFeedModal: React.FC<ActivityFeedModalProps> = ({
  isOpen,
  onClose,
  refreshToken,
  myStats,
  pets,
  onReopenGuide,
}) => {
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'feed' | 'ranking' | 'profile'>('feed');

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetchRecentCheckins(200)
      .then(setCheckins)
      .finally(() => setLoading(false));
  }, [isOpen, refreshToken]);

  if (!isOpen) return null;

  // Bảng xếp hạng: gộp theo người check-in nhiều nhất
  const rankMap: Record<string, { name: string; count: number; places: Set<string> }> = {};
  for (const c of checkins) {
    if (!rankMap[c.authorName])
      rankMap[c.authorName] = { name: c.authorName, count: 0, places: new Set() };
    rankMap[c.authorName].count += 1;
    rankMap[c.authorName].places.add(c.placeId);
  }
  const leaderboard = Object.values(rankMap)
    .map((x) => ({ name: x.name, count: x.count, places: x.places.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`);

  // Hồ sơ của tôi: thống kê theo từng Boss (lọc từ check-in đã tải)
  const myPetStats = (pets || []).map((p) => {
    const mine = checkins.filter((c) => c.petId && c.petId === p.id);
    const uniquePlaces = new Set(mine.map((c) => c.placeId)).size;
    return { pet: p, count: mine.length, places: uniquePlaces, level: bossLevel(uniquePlaces) };
  });
  const myTotalCheckins = myPetStats.reduce((s, x) => s + x.count, 0);
  const myTotalPlaces = new Set(
    checkins.filter((c) => (pets || []).some((p) => p.id === c.petId)).map((c) => c.placeId)
  ).size;

  return (
    <div className="fixed inset-0 z-[3400] flex items-end sm:items-center justify-center bg-slate-950/60 p-0 sm:p-4 backdrop-blur-xs">
      <div className="w-full max-w-md overflow-hidden rounded-t-3xl sm:rounded-3xl border border-slate-200 bg-white shadow-2xl max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            <div className="text-sm font-extrabold">Hoạt động cộng đồng</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-full bg-white/20 p-1.5 hover:bg-white/30 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {/* Tabs: Hoạt động | Xếp hạng | Hồ sơ */}
          <div className="mb-3 flex gap-1.5 rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => setTab('feed')}
              className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition cursor-pointer ${
                tab === 'feed' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500'
              }`}
            >
              Hoạt động
            </button>
            <button
              onClick={() => setTab('ranking')}
              className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition cursor-pointer ${
                tab === 'ranking' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500'
              }`}
            >
              🏆 Xếp hạng
            </button>
            <button
              onClick={() => setTab('profile')}
              className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition cursor-pointer ${
                tab === 'profile' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500'
              }`}
            >
              Hồ sơ
            </button>
          </div>

          {tab === 'profile' ? (
            <div className="space-y-3">
              {/* Thống kê tổng */}
              <div className="grid grid-cols-4 gap-2">
                <div className="rounded-xl border border-rose-100 bg-rose-50 p-2 text-center">
                  <div className="text-base font-black text-rose-600">{myStats?.saved ?? 0}</div>
                  <div className="text-[9px] font-bold text-slate-500">Đã lưu</div>
                </div>
                <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-2 text-center">
                  <div className="text-base font-black text-indigo-600">
                    {myStats?.collections ?? 0}
                  </div>
                  <div className="text-[9px] font-bold text-slate-500">BST</div>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-2 text-center">
                  <div className="text-base font-black text-emerald-600">{myTotalCheckins}</div>
                  <div className="text-[9px] font-bold text-slate-500">Check-in</div>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-2 text-center">
                  <div className="text-base font-black text-amber-600">{myTotalPlaces}</div>
                  <div className="text-[9px] font-bold text-slate-500">Quán đã ghé</div>
                </div>
              </div>

              {/* Huy hiệu từng Boss */}
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Huy hiệu các Boss
              </div>
              {myPetStats.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Bạn chưa có hồ sơ Boss nào. Tạo hồ sơ để nhận huy hiệu & lưu hành trình.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {myPetStats.map(({ pet, count, places, level }) => (
                    <div
                      key={pet.id || pet.name}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg">
                          {pet.type === 'dog' ? '🐶' : pet.type === 'cat' ? '🐱' : '🐰'}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-slate-800">
                            {pet.name}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {count} lượt • {places} quán
                          </div>
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-bold ${level.cls}`}>
                        {level.emoji} {level.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {onReopenGuide && (
                <button
                  onClick={onReopenGuide}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  <BookOpen className="h-4 w-4 text-indigo-600" />
                  <span>Xem lại hướng dẫn sử dụng</span>
                </button>
              )}
            </div>
          ) : tab === 'ranking' ? (
            leaderboard.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Chưa có dữ liệu xếp hạng. Hãy check-in để lên bảng!
              </div>
            ) : (
              <div className="space-y-1.5">
                {leaderboard.map((u, i) => (
                  <div
                    key={u.name}
                    className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${
                      i < 3 ? 'border-amber-200 bg-amber-50/60' : 'border-slate-100 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-7 shrink-0 text-center text-sm font-black">
                        {medal(i)}
                      </span>
                      <span className="truncate text-sm font-bold text-slate-800">{u.name}</span>
                    </div>
                    <span className="shrink-0 text-[11px] font-bold text-slate-500">
                      {u.count} lượt • {u.places} quán
                    </span>
                  </div>
                ))}
              </div>
            )
          ) : (
            <>
              {myStats && (
            <div className="mb-3 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-rose-100 bg-rose-50 p-2.5 text-center">
                <div className="text-lg font-black text-rose-600">{myStats.saved}</div>
                <div className="text-[10px] font-bold text-slate-500">Đã lưu</div>
              </div>
              <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-2.5 text-center">
                <div className="text-lg font-black text-indigo-600">{myStats.collections}</div>
                <div className="text-[10px] font-bold text-slate-500">Bộ sưu tập</div>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-2.5 text-center">
                <div className="text-lg font-black text-emerald-600">{myStats.pets}</div>
                <div className="text-[10px] font-bold text-slate-500">Boss</div>
              </div>
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Đang tải...
            </div>
          ) : checkins.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-3xl">
                🐾
              </div>
              <div className="text-sm font-bold text-slate-700">Chưa có check-in nào</div>
              <p className="text-xs text-slate-500">
                Hãy là người đầu tiên check-in cùng Boss tại quán pet-friendly!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {checkins.map((c) => (
                <div
                  key={c.id}
                  className="rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-extrabold text-slate-900">
                          {c.authorName}
                        </span>
                        {c.petName && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                            <PawPrint className="h-3 w-3" />
                            {c.petName}
                          </span>
                        )}
                        {c.verified && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            <ShieldCheck className="h-3 w-3" />
                            Đã xác thực
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-xs text-slate-600">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        <span className="font-semibold truncate">{c.placeName}</span>
                      </div>
                    </div>
                    <span className="shrink-0 text-[10px] font-medium text-slate-400">
                      {timeAgo(c.createdAt)}
                    </span>
                  </div>

                  <div className="mt-1.5 flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`h-3.5 w-3.5 ${
                          s <= c.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                  {c.comment && (
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">{c.comment}</p>
                  )}
                </div>
              ))}
            </div>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
