import { requireAdmin } from '$lib/server/auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const { serviceClient } = await requireAdmin(event);

  const [profilesResult, usersResult] = await Promise.all([
    serviceClient.from('profiles').select('id, display_name, is_admin, created_at').order('created_at'),
    serviceClient.auth.admin.listUsers()
  ]);

  const profiles = profilesResult.data ?? [];
  const authUsers = usersResult.data?.users ?? [];

  const emailById = new Map(authUsers.map((u) => [u.id, u.email ?? '']));

  const users = profiles.map((p) => ({
    id: p.id,
    email: emailById.get(p.id) ?? '',
    displayName: p.display_name,
    isAdmin: p.is_admin,
    createdAt: p.created_at
  }));

  return { users };
};
