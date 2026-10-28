import { createClient, SupabaseClient } from '@supabase/supabase-js';

const RUNTIME_URL_KEY = 'petmap_runtime_supabase_url';
const RUNTIME_ANON_KEY = 'petmap_runtime_supabase_anon_key';

export function getActiveSupabaseConfig(): {
  url: string;
  anonKey: string;
  source: 'env' | 'runtime' | 'none';
} {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

  if (
    envUrl &&
    envKey &&
    envUrl.startsWith('http') &&
    !envUrl.includes('your-project-id')
  ) {
    return { url: envUrl, anonKey: envKey, source: 'env' };
  }

  try {
    const runtimeUrl = localStorage.getItem(RUNTIME_URL_KEY)?.trim() || '';
    const runtimeKey = localStorage.getItem(RUNTIME_ANON_KEY)?.trim() || '';
    if (runtimeUrl && runtimeKey && runtimeUrl.startsWith('http')) {
      return { url: runtimeUrl, anonKey: runtimeKey, source: 'runtime' };
    }
  } catch {
    // ignore storage errors
  }

  return { url: '', anonKey: '', source: 'none' };
}

let cachedClient: SupabaseClient | null = null;
let cachedUrl = '';
let cachedKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const cfg = getActiveSupabaseConfig();
  if (cfg.source === 'none') {
    cachedClient = null;
    return null;
  }

  if (cachedClient && cachedUrl === cfg.url && cachedKey === cfg.anonKey) {
    return cachedClient;
  }

  cachedUrl = cfg.url;
  cachedKey = cfg.anonKey;
  cachedClient = createClient(cfg.url, cfg.anonKey);
  return cachedClient;
}

export function isSupabaseReady(): boolean {
  return getActiveSupabaseConfig().source !== 'none';
}

export function saveRuntimeSupabaseConfig(url: string, anonKey: string): void {
  localStorage.setItem(RUNTIME_URL_KEY, url.trim());
  localStorage.setItem(RUNTIME_ANON_KEY, anonKey.trim());
  cachedClient = null;
}

export function clearRuntimeSupabaseConfig(): void {
  localStorage.removeItem(RUNTIME_URL_KEY);
  localStorage.removeItem(RUNTIME_ANON_KEY);
  cachedClient = null;
}
