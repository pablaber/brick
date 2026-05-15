<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		formatDate,
		formatMetersAsMiles,
		formatSecondsAsDuration,
		formatSportType
	} from '$lib/dashboard/formatters';

	let { data } = $props();

	const activity = $derived(data.activity);
	const categoryColors = $derived(data.categoryColors);
	const stravaUrl = $derived(`https://www.strava.com/activities/${activity.strava_activity_id}`);

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

	const kickerColor = $derived(categoryColors[activityCategory(activity.sport_type)]);

	function formatNumber(value: number | null | undefined, suffix = ''): string {
		if (value == null || !Number.isFinite(value)) return '—';
		return `${Number(value).toFixed(1)}${suffix}`;
	}

	function formatSpeed(value: number | null | undefined): string {
		if (value == null || !Number.isFinite(value) || value <= 0) return '—';
		const mph = Number(value) * 2.2369362921;
		return `${mph.toFixed(1)} mph`;
	}
</script>

<section class="page activity-detail-page">
	<header class="page-header activity-header">
		<a class="back-link" href={resolve('/dashboard')}>Back to Dashboard</a>
		<div class="activity-title-row">
			<div>
				<p class="activity-kicker" style={`color: ${kickerColor}`}>{formatSportType(activity.sport_type)}</p>
				<h1 class="page-title">{activity.name ?? 'Untitled Activity'}</h1>
				<p class="page-subtitle">{formatDate(activity.start_date)}</p>
			</div>
			<a
				class="strava-link"
				href={stravaUrl}
				target="_blank"
				rel="noopener noreferrer"
			>
				View on Strava
			</a>
		</div>
	</header>

	<div class="activity-grid">
		<article class="card metric-card">
			<span>Distance</span>
			<strong>{formatMetersAsMiles(activity.distance_meters)}</strong>
		</article>
		<article class="card metric-card">
			<span>Moving Time</span>
			<strong>{formatSecondsAsDuration(activity.moving_time_seconds)}</strong>
		</article>
		<article class="card metric-card">
			<span>Elapsed Time</span>
			<strong>{formatSecondsAsDuration(activity.elapsed_time_seconds)}</strong>
		</article>
		<article class="card metric-card">
			<span>Elevation Gain</span>
			<strong>{formatNumber(activity.total_elevation_gain_meters, ' m')}</strong>
		</article>
	</div>

	<article class="card">
		<h2>Activity Details</h2>
		<dl class="detail-list">
			<div>
				<dt>Sport</dt>
				<dd>{formatSportType(activity.sport_type)}</dd>
			</div>
			<div>
				<dt>Start Date</dt>
				<dd>{formatDate(activity.start_date)}</dd>
			</div>
			<div>
				<dt>Average Speed</dt>
				<dd>{formatSpeed(activity.average_speed_mps)}</dd>
			</div>
			<div>
				<dt>Max Speed</dt>
				<dd>{formatSpeed(activity.max_speed_mps)}</dd>
			</div>
			<div>
				<dt>Average Heart Rate</dt>
				<dd>{activity.average_heartrate ? `${Math.round(activity.average_heartrate)} bpm` : '—'}</dd>
			</div>
			<div>
				<dt>Max Heart Rate</dt>
				<dd>{activity.max_heartrate ? `${Math.round(activity.max_heartrate)} bpm` : '—'}</dd>
			</div>
		</dl>
	</article>

</section>

<style>
	.activity-detail-page {
		max-width: 960px;
		margin: 0 auto;
	}

	.activity-header {
		gap: 0.7rem;
	}

	.back-link {
		width: fit-content;
		color: var(--text-muted);
		font-size: 0.9rem;
		font-weight: 600;
	}

	.back-link:hover {
		color: var(--brand);
		text-decoration: underline;
	}

	.activity-title-row {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.activity-kicker {
		margin: 0 0 0.25rem;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.strava-link {
		color: #fc5200;
		font-weight: 700;
		text-decoration: none;
	}

	.strava-link:hover {
		text-decoration: underline;
	}

	.activity-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
	}

	.metric-card {
		display: grid;
		gap: 0.35rem;
	}

	.metric-card span {
		color: var(--text-muted);
		font-size: 0.82rem;
		font-weight: 600;
	}

	.metric-card strong {
		font-size: 1.25rem;
	}

	.detail-list {
		display: grid;
		gap: 0;
		margin: 0;
	}

	.detail-list div {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.65rem 0;
		border-bottom: 1px dashed #d9e3ef;
	}

	.detail-list div:last-child {
		border-bottom: 0;
	}

	.detail-list dt {
		color: var(--text-muted);
		font-weight: 600;
	}

	.detail-list dd {
		margin: 0;
		text-align: right;
		font-weight: 700;
	}

	@media (min-width: 720px) {
		.activity-title-row {
			flex-direction: row;
			align-items: flex-start;
			justify-content: space-between;
		}

		.activity-grid {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}
</style>
