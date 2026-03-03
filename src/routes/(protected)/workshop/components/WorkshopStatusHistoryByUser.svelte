<script lang="ts">
  import { onMount } from 'svelte';
  import { getStatusHistoryCountsByUserThisWeek } from '$lib/services/workshop';

  let rows: { user_email: string; full_name: string | null; count: number }[] = [];
  let isLoading = true;
  let error: string | null = null;

  onMount(async () => {
    isLoading = true;
    error = null;
    try {
      rows = await getStatusHistoryCountsByUserThisWeek();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load';
      rows = [];
    } finally {
      isLoading = false;
    }
  });
</script>

<div class="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden flex flex-col col-span-1 md:col-span-3 min-h-0">
  <div class="px-6 py-4 border-b border-gray-200">
    <h2 class="text-lg font-semibold text-gray-800">Status changes this week (by user)</h2>
  </div>
  <div class="p-6 min-h-0">
    {#if isLoading}
      <p class="text-sm text-gray-500">Loading…</p>
    {:else if error}
      <p class="text-sm text-red-600">{error}</p>
    {:else if rows.length === 0}
      <p class="text-sm text-gray-500">No status changes this week</p>
    {:else}
      <ul class="divide-y divide-gray-200">
        {#each rows as { user_email, full_name, count }}
          <li class="flex items-center justify-between py-2 first:pt-0 last:pb-0">
            <span class="text-sm text-gray-700 truncate" title={user_email}>{full_name ?? user_email}</span>
            <span class="text-sm font-medium text-gray-900 tabular-nums shrink-0 ml-4">{count}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>
