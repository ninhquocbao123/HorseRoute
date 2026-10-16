import { ServiceUnavailableException } from '../../shared/core/error.response';
import { createClient } from '@supabase/supabase-js';

export function storageClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw unavailable();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, {
      ...init, signal: AbortSignal.timeout(30_000), redirect: 'error',
    }) },
  }).storage;
}

export function unavailable() {
  return new ServiceUnavailableException('Không truy cập được kho tài liệu. Vui lòng thử lại sau.');
}

