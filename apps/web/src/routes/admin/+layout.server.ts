import { requireAdmin } from '$lib/server/auth';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
  const { serviceClient } = await requireAdmin(event);
  const { count } = await serviceClient
    .from('account_deletion_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'requested');

  return {
    pendingDeletionRequestCount: count ?? 0
  };
};
