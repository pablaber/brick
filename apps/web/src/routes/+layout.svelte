<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import { base, resolve } from '$app/paths';

	let { children } = $props();

	const user = $derived(page.data.user);
	const isAuthPage = $derived(page.route.id === '/auth/login');
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

	const AVATAR_COLORS = [
		'#e53935', '#d81b60', '#8e24aa', '#5e35b1',
		'#3949ab', '#1e88e5', '#039be5', '#00acc1',
		'#00897b', '#43a047', '#7cb342', '#c0ca33',
		'#f4511e', '#6d4c41', '#546e7a', '#ff6f00'
	];

	function getInitials(displayName: string | null, email: string | null): string {
		if (displayName) {
			const parts = displayName.trim().split(/\s+/);
			if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
			return parts[0][0].toUpperCase();
		}
		if (email) return email[0].toUpperCase();
		return '?';
	}

	function getAvatarColor(initials: string): string {
		let hash = 0;
		for (let i = 0; i < initials.length; i++) {
			hash = initials.charCodeAt(i) + ((hash << 5) - hash);
		}
		return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
	}

	const initials = $derived(user ? getInitials(user.displayName, user.email) : '');
	const avatarColor = $derived(getAvatarColor(initials));

	let menuOpen = $state(false);
	let menuRef = $state<HTMLDivElement | null>(null);
	let logoutDialogRef = $state<HTMLDialogElement | null>(null);

	function toggleMenu() {
		menuOpen = !menuOpen;
	}

	function closeMenu() {
		menuOpen = false;
	}

	function promptLogout() {
		closeMenu();
		logoutDialogRef?.showModal();
	}

	function cancelLogout() {
		logoutDialogRef?.close();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && menuOpen) closeMenu();
	}

	function handleClickOutside(event: MouseEvent) {
		if (menuOpen && menuRef && !menuRef.contains(event.target as Node)) {
			closeMenu();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} onclick={handleClickOutside} />

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
					<div class="avatar-menu" bind:this={menuRef}>
						<button
							class="avatar-button"
							style="background-color: {avatarColor}"
							onclick={toggleMenu}
							aria-expanded={menuOpen}
							aria-haspopup="true"
						>
							{initials}
						</button>
						{#if menuOpen}
							<div class="avatar-dropdown">
								{#if user.isAdmin}
									<a
										class="dropdown-item"
										href={resolve('/admin')}
										onclick={closeMenu}
									>Admin</a>
								{/if}
								<a
									class="dropdown-item"
									href={resolve('/settings')}
									onclick={closeMenu}
								>Settings</a>
								<button class="dropdown-item dropdown-item-danger" type="button" onclick={promptLogout}>Log Out</button>
							</div>
						{/if}
					</div>
				{:else if !isAuthPage}
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

<dialog class="logout-dialog" bind:this={logoutDialogRef}>
	<div class="logout-dialog-content">
		<h3 class="logout-dialog-title">Log Out</h3>
		<p class="logout-dialog-message">Are you sure you want to log out?</p>
		<div class="logout-dialog-actions">
			<button class="logout-dialog-cancel" type="button" onclick={cancelLogout}>Cancel</button>
			<form method="POST" action={resolve('/auth/logout')} style="display:contents">
				<button class="logout-dialog-confirm" type="submit">Log Out</button>
			</form>
		</div>
	</div>
</dialog>
