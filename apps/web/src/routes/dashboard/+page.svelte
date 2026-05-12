<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		formatDate,
		formatMetersAsMiles,
		formatMiles,
		formatMinutes,
		formatMonth,
		formatMonthShort,
		formatSecondsAsDuration,
		formatSportType,
		formatWeek,
		formatYear
	} from '$lib/dashboard/formatters';

	let { data } = $props();

	function barHeight(value: number, max: number): number {
		if (max <= 0) return 2;
		return Math.max(4, Math.round((value / max) * 72));
	}

	const weeklyMax = $derived(Math.max(...data.charts.weeklyMinutes.map((d) => d.minutes), 1));
	const monthlyMax = $derived(Math.max(...data.charts.monthlyDistance.map((d) => d.miles), 1));
	const yearlyMax = $derived(Math.max(...data.charts.yearlyDistance.map((d) => d.miles), 1));
</script>

<section class="page">
	<header class="page-header">
		<h1 class="page-title">Dashboard</h1>
		{#if data.latestSyncRun?.completedAt}
			<p class="page-subtitle">Last synced {formatDate(data.latestSyncRun.completedAt)}</p>
		{:else}
			<p class="page-subtitle">Your workout dashboard</p>
		{/if}
	</header>

	{#if !data.connection.connected}
		<div class="card empty-card">
			<p class="empty-title">Connect Strava to start seeing your workout dashboard.</p>
			<a href={resolve('/settings')} class="primary-button">Go to Settings</a>
		</div>
	{:else if !data.latestSyncRun}
		<div class="card empty-card">
			<p class="empty-title">Your Strava account is connected. Run a sync to import activities.</p>
			<a href={resolve('/settings')} class="primary-button">Go to Settings</a>
		</div>
	{:else if data.recentActivities.length === 0}
		<div class="card empty-card">
			<p class="empty-title">No activities found yet.</p>
			<p class="metric-caption">
				Check your Strava permissions or run a sync again from Settings.
			</p>
			<a href={resolve('/settings')} class="primary-button" style="width: fit-content;"
				>Go to Settings</a
			>
		</div>
	{:else}
		<!-- Stat cards -->
		<div class="card-grid">
			<article class="card">
				<h2>Running Miles This Year</h2>
				<p class="metric">{formatMiles(data.stats.currentYearRunningMiles)}</p>
				<p class="metric-caption">Cumulative running miles in {new Date().getFullYear()}</p>
			</article>

			<article class="card">
				<h2>Workout Minutes This Week</h2>
				<p class="metric">{formatMinutes(data.stats.thisWeekWorkoutMinutes)}</p>
				<p class="metric-caption">Total training minutes this week</p>
			</article>

			<article class="card">
				<h2>Synced Activities</h2>
				<p class="metric">{data.stats.syncedActivityCount ?? '—'}</p>
				<p class="metric-caption">Total activities imported from Strava</p>
			</article>

			<article class="card">
				<h2>Last Synced</h2>
				<p class="metric metric-sm">{data.stats.lastSyncedAt ? formatDate(data.stats.lastSyncedAt) : '—'}</p>
				<p class="metric-caption">
					{#if data.latestSyncRun.status === 'success'}
						{data.latestSyncRun.activitiesFetched ?? 0} activities checked
					{:else}
						Status: {data.latestSyncRun.status}
					{/if}
				</p>
			</article>
		</div>

		<!-- Weekly minutes chart -->
		{#if data.charts.weeklyMinutes.length > 0}
			<article class="card">
				<h2>Weekly Workout Minutes</h2>
				<div class="chart-wrapper">
					<div class="chart-bars">
						{#each data.charts.weeklyMinutes as item, i (item.week)}
							<div
								class="chart-col"
								data-tip="{formatMinutes(item.minutes)} · wk of {formatWeek(item.week)}"
							>
								<div class="chart-bar" style="height: {barHeight(item.minutes, weeklyMax)}px"></div>
								<span class="chart-label"
									>{i % 4 === 0 ? formatYear(item.week) + ' ' + formatMonthShort(item.week) : ''}</span
								>
							</div>
						{/each}
					</div>
				</div>
				<p class="metric-caption">
					Past {data.charts.weeklyMinutes.length} weeks · most recent on right
				</p>
			</article>
		{/if}

		<!-- Monthly distance chart -->
		{#if data.charts.monthlyDistance.length > 0}
			<article class="card">
				<h2>Monthly Running Distance</h2>
				<div class="chart-wrapper">
					<div class="chart-bars">
						{#each data.charts.monthlyDistance as item, i (item.month)}
							<div
								class="chart-col"
								data-tip="{formatMiles(item.miles)} · {formatMonth(item.month)}"
							>
								<div class="chart-bar" style="height: {barHeight(item.miles, monthlyMax)}px"></div>
								<span class="chart-label">{i % 3 === 0 ? formatMonthShort(item.month) : ''}</span>
							</div>
						{/each}
					</div>
				</div>
				<p class="metric-caption">
					Distance in miles · past {data.charts.monthlyDistance.length} months
				</p>
			</article>
		{/if}

		<!-- Yearly running distance chart -->
		{#if data.charts.yearlyDistance.length > 0}
			<article class="card">
				<h2>Yearly Running Distance</h2>
				<div class="chart-wrapper chart-wrapper-sm">
					<div class="chart-bars">
						{#each data.charts.yearlyDistance as item (item.year)}
							<div
								class="chart-col"
								data-tip="{formatMiles(item.miles)} · {formatYear(item.year)}"
							>
								<div class="chart-bar" style="height: {barHeight(item.miles, yearlyMax)}px"></div>
								<span class="chart-label">{formatYear(item.year)}</span>
							</div>
						{/each}
					</div>
				</div>
				<p class="metric-caption">Total running miles per year</p>
			</article>
		{/if}

		<!-- Sport breakdown + recent activities -->
		<div class="card-grid">
			{#if data.charts.sportBreakdown.length > 0}
				<article class="card">
					<h3>Sport Breakdown</h3>
					<p class="metric-caption" style="margin-bottom: 0.75rem">
						Past 16 weeks by training minutes
					</p>
					<ul class="list">
						{#each data.charts.sportBreakdown as item (item.sport)}
							<li class="list-item">
								<span>{formatSportType(item.sport)}</span>
								<div class="breakdown-right">
									<div class="breakdown-bar-track">
										<div class="breakdown-bar-fill" style="width: {item.pct}%"></div>
									</div>
									<strong class="breakdown-pct">{item.pct}%</strong>
								</div>
							</li>
						{/each}
					</ul>
				</article>
			{/if}

			<article class="card">
				<h3>Recent Activities</h3>
				<ul class="list">
					{#each data.recentActivities.slice(0, 8) as activity (activity.id)}
						<li class="list-item activity-item">
							<div class="activity-main">
								<strong class="activity-name">
									{#if activity.stravaActivityId}
										<a
											href={`https://www.strava.com/activities/${activity.stravaActivityId}`}
											target="_blank"
											rel="noopener noreferrer"
											class="activity-link"
										>
											{activity.name ?? 'Untitled'}
										</a>
									{:else}
										{activity.name ?? 'Untitled'}
									{/if}
								</strong>
								<div class="activity-meta">
									{#if activity.startDate}{formatDate(activity.startDate)}{/if}
									{#if activity.distanceMeters}
										· {formatMetersAsMiles(activity.distanceMeters)}
									{/if}
									{#if activity.movingTimeSeconds}
										· {formatSecondsAsDuration(activity.movingTimeSeconds)}
									{/if}
									{#if activity.averageHeartrate}
										· {Math.round(activity.averageHeartrate)} bpm avg
									{/if}
								</div>
							</div>
							<span class="pill">{formatSportType(activity.sportType)}</span>
						</li>
					{/each}
				</ul>
			</article>
		</div>
	{/if}
</section>

<style>
	.empty-card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.empty-title {
		margin: 0;
		font-size: 1rem;
		font-weight: 500;
	}

	.metric-sm {
		font-size: 1.25rem;
	}

	/* Bar chart */
	.chart-wrapper {
		margin: 0.75rem 0 0.5rem;
	}

	.chart-wrapper-sm .chart-bars {
		height: 72px;
	}

	.chart-bars {
		display: flex;
		gap: 3px;
		height: 96px;
	}

	.chart-col {
		flex: 1;
		min-width: 0;
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
	}

	/* Tooltip */
	.chart-col::before {
		content: attr(data-tip);
		position: absolute;
		bottom: calc(100% - 16px + 6px);
		left: 50%;
		transform: translateX(-50%);
		background: #1a2740;
		color: #fff;
		font-size: 0.72rem;
		font-weight: 500;
		padding: 4px 7px;
		border-radius: 5px;
		white-space: nowrap;
		pointer-events: none;
		opacity: 0;
		transition: opacity 100ms ease;
		z-index: 20;
	}

	.chart-col:hover::before {
		opacity: 1;
	}

	.chart-bar {
		width: 100%;
		background: var(--brand);
		border-radius: 3px 3px 0 0;
		opacity: 0.8;
		transition: opacity 100ms ease;
	}

	.chart-col:hover .chart-bar {
		opacity: 1;
	}

	.chart-label {
		flex-shrink: 0;
		height: 16px;
		font-size: 0.58rem;
		color: var(--text-muted);
		text-align: center;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: clip;
	}

	/* Sport breakdown bar */
	.breakdown-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 120px;
	}

	.breakdown-bar-track {
		flex: 1;
		height: 6px;
		background: var(--surface-subtle);
		border-radius: 999px;
		overflow: hidden;
		border: 1px solid var(--line);
	}

	.breakdown-bar-fill {
		height: 100%;
		background: var(--brand);
		border-radius: 999px;
		opacity: 0.7;
	}

	.breakdown-pct {
		font-size: 0.85rem;
		min-width: 2.5rem;
		text-align: right;
	}

	/* Activity list */
	.activity-item {
		align-items: flex-start;
	}

	.activity-main {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}

	.activity-name {
		font-size: 0.95rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.activity-link {
		color: inherit;
		text-decoration: none;
	}

	.activity-link:hover {
		color: var(--brand);
		text-decoration: underline;
	}

	.activity-meta {
		font-size: 0.82rem;
		color: var(--text-muted);
	}
</style>
