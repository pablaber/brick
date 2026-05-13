import { fail } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async (event) => {
  const { serviceClient } = await requireAdmin(event);

  const { data: invites } = await serviceClient
    .from('allowed_emails')
    .select('id, email, created_at')
    .order('created_at');

  return { invites: invites ?? [] };
};

export const actions: Actions = {
  invite: async (event) => {
    const { user, serviceClient } = await requireAdmin(event);
    const formData = await event.request.formData();
    const email = (formData.get('email') as string)?.trim().toLowerCase();

    if (!email) {
      return fail(400, { error: 'Email is required.' });
    }

    const { error } = await serviceClient
      .from('allowed_emails')
      .insert({ email, invited_by: user.id });

    if (error) {
      if (error.code === '23505') {
        return fail(400, { error: 'That email is already on the invite list.' });
      }
      return fail(500, { error: error.message });
    }

    return { success: true };
  },

  remove: async (event) => {
    const { serviceClient } = await requireAdmin(event);
    const formData = await event.request.formData();
    const id = formData.get('id') as string;

    if (!id) {
      return fail(400, { error: 'Missing invite ID.' });
    }

    const { error } = await serviceClient.from('allowed_emails').delete().eq('id', id);

    if (error) {
      return fail(500, { error: error.message });
    }

    return { success: true };
  }
};
