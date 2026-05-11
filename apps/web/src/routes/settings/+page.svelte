<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();

	const stravaResultMessage: Record<string, string> = {
		connected: 'Strava connected successfully.',
		denied: 'Strava authorization was denied.',
		invalid_state: 'Invalid or expired Strava authorization state. Please try again.',
		error: 'Unable to connect Strava right now. Please try again.'
	};
</script>

<section class="page">
	<header class="page-header">
		<h1 class="page-title">Settings</h1>
		<p class="page-subtitle">Account and connection settings.</p>
	</header>

	<div class="card">
		<h2>Account</h2>
		<ul class="list">
			<li class="list-item">
				<span>Email</span>
				<strong>{data.email}</strong>
			</li>
			<li class="list-item">
				<span>Display Name</span>
				<strong>{data.displayName ?? 'Not set'}</strong>
			</li>
		</ul>
	</div>

	<div class="card">
		<h2>Strava</h2>
		{#if data.stravaResult}
			<p class={`note ${data.stravaResult === 'connected' ? 'note-success' : 'note-error'}`}>
				{stravaResultMessage[data.stravaResult]}
			</p>
		{/if}

		<p class="metric-caption">
			{data.strava.connected ? 'Connected to Strava' : 'Not connected yet'}
		</p>

		{#if data.strava.connected}
			<ul class="list">
				<li class="list-item">
					<span>Strava Athlete ID</span>
					<strong>{data.strava.strava_athlete_id}</strong>
				</li>
				<li class="list-item">
					<span>Scope</span>
					<strong>{data.strava.scope ?? 'Not provided'}</strong>
				</li>
				<li class="list-item">
					<span>Last Synced</span>
					<strong>{data.strava.last_synced_at ?? 'Never'}</strong>
				</li>
			</ul>
		{/if}

		<form method="POST" action={resolve('/strava/connect')}>
			<button type="submit" class="primary-button">
				{data.strava.connected ? 'Reconnect Strava' : 'Connect Strava'}
			</button>
		</form>
	</div>
</section>
