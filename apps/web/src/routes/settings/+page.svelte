<script lang="ts">
	let { data } = $props();
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
		<p class="metric-caption">
			{data.stravaConnected ? 'Connected' : 'Not connected yet'}
		</p>
	</div>
</section>
