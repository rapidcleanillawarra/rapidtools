<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { currentUser, isLoadingAuth, authError, loginWithEmailPassword } from '$lib/firebase';

  let email = $state('');
  let password = $state('');
  let isSubmitting = $state(false);
  let localError = $state('');

  let currentAuthUser = $state<import('firebase/auth').User | null>(null);
  let currentIsLoadingAuth = $state(true);
  let currentAuthError = $state<Error | null | unknown>(null);

  const unsubCurrentUser = currentUser.subscribe(value => {
    currentAuthUser = value;
    if (currentAuthUser && !currentIsLoadingAuth) {
      goto(base + '/dashboard', { replaceState: true });
    }
  });

  const unsubIsLoadingAuth = isLoadingAuth.subscribe(value => {
    currentIsLoadingAuth = value;
    // If loading finishes and user is authenticated, redirect.
    if (!currentIsLoadingAuth && currentAuthUser) {
      goto(base + '/dashboard', { replaceState: true });
    }
  });

  const unsubAuthError = authError.subscribe(value => {
    currentAuthError = value;
  });

  function mapAuthError(error: unknown): string {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code: string }).code)
        : '';
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: string }).message)
        : '';

    switch (code) {
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
      case 'auth/invalid-login-credentials':
        return 'Email or password is incorrect. Please try again.';
      case 'auth/user-not-found':
        return 'No account found for that email.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a moment and try again.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Contact an administrator.';
      default:
        return message || 'Something went wrong. Please try again.';
    }
  }

  async function handleLogin(event: Event) {
    event.preventDefault();
    localError = '';
    if (!email || !password) {
      localError = 'Please enter both email and password.';
      return;
    }
    isSubmitting = true;
    try {
      await loginWithEmailPassword(email, password);
      // Keep isSubmitting true on success so the form stays mounted until redirect.
      // Navigation to dashboard is handled by the currentUser store subscription.
    } catch (e) {
      console.error('Login page caught error:', e);
      localError = mapAuthError(e ?? currentAuthError);
      isSubmitting = false;
    }
  }

  const displayError = $derived(
    localError || (currentAuthError && !isSubmitting ? mapAuthError(currentAuthError) : '')
  );

  onMount(() => {
    // Initial check in case auth state is already resolved
    if (!currentIsLoadingAuth && currentAuthUser) {
      goto(base + '/dashboard', { replaceState: true });
    }
    return () => {
      unsubCurrentUser();
      unsubIsLoadingAuth();
      unsubAuthError();
    };
  });
</script>

