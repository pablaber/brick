import { resolve } from '$app/paths';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const user = await locals.getUser();

  redirect(303, user ? resolve('/dashboard') : resolve('/auth/login'));
};
