import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@brick/shared';

import type { Env } from '../env.js';

export function createServiceSupabaseClient(env: Env): SupabaseClient<Database> {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });
}
