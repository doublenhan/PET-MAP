-- ============================================================
-- PETMAP — SUPABASE DATABASE SCHEMA (PostgreSQL)
-- Script này hỗ trợ chạy lại nhiều lần (Idempotent - DROP POLICY IF EXISTS)
-- Chạy script này trong Supabase Dashboard -> SQL Editor
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- 0. HÀM is_admin(): kiểm tra tài khoản hiện tại có quyền admin không.
--    Dùng cho các RLS chỉ cho phép admin kiểm duyệt (xóa quán/review/report).
--    Admin được nhận diện qua bảng user_roles HOẶC email bắt đầu bằng 'admin@'.
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'admin'
  ) or coalesce(auth.jwt() ->> 'email', '') like 'admin@%';
$$;

-- 1. BẢNG PLACES: ĐỊA ĐIỂM CAFE / NHÀ HÀNG / STORE
create table if not exists public.places (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text not null check (category in ('cafe', 'restaurant', 'store', 'vet_spa', 'park')),
  address text not null,
  district text not null,
  lat double precision not null,
  lng double precision not null,
  pet_policy text not null check (pet_policy in ('allowed', 'conditional', 'not_allowed')),
  pet_conditions text[] not null default '{}',
  pet_policy_notes text default '',
  allowed_pet_types text[] not null default '{"dog","cat"}',
  max_weight_kg numeric,
  google_maps_url text default '',
  website_url text default '',
  phone text default '',
  opening_hours text default '',
  image_url text default '',
  rating numeric default 4.5,
  review_count integer default 1,
  verified boolean default false,
  created_at timestamptz not null default now()
);

alter table public.places enable row level security;

drop policy if exists "Allow public read access on places" on public.places;
create policy "Allow public read access on places"
  on public.places
  for select
  using (true);

drop policy if exists "Allow public insert access on places" on public.places;
create policy "Allow public insert access on places"
  on public.places
  for insert
  with check (true);

drop policy if exists "Allow public update access on places" on public.places;
create policy "Allow public update access on places"
  on public.places
  for update
  using (true)
  with check (true);

-- Xóa quán: CHỈ admin được phép (kiểm duyệt). User thường chỉ được góp (insert) & sửa chính sách (update).
drop policy if exists "Allow public delete access on places" on public.places;
drop policy if exists "Admin delete access on places" on public.places;
create policy "Admin delete access on places"
  on public.places
  for delete
  using (public.is_admin());

create index if not exists idx_places_pet_policy on public.places (pet_policy);
create index if not exists idx_places_category on public.places (category);
create index if not exists idx_places_district on public.places (district);

-- ============================================================
-- 2. BẢNG REVIEWS: ĐÁNH GIÁ & CỘNG ĐỒNG XÁC THỰC CHÍNH SÁCH PET
-- ============================================================
create table if not exists public.place_reviews (
  id uuid primary key default uuid_generate_v4(),
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  author_name text not null default 'Người nuôi Pet',
  pet_info text default '',
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text not null,
  policy_accurate boolean not null default true,
  image_url text default '',
  helpful_count integer not null default 0,
  visited_at date default current_date,
  created_at timestamptz not null default now()
);

alter table public.place_reviews enable row level security;

-- Bổ sung cột mở rộng nếu bảng đã tạo trước đó
alter table public.place_reviews add column if not exists image_url text default '';
alter table public.place_reviews add column if not exists helpful_count integer not null default 0;

drop policy if exists "Allow public read access on place_reviews" on public.place_reviews;
create policy "Allow public read access on place_reviews"
  on public.place_reviews
  for select
  using (true);

drop policy if exists "Allow public insert access on place_reviews" on public.place_reviews;
create policy "Allow public insert access on place_reviews"
  on public.place_reviews
  for insert
  with check (true);

-- Cập nhật review: cho phép công khai (dùng cho nút "hữu ích" tăng helpful_count).
drop policy if exists "Allow public update on place_reviews" on public.place_reviews;
create policy "Allow public update on place_reviews"
  on public.place_reviews
  for update
  using (true)
  with check (true);

