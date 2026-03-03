<script lang="ts">
  import { onMount } from 'svelte';
  import { getJobStatusCounts } from '$lib/services/workshop';
  import WorkshopJobsStatusChart from './components/WorkshopJobsStatusChart.svelte';

  let jobStatusCounts: { status: string; count: number }[] | null = null;
  let isLoadingStatusCounts = false;
  /** Which statuses are visible in the chart; new statuses default to true. */
  let statusVisibility: Record<string, boolean> = {};

  $: if (jobStatusCounts) {
    const next: Record<string, boolean> = { ...statusVisibility };
    for (const s of jobStatusCounts) {
      if (!(s.status in next)) next[s.status] = true;
    }
    statusVisibility = next;
  }

  $: filteredStatusCounts =
    jobStatusCounts?.filter((s) => statusVisibility[s.status] ?? true) ?? null;

  function formatStatusLabel(status: string): string {
    return status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  function toggleStatus(status: string) {
    statusVisibility[status] = !(statusVisibility[status] ?? true);
    statusVisibility = { ...statusVisibility };
  }

  onMount(async () => {
    isLoadingStatusCounts = true;
    try {
      jobStatusCounts = await getJobStatusCounts({ excludeDeleted: true });
    } catch (error) {
      console.error('Error loading job status counts:', error);
    } finally {
      isLoadingStatusCounts = false;
    }
  });
</script>

<div class="container mx-auto px-4 py-8">
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6 md:grid-rows-[auto_1fr_1fr] items-stretch">
    <!-- Row 1: header spanning 3 columns -->
    <div class="col-span-1 md:col-span-3 mb-0">
      <h1 class="text-xl font-semibold">Workshop Management</h1>
      <p class="text-gray-600 text-sm mt-1">Manage workshops and clean up storage</p>
    </div>

    <!-- Rows 2–3: Jobs by status (3 cols × 2 rows) -->
    <div class="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden flex flex-col col-span-1 md:col-span-3 md:row-span-2 min-h-0">
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-800">Jobs by status</h2>
      </div>
      <div class="flex flex-1 min-h-0">
        <!-- Left: show/hide status controls -->
        <div class="w-48 shrink-0 border-r border-gray-200 p-4 flex flex-col gap-2 overflow-y-auto">
          <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">Show in chart</span>
          {#if jobStatusCounts}
            {#each jobStatusCounts as { status, count }}
              <label class="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={statusVisibility[status] ?? true}
                  on:change={() => toggleStatus(status)}
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span class="text-sm text-gray-700 group-hover:text-gray-900 truncate" title={formatStatusLabel(status)}>
                  {formatStatusLabel(status)}
                </span>
                <span class="text-xs text-gray-400 ml-auto shrink-0">{count}</span>
              </label>
            {/each}
          {:else if isLoadingStatusCounts}
            <p class="text-sm text-gray-500">Loading…</p>
          {:else}
            <p class="text-sm text-gray-500">No statuses</p>
          {/if}
        </div>
        <!-- Right: pie chart -->
        <div class="flex-1 p-6 min-w-0 min-h-0">
          <WorkshopJobsStatusChart stats={filteredStatusCounts} isLoading={isLoadingStatusCounts} />
        </div>
      </div>
    </div>
  </div>
</div>
