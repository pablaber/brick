<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	let { children } = $props();

	const navItems: { href: '/' | '/dashboard' | '/settings' | '/auth/login'; label: string }[] = [
		{ href: '/', label: 'Home' },
		{ href: '/dashboard', label: 'Dashboard' },
		{ href: '/settings', label: 'Settings' },
		{ href: '/auth/login', label: 'Login' }
	];

	const isActive = (href: string) => {
		if (href === '/') {
			return page.url.pathname === '/';
		}

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
				{#each navItems as item (item.href)}
					<a
						class={`nav-link ${isActive(item.href) ? 'active' : ''}`}
						href={resolve(item.href)}>{item.label}</a
					>
				{/each}
			</nav>
		</div>
	</header>

	<main class="container content">
		{@render children()}
	</main>
</div>
