import { createClient } from '@supabase/supabase-js';
import { getLocalDb, isLocalDevMode } from './localDb';

export function getSupabase() {
  if (isLocalDevMode()) {
    return getLocalDb();
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  }

  return createClient(url, key);
}
