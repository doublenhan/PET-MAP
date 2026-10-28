import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Cấu hình riêng cho test để không ảnh hưởng build production (vite.config.ts)
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
    testTimeout: 15000,
    // Ép Supabase rỗng để test chạy ở chế độ local-only (không gọi mạng thật)
    env: {
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
    },
  },
});
