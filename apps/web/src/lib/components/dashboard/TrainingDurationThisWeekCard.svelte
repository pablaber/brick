<script lang="ts">
	import { fly } from 'svelte/transition';
	import { DASHBOARD_COMPACT_CHART_HEIGHT_PX } from '$lib/components/dashboard/constants';
	import { formatMinutes, formatWeek } from '$lib/dashboard/formatters';

	type DashboardActivity = {
		id: string;
		stravaActivityId: number | string | null;
		name: string | null;
		sportType: string | null;
		startDate: string | null;
		movingTimeSeconds: number | null;
	};

	type WeeklyWorkoutGoal = {
		target: number;
		pct: number;
	};

	let {
		recentActivities,
		weeklyWorkoutGoal = null
	}: {
		recentActivities: DashboardActivity[];
		weeklyWorkoutGoal?: WeeklyWorkoutGoal | null;
	} = $props();

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

	const now = new Date();
	const currentWeekKey = (() => {
		const weekStart = new Date(now);
		const daysSinceMonday = (weekStart.getUTCDay() + 6) % 7;
		weekStart.setUTCDate(weekStart.getUTCDate() - daysSinceMonday);
		weekStart.setUTCHours(0, 0, 0, 0);
		return weekStart.toISOString().slice(0, 10);
	})();
	const weeklyActivities = $derived.by(() =>
		recentActivities
			.flatMap((activity) => {
				const startDate = activity.startDate;
				const movingTimeSeconds = activity.movingTimeSeconds ?? 0;
				const weekdayIndex = startDate ? weekdayIndexMonday(startDate) : null;
				const weekKey = startDate ? weekStartKey(startDate) : null;
				if (!startDate || !weekKey || weekdayIndex === null || movingTimeSeconds <= 0) {
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
			weeklyActivities
				.filter((activity) => activity.weekKey <= currentWeekKey)
				.map((activity) => activity.weekKey)
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

<article class="card workout-duration-card">
	<div class="card-header-with-controls">
		<h2>
			{selectedWeekKey === currentWeekKey
				? 'Training Duration This Week'
				: `Training Duration: Week of ${formatWeek(selectedWeekKey)}`}
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
	{#if weeklyWorkoutGoal}
		<p class="metric-caption">
			Goal: {formatMinutes(weeklyWorkoutGoal.target)} ({weeklyWorkoutGoal.pct}%)
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
												<div class={`activity-column-bar bar-${activity.category}`}></div>
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
												<div class={`activity-column-bar bar-${activity.category}`}></div>
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

<style>
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

	.activity-columns-chart {
		margin-top: 0;
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
</style>
