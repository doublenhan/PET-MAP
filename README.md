# 🐾 PetMap — Bản đồ địa điểm thân thiện với thú cưng tại TP.HCM

Ứng dụng web/mobile kiểu Google Maps giúp cộng đồng tìm **quán cafe, nhà hàng, cửa hàng, công viên và phòng khám thú y 24/7** cho phép mang theo thú cưng, kèm hệ thống **Thẻ Căn Cước Định Danh Thú Cưng** (QR), đánh giá cộng đồng và trang quản trị.

## 🚀 Công nghệ

- **Frontend**: React 19 + TypeScript + Vite 6
- **UI**: Tailwind CSS v4, Lucide Icons
- **Bản đồ & định tuyến**: Leaflet + React-Leaflet, Google Maps tiles, OSRM (đường thật), Nominatim (geocoding), Overpass API (POI gần đây)
- **Backend**: Supabase (PostgreSQL + Auth + Storage), tự động fallback `localStorage` khi offline
- **Test**: Vitest + Testing Library

## 📦 Cài đặt

```bash
npm install
```

## 🔑 Cấu hình Supabase

1. Tạo project trên [supabase.com](https://supabase.com).
2. Sao chép `.env.example` thành `.env.local` và điền thông tin từ **Dashboard → Project Settings → API**:

```env
VITE_SUPABASE_URL=https://<project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key>
```

3. Mở **Supabase Dashboard → SQL Editor**, dán toàn bộ nội dung [`supabase/schema.sql`](supabase/schema.sql) và chạy. Script này idempotent (chạy lại nhiều lần an toàn), tạo đủ các bảng `places`, `place_reviews`, `pet_profiles`, `user_roles`, `place_reports`, storage bucket `petmap-images` và các RLS policy.

> Không cấu hình Supabase vẫn chạy được — dữ liệu sẽ lưu tạm trong `localStorage` của trình duyệt.

## 🛠 Lệnh thường dùng

| Lệnh | Mô tả |
|------|-------|
| `npm run dev` | Chạy dev server (Vite) |
| `npm run build` | Build production (`tsc -b && vite build`) |
| `npm run preview` | Xem thử bản build |
| `npm test` | Chạy toàn bộ test (Vitest) |
| `npm run test:watch` | Test ở chế độ watch |
| `npm run lint` | Kiểm tra ESLint |

## 👤 Tài khoản Admin

- Trang quản trị tại route `/admin` (yêu cầu đăng nhập Supabase Auth).
- Tài khoản được coi là admin nếu email bắt đầu bằng `admin@` **hoặc** có bản ghi `role = 'admin'` trong bảng `user_roles`.

## 🗂 Cấu trúc thư mục

```
src/
├─ components/   # UI components (bản đồ, modal, thẻ, admin...)
├─ services/     # Gọi Supabase + fallback localStorage
├─ utils/        # Logic thuần (validation, tương thích pet, khoảng cách...)
├─ types/        # Kiểu dữ liệu & hằng số metadata dùng chung
├─ lib/          # Khởi tạo Supabase client
└─ test/         # Setup cho Vitest
```

## 🔒 Bảo mật (RLS)

- `places` / `place_reviews`: cộng đồng được **góp & sửa**, nhưng **xoá chỉ dành cho admin**.
- `place_reports`: ai cũng gửi được, nhưng **đọc / xử lý / xoá chỉ admin**.
- `pet_profiles`: để public phục vụ tra cứu Mã Định Danh khi thú đi lạc (xem ghi chú nâng cấp production trong `schema.sql`).

## 🧪 Test

```bash
npm test
```

Test bao phủ: tìm kiếm Tiếng Việt không dấu, trạng thái giờ mở cửa, độ tương thích thú cưng, validation form, và lưu trữ Multi-Pet (mỗi Boss một dòng, không mất dữ liệu khi thêm/sửa/xoá).
