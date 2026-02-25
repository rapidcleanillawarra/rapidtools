<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import {
    getPhotoStatistics,
    cleanupOrphanedPhotos,
    getWorkshops,
    type WorkshopRecord
  } from '$lib/services/workshop';

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

  let isTransferring = false;
  let transferResult: { migrated: number; skipped: number; errors: string[] } | null = null;
  let transferError: string | null = null;

  let isTestingB2 = false;
  let b2TestResult: { ok: boolean; error?: string } | null = null;

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

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function getStatusColor(status: WorkshopRecord['status']): string {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  async function runTransferToColdStorage() {
    isTransferring = true;
    transferResult = null;
    transferError = null;
    try {
      const res = await fetch('/api/storage/migrate-to-b2', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        transferResult = {
          migrated: data.migrated ?? 0,
          skipped: data.skipped ?? 0,
          errors: Array.isArray(data.errors) ? data.errors : []
        };
        await loadStats();
      } else if (res.status === 503) {
        transferError = data.error ?? 'Cold storage (B2) is not configured.';
      } else {
        transferError = data.error ?? 'Transfer failed.';
      }
    } catch (err) {
      transferError = err instanceof Error ? err.message : 'Transfer failed.';
    } finally {
      isTransferring = false;
    }
  }

  async function testB2Connection() {
    isTestingB2 = true;
    b2TestResult = null;
    try {
      const res = await fetch('/api/storage/test-b2');
      const data = await res.json();
      b2TestResult = data.ok ? { ok: true } : { ok: false, error: data.error ?? 'Connection failed.' };
    } catch (err) {
      b2TestResult = { ok: false, error: err instanceof Error ? err.message : 'Request failed.' };
    } finally {
      isTestingB2 = false;
    }
  }
</script>

<div class="container mx-auto px-4 py-8">
  <div class="bg-white rounded-lg shadow-lg overflow-hidden">
    <div class="px-6 py-4 border-b border-gray-200">
      <h1 class="text-xl font-semibold">Workshop Management</h1>
      <p class="text-gray-600 text-sm mt-1">Manage workshops and clean up storage</p>
    </div>

    <div class="p-6 space-y-8">
      <!-- Quick Actions -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <a
          href="{base}/workshop/form"
          class="flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
          </svg>
          Create Workshop
        </a>
        <a
          href="{base}/workshop/camera"
          class="flex items-center justify-center px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
          </svg>
          Start with Camera
        </a>
        <button
          on:click={runTransferToColdStorage}
          disabled={isTransferring}
          class="flex items-center justify-center px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
          </svg>
          {#if isTransferring}
            Transferring...
          {:else}
            Transfer Files &amp; Photos to Cold Storage
          {/if}
        </button>
        <button
          on:click={testB2Connection}
          disabled={isTestingB2}
          class="flex items-center justify-center px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Test connection to Backblaze B2 storage"
        >
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"></path>
          </svg>
          {#if isTestingB2}
            Testing...
          {:else}
            Test Backblaze Connection
          {/if}
        </button>
        <button
          on:click={() => showCleanupConfirm = true}
          class="flex items-center justify-center px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
          Clean Storage
        </button>
      </div>

      <!-- Statistics -->
      <div class="bg-gray-50 rounded-lg p-6">
        <h2 class="text-lg font-semibold mb-4">Storage Statistics</h2>

        {#if isLoadingStats}
          <div class="animate-pulse space-y-3">
            <div class="h-4 bg-gray-300 rounded w-1/3"></div>
            <div class="h-4 bg-gray-300 rounded w-1/2"></div>
            <div class="h-4 bg-gray-300 rounded w-2/3"></div>
          </div>
        {:else if stats}
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-white p-4 rounded-lg shadow">
              <div class="text-2xl font-bold text-blue-600">{stats.totalPhotos}</div>
              <div class="text-sm text-gray-600">Total Photos</div>
            </div>
            <div class="bg-white p-4 rounded-lg shadow">
              <div class="text-2xl font-bold text-green-600">{stats.usedPhotos}</div>
              <div class="text-sm text-gray-600">Used Photos</div>
            </div>
            <div class="bg-white p-4 rounded-lg shadow">
              <div class="text-2xl font-bold text-red-600">{stats.orphanedPhotos}</div>
              <div class="text-sm text-gray-600">Orphaned Photos</div>
            </div>
          </div>

          <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-white p-4 rounded-lg shadow">
              <div class="text-lg font-semibold text-gray-700">{formatFileSize(stats.storageSize)}</div>
              <div class="text-sm text-gray-600">Storage Used</div>
            </div>
            <div class="bg-white p-4 rounded-lg shadow">
              <div class="text-lg font-semibold text-gray-700">{stats.workshopsCount}</div>
              <div class="text-sm text-gray-600">Total Workshops</div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Recent Workshops -->
      <div class="bg-white border rounded-lg">
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-semibold">Recent Workshops</h2>
        </div>

        {#if isLoadingWorkshops}
          <div class="p-6">
            <div class="animate-pulse space-y-3">
              <div class="h-4 bg-gray-300 rounded"></div>
              <div class="h-4 bg-gray-300 rounded w-3/4"></div>
              <div class="h-4 bg-gray-300 rounded w-1/2"></div>
            </div>
          </div>
        {:else if workshops.length > 0}
          <div class="divide-y divide-gray-200">
            {#each workshops as workshop}
              <div class="p-4 hover:bg-gray-50">
                <div class="flex items-center justify-between">
                  <div class="flex-1">
                    <div class="font-medium text-gray-900">{workshop.customer_name}</div>
                    <div class="text-sm text-gray-600">
                      {workshop.product_name} • {workshop.location_of_machine}
                      {#if workshop.photo_urls && workshop.photo_urls.length > 0}
                        • 📷 {workshop.photo_urls.length} photos
                      {/if}
                    </div>
                    <div class="text-xs text-gray-500 mt-1">
                      {new Date(workshop.created_at).toLocaleDateString()}
                      {#if workshop.started_with}
                        • Started via {workshop.started_with}
                      {/if}
                    </div>
                  </div>
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusColor(workshop.status)}">
                    {workshop.status}
                  </span>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="p-6 text-center text-gray-500">
            No workshops found. <a href="{base}/workshop/form" class="text-blue-600 hover:text-blue-800">Create your first workshop</a>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<!-- Cleanup Confirmation Modal -->
{#if showCleanupConfirm}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
      <div class="p-6">
        <div class="flex items-center mb-4">
          <svg class="w-6 h-6 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
          </svg>
          <h3 class="text-lg font-semibold text-gray-900">Clean Up Storage</h3>
        </div>

        <p class="text-gray-700 mb-6">
          This will delete all photos from storage that are not referenced by any workshop records.
          This action cannot be undone.
        </p>

        {#if stats && stats.orphanedPhotos > 0}
          <div class="bg-red-50 border border-red-200 rounded p-3 mb-6">
            <p class="text-red-800 text-sm">
              Found <strong>{stats.orphanedPhotos}</strong> orphaned photos that will be deleted.
            </p>
          </div>
        {/if}

        <div class="flex justify-end space-x-3">
          <button
            on:click={() => showCleanupConfirm = false}
            class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            on:click={runCleanup}
            disabled={isCleaning}
            class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {#if isCleaning}
              Cleaning...
            {:else}
              Delete Orphaned Photos
            {/if}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Cleanup Results Modal -->
{#if cleanupResult}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
      <div class="p-6">
        <div class="flex items-center mb-4">
          {#if cleanupResult.errors.length === 0}
            <svg class="w-6 h-6 text-green-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <h3 class="text-lg font-semibold text-green-900">Cleanup Complete</h3>
          {:else}
            <svg class="w-6 h-6 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
            </svg>
            <h3 class="text-lg font-semibold text-red-900">Cleanup Completed with Errors</h3>
          {/if}
        </div>

        <div class="space-y-3 mb-6">
          <div class="flex justify-between">
            <span class="text-gray-600">Orphaned photos found:</span>
            <span class="font-medium">{cleanupResult.found}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">Photos deleted:</span>
            <span class="font-medium text-green-600">{cleanupResult.deleted}</span>
          </div>
          {#if cleanupResult.errors.length > 0}
            <div class="mt-4">
              <p class="text-red-800 text-sm font-medium mb-2">Errors encountered:</p>
              <ul class="text-red-700 text-sm space-y-1">
                {#each cleanupResult.errors as error}
                  <li>• {error}</li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>

        <div class="flex justify-end">
          <button
            on:click={() => cleanupResult = null}
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Transfer to Cold Storage Result Modal -->
{#if transferResult}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
      <div class="p-6">
        <div class="flex items-center mb-4">
          <svg class="w-6 h-6 text-green-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <h3 class="text-lg font-semibold text-green-900">Transfer Complete</h3>
        </div>

        <p class="text-gray-700 mb-4">
          Migrated {transferResult.migrated} workshop(s) to cold storage.
          {#if transferResult.skipped > 0}
            Skipped {transferResult.skipped} (no Supabase files or already migrated).
          {/if}
        </p>

        {#if transferResult.errors.length > 0}
          <div class="mt-4 mb-4">
            <p class="text-amber-800 text-sm font-medium mb-2">Some errors occurred:</p>
            <ul class="text-amber-700 text-sm space-y-1 max-h-40 overflow-y-auto">
              {#each transferResult.errors as error}
                <li>• {error}</li>
              {/each}
            </ul>
          </div>
        {/if}

        <div class="flex justify-end">
          <button
            on:click={() => { transferResult = null; transferError = null; }}
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Transfer Error (e.g. B2 not configured) -->
{#if transferError && !transferResult}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
      <div class="p-6">
        <div class="flex items-center mb-4">
          <svg class="w-6 h-6 text-amber-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
          </svg>
          <h3 class="text-lg font-semibold text-gray-900">Transfer Failed</h3>
        </div>
        <p class="text-gray-700 mb-6">{transferError}</p>
        <div class="flex justify-end">
          <button
            on:click={() => transferError = null}
            class="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- B2 connection test result -->
{#if b2TestResult}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
      <div class="p-6">
        <div class="flex items-center mb-4">
          {#if b2TestResult.ok}
            <svg class="w-6 h-6 text-green-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <h3 class="text-lg font-semibold text-green-900">Backblaze B2 Connected</h3>
          {:else}
            <svg class="w-6 h-6 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <h3 class="text-lg font-semibold text-red-900">Backblaze B2 Connection Failed</h3>
          {/if}
        </div>
        {#if b2TestResult.ok}
          <p class="text-gray-700 mb-6">Connection to Backblaze B2 storage is working. Uploads and cold storage transfers can use B2.</p>
        {:else}
          <p class="text-gray-700 mb-6">{b2TestResult.error}</p>
        {/if}
        <div class="flex justify-end">
          <button
            on:click={() => b2TestResult = null}
            class="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
</style>
