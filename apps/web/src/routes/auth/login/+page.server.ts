import { fail, redirect } from '@sveltejs/kit';
import { ensureProfile } from '$lib/server/profiles';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const session = await locals.getSession();
  if (session) {
    redirect(303, '/dashboard');
  }
};

export const actions: Actions = {
  login: async ({ request, locals }) => {
    const formData = await request.formData();
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email || !password) {
      return fail(400, { error: 'Email and password are required.', email });
    }

    const { error } = await locals.supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return fail(400, { error: error.message, email });
    }

    const user = await locals.getUser();
    if (user) {
      await ensureProfile(locals.supabase, user);
    }

    redirect(303, '/dashboard');
  },

  signup: async ({ request, locals }) => {
    const formData = await request.formData();
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email || !password) {
      return fail(400, { error: 'Email and password are required.', email });
    }

    const { data, error } = await locals.supabase.auth.signUp({ email, password });

    if (error) {
      return fail(400, { error: error.message, email });
    }

    if (data.user && !data.session) {
      return { confirmEmail: true };
    }

    if (data.user) {
      await ensureProfile(locals.supabase, data.user);
    }

    redirect(303, '/dashboard');
  }
};
