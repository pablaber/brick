import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@brick/shared';
import { getSupabasePublicConfig } from '$lib/supabase-config';

export const createClient = () => {
  const { url, publishableKey } = getSupabasePublicConfig();
  return createBrowserClient<Database>(url, publishableKey);
};
