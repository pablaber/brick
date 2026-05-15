<svelte:head>
	<meta name="description" content="Contact Brick support." />
</svelte:head>

<section class="page support-page">
	<header class="page-header">
		<h1 class="page-title">Support</h1>
		<p class="page-subtitle">Need help with Brick?</p>
	</header>

	<article class="card support-card">
		<p>
			Contact us at
			<a href="mailto:support@getbricked.fit">support@getbricked.fit</a>.
		</p>
	</article>
</section>

<style>
	.support-page {
		max-width: 760px;
		margin: 0 auto;
	}

	.support-card {
		line-height: 1.65;
	}

	.support-card p {
		margin: 0;
		color: var(--text-muted);
	}

	.support-card a {
		color: var(--brand);
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 0.16em;
	}
</style>
