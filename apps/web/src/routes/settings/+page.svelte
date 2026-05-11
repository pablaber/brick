<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
	let isSyncing = $state(false);
	let syncProgressFetched = $state(0);
	let syncProgressTotal = $state<number | null>(null);
	let syncProgressMessage = $state<string | null>(null);

	const stravaResultMessage: Record<string, string> = {
		connected: 'Strava connected successfully.',
		denied: 'Strava authorization was denied.',
		invalid_state: 'Invalid or expired Strava authorization state. Please try again.',
		error: 'Unable to connect Strava right now. Please try again.'
	};

	const syncResultMessage: Record<string, string> = {
		success: 'Manual sync completed successfully.',
		error: 'Manual sync failed. Please try again.',
		running: 'A manual sync is already running.',
		not_connected: 'Connect Strava before running a manual sync.'
	};

	type ManualSyncResponse = {
		ok?: boolean;
		error?: string;
		syncRunId?: string;
		batchActivitiesFetched?: number;
		totalActivitiesFetched?: number;
		hasMore?: boolean;
		nextCursorBefore?: number | null;
		estimatedTotalActivities?: number | null;
	};

	async function onSyncSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (isSyncing) {
			return;
		}

		isSyncing = true;
		syncProgressFetched = 0;
		syncProgressTotal = null;
		syncProgressMessage = 'Preparing sync…';

		let cursorBefore: number | undefined = undefined;
		let syncRunId: string | undefined = undefined;
		let estimatedTotalActivities: number | undefined = undefined;

		try {
			while (true) {
				const response = await fetch(resolve('/sync/manual'), {
					method: 'POST',
					headers: {
						accept: 'application/json',
						'content-type': 'application/json'
					},
					body: JSON.stringify({
						cursorBefore,
						syncRunId,
						estimatedTotalActivities
					})
				});
				const body = (await response.json()) as ManualSyncResponse;

				if (!response.ok || !body.ok) {
					const syncStatus =
						response.status === 409 ? 'running' : response.status === 400 ? 'not_connected' : 'error';
					window.location.assign(`/settings?sync=${syncStatus}`);
					return;
				}

				syncProgressFetched = body.totalActivitiesFetched ?? syncProgressFetched;
				syncProgressTotal = body.estimatedTotalActivities ?? syncProgressTotal;
				estimatedTotalActivities = body.estimatedTotalActivities ?? estimatedTotalActivities;
				syncProgressMessage = syncProgressTotal
					? `Synced ${syncProgressFetched} of ~${syncProgressTotal} activities`
					: `Synced ${syncProgressFetched} activities`;

				if (!body.hasMore) {
					window.location.assign('/settings?sync=success');
					return;
				}

				if (!body.nextCursorBefore || !body.syncRunId) {
					window.location.assign('/settings?sync=error');
					return;
				}

				cursorBefore = body.nextCursorBefore;
				syncRunId = body.syncRunId;
			}
		} catch (error) {
			console.error('Manual sync client request failed.', error);
			window.location.assign('/settings?sync=error');
		}
	}

	function getProgressPercent() {
		if (!syncProgressTotal || syncProgressTotal <= 0) {
			return 0;
		}

		return Math.max(0, Math.min(100, Math.round((syncProgressFetched / syncProgressTotal) * 100)));
	}
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
		{#if data.syncResult}
			<p class={`note ${data.syncResult === 'success' ? 'note-success' : 'note-error'}`}>
				{syncResultMessage[data.syncResult]}
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

			{#if data.latestSyncRun}
				<ul class="list">
					<li class="list-item">
						<span>Latest Sync Status</span>
						<strong>{data.latestSyncRun.status}</strong>
					</li>
					<li class="list-item">
						<span>Started At</span>
						<strong>{data.latestSyncRun.started_at}</strong>
					</li>
					<li class="list-item">
						<span>Completed At</span>
						<strong>{data.latestSyncRun.completed_at ?? 'In progress'}</strong>
					</li>
					<li class="list-item">
						<span>Activities Fetched</span>
						<strong>{data.latestSyncRun.activities_fetched ?? '0'}</strong>
					</li>
					{#if data.latestSyncRun.error}
						<li class="list-item">
							<span>Latest Sync Error</span>
							<strong>{data.latestSyncRun.error}</strong>
						</li>
					{/if}
				</ul>
			{/if}

			<div class="strava-actions">
				<form method="POST" action={resolve('/sync/manual')} onsubmit={onSyncSubmit}>
					<button type="submit" class="primary-button" disabled={isSyncing}>
						{isSyncing ? 'Syncing now…' : 'Sync now'}
					</button>
				</form>
				<form method="POST" action={resolve('/strava/connect')}>
					<button type="submit" class="primary-button" disabled={isSyncing}>
						Reconnect Strava
					</button>
				</form>
				{#if isSyncing}
					<div class="sync-progress" role="status" aria-live="polite">
						<progress max="100" value={getProgressPercent()}></progress>
						<p class="sync-loading">{syncProgressMessage ?? 'Sync in progress. Please wait…'}</p>
					</div>
				{/if}
			</div>
		{:else}
			<p class="metric-caption">
				Connect Strava first. Manual sync is available once the account is connected.
			</p>
			<form method="POST" action={resolve('/strava/connect')}>
				<button type="submit" class="primary-button">Connect Strava</button>
			</form>
		{/if}
	</div>
</section>

<style>
	.strava-actions {
		display: grid;
		gap: 0.6rem;
		margin-top: 0.5rem;
	}

	.sync-loading {
		margin: 0;
		font-size: 0.9rem;
		color: var(--text-muted);
	}

	.sync-progress {
		display: grid;
		gap: 0.35rem;
	}

	.sync-progress progress {
		width: min(22rem, 100%);
		height: 0.7rem;
	}
</style>
