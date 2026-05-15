<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let { form } = $props();
	let loading = $state(false);
	let acceptedTerms = $state(false);
	let email = $state('');
	let mode = $state<'login' | 'signup'>(
		page.url.searchParams.get('mode') === 'signup' ? 'signup' : 'login'
	);

	$effect(() => {
		if (form && typeof form.email === 'string') {
			email = form.email;
		}
	});
</script>

<section class="page">
	<header class="page-header">
		<h1 class="page-title">{mode === 'login' ? 'Log In' : 'Sign Up'}</h1>
		<p class="page-subtitle">
			{mode === 'login' ? 'Sign in to your account.' : 'Create a new account.'}
		</p>
	</header>

	<div class="card">
		{#if form?.confirmEmail}
			<h2>Check Your Email</h2>
			<p>We sent a confirmation link to your email address. Click it to activate your account.</p>
		{:else}
			<h2>{mode === 'login' ? 'Sign In' : 'Create Account'}</h2>

			{#if form?.error}
				<p class="form-error">{form.error}</p>
			{/if}

			<form
				class="form-stack"
				method="POST"
				action={mode === 'login' ? '?/login' : '?/signup'}
				use:enhance={() => {
					loading = true;
					return async ({ update }) => {
						loading = false;
						await update();
					};
				}}
			>
				<label>
					<span>Email</span>
					<input
						class="text-input"
						type="email"
						name="email"
						placeholder="you@example.com"
						bind:value={email}
						required
					/>
				</label>
				<label>
					<span>Password</span>
					<input
						class="text-input"
						type="password"
						name="password"
						placeholder="********"
						required
						minlength={6}
					/>
				</label>
				{#if mode === 'signup'}
					<div class="consent-row">
						<input
							id="terms-consent"
							name="termsAccepted"
							type="checkbox"
							bind:checked={acceptedTerms}
							required
						/>
						<label for="terms-consent">
							I agree to the
							<a href={resolve('/terms')}>Terms of Service</a>
							and
							<a href={resolve('/privacy')}>Privacy Policy</a>.
						</label>
					</div>
				{/if}
				<button
					class="primary-button"
					type="submit"
					disabled={loading || (mode === 'signup' && !acceptedTerms)}
				>
					{loading ? 'Loading...' : mode === 'login' ? 'Log In' : 'Sign Up'}
				</button>
			</form>

			{#if mode === 'signup'}
				<p class="form-toggle">
					Already have an account?
					<button class="link-button" type="button" onclick={() => (mode = 'login')}>Log in</button>
				</p>
			{/if}
		{/if}
	</div>
</section>

<style>
	.consent-row {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.55rem;
		align-items: start;
		color: var(--text-muted);
		font-size: 0.92rem;
		line-height: 1.45;
	}

	.consent-row input {
		margin-top: 0.18rem;
	}

	.consent-row label {
		display: block;
	}

	.consent-row a {
		color: var(--brand);
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 0.16em;
	}
</style>
