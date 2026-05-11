import { dev } from '$app/environment';
import { env } from '$env/dynamic/public';

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321';
const LOCAL_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

export function getSupabasePublicConfig() {
  const url = env.PUBLIC_SUPABASE_URL ?? (dev ? LOCAL_SUPABASE_URL : undefined);
  const anonKey = env.PUBLIC_SUPABASE_ANON_KEY ?? (dev ? LOCAL_SUPABASE_ANON_KEY : undefined);

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase config. Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY.'
    );
  }

  return { url, anonKey };
}
