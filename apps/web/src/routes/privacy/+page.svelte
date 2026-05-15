<svelte:head>
	<meta
		name="description"
		content="Privacy Policy for Brick, including how Brick uses Strava activity data."
	/>
</svelte:head>

<section class="page legal-page">
	<header class="page-header">
		<h1 class="page-title">Privacy Policy</h1>
		<p class="page-subtitle">Last updated May 15, 2026</p>
	</header>

	<article class="card legal-card">
		<p>
			Brick helps athletes view and organize their training data. This policy explains what
			information we collect, how we use it, and the choices you have.
		</p>

		<h2>Information We Collect</h2>
		<p>
			When you create an account, we collect basic account information such as your email address
			and profile details needed to operate the app.
		</p>
		<p>
			If you connect Strava, we store your Strava athlete ID, authorized scopes, access and refresh
			tokens, sync status, webhook status, and activity data returned by Strava. Activity data may
			include activity names, sport types, dates, durations, distances, elevation, speed, heart rate
			when available, and related activity details returned by the Strava API.
		</p>

		<h2>How We Use Information</h2>
		<p>
			We use your information to authenticate your account, connect to Strava with your permission,
			sync your activities, display your dashboard, maintain app reliability, and provide support.
		</p>

		<h2>How We Share Information</h2>
		<p>
			We do not sell your personal information or Strava data. We do not share your Strava data with
			other users. We may use service providers, such as hosting, database, and authentication
			services, only as needed to run Brick.
		</p>

		<h2>Strava Connection</h2>
		<p>
			You can disconnect Brick from Strava from your Strava account settings at any time. When Strava
			notifies Brick that access has been revoked, we stop using your Strava tokens and remove Strava
			data as required by Strava's API terms.
		</p>

		<h2>Data Retention and Deletion</h2>
		<p>
			We keep your information only as long as needed to provide Brick, comply with legal obligations,
			resolve disputes, and enforce our agreements. You may request account or data deletion by
			contacting us.
		</p>

		<h2>Security</h2>
		<p>
			We use reasonable technical and organizational safeguards to protect your information, including
			server-side handling of Strava tokens and encrypted transport where supported.
		</p>

		<h2>Contact</h2>
		<p>
			For privacy questions or deletion requests, contact us at
			<a href="mailto:support@getbricked.fit">support@getbricked.fit</a>.
		</p>
	</article>
</section>

<style>
	.legal-page {
		max-width: 760px;
		margin: 0 auto;
	}

	.legal-card {
		display: grid;
		gap: 0.9rem;
		line-height: 1.65;
	}

	.legal-card h2 {
		margin: 0.7rem 0 0;
		font-size: 1.05rem;
	}

	.legal-card p {
		margin: 0;
		color: var(--text-muted);
	}

	.legal-card a {
		color: var(--brand);
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 0.16em;
	}
</style>
