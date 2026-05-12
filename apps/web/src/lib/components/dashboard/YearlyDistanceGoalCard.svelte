<script lang="ts">
	import { formatWeek } from '$lib/dashboard/formatters';

	type YearProgressPoint = {
		date: string;
		miles: number;
	};

	type DistanceGoal = {
		target: number;
		pct: number;
	};

	let {
		title,
		currentMiles,
		progress,
		goal = null,
		color
	}: {
		title: string;
		currentMiles: number | null | undefined;
		progress: YearProgressPoint[];
		goal?: DistanceGoal | null;
		color: string;
	} = $props();

	const SVG_H = 64;
	const SVG_PAD = 2;

	let sparkWidth = $state(0);
	let hoverIndex = $state<number | null>(null);

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

	function resolveSparkMax(points: YearProgressPoint[], goalTarget: number | null): number {
		const pointMax = Math.max(...points.map((p) => p.miles), 1);
		if (goalTarget == null || goalTarget <= 0) return pointMax;
		return Math.max(pointMax, goalTarget);
	}

	function sparkCoords(points: YearProgressPoint[], w: number, maxMiles: number) {
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

	function goalMilesAtDate(goalTarget: number | null, dateStr: string | null): number | null {
		if (goalTarget == null || goalTarget <= 0 || !dateStr) return null;
		return goalTarget * yearProgressForDate(dateStr);
	}

	function monthTicksForWidth(width: number) {
		if (width <= 0) return [];
		const year = new Date().getUTCFullYear();
		const months = ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		return months.map((label, i) => {
			const x = dateToX(`${year}-${String(i + 2).padStart(2, '0')}-01`, width);
			return { label, x, pct: (x / width) * 100 };
		});
	}

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

	function formatCardMiles(miles: number | null | undefined): string {
		if (miles == null || !Number.isFinite(miles)) return '—';

		const absMiles = Math.abs(miles);
		let decimals = 0;
		if (absMiles < 100) {
			decimals = 2;
		} else if (absMiles < 1000) {
			decimals = 1;
		}

		let rounded = Number(miles.toFixed(decimals));
		if (Math.abs(rounded) >= 1000 && decimals > 0) {
			decimals = 0;
			rounded = Number(miles.toFixed(0));
		}

		const formatted = rounded.toLocaleString(undefined, {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals
		});

		return `${formatted} mi`;
	}

	const goalTarget = $derived(goal?.target ?? null);
	const sparkMax = $derived(resolveSparkMax(progress, goalTarget));
	const coords = $derived(sparkCoords(progress, sparkWidth, sparkMax));
	const spark = $derived(sparkPaths(coords));
	const goalSpark = $derived(sparkGoalPath(goalTarget, sparkWidth, sparkMax));
	const monthTicks = $derived(monthTicksForWidth(sparkWidth));
</script>

<article class="card spark-card" style={`--spark-color: ${color};`}>
	<h2>{title}</h2>
	<div class="metric-goal-row">
		<p class="metric">{formatCardMiles(currentMiles)}</p>
		{#if goal}
			<p class="metric-caption metric-caption-inline">
				Goal: {formatCardMiles(goal.target)}
			</p>
		{/if}
	</div>
	{#if progress.length > 1}
		<div class="sparkline-wrapper" role="img">
			<div
				class="sparkline-graph"
				role="img"
				bind:clientWidth={sparkWidth}
				onmousemove={(e) => handleSparkMove(e, coords, (i) => hoverIndex = i)}
				onmouseleave={() => hoverIndex = null}
			>
				{#if sparkWidth > 0}
					<svg class="sparkline" viewBox={`0 0 ${sparkWidth} ${SVG_H}`}>
						{#each monthTicks as tick (tick.label)}
							<line x1={tick.x} y1="0" x2={tick.x} y2={SVG_H} class="sparkline-month-tick" />
						{/each}
						{#if goalSpark}
							<path d={goalSpark} class="sparkline-goal-line" />
						{/if}
						<path d={spark.area} class="sparkline-area" />
						<path d={spark.line} class="sparkline-line" />
						{#if hoverIndex !== null}
							{@const currentPoint = hoverIndex < coords.length ? coords[hoverIndex] : null}
							{@const currentProgress = hoverIndex < progress.length ? progress[hoverIndex] : null}
							{@const goalMiles = goalMilesAtDate(goalTarget, currentProgress?.date ?? null)}
							{#if currentPoint}
								<line x1={currentPoint.x} y1="0" x2={currentPoint.x} y2={SVG_H} class="sparkline-cursor" />
								{#if goalMiles !== null}
									<circle cx={currentPoint.x} cy={milesToY(goalMiles, sparkMax)} r="4" class="sparkline-dot dot-goal-stroke" />
								{/if}
								<circle cx={currentPoint.x} cy={currentPoint.y} r="4" class="sparkline-dot dot-current-stroke" />
							{/if}
						{/if}
					</svg>
				{/if}
				{#if hoverIndex !== null && sparkWidth > 0}
					{@const currentPoint = hoverIndex < coords.length ? coords[hoverIndex] : null}
					{@const currentProgress = hoverIndex < progress.length ? progress[hoverIndex] : null}
					{@const goalMiles = goalMilesAtDate(goalTarget, currentProgress?.date ?? null)}
					{#if currentPoint && currentProgress}
						<div class="sparkline-tip" style={`left: ${(currentPoint.x / sparkWidth) * 100}%`}>
							<div class="sparkline-tip-header">{formatWeek(currentProgress.date)}</div>
								<div class="sparkline-tip-row">
									<span class="sparkline-tip-label"><span class="tooltip-dot dot-current"></span>Current</span>
									<strong>{formatCardMiles(currentProgress.miles)}</strong>
								</div>
								{#if goalMiles !== null}
									{@const goalDelta = currentProgress.miles - goalMiles}
									<div class="sparkline-tip-row">
										<span class="sparkline-tip-label"><span class="tooltip-dot dot-goal"></span>Goal</span>
										<span>{formatCardMiles(goalMiles)}</span>
									</div>
									<div class="sparkline-tip-row">
										<span class="sparkline-tip-label">{goalDelta >= 0 ? 'Ahead of Goal' : 'Behind Goal'}</span>
										<span>{formatCardMiles(Math.abs(goalDelta))}</span>
									</div>
								{/if}
						</div>
					{/if}
				{/if}
			</div>
			<div class="sparkline-month-labels">
				{#each monthTicks as tick (tick.label)}
					<span class="sparkline-month-label" style={`left: ${tick.pct}%`}>{tick.label}</span>
				{/each}
			</div>
		</div>
	{/if}
</article>

<style>
	.spark-card {
		--spark-color: var(--color-running);
	}

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
		fill: var(--spark-color);
	}

	.sparkline-line {
		fill: none;
		stroke-width: 2;
		stroke: var(--spark-color);
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

	.dot-current-stroke {
		stroke: var(--spark-color);
	}

	.dot-goal-stroke {
		stroke: var(--text-muted);
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
		flex-direction: column;
		gap: 2px;
		align-items: stretch;
	}

	.sparkline-tip-header {
		color: #94a3b8;
		font-size: 0.62rem;
		font-weight: 400;
	}

	.sparkline-tip-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		font-size: 0.68rem;
	}

	.sparkline-tip-row > :last-child {
		padding-left: 4px;
	}

	.sparkline-tip-label {
		color: #94a3b8;
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

	.dot-current {
		background: var(--spark-color);
	}

	.dot-goal {
		background: var(--text-muted);
	}
</style>