<svelte:head>
  <title>Login - RapidTools</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Sora:wght@500;600;700;800&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<div class="login-page">
  {#if currentIsLoadingAuth && !isSubmitting && !currentAuthUser}
    <div class="status-panel" role="status" aria-live="polite">
      <div class="spinner" aria-hidden="true"></div>
      <p class="status-text">Checking your session</p>
    </div>
  {:else if !currentAuthUser}
    <div class="login-shell">
      <section class="brand-panel" aria-label="RapidTools">
        <div class="brand-grid" aria-hidden="true"></div>
        <div class="brand-accent" aria-hidden="true"></div>

        <div class="brand-content">
          <img
            class="brand-logo"
            src="{base}/company_logo_white.webp"
            alt="Rapid Clean Illawarra"
            width="160"
            height="48"
          />
          <h1 class="brand-title">RapidTools</h1>
          <span class="brand-rule" aria-hidden="true"></span>
          <p class="brand-support">Internal tools access for operations, warehouse, and field teams.</p>
        </div>
      </section>

      <section class="form-panel">
        <div class="form-surface">
          <h2 class="form-heading">Sign in</h2>
          <p class="form-lede">Use your RapidTools account to continue.</p>

          <form class="login-form" onsubmit={handleLogin}>
            <div class="field">
              <label for="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                bind:value={email}
                required
                autocomplete="username"
                inputmode="email"
                disabled={isSubmitting}
              />
            </div>

            <div class="field">
              <label for="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                bind:value={password}
                required
                autocomplete="current-password"
                disabled={isSubmitting}
              />
            </div>

            {#if displayError}
              <div class="alert" role="alert">
                {displayError}
              </div>
            {/if}

            <button type="submit" class="submit-btn" disabled={isSubmitting}>
              {#if isSubmitting}
                Signing in…
              {:else}
                Sign in
              {/if}
            </button>
          </form>
        </div>
      </section>
    </div>
  {:else}
    <div class="status-panel" role="status" aria-live="polite">
      <div class="spinner" aria-hidden="true"></div>
      <p class="status-text">Taking you to the dashboard</p>
    </div>
  {/if}
</div>

<style>
  .login-page {
    --brand-yellow: #facc15;
    --brand-charcoal: #111827;
    --brand-ink: #0f172a;
    --brand-surface: #f8fafc;
    --brand-muted: #64748b;
    --brand-danger: #9a3412;
    --brand-danger-bg: #fff7ed;
    --brand-danger-border: #fed7aa;
    --brand-slate: #1e293b;
    --brand-border: #e2e8f0;

    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    align-items: stretch;
    justify-content: center;
    font-family: 'DM Sans', 'Segoe UI', sans-serif;
    color: var(--brand-ink);
    background:
      linear-gradient(145deg, var(--brand-charcoal) 0%, #0f172a 48%, var(--brand-slate) 100%);
  }

  .login-shell {
    display: grid;
    grid-template-columns: 1fr;
    width: 100%;
    min-height: 100vh;
    min-height: 100dvh;
  }

  .brand-panel {
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: flex-end;
    padding: 2.5rem 1.75rem 2rem;
    color: #f8fafc;
    background:
      radial-gradient(ellipse 80% 60% at 10% 0%, rgba(250, 204, 21, 0.12), transparent 55%),
      linear-gradient(160deg, #111827 0%, #0f172a 55%, #1e293b 100%);
  }

  .brand-grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(248, 250, 252, 0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(248, 250, 252, 0.04) 1px, transparent 1px);
    background-size: 36px 36px;
    mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.7), transparent 85%);
    pointer-events: none;
  }

  .brand-accent {
    position: absolute;
    top: 0;
    left: 0;
    width: 4px;
    height: 100%;
    background: var(--brand-yellow);
    transform-origin: top;
    animation: accent-draw 0.9s ease-out both;
  }

  .brand-content {
    position: relative;
    z-index: 1;
    max-width: 28rem;
    animation: brand-enter 0.7s ease-out both;
  }

  .brand-logo {
    display: block;
    height: 2.5rem;
    width: auto;
    margin-bottom: 1.75rem;
    opacity: 0.85;
  }

  .brand-title {
    margin: 0;
    font-family: 'Sora', 'DM Sans', sans-serif;
    font-size: clamp(2.75rem, 9vw, 4.25rem);
    font-weight: 800;
    line-height: 0.95;
    letter-spacing: -0.04em;
    color: var(--brand-yellow);
  }

  .brand-rule {
    display: block;
    width: 3.5rem;
    height: 3px;
    margin: 1.25rem 0 1rem;
    background: var(--brand-yellow);
    transform-origin: left;
    animation: rule-draw 0.8s 0.25s ease-out both;
  }

  .brand-support {
    margin: 0;
    max-width: 22rem;
    font-size: 1.05rem;
    line-height: 1.5;
    color: rgba(248, 250, 252, 0.78);
  }

  .form-panel {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem 1.5rem 2.5rem;
    background: var(--brand-surface);
  }

  .form-surface {
    width: 100%;
    max-width: 24rem;
    padding: 1.75rem 1.5rem;
    border: 1px solid var(--brand-border);
    border-radius: 0.5rem;
    background: #ffffff;
    animation: form-rise 0.65s 0.1s ease-out both;
  }

  .form-heading {
    margin: 0 0 0.35rem;
    font-family: 'Sora', 'DM Sans', sans-serif;
    font-size: 1.35rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--brand-charcoal);
  }

  .form-lede {
    margin: 0 0 1.5rem;
    font-size: 0.95rem;
    color: var(--brand-muted);
  }

  .login-form {
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    text-align: left;
  }

  .field label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--brand-charcoal);
  }

  .field input {
    width: 100%;
    box-sizing: border-box;
    padding: 0.75rem 0.85rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.375rem;
    background: #fff;
    color: var(--brand-ink);
    font: inherit;
    font-size: 1rem;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .field input:hover:not(:disabled) {
    border-color: #94a3b8;
  }

  .field input:focus {
    outline: none;
    border-color: var(--brand-charcoal);
    box-shadow: 0 0 0 3px rgba(250, 204, 21, 0.45);
  }

  .field input:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  .alert {
    margin: 0;
    padding: 0.75rem 0.85rem;
    border: 1px solid var(--brand-danger-border);
    border-radius: 0.375rem;
    background: var(--brand-danger-bg);
    color: var(--brand-danger);
    font-size: 0.9rem;
    line-height: 1.4;
    text-align: left;
  }

  .submit-btn {
    margin-top: 0.25rem;
    width: 100%;
    padding: 0.85rem 1.25rem;
    border: none;
    border-radius: 0.375rem;
    background: var(--brand-charcoal);
    color: var(--brand-yellow);
    font-family: 'Sora', 'DM Sans', sans-serif;
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 0.01em;
    cursor: pointer;
    transition: background-color 0.15s ease, transform 0.12s ease, color 0.15s ease;
  }

  .submit-btn:hover:not(:disabled) {
    background: #1f2937;
  }

  .submit-btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  .submit-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(250, 204, 21, 0.55);
  }

  .submit-btn:disabled {
    cursor: not-allowed;
    background: #475569;
    color: #fde68a;
  }

  .status-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    width: 100%;
    min-height: 100vh;
    min-height: 100dvh;
    padding: 2rem;
    color: #f8fafc;
    animation: brand-enter 0.45s ease-out both;
  }

  .status-text {
    margin: 0;
    font-family: 'Sora', 'DM Sans', sans-serif;
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: rgba(248, 250, 252, 0.88);
  }

  .spinner {
    width: 2rem;
    height: 2rem;
    border: 2px solid rgba(248, 250, 252, 0.2);
    border-top-color: var(--brand-yellow);
    border-radius: 50%;
    animation: spin 0.75s linear infinite;
  }

  @keyframes brand-enter {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes form-rise {
    from {
      opacity: 0;
      transform: translateY(18px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes accent-draw {
    from {
      transform: scaleY(0);
    }
    to {
      transform: scaleY(1);
    }
  }

  @keyframes rule-draw {
    from {
      transform: scaleX(0);
      opacity: 0;
    }
    to {
      transform: scaleX(1);
      opacity: 1;
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (min-width: 900px) {
    .login-shell {
      grid-template-columns: minmax(0, 1.1fr) minmax(22rem, 0.9fr);
    }

    .brand-panel {
      align-items: center;
      padding: 4rem 3.5rem;
    }

    .brand-content {
      max-width: 32rem;
    }

    .brand-logo {
      height: 3rem;
      margin-bottom: 2.25rem;
    }

    .form-panel {
      padding: 3rem;
      background:
        linear-gradient(180deg, #f1f5f9 0%, var(--brand-surface) 40%, #ffffff 100%);
    }

    .form-surface {
      padding: 2rem 2rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .brand-content,
    .form-surface,
    .brand-accent,
    .brand-rule,
    .status-panel,
    .spinner,
    .submit-btn {
      animation: none !important;
      transition: none !important;
      transform: none !important;
    }

    .spinner {
      border-top-color: var(--brand-yellow);
      opacity: 0.85;
    }
  }
</style>
