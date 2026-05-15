<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let { children, data } = $props();

	const isActive = (href: string) => page.url.pathname === href;
</script>

<section class="page">
	<header class="page-header">
		<h1 class="page-title">Admin</h1>
	</header>

	<nav class="tab-nav">
		<a class={`tab-link ${isActive('/admin') ? 'active' : ''}`} href={resolve('/admin')}>Users</a>
		<a
			class={`tab-link ${isActive('/admin/invite') ? 'active' : ''}`}
			href={resolve('/admin/invite')}>Invites</a
		>
		<a
			class={`tab-link ${isActive('/admin/deletion-requests') ? 'active' : ''}`}
			href={resolve('/admin/deletion-requests')}
		>
			Deletion Requests
			{#if data.pendingDeletionRequestCount > 0}
				<span class="pending-count-badge">{data.pendingDeletionRequestCount}</span>
			{/if}
		</a>
	</nav>

	{@render children()}
</section>

<style>
	.tab-nav {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
		border-bottom: 1px solid var(--color-border, #e5e7eb);
		padding-bottom: 0;
	}

	.tab-link {
		padding: 0.5rem 1rem;
		text-decoration: none;
		color: var(--color-muted, #6b7280);
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
		font-size: 0.875rem;
		font-weight: 500;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}

	.tab-link.active {
		color: var(--color-text, #111827);
		border-bottom-color: var(--color-primary, #3b82f6);
	}

	.pending-count-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.2rem;
		height: 1.2rem;
		padding: 0 0.35rem;
		border-radius: 999px;
		background: #fee2e2;
		color: #b91c1c;
		font-size: 0.72rem;
		font-weight: 700;
		line-height: 1;
	}
</style>
