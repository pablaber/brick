<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { onMount, untrack } from 'svelte';
	import { slide } from 'svelte/transition';

	let { data, form } = $props();
	type SettingsFormFeedback = {
		scope: 'profile' | 'colors' | 'goals';
		error?: string;
		success?: string;
		goalType?: string;
	};
	const settingsForm = $derived((form?.settingsForm as SettingsFormFeedback | undefined) ?? null);
	let isSyncing = $state(false);
	let syncProgressFetched = $state(0);
	let syncProgressTotal = $state<number | null>(null);
	let syncProgressMessage = $state<string | null>(null);
	let syncProgressPercent = $state(0);

	let syncDetailsOpen = $state(false);

	let colorsOpen = $state(false);
	let goalsOpen = $state(false);
	let stravaOpen = $state(untrack(() => !data.strava.connected));
	let displayNameEditing = $state(false);
	let displayNameValue = $state(untrack(() => data.displayName ?? ''));
	let displayNameSaving = $state(false);

	let colorValues = $state(untrack(() => ({ ...data.settings.colors })));
	let colorSaving = $state(false);
	let colorSaved = $state(false);
	const colorIndicator = $derived.by(() => {
		const hasUnsaved = data.settings.categories.some((c) =>
			colorValues[c]?.toUpperCase() !== data.settings.colors[c]?.toUpperCase()
		);
		if (hasUnsaved) return 'unsaved' as const;
		return colorSaved ? 'saved' as const : 'idle' as const;
	});

	let goalSaving = $state<Record<string, 'save' | 'deactivate' | false>>({});
	let goalSaved = $state<Record<string, boolean>>({});

	let toast = $state<{ message: string; type: 'success' | 'error' } | null>(null);
	let toastDismissing = $state(false);

	function showToast(message: string, type: 'success' | 'error') {
		toast = { message, type };
		toastDismissing = false;
		setTimeout(() => {
			toastDismissing = true;
			setTimeout(() => {
				toast = null;
				toastDismissing = false;
			}, 400);
		}, 4000);
	}

	function dismissToast() {
		toastDismissing = true;
		setTimeout(() => {
			toast = null;
			toastDismissing = false;
		}, 400);
	}

	onMount(() => {
		const url = new URL(window.location.href);
		let dirty = false;

		if (data.stravaResult && stravaResultMessage[data.stravaResult]) {
			showToast(stravaResultMessage[data.stravaResult], data.stravaResult === 'connected' ? 'success' : 'error');
			url.searchParams.delete('strava');
			dirty = true;
		}

		if (data.syncResult && syncResultMessage[data.syncResult]) {
			showToast(syncResultMessage[data.syncResult], data.syncResult === 'success' ? 'success' : 'error');
			url.searchParams.delete('sync');
			dirty = true;
		}

		if (dirty) {
			window.history.replaceState({}, '', url.toString());
		}
	});


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

	const ESTIMATED_ACTIVITY_BUFFER_MULTIPLIER = 1.2;

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

	function formatDate(raw: string | null | undefined): { date: string; time: string } | null {
		if (!raw) return null;
		const d = new Date(raw);
		if (isNaN(d.getTime())) return null;

		const day = d.getDate();
		const suffix =
			day % 10 === 1 && day !== 11
				? 'st'
				: day % 10 === 2 && day !== 12
					? 'nd'
					: day % 10 === 3 && day !== 13
						? 'rd'
						: 'th';
		const month = d.toLocaleDateString('en-US', { month: 'long' });
		const year = d.getFullYear();
		const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short' });

		return { date: `${month} ${day}${suffix}, ${year}`, time };
	}

	function inflateEstimatedActivityTotal(total: number): number {
		return Math.max(1, Math.ceil(total * ESTIMATED_ACTIVITY_BUFFER_MULTIPLIER));
	}

	function formatCategoryName(category: string): string {
		return category.charAt(0).toUpperCase() + category.slice(1);
	}

	async function onSyncSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (isSyncing) {
			return;
		}

		isSyncing = true;
		syncProgressFetched = 0;
		syncProgressTotal = null;
		syncProgressPercent = 0;
		syncProgressMessage = 'Checking Strava activities…';

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
				if (body.estimatedTotalActivities != null) {
					const normalizedEstimatedTotal = Math.max(1, Math.floor(body.estimatedTotalActivities));
					estimatedTotalActivities =
						estimatedTotalActivities == null
							? inflateEstimatedActivityTotal(normalizedEstimatedTotal)
							: Math.max(estimatedTotalActivities, normalizedEstimatedTotal);
				}
				syncProgressTotal =
					estimatedTotalActivities != null
						? Math.max(estimatedTotalActivities, syncProgressFetched)
						: null;

				if (syncProgressTotal && syncProgressTotal > 0) {
					syncProgressPercent = Math.max(0, Math.min(100, Math.round((syncProgressFetched / syncProgressTotal) * 100)));
				}

				if (!body.hasMore) {
					syncProgressPercent = 100;
					syncProgressMessage = `Checked ${syncProgressFetched} activities`;
					window.location.assign('/settings?sync=success');
					return;
				}

				syncProgressMessage = syncProgressTotal
					? `Checked ${syncProgressFetched} of ~${syncProgressTotal} activities`
					: `Checked ${syncProgressFetched} activities`;

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
</script>

