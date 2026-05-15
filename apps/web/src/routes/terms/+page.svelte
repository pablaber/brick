<svelte:head>
	<meta name="description" content="Terms of Service for Brick." />
</svelte:head>

<section class="page terms-page">
	<header class="page-header">
		<h1 class="page-title">Terms of Service</h1>
		<p class="page-subtitle">Last updated May 15, 2026</p>
	</header>

	<article class="card terms-card">
		<p>
			These Terms of Service govern your use of Brick. By using Brick, you agree to these terms.
			If you do not agree, do not use the app.
		</p>

		<h2>Use of Brick</h2>
		<p>
			Brick is provided to help you view and organize your own training data. You are responsible
			for your account, your use of the app, and any information you choose to connect or provide.
		</p>

		<h2>Strava Data</h2>
		<p>
			If you connect Strava, Brick accesses Strava data only with your permission and only to provide
			app features. Your use of Strava remains subject to Strava's own terms and policies.
		</p>

		<h2>Acceptable Use</h2>
		<p>
			You may not use Brick to break the law, interfere with the service, attempt unauthorized
			access, misuse another person's data, or abuse connected third-party services.
		</p>

		<h2>No Professional Advice</h2>
		<p>
			Brick is an informational training dashboard. It does not provide medical, fitness, legal, or
			other professional advice. Use your own judgment and consult a qualified professional when
			needed.
		</p>

		<h2>Service Changes</h2>
		<p>
			We may update, suspend, or discontinue parts of Brick at any time. We may also update these
			terms, and continued use of Brick means you accept the updated terms.
		</p>

		<h2>Disclaimer</h2>
		<p>
			Brick is provided as is and as available, without warranties of any kind to the fullest extent
			permitted by law.
		</p>

		<h2>Limitation of Liability</h2>
		<p>
			To the fullest extent permitted by law, Brick and its operators will not be liable for indirect,
			incidental, special, consequential, or punitive damages arising from your use of the app.
		</p>

		<h2>Contact</h2>
		<p>
			Questions about these terms can be sent to
			<a href="mailto:support@getbricked.fit">support@getbricked.fit</a>.
		</p>
	</article>
</section>

<style>
	.terms-page {
		max-width: 760px;
		margin: 0 auto;
	}

	.terms-card {
		display: grid;
		gap: 0.9rem;
		line-height: 1.65;
	}

	.terms-card h2 {
		margin: 0.7rem 0 0;
		font-size: 1.05rem;
	}

	.terms-card p {
		margin: 0;
		color: var(--text-muted);
	}

	.terms-card a {
		color: var(--brand);
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 0.16em;
	}
</style>
