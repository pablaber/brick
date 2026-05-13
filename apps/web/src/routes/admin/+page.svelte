<script lang="ts">
	let { data } = $props();
</script>

<div class="card">
	<table class="data-table">
		<thead>
			<tr>
				<th>Email</th>
				<th>Display Name</th>
				<th>Admin</th>
				<th>Joined</th>
			</tr>
		</thead>
		<tbody>
			{#each data.users as user (user.id)}
				<tr>
					<td>{user.email}</td>
					<td>{user.displayName ?? '—'}</td>
					<td>{user.isAdmin ? 'Yes' : 'No'}</td>
					<td>{new Date(user.createdAt).toLocaleDateString()}</td>
				</tr>
			{/each}
		</tbody>
	</table>
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
	}

	.data-table tr:last-child td {
		border-bottom: none;
	}
</style>
