<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	let confirmations = $state<Record<string, string>>({});
	let submittingRequestId = $state<string | null>(null);

	const pendingRequests = $derived(
		data.deletionRequests.filter((request: { status: string }) => request.status === 'requested')
	);
	const completedRequests = $derived(
		data.deletionRequests.filter((request: { status: string }) => request.status === 'deleted')
	);

	function formatTimestamp(timestamp: string | null): string {
		if (!timestamp) return '—';
		const date = new Date(timestamp);
		if (isNaN(date.getTime())) return timestamp;
		return date.toLocaleString();
	}

	function isConfirmationMatch(email: string, userId: string, text: string | undefined): boolean {
		if (!text) return false;
		return text === email || text === userId;
	}
</script>

<div class="card">
	<h2>Pending Requests</h2>
	{#if pendingRequests.length === 0}
		<p class="empty-state">No pending account deletion requests.</p>
	{:else}
		<table class="data-table">
			<thead>
				<tr>
					<th>Email</th>
					<th>User UUID</th>
					<th>Requested</th>
					<th>Status</th>
					<th>Fulfill</th>
				</tr>
			</thead>
			<tbody>
				{#each pendingRequests as request (request.id)}
					{@const confirmationValue = confirmations[request.id] ?? ''}
					{@const isSelfRequest = request.user_id === data.currentAdminUserId}
					{@const canSubmit = isConfirmationMatch(request.email, request.user_id, confirmationValue) && !isSelfRequest}
					<tr>
						<td>{request.email}</td>
						<td><code>{request.user_id}</code></td>
						<td>{formatTimestamp(request.requested_at)}</td>
						<td><span class="status-chip status-pending">requested</span></td>
						<td>
							<form
								method="POST"
								action="?/fulfill"
								class="fulfill-form"
								use:enhance={() => {
									submittingRequestId = request.id;
									return async ({ update }) => {
										submittingRequestId = null;
										await update({ reset: false });
									};
								}}
							>
								<input type="hidden" name="requestId" value={request.id} />
								<input
									type="text"
									name="confirmationText"
									class="text-input confirm-input"
									placeholder="Type email or UUID"
									value={confirmationValue}
									oninput={(event) => {
										const value = (event.currentTarget as HTMLInputElement).value;
										confirmations = { ...confirmations, [request.id]: value };
									}}
									required
								/>
								<button
									type="submit"
									class="danger-button"
									disabled={!canSubmit || submittingRequestId === request.id}
								>
									{submittingRequestId === request.id ? 'Fulfilling…' : 'Fulfill Deletion'}
								</button>
								{#if isSelfRequest}
									<p class="form-note self-guard">You cannot fulfill deletion for your own active account.</p>
								{:else}
									<p class="form-note">Confirmation must match the request email or user UUID exactly.</p>
								{/if}
								{#if form?.requestId === request.id && form?.error}
									<p class="form-error">{form.error}</p>
								{/if}
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>

<div class="card">
	<h2>Fulfilled Requests</h2>
	{#if completedRequests.length === 0}
		<p class="empty-state">No fulfilled account deletion requests yet.</p>
	{:else}
		<table class="data-table">
			<thead>
				<tr>
					<th>Email</th>
					<th>User UUID</th>
					<th>Requested</th>
					<th>Status</th>
					<th>Deleted</th>
					<th>Deleted By</th>
				</tr>
			</thead>
			<tbody>
				{#each completedRequests as request (request.id)}
					<tr>
						<td>{request.email}</td>
						<td><code>{request.user_id}</code></td>
						<td>{formatTimestamp(request.requested_at)}</td>
						<td><span class="status-chip status-deleted">deleted</span></td>
						<td>{formatTimestamp(request.deleted_at)}</td>
						<td>
							{#if request.deleted_by_admin_email}
								{request.deleted_by_admin_email}
							{:else if request.deleted_by_admin_user_id}
								{request.deleted_by_admin_user_id}
							{:else}
								—
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>

<style>
	.data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	.data-table th {
		text-align: left;
		padding: 0.5rem 0.75rem;
		font-weight: 600;
		color: var(--color-muted, #6b7280);
		border-bottom: 1px solid var(--color-border, #e5e7eb);
	}

	.data-table td {
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--color-border, #e5e7eb);
		vertical-align: top;
	}

	.data-table tr:last-child td {
		border-bottom: none;
	}

	.empty-state {
		color: var(--color-muted, #6b7280);
		font-size: 0.875rem;
	}

	.status-chip {
		display: inline-flex;
		align-items: center;
		padding: 0.15rem 0.45rem;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: lowercase;
	}

	.status-pending {
		background: #fff7ed;
		color: #9a3412;
	}

	.status-deleted {
		background: #ecfdf5;
		color: #166534;
	}

	.fulfill-form {
		display: grid;
		gap: 0.5rem;
		max-width: 16rem;
	}

	.confirm-input {
		font-size: 0.8rem;
		padding: 0.5rem 0.55rem;
	}

	.danger-button {
		border: 1px solid #e0b4b4;
		border-radius: 0.55rem;
		padding: 0.5rem 0.65rem;
		font-weight: 600;
		color: #a73131;
		background: #fff0f0;
		cursor: pointer;
		font-size: 0.82rem;
	}

	.danger-button:hover {
		background: #ffe0e0;
		border-color: #d49a9a;
	}

	.danger-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.form-note {
		margin: 0;
		font-size: 0.75rem;
		color: var(--color-muted, #6b7280);
	}

	.form-note.self-guard {
		color: #b91c1c;
	}

	.form-error {
		margin: 0;
		font-size: 0.78rem;
		color: #b91c1c;
	}
</style>
