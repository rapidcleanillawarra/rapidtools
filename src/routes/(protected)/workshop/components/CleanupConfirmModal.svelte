<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let open: boolean = false;
  export let stats: {
    totalPhotos: number;
    usedPhotos: number;
    orphanedPhotos: number;
    storageSize: number;
    workshopsCount: number;
  } | null = null;
  export let isCleaning: boolean = false;

  const dispatch = createEventDispatcher<{ confirm: void; cancel: void }>();
</script>

{#if open}
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
            on:click={() => dispatch('cancel')}
            class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            on:click={() => dispatch('confirm')}
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
