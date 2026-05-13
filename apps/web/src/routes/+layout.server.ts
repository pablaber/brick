import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  const user = await locals.getUser();

  if (!user) {
    return { user: null };
  }

  const { data: profile } = await locals.supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();

  return {
    user: {
      id: user.id,
      email: user.email ?? null,
      isAdmin: profile?.is_admin ?? false
    }
  };
};
