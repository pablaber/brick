import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

export async function requireUser(event: RequestEvent) {
  const user = await event.locals.getUser();

  if (!user) {
    redirect(303, '/auth/login');
  }

  return user;
}
