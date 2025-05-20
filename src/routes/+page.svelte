<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { currentUser, isLoadingAuth, authError, loginWithEmailPassword } from '$lib/firebase';

  let email = '';
  let password = '';
  
  let currentAuthUser: import('firebase/auth').User | null = null;
  let currentIsLoadingAuth: boolean = true;
  let currentAuthError: Error | null | unknown = null;

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

  async function handleLogin() {
    if (!email || !password) {
      // Basic validation, consider more robust validation
      alert('Please enter both email and password.');
      return;
    }
    try {
      await loginWithEmailPassword(email, password);
      // Navigation to dashboard is handled by the currentUser store subscription
    } catch (e) {
      // authError store is already set by the service, 
      // but you could add specific UI reactions here if needed.
      console.error("Login page caught error:", e);
    }
  }

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
</svelte:head>

<div class="login-container">
  {#if currentIsLoadingAuth && !currentAuthUser}
    <p>Loading authentication...</p>
  {:else if !currentAuthUser}
    <h1>RapidTools Login</h1>
    <form on:submit|preventDefault={handleLogin}>
      <div>
        <label for="email">Email:</label>
        <input type="email" id="email" bind:value={email} required>
      </div>
      <div>
        <label for="password">Password:</label>
        <input type="password" id="password" bind:value={password} required>
      </div>
      {#if currentIsLoadingAuth}
        <button type="submit" disabled>Logging in...</button>
      {:else}
        <button type="submit">Log In</button>
      {/if}
    </form>
    {#if currentAuthError}
      <!-- Basic error display, Firebase errors often have a .message property -->
      <p class="error">Login Failed: {typeof currentAuthError === 'object' && currentAuthError !== null && 'message' in currentAuthError ? (currentAuthError as {message: string}).message : 'An unknown error occurred'}</p>
    {/if}
  {:else}
    <!-- User is authenticated, redirecting -->
    <p>Redirecting to dashboard...</p>
  {/if}
</div>

<style>
  .login-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    text-align: center;
    padding: 20px;
  }
  form div {
    margin-bottom: 15px;
  }
  label {
    display: block;
    margin-bottom: 5px;
    text-align: left;
  }
  input {
    padding: 8px;
    width: 250px;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
  button {
    padding: 10px 20px;
    font-size: 1.1em;
    margin-top: 10px;
    cursor: pointer;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
  }
  button:disabled {
    background-color: #ccc;
  }
  .error {
    color: red;
    margin-top: 15px;
  }
</style>
