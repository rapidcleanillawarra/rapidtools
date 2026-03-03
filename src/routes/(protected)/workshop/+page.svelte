<script lang="ts">
  import { onMount } from 'svelte';
  import { getJobStatusCounts } from '$lib/services/workshop';
  import WorkshopJobsStatusChart from './components/WorkshopJobsStatusChart.svelte';

  let jobStatusCounts: { status: string; count: number }[] | null = null;
  let isLoadingStatusCounts = false;

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
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6 md:grid-rows-[auto_auto_auto] items-start">
    <!-- Row 1: header spanning 3 columns -->
    <div class="col-span-1 md:col-span-3 mb-0">
      <h1 class="text-xl font-semibold">Workshop Management</h1>
      <p class="text-gray-600 text-sm mt-1">Manage workshops and clean up storage</p>
    </div>

    <!-- Row 2: Jobs by status -->
    <div class="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden flex flex-col col-span-1">
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-800">Jobs by status</h2>
      </div>
      <div class="p-6 flex-1">
        <WorkshopJobsStatusChart stats={jobStatusCounts} isLoading={isLoadingStatusCounts} />
      </div>
    </div>
  </div>
</div>
