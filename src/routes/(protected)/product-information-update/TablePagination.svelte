<script lang="ts">
  import { ITEMS_PER_PAGE_OPTIONS } from './config';

  export let currentPage: number;
  export let itemsPerPage: number;
  export let hasNextPage: boolean;
  export let onPageChange: (page: number) => void;
  export let onItemsPerPageChange: (items: number) => void;
</script>

<div class="bg-[#181b20] px-4 py-3 flex items-center justify-between border-t border-[#262a30] sm:px-6">
  <div class="flex items-center gap-2">
    <span class="text-xs text-gray-400">Show</span>
    <select
      value={itemsPerPage}
      on:change={(e) => onItemsPerPageChange(Number(e.currentTarget.value))}
      class="bg-[#0e1012] text-gray-200 border border-[#262a30] rounded px-2 py-1 text-xs focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500 transition-colors"
    >
      {#each ITEMS_PER_PAGE_OPTIONS as option}
        <option value={option}>{option}</option>
      {/each}
    </select>
    <span class="text-xs text-gray-400">entries</span>
  </div>

  <div class="flex items-center gap-3">
    <button
      class="btn-secondary text-xs px-3 py-1"
      on:click={() => onPageChange(Math.max(1, currentPage - 1))}
      disabled={currentPage === 1}
    >
      Previous
    </button>
    <span class="text-xs text-gray-400 font-medium">Page {currentPage}</span>
    <button
      class="btn-secondary text-xs px-3 py-1"
      on:click={() => onPageChange(currentPage + 1)}
      disabled={!hasNextPage}
    >
      Next
    </button>
  </div>
</div>

