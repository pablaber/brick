<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import { base, resolve } from '$app/paths';

	let { children } = $props();

	const user = $derived(page.data.user);
	const pageTitle = $derived.by(() => {
		const routeId = page.route.id;
		if (routeId === '/dashboard') return 'Brick | Dashboard';
		if (routeId === '/auth/login') return 'Brick | Login';
		if (routeId === '/settings') return 'Brick | Settings';
		if (routeId === '/privacy') return 'Brick | Privacy Policy';
		if (routeId === '/support') return 'Brick | Support';
		if (routeId === '/terms') return 'Brick | Terms of Service';
		return 'Brick';
	});

	const isActive = (href: string) => {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	};
</script>

<svelte:head>
	<link rel="icon" type="image/png" sizes="16x16" href={`${base}/logos/brick-16.png`} />
	<link rel="icon" type="image/png" sizes="32x32" href={`${base}/logos/brick-32.png`} />
	<link rel="apple-touch-icon" sizes="180x180" href={`${base}/logos/brick-180.png`} />
	<title>{pageTitle}</title>
</svelte:head>

<div class="app-shell">
	<header class="topbar">
		<div class="container topbar-inner">
			<a class="brand" href={resolve('/')}>
				<img class="brand-logo" src={`${base}/logos/brick-64.png`} alt="Brick logo" />
				<span class="brand-label">Brick</span>
			</a>
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
