import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import type { Database } from '@brick/shared';
import { getSupabasePublicConfig } from '$lib/supabase-config';

let _adminClient: SupabaseClient<Database> | null = null;

export function getAdminSupabaseClient(): SupabaseClient<Database> {
  if (_adminClient) return _adminClient;

  const { url } = getSupabasePublicConfig();
  const secretKey = env.SUPABASE_SECRET_KEY;

  if (!secretKey) {
    throw new Error('Missing SUPABASE_SECRET_KEY');
  }

  _adminClient = createClient<Database>(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });

  return _adminClient;
}
