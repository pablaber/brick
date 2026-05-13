import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '@brick/shared';

export async function ensureProfile(supabase: SupabaseClient<Database>, user: User) {
  const displayName = user.email?.split('@')[0] ?? null;

  await supabase
    .from('profiles')
    .upsert(
      { id: user.id, display_name: displayName },
      { onConflict: 'id', ignoreDuplicates: true }
    );
}
