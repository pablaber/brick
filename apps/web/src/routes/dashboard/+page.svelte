<script lang="ts">
	const weeklyMinutes = 246;
	const yearlyRunningMiles = 382.4;

	const recentActivities = [
		{ sport: 'Run', summary: 'Tempo run - 6.2 mi', when: 'Today' },
		{ sport: 'Ride', summary: 'Endurance ride - 24.8 mi', when: 'Yesterday' },
		{ sport: 'Swim', summary: 'Pool session - 1,500 yd', when: '2 days ago' }
	];

	const sportBreakdown = [
		{ sport: 'Running', pct: 46 },
		{ sport: 'Cycling', pct: 38 },
		{ sport: 'Swimming', pct: 16 }
	];
</script>

<section class="page">
	<header class="page-header">
		<h1 class="page-title">Dashboard</h1>
		<p class="page-subtitle">Mock stats for initial UI development.</p>
	</header>

	<div class="card-grid">
		<article class="card">
			<h2>Weekly Minutes</h2>
			<p class="metric">{weeklyMinutes}</p>
			<p class="metric-caption">Total training minutes this week</p>
		</article>

		<article class="card">
			<h2>Yearly Running Miles</h2>
			<p class="metric">{yearlyRunningMiles}</p>
			<p class="metric-caption">Cumulative miles this year</p>
		</article>

		<article class="card">
			<h3>Recent Activities</h3>
			<ul class="list">
				{#each recentActivities as activity}
					<li class="list-item">
						<div>
							<strong>{activity.summary}</strong>
							<div class="metric-caption">{activity.when}</div>
						</div>
						<span class="pill">{activity.sport}</span>
					</li>
				{/each}
			</ul>
		</article>

		<article class="card">
			<h3>Sport Breakdown</h3>
			<ul class="list">
				{#each sportBreakdown as item}
					<li class="list-item">
						<span>{item.sport}</span>
						<strong>{item.pct}%</strong>
					</li>
				{/each}
			</ul>
		</article>
	</div>
</section>
