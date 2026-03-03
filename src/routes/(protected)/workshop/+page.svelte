<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import {
    getPhotoStatistics,
    cleanupOrphanedPhotos,
    getWorkshops,
    type WorkshopRecord
  } from '$lib/services/workshop';
  import WorkshopQuickActions from './components/WorkshopQuickActions.svelte';
  import WorkshopStorageStats from './components/WorkshopStorageStats.svelte';
  import RecentWorkshopsList from './components/RecentWorkshopsList.svelte';
  import CleanupConfirmModal from './components/CleanupConfirmModal.svelte';
  import CleanupResultModal from './components/CleanupResultModal.svelte';

  let stats: {
    totalPhotos: number;
    usedPhotos: number;
    orphanedPhotos: number;
    storageSize: number;
    workshopsCount: number;
  } | null = null;

  let workshops: WorkshopRecord[] = [];
  let isLoadingStats = false;
  let isLoadingWorkshops = false;
  let isCleaning = false;
  let cleanupResult: { found: number; deleted: number; errors: string[] } | null = null;
  let showCleanupConfirm = false;

  onMount(async () => {
    await loadStats();
    await loadWorkshops();
  });

  async function loadStats() {
    isLoadingStats = true;
    try {
      stats = await getPhotoStatistics();
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      isLoadingStats = false;
    }
  }

  async function loadWorkshops() {
    isLoadingWorkshops = true;
    try {
      workshops = await getWorkshops({ limit: 10 });
    } catch (error) {
      console.error('Error loading workshops:', error);
    } finally {
      isLoadingWorkshops = false;
    }
  }

  async function runCleanup() {
    isCleaning = true;
    cleanupResult = null;
    try {
      cleanupResult = await cleanupOrphanedPhotos();
      await loadStats(); // Refresh stats after cleanup
    } catch (error) {
      console.error('Error during cleanup:', error);
      cleanupResult = {
        found: 0,
        deleted: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    } finally {
      isCleaning = false;
      showCleanupConfirm = false;
    }
  }
</script>

<div class="container mx-auto px-4 py-8">
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6 md:grid-rows-[auto_auto_auto] items-start">
    <!-- Row 1: header spanning 3 columns -->
    <div class="col-span-1 md:col-span-3 mb-0">
      <h1 class="text-xl font-semibold">Workshop Management</h1>
      <p class="text-gray-600 text-sm mt-1">Manage workshops and clean up storage</p>
    </div>

    <!-- Row 2: 3 columns -->
    <div class="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden flex flex-col">
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-800">Quick Actions</h2>
      </div>
      <div class="p-6 flex-1">
        <WorkshopQuickActions {base} on:cleanup={() => (showCleanupConfirm = true)} />
      </div>
    </div>

    <div class="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden flex flex-col">
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-800">Storage</h2>
      </div>
      <div class="p-6 flex-1">
        <WorkshopStorageStats stats={stats} isLoading={isLoadingStats} />
      </div>
    </div>

    <div class="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden flex flex-col">
      <div class="flex-1 min-h-0">
        <RecentWorkshopsList workshops={workshops} isLoading={isLoadingWorkshops} {base} />
      </div>
    </div>

    <!-- Row 3: 3 columns (placeholder cells for layout) -->
    <div class="hidden md:block min-h-[120px]"></div>
    <div class="hidden md:block min-h-[120px]"></div>
    <div class="hidden md:block min-h-[120px]"></div>
  </div>
</div>

<CleanupConfirmModal
  open={showCleanupConfirm}
  {stats}
  isCleaning={isCleaning}
  on:confirm={runCleanup}
  on:cancel={() => (showCleanupConfirm = false)}
/>

<CleanupResultModal result={cleanupResult} on:close={() => (cleanupResult = null)} />
