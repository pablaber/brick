<script lang="ts">
	import { resolve } from '$app/paths';
	import PoweredByStrava from '$lib/components/PoweredByStrava.svelte';
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

	const weeklyMax = $derived(Math.max(...data.charts.weeklyMinutes.map((d) => d.minutes), 1));
	const monthlyMax = $derived(Math.max(...data.charts.monthlyDistance.map((d) => d.miles), 1));
	const yearlyMax = $derived(Math.max(...data.charts.yearlyDistance.map((d) => d.miles), 1));

	const SVG_H = 64;
	const SVG_PAD = 2;

	let runningSparkWidth = $state(0);
	let cyclingSparkWidth = $state(0);

	function yearBounds() {
		const year = new Date().getUTCFullYear();
		return {
			start: Date.UTC(year, 0, 1),
			end: Date.UTC(year + 1, 0, 1)
		};
	}

	function yearProgressForDate(dateStr: string): number {
		const { start, end } = yearBounds();
		const timestamp = new Date(`${dateStr}T00:00:00Z`).getTime();
		if (Number.isNaN(timestamp)) return 0;
		return Math.max(0, Math.min(1, (timestamp - start) / (end - start)));
	}

	function dateToX(dateStr: string, w: number): number {
		return SVG_PAD + yearProgressForDate(dateStr) * (w - SVG_PAD * 2);
	}

	function milesToY(miles: number, maxMiles: number): number {
		const h = SVG_H - SVG_PAD * 2;
		return SVG_PAD + h - (miles / maxMiles) * h;
	}

	function resolveSparkMax(points: { miles: number }[], goalTarget: number | null): number {
		const pointMax = Math.max(...points.map((p) => p.miles), 1);
		if (goalTarget == null || goalTarget <= 0) return pointMax;
		return Math.max(pointMax, goalTarget);
	}

	function sparkCoords(points: { date: string; miles: number }[], w: number, maxMiles: number) {
		if (points.length === 0 || w <= 0) return [];
		return points.map((p) => ({
			x: dateToX(p.date, w),
			y: milesToY(p.miles, maxMiles)
		}));
	}

	function sparkGoalPath(goalTarget: number | null, w: number, maxMiles: number): string {
		if (goalTarget == null || goalTarget <= 0 || w <= 0) return '';
		const year = new Date().getUTCFullYear();
		const x1 = dateToX(`${year}-01-01`, w);
		const y1 = milesToY(0, maxMiles);
		const x2 = dateToX(`${year + 1}-01-01`, w);
		const y2 = milesToY(goalTarget, maxMiles);
		return `M${x1},${y1} L${x2},${y2}`;
	}

	function sparkPaths(coords: { x: number; y: number }[]): { line: string; area: string } {
		if (coords.length === 0) return { line: '', area: '' };
		const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x},${c.y}`).join(' ');
		const last = coords[coords.length - 1];
		const first = coords[0];
		const area = `${line} L${last.x},${SVG_H} L${first.x},${SVG_H} Z`;
		return { line, area };
	}

	const runningGoalTarget = $derived(data.stats.goals.yearlyRunningDistance?.target ?? null);
	const runningSparkMax = $derived(resolveSparkMax(data.charts.runningProgress, runningGoalTarget));
	const cyclingSparkMax = $derived(resolveSparkMax(data.charts.cyclingProgress, null));

	const runningCoords = $derived(
		sparkCoords(data.charts.runningProgress, runningSparkWidth, runningSparkMax)
	);
	const cyclingCoords = $derived(
		sparkCoords(data.charts.cyclingProgress, cyclingSparkWidth, cyclingSparkMax)
	);
	const runningSpark = $derived(sparkPaths(runningCoords));
	const cyclingSpark = $derived(sparkPaths(cyclingCoords));
	const runningGoalSpark = $derived(
		sparkGoalPath(runningGoalTarget, runningSparkWidth, runningSparkMax)
	);

	function goalMilesAtDate(goalTarget: number | null, dateStr: string | null): number | null {
		if (goalTarget == null || goalTarget <= 0 || !dateStr) return null;
		return goalTarget * yearProgressForDate(dateStr);
	}

	function monthTicksForWidth(width: number) {
		if (width <= 0) return [];
		const year = new Date().getFullYear();
		const months = ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		return months.map((label, i) => {
			const x = dateToX(`${year}-${String(i + 2).padStart(2, '0')}-01`, width);
			return { label, x, pct: (x / width) * 100 };
		});
	}
	const runningMonthTicks = $derived(monthTicksForWidth(runningSparkWidth));
	const cyclingMonthTicks = $derived(monthTicksForWidth(cyclingSparkWidth));

	let runningHover = $state<number | null>(null);
	let cyclingHover = $state<number | null>(null);

	function handleSparkMove(
		e: MouseEvent,
		coords: { x: number; y: number }[],
		setIndex: (i: number | null) => void
	) {
		const el = e.currentTarget as HTMLElement;
		const rect = el.getBoundingClientRect();
		const x = e.clientX - rect.left;
		if (coords.length === 0) {
			setIndex(null);
			return;
		}
		let nearestIdx = 0;
		let nearestDistance = Math.abs(coords[0].x - x);
		for (let i = 1; i < coords.length; i += 1) {
			const distance = Math.abs(coords[i].x - x);
			if (distance < nearestDistance) {
				nearestIdx = i;
				nearestDistance = distance;
			}
		}
		setIndex(nearestIdx);
	}
</script>

<section
	class="page"
	style={`--color-running: ${data.categoryColors.running}; --color-cycling: ${data.categoryColors.cycling}; --color-swimming: ${data.categoryColors.swimming}; --color-other: ${data.categoryColors.other};`}
>
	<header class="page-header">
		<h1 class="page-title">Dashboard</h1>
		{#if data.latestSyncRun?.completedAt}
			<p class="page-subtitle">
				Last {data.latestSyncRun.syncType} sync {formatDate(data.latestSyncRun.completedAt)}
			</p>
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
				<div class="metric-goal-row">
					<p class="metric">{formatMiles(data.stats.currentYearRunningMiles)}</p>
					{#if data.stats.goals.yearlyRunningDistance}
						<p class="metric-caption metric-caption-inline">
							Goal: {formatMiles(data.stats.goals.yearlyRunningDistance.target)} ({data.stats.goals.yearlyRunningDistance.pct}%)
						</p>
					{/if}
				</div>
				{#if data.charts.runningProgress.length > 1}
					<div
						class="sparkline-wrapper"
						role="img"
					>
						<div
								class="sparkline-graph"
								role="img"
								bind:clientWidth={runningSparkWidth}
								onmousemove={(e) => handleSparkMove(e, runningCoords, (i) => runningHover = i)}
								onmouseleave={() => runningHover = null}
							>
								{#if runningSparkWidth > 0}
									<svg class="sparkline" viewBox="0 0 {runningSparkWidth} {SVG_H}">
										{#each runningMonthTicks as tick (tick.label)}
											<line x1={tick.x} y1="0" x2={tick.x} y2={SVG_H} class="sparkline-month-tick" />
										{/each}
									{#if runningGoalSpark}
										<path d={runningGoalSpark} class="sparkline-goal-line" />
									{/if}
										<path d={runningSpark.area} class="sparkline-area sparkline-running" />
										<path d={runningSpark.line} class="sparkline-line sparkline-running-line" />
										{#if runningHover !== null}
											{@const currentPoint = runningHover < runningCoords.length ? runningCoords[runningHover] : null}
											{#if currentPoint}
												<line x1={currentPoint.x} y1="0" x2={currentPoint.x} y2={SVG_H} class="sparkline-cursor" />
												<circle cx={currentPoint.x} cy={currentPoint.y} r="4" class="sparkline-dot dot-running-stroke" />
											{/if}
										{/if}
									</svg>
								{/if}
								{#if runningHover !== null && runningSparkWidth > 0}
									{@const currentPoint = runningHover < runningCoords.length ? runningCoords[runningHover] : null}
									{@const currentProgress = runningHover < data.charts.runningProgress.length ? data.charts.runningProgress[runningHover] : null}
									{@const goalMiles = goalMilesAtDate(runningGoalTarget, currentProgress?.date ?? null)}
									{#if currentPoint && currentProgress}
									<div class="sparkline-tip" style="left: {(currentPoint.x / runningSparkWidth) * 100}%">
										{#if goalMiles !== null}
											<div class="sparkline-tip-row">
												<strong>Goal {formatMiles(goalMiles)}</strong>
											</div>
										{/if}
										<div class="sparkline-tip-row">
											<span>Current {formatMiles(currentProgress.miles)}</span>
										</div>
										<span>{formatWeek(currentProgress.date)}</span>
									</div>
									{/if}
								{/if}
							</div>
							<div class="sparkline-month-labels">
								{#each runningMonthTicks as tick (tick.label)}
									<span class="sparkline-month-label" style="left: {tick.pct}%">{tick.label}</span>
								{/each}
							</div>
					</div>
				{/if}
			</article>

			<article class="card">
				<h2>Cycling Miles This Year</h2>
				<p class="metric">{formatMiles(data.stats.currentYearCyclingMiles)}</p>
				{#if data.charts.cyclingProgress.length > 1}
					<div
						class="sparkline-wrapper"
						role="img"
					>
						<div
								class="sparkline-graph"
								role="img"
								bind:clientWidth={cyclingSparkWidth}
								onmousemove={(e) => handleSparkMove(e, cyclingCoords, (i) => cyclingHover = i)}
								onmouseleave={() => cyclingHover = null}
							>
								{#if cyclingSparkWidth > 0}
									<svg class="sparkline" viewBox="0 0 {cyclingSparkWidth} {SVG_H}">
										{#each cyclingMonthTicks as tick (tick.label)}
											<line x1={tick.x} y1="0" x2={tick.x} y2={SVG_H} class="sparkline-month-tick" />
										{/each}
										<path d={cyclingSpark.area} class="sparkline-area sparkline-cycling" />
										<path d={cyclingSpark.line} class="sparkline-line sparkline-cycling-line" />
										{#if cyclingHover !== null}
											{@const currentPoint = cyclingHover < cyclingCoords.length ? cyclingCoords[cyclingHover] : null}
											{#if currentPoint}
												<line x1={currentPoint.x} y1="0" x2={currentPoint.x} y2={SVG_H} class="sparkline-cursor" />
												<circle cx={currentPoint.x} cy={currentPoint.y} r="4" class="sparkline-dot dot-cycling-stroke" />
											{/if}
										{/if}
									</svg>
								{/if}
								{#if cyclingHover !== null && cyclingSparkWidth > 0}
									{@const currentPoint = cyclingHover < cyclingCoords.length ? cyclingCoords[cyclingHover] : null}
									{@const currentProgress = cyclingHover < data.charts.cyclingProgress.length ? data.charts.cyclingProgress[cyclingHover] : null}
									{#if currentPoint && currentProgress}
									<div class="sparkline-tip" style="left: {(currentPoint.x / cyclingSparkWidth) * 100}%">
										<div class="sparkline-tip-row">
											<strong>Current {formatMiles(currentProgress.miles)}</strong>
										</div>
										<span>{formatWeek(currentProgress.date)}</span>
									</div>
									{/if}
								{/if}
							</div>
							<div class="sparkline-month-labels">
								{#each cyclingMonthTicks as tick (tick.label)}
									<span class="sparkline-month-label" style="left: {tick.pct}%">{tick.label}</span>
								{/each}
							</div>
					</div>
				{/if}
			</article>

			<article class="card">
				<h2>Workout Minutes This Week</h2>
				<p class="metric">{formatMinutes(data.stats.thisWeekWorkoutMinutes)}</p>
				{#if data.stats.goals.weeklyWorkoutMinutes}
					<p class="metric-caption">
						Goal: {formatMinutes(data.stats.goals.weeklyWorkoutMinutes.target)} ({data.stats.goals.weeklyWorkoutMinutes.pct}%)
					</p>
				{:else}
					<p class="metric-caption">Total training minutes this week</p>
				{/if}
			</article>

			<article class="card">
				<h2>Synced Activities</h2>
				<p class="metric">{data.stats.syncedActivityCount ?? '—'}</p>
				<p class="metric-caption">Total activities imported from Strava</p>
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
						{#each data.charts.weeklyMinutes as item, i (item.week)}
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
								<div class="chart-stack">
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
								<span class="chart-label"
									>{i % 4 === 0 ? formatYear(item.week) + ' ' + formatMonthShort(item.week) : ''}</span
								>
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

		<!-- Yearly distance chart -->
		{#if data.charts.yearlyDistance.length > 0}
			<article class="card">
				<h2>Yearly Distance</h2>
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
							<span class="pill">{formatSportType(activity.sportType)}</span>
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

	/* Sparkline */
	.metric-goal-row {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.metric-caption-inline {
		margin: 0;
	}

	.sparkline-wrapper {
		margin-top: 0.5rem;
	}

	.sparkline-graph {
		position: relative;
		height: 64px;
		cursor: crosshair;
	}

	.sparkline {
		display: block;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	.sparkline-area {
		opacity: 0.15;
	}

	.sparkline-line {
		fill: none;
		stroke-width: 2;
	}

	.sparkline-goal-line {
		fill: none;
		stroke: var(--text-muted);
		stroke-width: 1.5;
		stroke-linecap: round;
		opacity: 0.9;
	}

	.sparkline-month-tick {
		stroke: var(--text-muted);
		stroke-width: 1;
		opacity: 0.15;
	}

	.sparkline-month-labels {
		position: relative;
		height: 14px;
	}

	.sparkline-month-label {
		position: absolute;
		transform: translateX(-50%);
		font-size: 0.55rem;
		color: var(--text-muted);
		pointer-events: none;
	}

	.sparkline-cursor {
		stroke: var(--text-muted);
		stroke-width: 1;
		stroke-dasharray: 3 3;
		opacity: 0.5;
	}

	.sparkline-dot {
		fill: var(--surface);
		stroke-width: 2;
	}

	.dot-running-stroke {
		stroke: var(--color-running);
	}

	.dot-cycling-stroke {
		stroke: var(--color-cycling);
	}

	.sparkline-tip {
		position: absolute;
		bottom: 100%;
		transform: translateX(-50%);
		background: #1a2740;
		color: #fff;
		font-size: 0.7rem;
		padding: 3px 7px;
		border-radius: 5px;
		white-space: nowrap;
		pointer-events: none;
		z-index: 20;
		display: flex;
		gap: 6px;
		align-items: baseline;
	}

	.sparkline-tip span {
		color: #94a3b8;
		font-size: 0.62rem;
	}

	.sparkline-tip-row {
		display: flex;
		align-items: baseline;
		gap: 0.25rem;
	}

	.sparkline-running {
		fill: var(--color-running);
	}

	.sparkline-running-line {
		stroke: var(--color-running);
	}

	.sparkline-cycling {
		fill: var(--color-cycling);
	}

	.sparkline-cycling-line {
		stroke: var(--color-cycling);
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

	.powered-by-footer {
		display: flex;
		justify-content: center;
		padding: 0.5rem 0 0.25rem;
	}
</style>