-- Xóa review: CHỈ admin được phép (gỡ review spam). User thường chỉ được viết (insert).
drop policy if exists "Allow public delete access on place_reviews" on public.place_reviews;
drop policy if exists "Admin delete access on place_reviews" on public.place_reviews;
create policy "Admin delete access on place_reviews"
  on public.place_reviews
  for delete
  using (public.is_admin());

create index if not exists idx_place_reviews_place_id on public.place_reviews (place_id);

-- ============================================================
-- 3. BẢNG PET_PROFILES: LƯU NHIỀU THÚ CƯNG THEO USER ĐĂNG NHẬP
-- ============================================================
create table if not exists public.pet_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  identity_code text default '',
  avatar_url text default '',
  owner_phone text default '',
  name text not null,
  type text not null check (type in ('dog', 'cat', 'other')),
  breed text default '',
  weight_kg numeric not null default 5,
  birth_date date,
  gender text default 'unknown' check (gender in ('male', 'female', 'unknown')),
  vaccinated boolean not null default true,
  has_carrier boolean not null default false,
  has_muzzle boolean not null default false,
  has_diaper boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Bổ sung các cột mở rộng nếu bảng đã tạo trước đó
alter table public.pet_profiles add column if not exists identity_code text default '';
alter table public.pet_profiles add column if not exists avatar_url text default '';
alter table public.pet_profiles add column if not exists owner_phone text default '';
alter table public.pet_profiles add column if not exists birth_date date;
alter table public.pet_profiles add column if not exists gender text default 'unknown';

-- Gỡ bỏ ràng buộc 1 user - 1 pet cũ (nếu có) để hỗ trợ Multi-Pet Profile
alter table public.pet_profiles drop constraint if exists pet_profiles_user_id_key;

-- QUAN TRỌNG: Gỡ ràng buộc khóa ngoại user_id -> auth.users(id).
-- Ứng dụng hỗ trợ cả tài khoản cục bộ (local-auth), nếu giữ khóa ngoại thì insert sẽ bị lỗi 23503
-- (foreign key violation) khiến pet_profiles không lưu được dữ liệu.
alter table public.pet_profiles drop constraint if exists pet_profiles_user_id_fkey;

create index if not exists idx_pet_profiles_user_id on public.pet_profiles (user_id);
create index if not exists idx_pet_profiles_identity_code on public.pet_profiles (identity_code);

alter table public.pet_profiles enable row level security;

drop policy if exists "Users can view their own pet profile" on public.pet_profiles;
drop policy if exists "Allow public lookup of pet profiles" on public.pet_profiles;
-- GHI CHÚ BẢO MẬT: pet_profiles để public để hỗ trợ (1) tra cứu Mã Định Danh khi bé đi lạc,
-- (2) tài khoản cục bộ (local-auth) khi chưa bật Supabase Auth. Nếu triển khai production dùng
-- Supabase Auth đầy đủ, nên đổi update/delete thành: using (auth.uid() = user_id).
create policy "Allow public lookup of pet profiles"
  on public.pet_profiles
  for select
  using (true);

drop policy if exists "Users can insert their own pet profile" on public.pet_profiles;
create policy "Users can insert their own pet profile"
  on public.pet_profiles
  for insert
  with check (true);

drop policy if exists "Users can update their own pet profile" on public.pet_profiles;
create policy "Users can update their own pet profile"
  on public.pet_profiles
  for update
  using (true)
  with check (true);

drop policy if exists "Users can delete their own pet profile" on public.pet_profiles;
create policy "Users can delete their own pet profile"
  on public.pet_profiles
  for delete
  using (true);

-- ============================================================
-- 4. BẢNG USER_ROLES: PHÂN QUYỀN USER / ADMIN (DÙNG CHO CẤU HÌNH HỆ THỐNG)
-- ============================================================
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;

drop policy if exists "Users can read their own role" on public.user_roles;
create policy "Users can read their own role"
  on public.user_roles
  for select
  using (auth.uid() = user_id);

