import { requireAdmin } from '$lib/server/auth';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
  await requireAdmin(event);
};
