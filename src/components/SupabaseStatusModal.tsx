import React, { useState, useEffect } from 'react';
import {
  Database,
  X,
  CheckCircle2,
  UploadCloud,
  RotateCcw,
  Copy,
  KeyRound,
  Trash2,
} from 'lucide-react';
import {
  isSupabaseReady,
  getActiveSupabaseConfig,
  saveRuntimeSupabaseConfig,
  clearRuntimeSupabaseConfig,
} from '../lib/supabase';

interface SupabaseStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataSource: 'supabase' | 'local';
  onSeedSupabase: () => Promise<void>;
  onResetLocal: () => void;
  onConfigChanged: () => Promise<void>;
}

export const SupabaseStatusModal: React.FC<SupabaseStatusModalProps> = ({
  isOpen,
  onClose,
  dataSource,
  onSeedSupabase,
  onResetLocal,
  onConfigChanged,
}) => {
  const [seeding, setSeeding] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const cfg = getActiveSupabaseConfig();
      setUrlInput(cfg.url);
      setKeyInput(cfg.anonKey);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const activeCfg = getActiveSupabaseConfig();
  const ready = isSupabaseReady();

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await onSeedSupabase();
    } finally {
      setSeeding(false);
    }
  };

  const handleSaveRuntimeConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() || !keyInput.trim()) return;
    setSavingConfig(true);
    try {
      saveRuntimeSupabaseConfig(urlInput, keyInput);
      await onConfigChanged();
    } finally {
      setSavingConfig(false);
    }
  };

  const handleDisconnect = async () => {
    clearRuntimeSupabaseConfig();
    setUrlInput('');
    setKeyInput('');
    await onConfigChanged();
  };

  const envSnippet = `VITE_SUPABASE_URL=https://your-project-id.supabase.co\nVITE_SUPABASE_ANON_KEY=your-anon-public-key`;

  const copyEnv = () => {
    navigator.clipboard?.writeText(envSnippet);
    setCopiedEnv(true);
    setTimeout(() => setCopiedEnv(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl text-white ${
                dataSource === 'supabase' ? 'bg-emerald-600' : 'bg-amber-500'
              }`}
            >
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Trạng thái Lưu trữ Dữ liệu (Supabase Cloud)
              </h3>
              <p className="text-xs text-slate-500">
                {dataSource === 'supabase'
                  ? 'Đang kết nối trực tiếp với Supabase PostgreSQL'
                  : 'Đang chạy chế độ LocalStorage + Dữ liệu mẫu TP.HCM'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto p-6 space-y-4 text-xs text-slate-600 leading-relaxed">
          {ready && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Đã kết nối Supabase!</span>
                </div>
                {activeCfg.source === 'runtime' && (
                  <button
                    onClick={handleDisconnect}
                    className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-rose-600 border border-rose-200 hover:bg-rose-50 cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" /> Ngắt kết nối
                  </button>
                )}
              </div>
              <p className="mt-1">
                Nếu bảng <code className="font-mono font-semibold">places</code> trên Supabase của bạn đang trống, bấm nút dưới để đẩy 10 địa điểm mẫu tại TP.HCM lên Cloud.
              </p>
              <button
                onClick={handleSeed}
                disabled={seeding}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
              >
                <UploadCloud className="h-4 w-4" />
                <span>
                  {seeding ? 'Đang đẩy dữ liệu mẫu...' : 'Seed 10 địa điểm mẫu lên Supabase'}
                </span>
              </button>
            </div>
          )}

          {/* Form kết nối nhanh ngay trên UI */}
          <form
            onSubmit={handleSaveRuntimeConfig}
            className="space-y-3 rounded-2xl border border-indigo-200/80 bg-indigo-50/40 p-4"
          >
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <KeyRound className="h-4 w-4 text-indigo-600" />
              <span>Kết nối nhanh Supabase ngay trên giao diện</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Dán Project URL và Anon Public Key từ Supabase Dashboard (Settings → API) để kết nối ngay mà không cần khởi động lại server:
            </p>
            <div className="space-y-2">
              <input
                type="url"
                required
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://xyzcompany.supabase.co"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono focus:border-indigo-500 focus:outline-none"
              />
              <input
                type="password"
                required
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (anon public key)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={savingConfig}
              className="w-full rounded-xl bg-indigo-600 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 cursor-pointer"
            >
              {savingConfig ? 'Đang kết nối...' : 'Lưu & Kết nối Supabase Cloud'}
            </button>
          </form>

          {/* Hướng dẫn SQL & .env.local */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
            <div className="font-bold text-slate-800">
              Hoặc cấu hình cố định qua file <code className="font-mono">.env.local</code>:
            </div>
            <ol className="list-decimal list-inside space-y-1 text-slate-600">
              <li>
                Chạy nội dung file{' '}
                <code className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-slate-800">
                  supabase/schema.sql
                </code>{' '}
                trong Supabase SQL Editor.
              </li>
              <li>
                Tạo file <code className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-slate-800">.env.local</code> ở thư mục gốc:
              </li>
            </ol>
            <div className="relative mt-2 rounded-xl bg-slate-900 p-3 font-mono text-[11px] text-emerald-300">
              <pre className="overflow-x-auto">{envSnippet}</pre>
              <button
                type="button"
                onClick={copyEnv}
                className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[10px] text-white hover:bg-white/20 cursor-pointer"
              >
                <Copy className="h-3 w-3" />
                {copiedEnv ? 'Đã chép' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => {
                onResetLocal();
                onClose();
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-rose-600 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Khôi phục dữ liệu mẫu ban đầu</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
