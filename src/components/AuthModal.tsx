import React, { useState } from 'react';
import { X, LogIn, UserPlus, Mail, Lock, User, PawPrint, Loader2 } from 'lucide-react';
import { AuthUser, signInWithEmail, signUpWithEmail } from '../services/authPetService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  reasonMessage?: string;
  onAuthSuccess: (user: AuthUser) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  reasonMessage,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await signInWithEmail(email, password);
        if (res.error || !res.user) {
          setErrorMsg(res.error || 'Đăng nhập thất bại. Vui lòng kiểm tra lại email/mật khẩu.');
          return;
        }
        onAuthSuccess(res.user);
        onClose();
      } else {
        if (password.length < 6) {
          setErrorMsg('Mật khẩu cần tối thiểu 6 ký tự.');
          return;
        }
        const res = await signUpWithEmail(email, password, fullName);
        if (res.error || !res.user) {
          setErrorMsg(res.error || 'Đăng ký thất bại.');
          return;
        }
        onAuthSuccess(res.user);
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1150] flex items-end sm:items-center justify-center bg-slate-950/60 p-0 sm:p-4 backdrop-blur-xs">
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
              <PawPrint className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {mode === 'login' ? 'Đăng nhập PetMap' : 'Tạo tài khoản PetMap'}
              </h3>
              <p className="text-xs text-slate-500">
                Lưu thông tin thú cưng & đồng bộ dữ liệu cá nhân
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

        {/* Body */}
        <div className="p-6 space-y-4">
          {reasonMessage && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-900">
              🐾 {reasonMessage}
            </div>
          )}

          {/* Switch Tabs */}
          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg('');
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Đăng nhập</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMsg('');
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition cursor-pointer ${
                mode === 'signup'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Đăng ký mới</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Tên của bạn (Sen) *
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="VD: Minh Anh"
                    className="w-full rounded-xl border border-slate-200 py-2.5 pr-3 pl-9 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Email *
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ban@email.com"
                  className="w-full rounded-xl border border-slate-200 py-2.5 pr-3 pl-9 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Mật khẩu *
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  className="w-full rounded-xl border border-slate-200 py-2.5 pr-3 pl-9 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-medium text-rose-700">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>
                {mode === 'login'
                  ? 'Đăng nhập & Mở Hồ sơ Thú cưng'
                  : 'Đăng ký & Lưu Hồ sơ Thú cưng'}
              </span>
            </button>
          </form>

          <p className="text-center text-[11px] text-slate-400">
            Bạn vẫn có thể đóng cửa sổ này và tra cứu bản đồ bình thường mà không cần đăng nhập.
          </p>
        </div>
      </div>
    </div>
  );
};
