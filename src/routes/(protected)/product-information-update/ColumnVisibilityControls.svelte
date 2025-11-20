<script lang="ts">
  import type { ColumnConfig } from './config';
  import type { ProductInfo } from './types';

  export let columns: ColumnConfig[];
  export let visibleColumns: Record<keyof ProductInfo, boolean>;
  export let onToggle: (column: keyof ProductInfo) => void;
  export let onShowAll: () => void;
  export let onHideAll: () => void;
</script>

<div class="bg-white rounded-lg shadow p-6 mb-6">
  <h3 class="text-lg font-medium text-gray-900 mb-4">Show/Hide Columns</h3>
  
  <div class="flex flex-wrap gap-2 mb-4">
    <button
      class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 hover:bg-green-200 transition-colors duration-200"
      on:click={onShowAll}
    >
      Show All
    </button>
    <button
      class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 hover:bg-red-200 transition-colors duration-200"
      on:click={onHideAll}
    >
      Hide All
    </button>
  </div>

  <div class="flex flex-wrap gap-2">
    {#each columns as column (column.key)}
      <button
        class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium transition-colors duration-200 {visibleColumns[column.key]
          ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }"
        on:click={() => onToggle(column.key)}
      >
        {column.pillName}
        {#if visibleColumns[column.key]}
          <svg class="ml-1 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
          </svg>
        {/if}
      </button>
    {/each}
  </div>

  <p class="mt-2 text-sm text-gray-500">
    Click on column names above to show or hide them in the table below.
  </p>
</div>

