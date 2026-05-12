<script lang="ts">
	import { resolve } from '$app/paths';
	import PoweredByStrava from '$lib/components/PoweredByStrava.svelte';
	import TrainingDurationThisWeekCard from '$lib/components/dashboard/TrainingDurationThisWeekCard.svelte';
	import YearlyDistanceGoalCard from '$lib/components/dashboard/YearlyDistanceGoalCard.svelte';
	import { slide } from 'svelte/transition';
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

	function barHeight(value: number, max: number, totalHeight = 72): number {
		if (max <= 0) return 2;
		return Math.max(2, Math.round((value / max) * totalHeight));
	}

	const RUNNING_SPORT_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun']);
	const CYCLING_SPORT_TYPES = new Set([
		'Ride',
		'VirtualRide',
		'GravelRide',
		'EBikeRide',
		'MountainBikeRide'
	]);
	const SWIMMING_SPORT_TYPES = new Set(['Swim', 'OpenWaterSwimming']);

	function activityCategory(
		sportType: string | null | undefined
	): 'running' | 'cycling' | 'swimming' | 'other' {
		if (RUNNING_SPORT_TYPES.has(sportType ?? '')) return 'running';
		if (CYCLING_SPORT_TYPES.has(sportType ?? '')) return 'cycling';
		if (SWIMMING_SPORT_TYPES.has(sportType ?? '')) return 'swimming';
		return 'other';
	}

	function sportBreakdownBarClass(sportType: string | null | undefined): string {
		return `breakdown-bar-fill-${activityCategory(sportType)}`;
	}

	const SPORT_BREAKDOWN_TOP_COUNT = 9;
	let sportBreakdownExpanded = $state(false);

	function weekStartKey(date: Date): string {
		const daysSinceMonday = (date.getUTCDay() + 6) % 7;
		const weekStartUtcMillis = Date.UTC(
			date.getUTCFullYear(),
			date.getUTCMonth(),
			date.getUTCDate() - daysSinceMonday
		);
		return new Date(weekStartUtcMillis).toISOString().slice(0, 10);
	}

	const weeklyMax = $derived(Math.max(...data.charts.weeklyMinutes.map((d) => d.minutes), 1));
	const monthlyMax = $derived(Math.max(...data.charts.monthlyDistance.map((d) => d.miles), 1));
	const yearlyMax = $derived(Math.max(...data.charts.yearlyDistance.map((d) => d.miles), 1));
	const sportBreakdownTop = $derived(
		data.charts.sportBreakdown.slice(0, SPORT_BREAKDOWN_TOP_COUNT)
	);
	const sportBreakdownOverflow = $derived(
		data.charts.sportBreakdown.slice(SPORT_BREAKDOWN_TOP_COUNT)
	);
	const sportBreakdownOverflowMinutes = $derived(
		sportBreakdownOverflow.reduce((sum, item) => sum + item.minutes, 0)
	);
	const sportBreakdownTotalMinutes = $derived(
		data.charts.sportBreakdown.reduce((sum, item) => sum + item.minutes, 0)
	);
	const sportBreakdownOverflowPct = $derived(
		sportBreakdownTotalMinutes > 0
			? Math.round((sportBreakdownOverflowMinutes / sportBreakdownTotalMinutes) * 100)
			: 0
	);
	const weeklyMonthLabelWeeks = $derived(
		new Set(
			data.charts.weeklyMinutes
				.filter((item, i, weeks) => i === 0 || item.week.slice(0, 7) !== weeks[i - 1].week.slice(0, 7))
				.map((item) => item.week)
		)
	);

	const now = new Date();
	const currentWeekKey = weekStartKey(now);
	const currentMonthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
	const currentYearKey = `${now.getUTCFullYear()}-01-01`;
</script>

<section
	class="page"
	style={`--color-running: ${data.categoryColors.running}; --color-cycling: ${data.categoryColors.cycling}; --color-swimming: ${data.categoryColors.swimming}; --color-other: ${data.categoryColors.other};`}
