import { getSupabaseClient, isSupabaseReady } from '../lib/supabase';

const BUCKET_NAME = 'petmap-images';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Không thể đọc file ảnh'));
    reader.readAsDataURL(file);
  });
}

/**
 * Nén ảnh trên trình duyệt trước khi upload hoặc lưu DataURL để tăng tốc độ hiển thị
 */
async function compressImageFile(file: File, maxWidth = 960, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          resolve(blob || file);
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('File ảnh không hợp lệ'));
    };
    img.src = url;
  });
}

/**
 * Upload ảnh lên Supabase Storage bucket `petmap-images`.
 * Nếu bucket chưa tạo trên Supabase hoặc bị chặn RLS, tự động fallback sang ảnh nén Base64
 * để người dùng luôn tải ảnh lên thành công ngay lập tức.
 */
export async function uploadPlaceImage(file: File): Promise<{
  url: string;
  storageType: 'supabase' | 'inline';
}> {
  const compressedBlob = await compressImageFile(file);
  const supabase = getSupabaseClient();

  if (isSupabaseReady() && supabase) {
    const ext = 'jpg';
    const filePath = `places/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, compressedBlob, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (!error) {
      const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
      if (data?.publicUrl) {
        return { url: data.publicUrl, storageType: 'supabase' };
      }
    }
  }

  // Fallback sang ảnh nén DataURL để hoạt động mượt mà kể cả khi chưa tạo Storage Bucket
  const compressedFile = new File([compressedBlob], file.name, { type: 'image/jpeg' });
  const dataUrl = await fileToDataUrl(compressedFile);
  return { url: dataUrl, storageType: 'inline' };
}