-- ============================================================
-- 5. BẢNG PLACE_REPORTS: BÁO CÁO CẬP NHẬT TRẠNG THÁI QUÁN / SAI THÔNG TIN
-- ============================================================
create table if not exists public.place_reports (
  id uuid primary key default uuid_generate_v4(),
  place_id uuid not null references public.places(id) on delete cascade,
  place_name text not null default '',
  reason text not null default 'policy_changed',
  suggested_policy text check (suggested_policy in ('allowed', 'conditional', 'not_allowed')),
  details text not null default '',
  reporter_name text not null default 'Cộng đồng PetMap',
  status text not null default 'pending' check (status in ('pending', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table public.place_reports enable row level security;

-- Đọc báo cáo: CHỈ admin (báo cáo chứa thông tin kiểm duyệt nội bộ).
drop policy if exists "Allow public read on place_reports" on public.place_reports;
drop policy if exists "Admin read on place_reports" on public.place_reports;
create policy "Admin read on place_reports"
  on public.place_reports for select using (public.is_admin());

-- Gửi báo cáo: ai cũng được (cộng đồng đóng góp).
drop policy if exists "Allow public insert on place_reports" on public.place_reports;
create policy "Allow public insert on place_reports"
  on public.place_reports for insert with check (true);

-- Cập nhật / Xóa báo cáo: CHỈ admin (xử lý kiểm duyệt).
drop policy if exists "Allow public update on place_reports" on public.place_reports;
drop policy if exists "Admin update on place_reports" on public.place_reports;
create policy "Admin update on place_reports"
  on public.place_reports for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Allow public delete on place_reports" on public.place_reports;
drop policy if exists "Admin delete on place_reports" on public.place_reports;
create policy "Admin delete on place_reports"
  on public.place_reports for delete using (public.is_admin());

-- ============================================================
-- 6. SUPABASE STORAGE BUCKET CHO UPLOAD ẢNH QUÁN & BOSS CHECK-IN
-- ============================================================
insert into storage.buckets (id, name, public)
values ('petmap-images', 'petmap-images', true)
on conflict (id) do nothing;

drop policy if exists "Allow public read on petmap-images" on storage.objects;
create policy "Allow public read on petmap-images"
  on storage.objects for select
  using (bucket_id = 'petmap-images');

drop policy if exists "Allow public upload on petmap-images" on storage.objects;
create policy "Allow public upload on petmap-images"
  on storage.objects for insert
  with check (bucket_id = 'petmap-images');

-- ============================================================
-- 7. BẢNG CHECK_INS: LƯỢT CHECK-IN TẠI QUÁN (XÁC THỰC QR + GPS)
-- ============================================================
create table if not exists public.check_ins (
  id uuid primary key default uuid_generate_v4(),
  place_id uuid not null references public.places(id) on delete cascade,
  place_name text not null default '',
  pet_id uuid,
  pet_name text default '',
  user_id uuid,
  author_name text not null default 'Người dùng PetMap',
  rating numeric not null default 5,
  comment text not null default '',
  verified boolean not null default false,
  method text not null default 'qr' check (method in ('qr_gps', 'qr', 'gps')),
  created_at timestamptz not null default now()
);

create index if not exists idx_check_ins_place_id on public.check_ins (place_id);
create index if not exists idx_check_ins_pet_id on public.check_ins (pet_id);
create index if not exists idx_check_ins_created_at on public.check_ins (created_at desc);

alter table public.check_ins enable row level security;

-- Đọc check-in: công khai (feed hoạt động + lịch sử Boss).
drop policy if exists "Allow public read on check_ins" on public.check_ins;
create policy "Allow public read on check_ins"
  on public.check_ins for select using (true);

-- Tạo check-in: ai cũng được (xác thực bằng QR + GPS ở phía ứng dụng).
drop policy if exists "Allow public insert on check_ins" on public.check_ins;
create policy "Allow public insert on check_ins"
  on public.check_ins for insert with check (true);

-- Xoá check-in: chỉ admin (kiểm duyệt).
drop policy if exists "Admin delete on check_ins" on public.check_ins;
create policy "Admin delete on check_ins"
  on public.check_ins for delete using (public.is_admin());



