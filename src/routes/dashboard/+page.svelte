<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { currentUser, isLoadingAuth, authError, logoutUser } from '$lib/firebase';
  import type { User } from 'firebase/auth';

  let currentAuthUser: User | null = null;
  let currentIsLoadingAuth: boolean = true;
  let currentAuthError: Error | null | unknown = null;

  const unsubCurrentUser = currentUser.subscribe(value => {
    currentAuthUser = value;
    if (browser && !currentIsLoadingAuth && !currentAuthUser) {
      goto('/', { replaceState: true });
    }
  });

  const unsubIsLoadingAuth = isLoadingAuth.subscribe(value => {
    currentIsLoadingAuth = value;
    if (browser && !value && !currentAuthUser) {
      goto('/', { replaceState: true });
    }
  });
  
  const unsubAuthError = authError.subscribe(value => {
    currentAuthError = value;
  });

  async function handleLogout() {
    try {
      await logoutUser();
      // Navigation to login page is handled by the currentUser store subscription (becomes null)
    } catch (e) {
      // authError store is already set, can add specific UI reactions here if needed
      console.error("Dashboard caught logout error:", e);
    }
  }

  onMount(() => {
    if (browser && !currentIsLoadingAuth && !currentAuthUser) {
        goto('/', { replaceState: true });
    }
    return () => {
      unsubCurrentUser();
      unsubIsLoadingAuth();
      unsubAuthError();
    };
  });

</script>

<svelte:head>
  <title>Dashboard - RapidTools</title>
</svelte:head>

<div class="dashboard-container">
  {#if currentIsLoadingAuth}
    <p>Loading dashboard...</p>
  {:else if currentAuthUser}
    <h1>Welcome to your Dashboard!</h1>
    <p>Logged in as: {currentAuthUser.email}</p>
    <!-- You can add more user details here, e.g., currentAuthUser.displayName if available -->
    <button on:click={handleLogout}>Log Out</button>
  {:else if currentAuthError}
    <p class="error">Authentication Error: {typeof currentAuthError === 'object' && currentAuthError !== null && 'message' in currentAuthError ? (currentAuthError as {message: string}).message : 'An unknown error occurred'}. Please try logging in again.</p>
    <p><a href="/">Go to Login</a></p>
  {:else}
    <!-- This should ideally be covered by redirects -->
    <p>You are not authenticated. Redirecting to login...</p>
  {/if}
</div>

<style>
  .dashboard-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
    text-align: center;
    min-height: 100vh;
  }
  button {
    padding: 10px 20px;
    font-size: 1.1em;
    cursor: pointer;
    margin-top: 20px;
    background-color: #dc3545; /* Red for logout */
    color: white;
    border: none;
    border-radius: 4px;
  }
  .error {
    color: red;
    margin-top: 15px;
  }
</style> 