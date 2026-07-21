<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { currentUser, isLoadingAuth } from '$lib/firebase';
  import type { User } from 'firebase/auth';
  import { onDestroy } from 'svelte';

  let isLoading = true;
  let user: User | null = null;
  let redirectStarted = false;

  const unsubAuth = isLoadingAuth.subscribe((loading) => {
    isLoading = loading;
  });

  const unsubUser = currentUser.subscribe((value) => {
    user = value;
  });

  // Redirect when auth finishes with no user (covers load race + mid-session logout)
  $: if (browser && !isLoading && !user && !redirectStarted) {
    redirectStarted = true;
    goto(base + '/', { replaceState: true });
  }

  onDestroy(() => {
    unsubAuth();
    unsubUser();
  });
</script>

{#if isLoading}
  <div class="flex items-center justify-center min-h-screen">
    <div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
  </div>
{:else if user}
  <slot />
{:else}
  <div class="flex items-center justify-center min-h-screen">
    <p>Redirecting...</p>
  </div>
{/if}
