<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { currentUser, isLoadingAuth } from '$lib/firebase';
  import { onMount } from 'svelte';

  let mounted = false;
  let isLoading = true;

  const unsubAuth = isLoadingAuth.subscribe(loading => {
    isLoading = loading;
  });

  const unsubUser = currentUser.subscribe(user => {
    if (mounted && browser && !user && !isLoading) {
      goto(base + '/');
    }
  });

  onMount(() => {
    mounted = true;
    return () => {
      unsubAuth();
      unsubUser();
    };
  });
</script>

{#if isLoading && !mounted}
  <div class="flex items-center justify-center min-h-screen">
    <div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
  </div>
{:else}
  <slot />
{/if} 