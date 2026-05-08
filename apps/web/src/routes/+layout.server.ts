import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  const session = await locals.getSession();

  return {
    user: session?.user ? { id: session.user.id, email: session.user.email ?? null } : null
  };
};
