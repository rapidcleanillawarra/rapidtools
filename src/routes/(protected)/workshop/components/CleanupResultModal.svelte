<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let result: { found: number; deleted: number; errors: string[] } | null = null;

  const dispatch = createEventDispatcher<{ close: void }>();
</script>

{#if result}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
      <div class="p-6">
        <div class="flex items-center mb-4">
          {#if result.errors.length === 0}
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
            <span class="font-medium">{result.found}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">Photos deleted:</span>
            <span class="font-medium text-green-600">{result.deleted}</span>
          </div>
          {#if result.errors.length > 0}
            <div class="mt-4">
              <p class="text-red-800 text-sm font-medium mb-2">Errors encountered:</p>
              <ul class="text-red-700 text-sm space-y-1">
                {#each result.errors as error}
                  <li>• {error}</li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>

        <div class="flex justify-end">
          <button
            on:click={() => dispatch('close')}
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
