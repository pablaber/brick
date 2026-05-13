<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	let adding = $state(false);
</script>

<div class="card" style="margin-bottom: 1.5rem;">
	<h2>Add Invite</h2>

	{#if form?.error}
		<p class="form-error">{form.error}</p>
	{/if}

	<form
		class="form-stack"
		method="POST"
		action="?/invite"
		use:enhance={() => {
			adding = true;
			return async ({ update }) => {
				adding = false;
				await update({ reset: true });
			};
		}}
	>
		<label>
			<span>Email</span>
			<input class="text-input" type="email" name="email" placeholder="friend@example.com" required />
		</label>
		<button class="primary-button" type="submit" disabled={adding}>
			{adding ? 'Adding...' : 'Add to Invite List'}
		</button>
	</form>
</div>

<div class="card">
	<h2>Invite List</h2>
	{#if data.invites.length === 0}
		<p class="empty-state">No invites yet.</p>
	{:else}
		<table class="data-table">
			<thead>
				<tr>
					<th>Email</th>
					<th>Added</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each data.invites as invite (invite.id)}
					<tr>
						<td>{invite.email}</td>
						<td>{new Date(invite.created_at).toLocaleDateString()}</td>
						<td>
							<form method="POST" action="?/remove" use:enhance>
								<input type="hidden" name="id" value={invite.id} />
								<button class="link-button danger" type="submit">Remove</button>
							</form>
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
		vertical-align: middle;
	}

	.data-table tr:last-child td {
		border-bottom: none;
	}

	.empty-state {
		color: var(--color-muted, #6b7280);
		font-size: 0.875rem;
	}

	.danger {
		color: var(--color-danger, #ef4444);
	}
</style>
