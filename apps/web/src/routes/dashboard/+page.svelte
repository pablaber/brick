<script lang="ts">
	import { resolve } from '$app/paths';
	import { fly } from 'svelte/transition';
	import PoweredByStrava from '$lib/components/PoweredByStrava.svelte';
	import { DASHBOARD_COMPACT_CHART_HEIGHT_PX } from '$lib/components/dashboard/constants';
	import YearlyDistanceGoalCard from '$lib/components/dashboard/YearlyDistanceGoalCard.svelte';
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
	const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

	function activityCategory(
		sportType: string | null | undefined
	): 'running' | 'cycling' | 'swimming' | 'other' {
		if (RUNNING_SPORT_TYPES.has(sportType ?? '')) return 'running';
		if (CYCLING_SPORT_TYPES.has(sportType ?? '')) return 'cycling';
		if (SWIMMING_SPORT_TYPES.has(sportType ?? '')) return 'swimming';
		return 'other';
	}

	function weekStartKey(dateLike: string): string | null {
		const parsed = new Date(dateLike);
		if (Number.isNaN(parsed.getTime())) return null;
		const weekStart = new Date(parsed);
		const daysSinceMonday = (weekStart.getUTCDay() + 6) % 7;
		weekStart.setUTCDate(weekStart.getUTCDate() - daysSinceMonday);
		weekStart.setUTCHours(0, 0, 0, 0);
		return weekStart.toISOString().slice(0, 10);
	}

	function weekdayIndexMonday(dateLike: string): number | null {
		const parsed = new Date(dateLike);
		if (Number.isNaN(parsed.getTime())) return null;
		return (parsed.getUTCDay() + 6) % 7;
	}

	const weeklyMax = $derived(Math.max(...data.charts.weeklyMinutes.map((d) => d.minutes), 1));
	const monthlyMax = $derived(Math.max(...data.charts.monthlyDistance.map((d) => d.miles), 1));
	const yearlyMax = $derived(Math.max(...data.charts.yearlyDistance.map((d) => d.miles), 1));
	const weeklyMonthLabelWeeks = $derived(
		new Set(
			data.charts.weeklyMinutes
				.filter((item, i, weeks) => i === 0 || item.week.slice(0, 7) !== weeks[i - 1].week.slice(0, 7))
				.map((item) => item.week)
		)
	);

	const now = new Date();
	const currentWeekKey = (() => {
		const weekStart = new Date(now);
		const daysSinceMonday = (weekStart.getUTCDay() + 6) % 7;
		weekStart.setUTCDate(weekStart.getUTCDate() - daysSinceMonday);
		weekStart.setUTCHours(0, 0, 0, 0);
		return weekStart.toISOString().slice(0, 10);
	})();
	const currentMonthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
	const currentYearKey = `${now.getUTCFullYear()}-01-01`;
	const weeklyActivities = $derived.by(() =>
		data.recentActivities
			.flatMap((activity) => {
				const startDate = activity.startDate;
				const movingTimeSeconds = activity.movingTimeSeconds ?? 0;
				const weekdayIndex = startDate ? weekdayIndexMonday(startDate) : null;
				const weekKey = startDate ? weekStartKey(startDate) : null;
				if (
					!startDate ||
					!weekKey ||
					weekdayIndex === null ||
					movingTimeSeconds <= 0
				) {
					return [];
				}
				return [
					{
						id: activity.id,
						stravaActivityId: activity.stravaActivityId,
						name: activity.name?.trim() || 'Untitled',
						startDate,
						weekKey,
						weekdayIndex,
						category: activityCategory(activity.sportType),
						minutes: movingTimeSeconds / 60
					}
				];
			})
			.sort(
				(a, b) =>
					a.weekdayIndex - b.weekdayIndex ||
					a.startDate.localeCompare(b.startDate) ||
						a.id.localeCompare(b.id)
				)
	);
	const availableWeekKeys = $derived.by(() => {
		const weekKeys = new Set(
			weeklyActivities.filter((activity) => activity.weekKey <= currentWeekKey).map((activity) => activity.weekKey)
		);
		weekKeys.add(currentWeekKey);
		return [...weekKeys].sort((a, b) => a.localeCompare(b));
	});
	let selectedWeekKey = $state(currentWeekKey);
	let weekSlideDirection = $state(1);

	$effect(() => {
		if (availableWeekKeys.length === 0) {
			selectedWeekKey = currentWeekKey;
			return;
		}
		if (!availableWeekKeys.includes(selectedWeekKey)) {
			selectedWeekKey = availableWeekKeys[availableWeekKeys.length - 1];
		}
	});

	const selectedWeekActivities = $derived.by(() =>
		weeklyActivities.filter((activity) => activity.weekKey === selectedWeekKey)
	);
	const selectedWeekDayColumns = $derived.by(() => {
		const groups = WEEKDAY_LABELS.map((weekdayLabel, weekdayIndex) => ({
			weekdayIndex,
			weekdayLabel,
			activities: [] as Array<(typeof selectedWeekActivities)[number]>,
			totalMinutes: 0
		}));
		for (const activity of selectedWeekActivities) {
			groups[activity.weekdayIndex].activities.push(activity);
			groups[activity.weekdayIndex].totalMinutes += activity.minutes;
		}
		return groups;
	});
	const selectedWeekDayMax = $derived(
		Math.max(...selectedWeekDayColumns.map((day) => day.totalMinutes), 1)
	);
	const selectedWeekIndex = $derived(availableWeekKeys.indexOf(selectedWeekKey));
	const canGoToPreviousWeek = $derived(selectedWeekIndex > 0);
	const canGoToNextWeek = $derived(
		selectedWeekIndex >= 0 && selectedWeekIndex < availableWeekKeys.length - 1
	);
	const selectedWeekTotalMinutes = $derived(
		selectedWeekActivities.reduce((sum, activity) => sum + activity.minutes, 0)
	);

	function showPreviousWeek(): void {
		if (!canGoToPreviousWeek) return;
		weekSlideDirection = -1;
		selectedWeekKey = availableWeekKeys[selectedWeekIndex - 1];
	}

	function showNextWeek(): void {
		if (!canGoToNextWeek) return;
		weekSlideDirection = 1;
		selectedWeekKey = availableWeekKeys[selectedWeekIndex + 1];
	}
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
				<article class="card workout-duration-card">
						<div class="card-header-with-controls">
							<h2>
								{selectedWeekKey === currentWeekKey
									? 'Workout Duration This Week'
									: `Workout Duration: Week of ${formatWeek(selectedWeekKey)}`}
							</h2>
							<div class="week-nav-controls" aria-label="Week navigation">
							<button
								type="button"
								class="week-nav-button"
								onclick={showPreviousWeek}
								disabled={!canGoToPreviousWeek}
								aria-label="Show previous week"
							>
								<svg class="week-nav-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
									<path d="M11.5 4.5 6 10l5.5 5.5" />
								</svg>
							</button>
							<button
								type="button"
								class="week-nav-button"
								onclick={showNextWeek}
								disabled={!canGoToNextWeek}
								aria-label="Show next week"
							>
								<svg class="week-nav-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
									<path d="m8.5 4.5 5.5 5.5-5.5 5.5" />
								</svg>
							</button>
						</div>
						</div>
						<p class="metric">{formatMinutes(selectedWeekTotalMinutes)}</p>
						{#if data.stats.goals.weeklyWorkoutMinutes}
							<p class="metric-caption">
							Goal: {formatMinutes(data.stats.goals.weeklyWorkoutMinutes.target)} ({data.stats.goals.weeklyWorkoutMinutes.pct}%)
						</p>
					{/if}
					<div
						class="activity-week-viewport"
						style={`--dashboard-compact-chart-height: ${DASHBOARD_COMPACT_CHART_HEIGHT_PX}px`}
					>
						{#key selectedWeekKey}
							<div
								class="activity-week-panel"
								in:fly={{ x: weekSlideDirection * 40, duration: 180, opacity: 1 }}
								out:fly={{ x: weekSlideDirection * -40, duration: 180, opacity: 1 }}
							>
								<div class="activity-columns-chart">
									<div class="activity-day-groups">
										{#each selectedWeekDayColumns as day (day.weekdayIndex)}
											<div class="activity-day-group">
												<div
													class="activity-day-stack"
													style={`height: ${barHeight(day.totalMinutes, selectedWeekDayMax, DASHBOARD_COMPACT_CHART_HEIGHT_PX)}px`}
												>
													{#each day.activities as activity (activity.id)}
														{#if activity.stravaActivityId}
															<a
																href={`https://www.strava.com/activities/${activity.stravaActivityId}`}
																target="_blank"
																rel="noopener noreferrer"
																class="activity-segment activity-segment-link has-tooltip"
																style={`flex-grow: ${Math.max(activity.minutes, 1)}`}
															>
																<div class="chart-tooltip">
																	<div class="tooltip-header tooltip-header-activity">
																		<span class={`tooltip-dot dot-${activity.category}`}></span>
																		<span>{activity.name}</span>
																	</div>
																	<div class="tooltip-total">{formatMinutes(activity.minutes)}</div>
																</div>
																<div
																	class={`activity-column-bar bar-${activity.category}`}
																></div>
															</a>
														{:else}
															<div
																class="activity-segment has-tooltip"
																style={`flex-grow: ${Math.max(activity.minutes, 1)}`}
															>
																<div class="chart-tooltip">
																	<div class="tooltip-header tooltip-header-activity">
																		<span class={`tooltip-dot dot-${activity.category}`}></span>
																		<span>{activity.name}</span>
																	</div>
																	<div class="tooltip-total">{formatMinutes(activity.minutes)}</div>
																</div>
																<div
																	class={`activity-column-bar bar-${activity.category}`}
																></div>
															</div>
														{/if}
													{/each}
												</div>
												<span class="activity-col-label">{day.weekdayLabel}</span>
											</div>
										{/each}
									</div>
								</div>
							</div>
						{/key}
					</div>
				</article>

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

	.activity-columns-chart {
		margin-top: 0;
	}

	.card-header-with-controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.workout-duration-card {
		position: relative;
		z-index: 5;
	}

	.week-nav-controls {
		display: inline-flex;
		gap: 0.35rem;
	}

	.week-nav-button {
		appearance: none;
		width: 1.65rem;
		height: 1.65rem;
		border-radius: 999px;
		border: 1px solid var(--line);
		background: var(--surface-subtle);
		color: var(--text-muted);
		padding: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: background-color 100ms ease, color 100ms ease, border-color 100ms ease;
		-webkit-tap-highlight-color: transparent;
	}

	.week-nav-icon {
		width: 0.78rem;
		height: 0.78rem;
		display: block;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.week-nav-button:focus,
	.week-nav-button:focus-visible {
		outline: none;
		box-shadow: none;
	}

	.week-nav-button:hover:not(:disabled) {
		background: var(--surface);
		color: var(--text);
		border-color: var(--line-strong);
	}

	.week-nav-button:disabled {
		cursor: not-allowed;
		opacity: 0.45;
	}

	.activity-week-viewport {
		margin-top: 0.75rem;
		position: relative;
		overflow: visible;
		height: calc(var(--dashboard-compact-chart-height) + 18px);
	}

	.activity-week-panel {
		position: absolute;
		inset: 0;
		width: 100%;
	}

	.activity-day-groups {
		width: 100%;
		height: calc(var(--dashboard-compact-chart-height) + 16px);
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 3px;
		padding-bottom: 2px;
	}

	.activity-day-group {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
		gap: 2px;
	}

	.activity-day-stack {
		width: 100%;
		display: flex;
		flex-direction: column-reverse;
		align-items: stretch;
		justify-content: flex-end;
		overflow: visible;
		border-radius: 3px 3px 0 0;
	}

	.activity-segment {
		flex: 1 1 auto;
		position: relative;
		display: flex;
		min-height: 2px;
	}

	.activity-segment-link {
		text-decoration: none;
		cursor: pointer;
	}

	.activity-column-bar {
		width: 100%;
		min-height: 2px;
		border-radius: 0;
		opacity: 0.8;
		transition: opacity 100ms ease;
	}

	.activity-segment:last-child .activity-column-bar {
		border-radius: 3px 3px 0 0;
	}

	.activity-segment-link .activity-column-bar {
		cursor: pointer;
	}

	.activity-segment:hover .activity-column-bar {
		opacity: 1;
	}

	.activity-segment .chart-tooltip {
		bottom: calc(100% + 6px);
	}

	.activity-col-label {
		font-size: 0.58rem;
		line-height: 1;
		color: var(--text-muted);
	}

	.tooltip-header-activity {
		display: flex;
		align-items: center;
		gap: 4px;
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
