<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	let { children } = $props();

	const user = $derived(page.data.user);

	const isActive = (href: string) => {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	};
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Workout Dashboard</title>
</svelte:head>

<div class="app-shell">
	<header class="topbar">
		<div class="container topbar-inner">
			<a class="brand" href={resolve('/')}>Lyon Workout</a>
			<nav class="nav" aria-label="Primary">
				{#if user}
					<a
						class={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}
						href={resolve('/dashboard')}>Dashboard</a
					>
					<a
						class={`nav-link ${isActive('/settings') ? 'active' : ''}`}
						href={resolve('/settings')}>Settings</a
					>
					<form method="POST" action={resolve('/auth/logout')} style="display:contents">
						<button class="nav-link nav-button" type="submit">Log out</button>
					</form>
				{:else}
					<a class={`nav-link ${isActive('/') ? 'active' : ''}`} href={resolve('/')}>Home</a>
					<a
						class={`nav-link ${isActive('/auth/login') ? 'active' : ''}`}
						href={resolve('/auth/login')}>Log in</a
					>
				{/if}
			</nav>
		</div>
	</header>

	<main class="container content">
		{@render children()}
	</main>
</div>
