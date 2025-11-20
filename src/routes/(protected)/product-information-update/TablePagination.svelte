<script lang="ts">
  import { ITEMS_PER_PAGE_OPTIONS } from './config';

  export let currentPage: number;
  export let itemsPerPage: number;
  export let hasNextPage: boolean;
  export let onPageChange: (page: number) => void;
  export let onItemsPerPageChange: (items: number) => void;
</script>

<div class="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
  <div class="flex items-center gap-2">
    <span class="text-xs text-gray-700">Show</span>
    <select
      value={itemsPerPage}
      on:change={(e) => onItemsPerPageChange(Number(e.currentTarget.value))}
      class="border rounded px-1 py-0.5 text-xs"
    >
      {#each ITEMS_PER_PAGE_OPTIONS as option}
        <option value={option}>{option}</option>
      {/each}
    </select>
    <span class="text-xs text-gray-700">entries</span>
  </div>

  <div class="flex items-center gap-2">
    <button
      class="relative inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
      on:click={() => onPageChange(Math.max(1, currentPage - 1))}
      disabled={currentPage === 1}
    >
      Previous
    </button>
    <span class="text-xs text-gray-700">Page {currentPage}</span>
    <button
      class="relative inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
      on:click={() => onPageChange(currentPage + 1)}
      disabled={!hasNextPage}
    >
      Next
    </button>
  </div>
</div>