>
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
			<YearlyDistanceGoalCard
				title="Running Miles This Year"
				currentMiles={data.stats.currentYearRunningMiles}
				progress={data.charts.runningProgress}
				goal={data.stats.goals.yearlyRunningDistance}
				color={data.categoryColors.running}
			/>
			<YearlyDistanceGoalCard
				title="Cycling Miles This Year"
				currentMiles={data.stats.currentYearCyclingMiles}
				progress={data.charts.cyclingProgress}
				goal={data.stats.goals.yearlyCyclingDistance}
				color={data.categoryColors.cycling}
			/>
			<YearlyDistanceGoalCard
				title="Swimming Miles This Year"
				currentMiles={data.stats.currentYearSwimmingMiles}
				progress={data.charts.swimmingProgress}
				goal={data.stats.goals.yearlySwimmingDistance}
				color={data.categoryColors.swimming}
			/>
			<TrainingDurationThisWeekCard
				recentActivities={data.recentActivities}
				weeklyWorkoutGoal={data.stats.goals.weeklyWorkoutMinutes}
			/>
		</div>

		<!-- Weekly minutes chart -->
		{#if data.charts.weeklyMinutes.length > 0}
			<article class="card">
				<h2>Weekly Workout Minutes</h2>
				<div class="chart-legend">
					<span class="legend-item"><span class="legend-swatch legend-running"></span>Running</span>
					<span class="legend-item"><span class="legend-swatch legend-cycling"></span>Cycling</span>
					<span class="legend-item"><span class="legend-swatch legend-swimming"></span>Swimming</span>
					<span class="legend-item"><span class="legend-swatch legend-other"></span>Other</span>
				</div>
				<div class="chart-wrapper">
					<div class="chart-bars">
						{#each data.charts.weeklyMinutes as item (item.week)}
							<div class="chart-col has-tooltip">
								<div class="chart-tooltip">
									<div class="tooltip-header">Wk of {formatWeek(item.week)}</div>
									<div class="tooltip-total">{formatMinutes(item.minutes)} total</div>
									{#if item.running > 0}
										<div class="tooltip-row"><span class="tooltip-label"><span class="tooltip-dot dot-running"></span>Running</span><span>{formatMinutes(item.running)}</span></div>
									{/if}
									{#if item.cycling > 0}
										<div class="tooltip-row"><span class="tooltip-label"><span class="tooltip-dot dot-cycling"></span>Cycling</span><span>{formatMinutes(item.cycling)}</span></div>
									{/if}
									{#if item.swimming > 0}
										<div class="tooltip-row"><span class="tooltip-label"><span class="tooltip-dot dot-swimming"></span>Swimming</span><span>{formatMinutes(item.swimming)}</span></div>
									{/if}
									{#if item.other > 0}
										<div class="tooltip-row"><span class="tooltip-label"><span class="tooltip-dot dot-other"></span>Other</span><span>{formatMinutes(item.other)}</span></div>
									{/if}
								</div>
								<div class={`chart-stack ${item.week === currentWeekKey ? 'chart-stack-in-progress' : ''}`}>
									{#if item.other > 0}
										<div class="chart-bar bar-other" style="height: {barHeight(item.other, weeklyMax)}px"></div>
									{/if}
									{#if item.swimming > 0}
										<div class="chart-bar bar-swimming" style="height: {barHeight(item.swimming, weeklyMax)}px"></div>
									{/if}
									{#if item.cycling > 0}
										<div class="chart-bar bar-cycling" style="height: {barHeight(item.cycling, weeklyMax)}px"></div>
									{/if}
									{#if item.running > 0}
										<div class="chart-bar bar-running" style="height: {barHeight(item.running, weeklyMax)}px"></div>
									{/if}
								</div>
								<span class="chart-label">
									{weeklyMonthLabelWeeks.has(item.week) ? formatMonthShort(item.week) : ''}
								</span>
							</div>
						{/each}
					</div>
				</div>
				<p class="metric-caption">
					Past {data.charts.weeklyMinutes.length} weeks
				</p>
			</article>
		{/if}

		<!-- Monthly distance chart -->
		{#if data.charts.monthlyDistance.length > 0}
			<article class="card">
				<h2>Monthly Distance</h2>
				<div class="chart-wrapper">
					<div class="chart-bars">
						{#each data.charts.monthlyDistance as item, i (item.month)}
							<div
								class={`chart-col ${item.month === currentMonthKey ? 'in-progress-period' : ''}`}
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

		<!-- Yearly distance chart -->
		{#if data.charts.yearlyDistance.length > 0}
			<article class="card">
				<h2>Yearly Distance</h2>
				<div class="chart-wrapper chart-wrapper-sm">
					<div class="chart-bars">
						{#each data.charts.yearlyDistance as item (item.year)}
							<div
								class={`chart-col ${item.year === currentYearKey ? 'in-progress-period' : ''}`}
								data-tip="{formatMiles(item.miles)} · {formatYear(item.year)}"
							>
								<div class="chart-bar" style="height: {barHeight(item.miles, yearlyMax)}px"></div>
								<span class="chart-label">{formatYear(item.year)}</span>
							</div>
						{/each}
					</div>
				</div>
				<p class="metric-caption">Total miles per year</p>
			</article>
		{/if}

		<!-- Sport breakdown + recent activities -->
		<div class="card-grid">
			{#if data.charts.sportBreakdown.length > 0}
				<article class="card">
					<h3>Sport Breakdown</h3>
					<p class="metric-caption" style="margin-bottom: 0.75rem">
						Past 1 year by training minutes
					</p>
					<ul class="list">
						{#each sportBreakdownTop as item (item.sport)}
							<li class="list-item">
								<span>{formatSportType(item.sport)}</span>
								<div class="breakdown-right">
									<div class="breakdown-bar-track">
										<div
											class={`breakdown-bar-fill ${sportBreakdownBarClass(item.sport)}`}
											style="width: {item.pct}%"
										></div>
									</div>
									<strong class="breakdown-pct">{item.pct}%</strong>
								</div>
							</li>
						{/each}
						{#if sportBreakdownOverflow.length > 0}
							<li class="list-item list-item-expandable-other">
								<button
									type="button"
									class="breakdown-expand-trigger"
									aria-expanded={sportBreakdownExpanded}
									onclick={() => {
										sportBreakdownExpanded = !sportBreakdownExpanded;
									}}
								>
									<span class="breakdown-expand-label">
										Other
										<span class="breakdown-expand-hint">
											{sportBreakdownExpanded ? 'Click to collapse' : 'Click to expand'}
										</span>
									</span>
									<div class="breakdown-right">
										<div class="breakdown-bar-track">
											<div
												class="breakdown-bar-fill breakdown-bar-fill-other"
												style="width: {sportBreakdownOverflowPct}%"
											></div>
										</div>
										<strong class="breakdown-pct">{sportBreakdownOverflowPct}%</strong>
									</div>
								</button>
							</li>
						{/if}
					</ul>
					{#if sportBreakdownExpanded && sportBreakdownOverflow.length > 0}
						<ul class="list breakdown-expanded-list" transition:slide={{ duration: 200 }}>
							{#each sportBreakdownOverflow as item (item.sport)}
								<li class="list-item breakdown-sub-item">
									<span>{formatSportType(item.sport)}</span>
									<div class="breakdown-right">
										<div class="breakdown-bar-track">
											<div
												class={`breakdown-bar-fill ${sportBreakdownBarClass(item.sport)}`}
												style="width: {item.pct}%"
											></div>
										</div>
										<strong class="breakdown-pct">{item.pct}%</strong>
									</div>
								</li>
							{/each}
						</ul>
					{/if}
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
							<span class={`pill activity-pill pill-${activityCategory(activity.sportType)}`}>
								{formatSportType(activity.sportType)}
							</span>
						</li>
					{/each}
				</ul>
			</article>
		</div>
		<div class="powered-by-footer">
			<PoweredByStrava />
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

	/* Rich tooltip */
	.chart-tooltip {
		display: none;
		position: absolute;
		bottom: calc(100% - 16px + 6px);
		left: 50%;
		transform: translateX(-50%);
		background: #1a2740;
		color: #fff;
		font-size: 0.72rem;
		font-weight: 500;
		padding: 6px 8px;
		border-radius: 5px;
		white-space: nowrap;
		pointer-events: none;
		z-index: 20;
		flex-direction: column;
		gap: 2px;
	}

	.has-tooltip:hover .chart-tooltip {
		display: flex;
	}

	.tooltip-header {
		color: #94a3b8;
		font-size: 0.65rem;
		font-weight: 400;
	}

	.tooltip-total {
		font-weight: 600;
		margin-bottom: 1px;
	}

	.tooltip-row {
		display: flex;
		align-items: center;
		gap: 10px;
		font-weight: 400;
		font-size: 0.68rem;
		justify-content: space-between;
	}

	.tooltip-label {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.tooltip-dot {
		width: 7px;
		height: 7px;
		border-radius: 2px;
		flex-shrink: 0;
	}

	.dot-running {
		background: var(--color-running);
	}

	.dot-cycling {
		background: var(--color-cycling);
	}

	.dot-swimming {
		background: var(--color-swimming);
	}

	.dot-other {
		background: var(--color-other);
	}

	/* Simple text tooltip (monthly/yearly charts) */
	.chart-col[data-tip]::before {
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

	.chart-col[data-tip]:hover::before {
		opacity: 1;
	}

	.chart-stack {
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		flex: 1;
		min-height: 0;
		position: relative;
		overflow: hidden;
	}

	.chart-stack-in-progress::after {
		content: '';
		position: absolute;
		inset: 0;
		background-image: repeating-linear-gradient(
			-45deg,
			rgba(255, 255, 255, 0.42) 0 5px,
			rgba(255, 255, 255, 0.12) 5px 10px
		);
		pointer-events: none;
		border-radius: 3px 3px 0 0;
	}

	.chart-stack .chart-bar:last-child {
		border-radius: 0 0 0 0;
	}

	.chart-stack .chart-bar:first-child {
		border-radius: 3px 3px 0 0;
	}

	.chart-stack .chart-bar:only-child {
		border-radius: 3px 3px 0 0;
	}

	.chart-bar {
		width: 100%;
		background: var(--color-running);
		border-radius: 0;
		opacity: 0.8;
		transition: opacity 100ms ease;
	}

	.in-progress-period .chart-bar {
		background-color: var(--color-running);
		background-image: repeating-linear-gradient(
			-45deg,
			rgba(255, 255, 255, 0.42) 0 5px,
			rgba(255, 255, 255, 0.12) 5px 10px
		);
	}

	.bar-running {
		background: var(--color-running);
	}

	.bar-cycling {
		background: var(--color-cycling);
	}

	.bar-swimming {
		background: var(--color-swimming);
	}

	.bar-other {
		background: var(--color-other);
	}

	.chart-col:hover .chart-bar {
		opacity: 1;
	}

	.chart-legend {
		display: flex;
		gap: 1rem;
		margin-bottom: 0.25rem;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.legend-swatch {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 2px;
		opacity: 0.8;
	}

	.legend-running {
		background: var(--color-running);
	}

	.legend-cycling {
		background: var(--color-cycling);
	}

	.legend-swimming {
		background: var(--color-swimming);
	}

	.legend-other {
		background: var(--color-other);
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
		border-radius: 999px;
		opacity: 0.7;
	}

	.breakdown-bar-fill-running {
		background: var(--color-running);
	}

	.breakdown-bar-fill-cycling {
		background: var(--color-cycling);
	}

	.breakdown-bar-fill-swimming {
		background: var(--color-swimming);
	}

	.breakdown-bar-fill-other {
		background: var(--color-other);
	}

	.breakdown-pct {
		font-size: 0.85rem;
		min-width: 2.5rem;
		text-align: right;
	}

	.list-item-expandable-other {
		padding-bottom: 0.2rem;
	}

	.breakdown-expand-trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		width: 100%;
		border: 0;
		background: transparent;
		padding: 0;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.breakdown-expand-label {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
	}

	.breakdown-expand-hint {
		font-size: 0.72rem;
		color: var(--text-muted);
		opacity: 0;
		transition: opacity 120ms ease;
	}

	.breakdown-expand-trigger:hover .breakdown-expand-hint,
	.breakdown-expand-trigger:focus-visible .breakdown-expand-hint,
	.breakdown-expand-trigger[aria-expanded='true'] .breakdown-expand-hint {
		opacity: 1;
	}

	.breakdown-expanded-list {
		margin-top: 0.45rem;
		padding-top: 0.5rem;
		border-top: 1px dashed #d9e3ef;
	}

	.breakdown-sub-item {
		padding-bottom: 0.5rem;
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

	.activity-pill {
		color: #fff;
	}

	.pill-running {
		background: var(--color-running);
	}

	.pill-cycling {
		background: var(--color-cycling);
	}

	.pill-swimming {
		background: var(--color-swimming);
	}

	.pill-other {
		background: var(--color-other);
	}

	.powered-by-footer {
		display: flex;
		justify-content: center;
		padding: 0.5rem 0 0.25rem;
	}
</style>
