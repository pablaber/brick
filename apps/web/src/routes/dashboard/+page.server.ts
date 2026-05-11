import { requireUser } from '$lib/server/auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  await requireUser(event);
};
