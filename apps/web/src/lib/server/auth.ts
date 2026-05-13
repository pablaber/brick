import { error, redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { getAdminSupabaseClient } from './supabase-admin';

export async function requireUser(event: RequestEvent) {
  const user = await event.locals.getUser();

  if (!user) {
    redirect(303, '/auth/login');
  }

  return user;
}

export async function requireAdmin(event: RequestEvent) {
  const user = await requireUser(event);
  const serviceClient = getAdminSupabaseClient();

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    error(403, 'Forbidden');
  }

  return { user, serviceClient };
}
