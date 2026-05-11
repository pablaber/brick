<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	const user = $derived(page.data.user);
</script>

<section class="page">
	<header class="page-header">
		<h1 class="page-title">Workout Dashboard</h1>
		<p class="page-subtitle">
			A lightweight SvelteKit app for tracking training stats powered by Strava and Supabase.
		</p>
	</header>

	<div class="card">
		{#if user}
			<h2>Welcome back</h2>
			<p>You are signed in as <strong>{user.email}</strong>.</p>
			<p class="note">
				Head to <a href={resolve('/dashboard')}><strong>/dashboard</strong></a> to view your stats.
			</p>
		{:else}
			<h2>Get Started</h2>
			<p>Log in or create an account to access your training dashboard.</p>
			<p class="note">
				<a href={resolve('/auth/login')}><strong>Log in or sign up</strong></a>
			</p>
		{/if}
	</div>
</section>
