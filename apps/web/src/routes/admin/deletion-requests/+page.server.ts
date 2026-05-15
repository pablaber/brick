import { error, fail } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const { user, serviceClient } = await requireAdmin(event);

  const [requestsResult, usersResult] = await Promise.all([
    serviceClient
      .from('account_deletion_requests')
      .select('id,user_id,email,status,requested_at,deleted_at,deleted_by_admin_user_id')
      .order('requested_at', { ascending: false }),
    serviceClient.auth.admin.listUsers()
  ]);

  if (requestsResult.error) {
    throw error(500, 'Unable to load account deletion requests.');
  }

  const requests = requestsResult.data ?? [];
  const authUsers = usersResult.data?.users ?? [];
  const emailByUserId = new Map(authUsers.map((authUser) => [authUser.id, authUser.email ?? '']));

  const sortedRequests = [...requests].sort((a, b) => {
    if (a.status === b.status) {
      return b.requested_at.localeCompare(a.requested_at);
    }

    return a.status === 'requested' ? -1 : 1;
  });

  return {
    currentAdminUserId: user.id,
    deletionRequests: sortedRequests.map((request) => ({
      id: request.id,
      user_id: request.user_id,
      email: request.email,
      status: request.status,
      requested_at: request.requested_at,
      deleted_at: request.deleted_at,
      deleted_by_admin_user_id: request.deleted_by_admin_user_id,
      deleted_by_admin_email: request.deleted_by_admin_user_id
        ? (emailByUserId.get(request.deleted_by_admin_user_id) ?? null)
        : null
    }))
  };
};

export const actions: Actions = {
  fulfill: async (event) => {
    const { user, serviceClient } = await requireAdmin(event);
    const formData = await event.request.formData();

    const requestId = formData.get('requestId')?.toString() ?? '';
    const confirmationText = formData.get('confirmationText')?.toString() ?? '';

    if (!requestId) {
      return fail(400, { requestId: null, error: 'Missing deletion request ID.' });
    }

    const { data: requestRow, error: requestLoadError } = await serviceClient
      .from('account_deletion_requests')
      .select('id,user_id,email,status')
      .eq('id', requestId)
      .maybeSingle();

    if (requestLoadError) {
      return fail(500, { requestId, error: 'Unable to load deletion request.' });
    }

    if (!requestRow) {
      return fail(404, { requestId, error: 'Deletion request no longer exists.' });
    }

    if (requestRow.status !== 'requested') {
      return fail(400, { requestId, error: 'Deletion request has already been fulfilled.' });
    }

    if (requestRow.user_id === user.id) {
      return fail(400, { requestId, error: 'You cannot fulfill deletion for your own account.' });
    }

    if (confirmationText !== requestRow.email && confirmationText !== requestRow.user_id) {
      return fail(400, {
        requestId,
        error: 'Confirmation must match the request email or user UUID exactly.'
      });
    }

    const { error: deleteWebhookEventsError } = await serviceClient
      .from('strava_webhook_events')
      .delete()
      .eq('user_id', requestRow.user_id);

    if (deleteWebhookEventsError) {
      return fail(500, {
        requestId,
        error: 'Unable to delete webhook event records for this user.'
      });
    }

    const { error: deleteAllowedEmailError } = await serviceClient
      .from('allowed_emails')
      .delete()
      .ilike('email', requestRow.email);

    if (deleteAllowedEmailError) {
      return fail(500, {
        requestId,
        error: 'Unable to remove allowed email entry for this account.'
      });
    }

    const { error: deleteAuthUserError } = await serviceClient.auth.admin.deleteUser(
      requestRow.user_id
    );

    if (deleteAuthUserError) {
      return fail(500, {
        requestId,
        error: 'Unable to delete auth user account.'
      });
    }

    const { data: updatedRequest, error: updateRequestError } = await serviceClient
      .from('account_deletion_requests')
      .update({
        status: 'deleted',
        deleted_at: new Date().toISOString(),
        deleted_by_admin_user_id: user.id
      })
      .eq('id', requestRow.id)
      .eq('status', 'requested')
      .select('id')
      .maybeSingle();

    if (updateRequestError || !updatedRequest) {
      return fail(500, {
        requestId,
        error: 'Account was deleted but the request audit row could not be updated.'
      });
    }

    return {
      success: true,
      fulfilledRequestId: requestRow.id
    };
  }
};
