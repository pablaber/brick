import { getAdminSupabaseClient } from './supabase-admin';

export async function isEmailAllowed(email: string): Promise<boolean> {
  const client = getAdminSupabaseClient();
  const { data } = await client
    .from('allowed_emails')
    .select('id')
    .eq('email', email.toLowerCase())
    .maybeSingle();
  return data !== null;
}
