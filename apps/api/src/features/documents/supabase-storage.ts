import { ServiceUnavailableException } from '../../shared/core/error.response';
import { createClient } from '@supabase/supabase-js';

// One client per URL + key: building a new client for every file adds avoidable work on each upload.
let cached: { id: string; storage: ReturnType<typeof build> } | null = null;

export function storageClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw unavailable();
  const id = `${url}\n${key}`;
  if (cached?.id !== id) cached = { id, storage: build(url, key) };
  return cached.storage;
}

function build(url: string, key: string) {
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

