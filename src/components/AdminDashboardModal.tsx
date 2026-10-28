import React, { useState, useMemo } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  MapPin,
  Database,
  UploadCloud,
  RotateCcw,
  Search,
} from 'lucide-react';
import { Place, PLACE_CATEGORIES, PET_POLICIES } from '../types/place';

interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  places: Place[];
  dataSource: 'supabase' | 'local';
  onApprovePlace: (placeId: string) => Promise<void>;
  onDeletePlace: (placeId: string) => Promise<void>;
  onSelectPlaceOnMap: (place: Place) => void;
  onSeedSupabase: () => Promise<void>;
  onResetLocal: () => void;
}

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({
  isOpen,
  onClose,
  places,
  dataSource,
  onApprovePlace,
  onDeletePlace,
  onSelectPlaceOnMap,
  onSeedSupabase,
  onResetLocal,
}) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'all' | 'system'>('pending');
  const [filterText, setFilterText] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const pendingPlaces = useMemo(
    () => places.filter((p) => !p.verified && !p.id.startsWith('osm-')),
    [places]
  );

  const filteredAllPlaces = useMemo(() => {
    const q = filterText.toLowerCase().trim();
    if (!q) return places;
    return places.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.district.toLowerCase().includes(q)
    );
  }, [places, filterText]);

  if (!isOpen) return null;

  const handleApprove = async (id: string) => {
    setBusyId(id);
    try {
      await onApprovePlace(id);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      await onDeletePlace(id);
    } finally {
      setBusyId(null);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await onSeedSupabase();
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1150] flex items-end sm:items-center justify-center bg-slate-950/60 p-0 sm:p-4 backdrop-blur-xs">
      <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-900 px-6 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold">Bảng Quản Trị Admin (PetMap)</h3>
                <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                  {dataSource === 'supabase' ? 'Supabase Cloud' : 'Local DB'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Duyệt địa điểm cộng đồng đóng góp, xoá địa điểm rác & quản lý hệ thống
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`border-b-2 px-3 py-2 text-xs font-bold transition cursor-pointer ${
              activeTab === 'pending'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Chờ duyệt ({pendingPlaces.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`border-b-2 px-3 py-2 text-xs font-bold transition cursor-pointer ${
              activeTab === 'all'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Tất cả địa điểm ({places.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('system')}
            className={`border-b-2 px-3 py-2 text-xs font-bold transition cursor-pointer ${
              activeTab === 'system'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Cơ sở dữ liệu & Seed
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {activeTab === 'pending' && (
            <>
              {pendingPlaces.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div className="text-sm font-bold text-slate-800">
                    Tất cả địa điểm đã được duyệt!
                  </div>
                  <p className="text-xs text-slate-500">
                    Khi người dùng bấm "+ Thêm quán", địa điểm mới sẽ xuất hiện tại đây với trạng thái chờ duyệt.
                  </p>
                </div>
              ) : (
                pendingPlaces.map((place) => {
                  const cat = PLACE_CATEGORIES[place.category];
                  const pol = PET_POLICIES[place.petPolicy];
                  return (
                    <div
                      key={place.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/40 p-3.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <span className="font-bold text-slate-700">
                            {cat.emoji} {cat.shortLabel}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="font-semibold text-amber-700">{pol.shortLabel}</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-500">{place.district}</span>
                        </div>
                        <h4 className="mt-0.5 text-sm font-bold text-slate-900">{place.name}</h4>
                        <p className="text-xs text-slate-600">{place.address}</p>
                        {place.petPolicyNotes && (
                          <p className="mt-1 text-xs italic text-slate-500">
                            "{place.petPolicyNotes}"
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectPlaceOnMap(place);
                            onClose();
                          }}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          <span>Xem</span>
                        </button>
                        <button
                          type="button"
                          disabled={busyId === place.id}
                          onClick={() => handleApprove(place.id)}
                          className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Duyệt</span>
                        </button>
                        <button
                          type="button"
                          disabled={busyId === place.id}
                          onClick={() => handleDelete(place.id)}
                          className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-50 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}

          {activeTab === 'all' && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="Tìm nhanh địa điểm để kiểm duyệt hoặc xoá..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-xs focus:border-emerald-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
                {filteredAllPlaces.map((place) => (
                  <div
                    key={place.id}
                    className="flex items-center justify-between gap-3 p-3 text-xs hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 truncate">{place.name}</span>
                        {place.verified ? (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                            Đã xác thực
                          </span>
                        ) : (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                            Chưa duyệt
                          </span>
                        )}
                      </div>
                      <div className="text-slate-500 truncate">
                        {place.address} • {place.district}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {!place.verified && (
                        <button
                          type="button"
                          disabled={busyId === place.id}
                          onClick={() => handleApprove(place.id)}
                          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-500 cursor-pointer"
                        >
                          Duyệt
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busyId === place.id}
                        onClick={() => handleDelete(place.id)}
                        title="Xoá địa điểm này"
                        className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="space-y-4 text-xs text-slate-600">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Database className="h-4 w-4 text-emerald-600" />
                  <span>
                     Nguồn dữ liệu hiện tại:{' '}
                    {dataSource === 'supabase' ? 'Supabase PostgreSQL Cloud' : 'LocalStorage'}
                  </span>
                </div>
                <p className="mt-1">
                  Đẩy bổ sung bộ dữ liệu địa điểm mẫu (bao gồm các Bệnh viện Thú y Cấp cứu 24/7 và các quán Quận 5) lên bảng <code className="font-mono font-bold">places</code>.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={seeding}
                    onClick={handleSeed}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
                  >
                    <UploadCloud className="h-4 w-4" />
                    <span>{seeding ? 'Đang đồng bộ...' : 'Đồng bộ dữ liệu mẫu lên Supabase'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={onResetLocal}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset Local Cache</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
