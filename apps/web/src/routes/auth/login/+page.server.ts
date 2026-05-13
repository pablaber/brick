import { fail, redirect } from '@sveltejs/kit';
import { ensureProfile } from '$lib/server/profiles';
import { isEmailAllowed } from '$lib/server/allowed-emails';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const user = await locals.getUser();
  if (user) {
    redirect(303, '/dashboard');
  }
  return { signupEnabled: false };
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

    const allowed = await isEmailAllowed(email);
    if (!allowed) {
      return fail(403, {
        error: 'Signups are invite-only. Contact the admin to request access.',
        email
      });
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