<section class="page">
	<header class="page-header">
		<h1 class="page-title">Settings</h1>
		<p class="page-subtitle">Account and connection settings.</p>
	</header>

	<div class="card card-sectioned">
		<div class="card-heading">
			<h2>Account</h2>
		</div>
		<ul class="list">
			<li class="list-item">
				<span>Email</span>
				<strong>{data.email}</strong>
			</li>
			<li class="list-item display-name-row">
				<span>Display Name</span>
				<div class="display-name-area">
					{#if displayNameEditing}
						<form
							method="POST"
							action="?/saveDisplayName"
							class="display-name-form"
							use:enhance={() => {
								displayNameSaving = true;
								return async ({ result, update }) => {
									await update({ reset: false });
									displayNameSaving = false;

									const settingsFeedback = (result as { data?: { settingsForm?: SettingsFormFeedback } })
										.data?.settingsForm;

									if (result.type === 'success') {
										displayNameEditing = false;
										showToast(settingsFeedback?.success ?? 'Display name saved.', 'success');
									} else if (result.type === 'failure') {
										showToast(settingsFeedback?.error ?? 'Unable to save display name right now.', 'error');
									} else if (result.type === 'error') {
										showToast('Unable to save display name right now.', 'error');
									}
								};
							}}
						>
							<input
								class="text-input display-name-input"
								type="text"
								name="displayName"
								maxlength={80}
								placeholder="Enter display name"
								bind:value={displayNameValue}
							/>
							<button type="submit" class="primary-button" disabled={displayNameSaving}>
								{displayNameSaving ? 'Saving…' : 'Save'}
							</button>
							<button
								type="button"
								class="secondary-button"
								disabled={displayNameSaving}
								onclick={() => {
									displayNameEditing = false;
									displayNameValue = data.displayName ?? '';
								}}
							>
								Cancel
							</button>
						</form>
					{:else}
						<div class="display-name-static">
							<strong>{data.displayName ?? 'Not set'}</strong>
							<button
								type="button"
								class="icon-button"
								aria-label="Edit display name"
								onclick={() => {
									displayNameEditing = true;
									displayNameValue = data.displayName ?? '';
								}}
							>
								&#9998;
							</button>
						</div>
					{/if}
				</div>
			</li>
		</ul>
	</div>

	{#if data.strava.connected}
	<div class="card card-sectioned">
		<button class="card-heading card-heading-toggle" onclick={() => colorsOpen = !colorsOpen}>
			<h2>Sport Colors</h2>
			<span class="chevron" class:chevron-open={colorsOpen}>&#9656;</span>
		</button>
		{#if colorsOpen}
		<div class="collapsible-body" transition:slide={{ duration: 200 }}>
		<div class="settings-block">
			<p class="metric-caption">Customize dashboard category colors.</p>
			{#if settingsForm?.scope === 'colors' && settingsForm.error}
				<p class="form-error">{settingsForm.error}</p>
			{/if}
			<form method="POST" action="?/saveSportColors" class="form-stack compact-form" use:enhance={() => {
				colorSaving = true;
				return async ({ result, update }) => {
					await update({ reset: false });
					colorSaving = false;
					if (result.type === 'success') colorSaved = true;
				};
			}}>
				<div class="color-grid">
					{#each data.settings.categories as category (category)}
						<label class="color-field">
							<span>{formatCategoryName(category)}</span>
							<input
								class="color-input"
								type="color"
								name={category}
								bind:value={colorValues[category]}
								required
							/>
							<code>{colorValues[category].toUpperCase()}</code>
						</label>
					{/each}
				</div>
				<div class="color-actions">
					<button type="submit" class="primary-button save-button" disabled={colorSaving}>
						<span class="save-button-text" class:save-button-text-hidden={colorSaving}>Save Colors</span>
						<span class="save-button-text save-button-text-overlay" class:save-button-text-hidden={!colorSaving}>Saving…</span>
					</button>
					<button type="button" class="secondary-button" disabled={colorSaving} onclick={() => {
						colorValues = { ...data.settings.defaultColors };
					}}>Reset to Defaults</button>
					<span class="save-indicator" class:save-indicator-visible={colorIndicator !== 'idle'}>
						{#if colorIndicator === 'unsaved'}
							<span class="save-indicator-unsaved">Unsaved changes</span>
						{:else if colorIndicator === 'saved'}
							<span class="save-indicator-saved">Changes saved</span>
						{/if}
					</span>
				</div>
			</form>
		</div>
		</div>
		{/if}
	</div>
	{/if}

	{#if data.strava.connected}
	<div class="card card-sectioned">
		<button class="card-heading card-heading-toggle" onclick={() => goalsOpen = !goalsOpen}>
			<h2>Goals</h2>
			<span class="chevron" class:chevron-open={goalsOpen}>&#9656;</span>
		</button>
		{#if goalsOpen}
		<div class="collapsible-body" transition:slide={{ duration: 200 }}>
		<div class="settings-block goals-stack">
			<p class="metric-caption">Set optional goals that appear on the dashboard.</p>
			{#if settingsForm?.scope === 'goals' && settingsForm.error}
				<p class="form-error">{settingsForm.error}</p>
			{/if}
			{#each data.settings.goalDefinitions as definition (definition.goalType)}
				{@const activeGoal = data.settings.activeGoals[definition.goalType]}
				<div class="goal-row">
					<div class="goal-head">
						<strong>{definition.label}</strong>
						<span class="goal-meta">{definition.period} · {definition.unit}</span>
					</div>
					{#if activeGoal}
						<p class="metric-caption">Current target: {activeGoal.targetValue} {definition.unit}</p>
					{/if}
					<form method="POST" action="?/saveGoal" class="goal-form" use:enhance={(e) => {
						const isDeactivate = e.formData.get('mode') === 'deactivate';
						goalSaving = { ...goalSaving, [definition.goalType]: isDeactivate ? 'deactivate' : 'save' };
						return async ({ result, update }) => {
							await update({ reset: false });
							goalSaving = { ...goalSaving, [definition.goalType]: false };
							if (result.type === 'success') goalSaved = { ...goalSaved, [definition.goalType]: true };
						};
					}}>
						<input type="hidden" name="goalType" value={definition.goalType} />
						<label>
							<span>Target</span>
							<input
								class="text-input"
								type="number"
								name="targetValue"
								step={definition.step}
								min={definition.min}
								max={definition.max}
								value={activeGoal?.targetValue ?? ''}
								placeholder={`Enter ${definition.unit}`}
								required
								oninput={() => { goalSaved = { ...goalSaved, [definition.goalType]: false }; }}
							/>
						</label>
						<div class="goal-actions">
							<button type="submit" class="primary-button save-button" disabled={!!goalSaving[definition.goalType]}>
								<span class="save-button-text" class:save-button-text-hidden={goalSaving[definition.goalType] === 'save'}>Save Goal</span>
								<span class="save-button-text save-button-text-overlay" class:save-button-text-hidden={goalSaving[definition.goalType] !== 'save'}>Saving…</span>
							</button>
							{#if activeGoal}
								<button type="submit" class="destructive-button save-button" name="mode" value="deactivate" disabled={!!goalSaving[definition.goalType]}>
									<span class="save-button-text" class:save-button-text-hidden={goalSaving[definition.goalType] === 'deactivate'}>Remove Goal</span>
									<span class="save-button-text save-button-text-overlay" class:save-button-text-hidden={goalSaving[definition.goalType] !== 'deactivate'}>Removing…</span>
								</button>
							{/if}
							<span class="save-indicator" class:save-indicator-visible={goalSaved[definition.goalType]}>
								<span class="save-indicator-saved">Changes saved</span>
							</span>
						</div>
					</form>
				</div>
			{/each}
		</div>
		</div>
		{/if}
	</div>
	{/if}

	<div class="card card-sectioned">
		<button class="card-heading card-heading-toggle" onclick={() => stravaOpen = !stravaOpen}>
			<h2>Strava</h2>
			<span class="card-heading-right">
				{#if data.strava.connected}
					<span class="status-bubble status-success heading-status">Connected</span>
				{/if}
				<span class="chevron" class:chevron-open={stravaOpen}>&#9656;</span>
			</span>
		</button>
		{#if stravaOpen}
		<div class="collapsible-body" transition:slide={{ duration: 200 }}>
		{#if data.strava.connected}
			<ul class="list">
				<li class="list-item">
					<span>Strava Athlete ID</span>
					<strong>
						<a
							href={`https://www.strava.com/athletes/${data.strava.strava_athlete_id}`}
							target="_blank"
							rel="noopener noreferrer"
							class="strava-link"
						>
							{data.strava.strava_athlete_id}
						</a>
					</strong>
				</li>
				<li class="list-item">
					<span>Scope</span>
					<strong>{data.strava.scope ?? 'Not provided'}</strong>
				</li>
				<li class="list-item">
					<span>Last Sync Type</span>
					<strong>{data.latestSyncRun?.sync_type ?? 'Never'}</strong>
				</li>
				<li class="list-item">
					<span>Last Sync Status</span>
					{#if data.latestSyncRun}
						<span
							class="status-bubble status-inline"
							class:status-success={data.latestSyncRun.status === 'success'}
							class:status-error={data.latestSyncRun.status === 'failed'}
							class:status-running={data.latestSyncRun.status === 'running' || data.latestSyncRun.status === 'in_progress'}
						>
							{data.latestSyncRun.status}
						</span>
					{:else}
						<strong>Never</strong>
					{/if}
				</li>
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<li
					class="list-item"
					class:list-item-clickable={!!data.latestSyncRun}
					role={data.latestSyncRun ? 'button' : undefined}
					tabindex={data.latestSyncRun ? 0 : undefined}
					onclick={() => { if (data.latestSyncRun) syncDetailsOpen = !syncDetailsOpen; }}
					onkeydown={(e) => { if (data.latestSyncRun && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); syncDetailsOpen = !syncDetailsOpen; } }}
				>
					<span class="last-synced-label">
						Last Synced
						{#if data.latestSyncRun}
							<span class="expand-hint">{syncDetailsOpen ? 'Hide details' : 'Show details'}</span>
						{/if}
					</span>
					<span class="last-synced-value">
						{#if formatDate(data.strava.last_synced_at)}
							<span class="date-display">
								<span class="date-label">{formatDate(data.strava.last_synced_at)?.date}</span>
								<span class="date-time">{formatDate(data.strava.last_synced_at)?.time}</span>
							</span>
						{:else}
							<strong>Never</strong>
						{/if}
					</span>
				</li>
			</ul>

			{#if data.latestSyncRun && syncDetailsOpen}
				<ul class="list sync-details">
					<li class="list-item">
						<span>Started At</span>
						{#if formatDate(data.latestSyncRun.started_at)}
							<span class="date-display">
								<span class="date-label">{formatDate(data.latestSyncRun.started_at)?.date}</span>
								<span class="date-time">{formatDate(data.latestSyncRun.started_at)?.time}</span>
							</span>
						{:else}
							<strong>{data.latestSyncRun.started_at}</strong>
						{/if}
					</li>
					<li class="list-item">
						<span>Completed At</span>
						{#if formatDate(data.latestSyncRun.completed_at)}
							<span class="date-display">
								<span class="date-label">{formatDate(data.latestSyncRun.completed_at)?.date}</span>
								<span class="date-time">{formatDate(data.latestSyncRun.completed_at)?.time}</span>
							</span>
						{:else}
							<strong>In progress</strong>
						{/if}
					</li>
					<li class="list-item">
						<span>Activities Checked</span>
						<strong>{data.latestSyncRun.activities_fetched ?? '0'}</strong>
					</li>
					<li class="list-item">
						<span>Activities Upserted</span>
						<strong>{data.latestSyncRun.activities_upserted ?? '0'}</strong>
					</li>
					{#if data.latestSyncRun.error}
						<li class="list-item">
							<span>Latest Sync Error</span>
							<strong>{data.latestSyncRun.error}</strong>
						</li>
					{/if}
				</ul>
			{/if}

			{#if data.latestManualSyncRun || data.latestScheduledSyncRun}
				<ul class="list">
					<li class="list-item">
						<span>Last Manual Sync</span>
						{#if formatDate(data.latestManualSyncRun?.started_at)}
							<span class="date-display">
								<span class="date-label">{formatDate(data.latestManualSyncRun?.started_at)?.date}</span>
								<span class="date-time">{formatDate(data.latestManualSyncRun?.started_at)?.time}</span>
							</span>
						{:else}
							<strong>Never</strong>
						{/if}
					</li>
					<li class="list-item">
						<span>Last Scheduled Sync</span>
						{#if formatDate(data.latestScheduledSyncRun?.started_at)}
							<span class="date-display">
								<span class="date-label">{formatDate(data.latestScheduledSyncRun?.started_at)?.date}</span>
								<span class="date-time">{formatDate(data.latestScheduledSyncRun?.started_at)?.time}</span>
							</span>
						{:else}
							<strong>Never</strong>
						{/if}
					</li>
				</ul>
			{/if}

			<div class="card-subheading">Actions</div>
			<div class="strava-actions">
				<div class="strava-actions-row">
					<form method="POST" action={resolve('/sync/manual')} onsubmit={onSyncSubmit}>
						<button type="submit" class="primary-button" disabled={isSyncing}>
							{isSyncing ? 'Syncing now…' : 'Sync now'}
						</button>
					</form>
				</div>
				{#if isSyncing}
					<div class="sync-progress" role="status" aria-live="polite">
						<div class="progress-bar-track">
							<div class="progress-bar-fill" style:width={`${syncProgressPercent}%`}></div>
						</div>
						<p class="sync-loading">{syncProgressMessage ?? 'Sync in progress. Please wait…'}</p>
					</div>
				{/if}
			</div>
		{:else}
			<div class="strava-disconnected">
				<p class="metric-caption">Not connected yet</p>
				<p class="metric-caption">
					Connect Strava first. Manual sync is available once the account is connected.
				</p>
				<form method="POST" action={resolve('/strava/connect')}>
					<button type="submit" class="strava-connect-button">
						<img src="/strava/connect-with-strava.png" alt="Connect with Strava" height="48" />
					</button>
				</form>
			</div>
		{/if}
		</div>
		{/if}
	</div>
</section>

{#if toast}
	<div class="toast-container" class:toast-dismissing={toastDismissing}>
		<div class="toast" class:toast-success={toast.type === 'success'} class:toast-error={toast.type === 'error'}>
			<span>{toast.message}</span>
			<button class="toast-close" onclick={dismissToast} aria-label="Dismiss">&times;</button>
		</div>
	</div>
{/if}

<style>
	.card-sectioned {
		padding: 0;
		overflow: hidden;
	}

	.card-sectioned > :not(.card-heading) {
		padding: 0 1rem;
	}

	.card-heading + * {
		margin-top: 0.75rem;
	}

	.card-sectioned > .card-heading:not(:first-child) {
		margin-top: 0.5rem;
	}

	.card-subheading {
		margin-top: 0.75rem;
		margin-bottom: 0.75rem;
		padding: 0.5rem 1rem;
		background: var(--surface-subtle);
		border-top: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
		font-size: 0.78rem;
		font-weight: 600;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.card-sectioned > :last-child:not(.card-heading) {
		padding-bottom: 1rem;
	}

	.display-name-row {
		align-items: center;
	}

	.display-name-area {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		min-width: 0;
	}

	.display-name-form {
		display: inline-flex;
		flex-wrap: nowrap;
		justify-content: flex-end;
		align-items: center;
		gap: 0.5rem;
	}

	.display-name-input {
		width: clamp(10rem, 16vw, 14rem);
	}

	.display-name-static {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	.icon-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.85rem;
		height: 1.85rem;
		border-radius: 999px;
		border: 1px solid var(--line);
		background: #fff;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 0.95rem;
		line-height: 1;
	}

	.icon-button:hover {
		background: var(--surface-subtle);
		color: var(--text);
		border-color: var(--text-muted);
	}

	.settings-block {
		display: grid;
		gap: 0.75rem;
	}

	.compact-form {
		margin-top: 0;
	}

	.color-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 0.75rem;
	}

	.color-field {
		display: grid;
		gap: 0.4rem;
	}

	.color-field code {
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.color-input {
		width: 100%;
		height: 2.4rem;
		border: 1px solid var(--line);
		border-radius: 0.5rem;
		background: transparent;
		padding: 0.15rem;
	}

	.goals-stack {
		gap: 1rem;
	}

	.goal-row {
		border: 1px solid var(--line);
		border-radius: 0.75rem;
		padding: 0.75rem;
		display: grid;
		gap: 0.5rem;
	}

	.goal-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.6rem;
	}

	.goal-meta {
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--text-muted);
	}

	.goal-form {
		display: grid;
		gap: 0.6rem;
	}

	.goal-form label {
		display: grid;
		gap: 0.35rem;
	}

	.goal-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.color-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.save-indicator {
		font-size: 0.82rem;
		font-weight: 500;
		opacity: 0;
		transition: opacity 200ms ease;
	}

	.save-indicator-visible {
		opacity: 1;
	}

	.save-indicator-unsaved {
		color: var(--text-muted);
	}

	.save-indicator-saved {
		color: var(--ok);
	}

	.save-button {
		display: grid;
		grid-template-areas: "text";
	}

	.save-button-text {
		grid-area: text;
		transition: opacity 150ms ease;
	}

	.save-button-text-hidden {
		opacity: 0;
	}

	.save-button-text-overlay {
		pointer-events: none;
	}

	.secondary-button {
		border: 1px solid var(--line);
		border-radius: 0.6rem;
		padding: 0.65rem 0.8rem;
		font-weight: 600;
		color: var(--text-muted);
		background: #fff;
		cursor: pointer;
	}

	.secondary-button:hover {
		background: var(--surface-subtle);
		border-color: var(--text-muted);
	}

	.card-heading {
		background: var(--surface-subtle);
		border-bottom: 1px solid var(--line);
		padding: 0.65rem 1rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.card-heading-toggle {
		width: 100%;
		border: none;
		cursor: pointer;
		font: inherit;
		color: inherit;
		text-align: left;
		transition: background 120ms ease-in-out;
	}

	.card-heading-toggle:hover {
		background: var(--surface-hover, rgba(0, 0, 0, 0.04));
	}

	.card-heading-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.chevron {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		line-height: 1;
		color: var(--text-muted);
		transition: transform 200ms ease;
	}

	.chevron-open {
		transform: rotate(90deg);
	}

	.collapsible-body {
		overflow: hidden;
	}

	.card-heading h2 {
		margin: 0;
		font-size: 0.85rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.heading-status {
		font-size: 0.75rem;
		padding: 0.15rem 0.5rem;
	}

	.list-item-clickable {
		cursor: pointer;
		transition: background 120ms ease-in-out;
	}

	.list-item-clickable:hover {
		background: var(--surface-subtle);
	}

	.last-synced-label {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.expand-hint {
		font-size: 0.75rem;
		color: var(--brand);
		font-weight: 500;
	}

	.last-synced-value {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.status-inline {
		font-size: 0.75rem;
		padding: 0.15rem 0.45rem;
	}

	.card-sectioned .sync-details {
		margin-top: 0.25rem;
		border-top: 1px solid var(--line);
		background: var(--surface-subtle);
		padding: 0.6rem 1rem 1rem;
	}

	.sync-details + .card-subheading {
		margin-top: 0;
	}

	.strava-disconnected {
		display: grid;
		gap: 0.6rem;
	}

	.strava-connect-button {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		display: block;
	}

	.strava-connect-button:hover {
		opacity: 0.85;
	}

	.strava-disconnected .metric-caption {
		margin: 0;
	}

	.card-sectioned .list + .list {
		margin-top: 0.4rem;
		padding-top: 0.6rem;
		border-top: 1px solid var(--line);
	}

	.strava-actions {
		display: grid;
		gap: 0.6rem;
	}

	.strava-actions-row {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 0.6rem;
	}

	.destructive-button {
		border: 1px solid #e0b4b4;
		border-radius: 0.6rem;
		padding: 0.65rem 0.8rem;
		font-weight: 600;
		color: #a73131;
		background: #fff0f0;
		cursor: pointer;
	}

	.destructive-button:hover {
		background: #ffe0e0;
		border-color: #d49a9a;
	}

	.destructive-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.sync-loading {
		margin: 0;
		font-size: 0.9rem;
		color: var(--text-muted);
	}

	.sync-progress {
		display: grid;
		gap: 0.5rem;
	}

	.progress-bar-track {
		width: 100%;
		height: 0.6rem;
		background: var(--surface-subtle);
		border-radius: 999px;
		overflow: hidden;
		border: 1px solid var(--line);
	}

	.progress-bar-fill {
		height: 100%;
		border-radius: 999px;
		background: linear-gradient(90deg, var(--brand) 0%, var(--brand-strong) 100%);
		transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.strava-link {
		color: var(--brand);
		text-decoration: none;
	}

	.strava-link:hover {
		color: var(--brand-strong);
		text-decoration: underline;
	}

	.date-display {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.1rem;
	}

	.date-label {
		font-weight: 500;
	}

	.date-time {
		font-size: 0.82rem;
		color: var(--text-muted);
		font-weight: 400;
	}

	.status-bubble {
		display: inline-flex;
		align-items: center;
		padding: 0.2rem 0.6rem;
		border-radius: 999px;
		font-size: 0.82rem;
		font-weight: 600;
		text-transform: capitalize;
	}

	.status-success {
		background: #e9fff4;
		color: var(--ok);
	}

	.status-error {
		background: #fff0f0;
		color: #a73131;
	}

	.status-running {
		background: #e9f2ff;
		color: var(--brand-strong);
	}

	.toast-container {
		position: fixed;
		bottom: 1.5rem;
		right: 1.5rem;
		z-index: 100;
		animation: toast-in 0.35s ease-out;
	}

	.toast-container.toast-dismissing {
		animation: toast-out 0.4s ease-in forwards;
	}

	.toast {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border-radius: 0.75rem;
		font-size: 0.92rem;
		font-weight: 500;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
	}

	.toast-success {
		background: #e9fff4;
		color: var(--ok);
		border: 1px solid #b6ecd2;
	}

	.toast-error {
		background: #fff0f0;
		color: #a73131;
		border: 1px solid #ffd6d6;
	}

	.toast-close {
		background: none;
		border: none;
		font-size: 1.2rem;
		line-height: 1;
		cursor: pointer;
		color: inherit;
		opacity: 0.6;
		padding: 0;
	}

	.toast-close:hover {
		opacity: 1;
	}

	@keyframes toast-in {
		from {
			opacity: 0;
			transform: translateY(1rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes toast-out {
		from {
			opacity: 1;
			transform: translateY(0);
		}
		to {
			opacity: 0;
			transform: translateY(1rem);
		}
	}
</style>
