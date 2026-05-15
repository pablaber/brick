import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  const user = await locals.getUser();

  if (!user) {
    return { user: null };
  }

  const { data: profile } = await locals.supabase
    .from('profiles')
    .select('display_name, is_admin')
    .eq('id', user.id)
    .single();

  return {
    user: {
      id: user.id,
      email: user.email ?? null,
      displayName: profile?.display_name ?? null,
      isAdmin: profile?.is_admin ?? false
    }
  };
};
