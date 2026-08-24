<script lang="ts">
  import type { ColumnConfig } from './config';
  import type { ProductInfo } from './types';

  export let columns: ColumnConfig[];
  export let visibleColumns: Record<keyof ProductInfo, boolean>;
  export let onToggle: (column: keyof ProductInfo) => void;
  export let onShowAll: () => void;
  export let onHideAll: () => void;
</script>

<div class="rounded-xl border border-[#262a30] bg-[#181b20]/60 p-5 shadow-sm mb-6">
  <h3 class="text-base font-semibold text-white mb-4">Show/Hide Columns</h3>
  
  <div class="flex flex-wrap gap-2 mb-4">
    <button
      class="inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold bg-lime-500/20 text-lime-400 border border-lime-500/30 hover:bg-lime-500/30 transition-colors duration-200"
      on:click={onShowAll}
    >
      Show All
    </button>
    <button
      class="inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold bg-red-950/30 text-red-400 border border-red-500/30 hover:bg-red-900/40 transition-colors duration-200"
      on:click={onHideAll}
    >
      Hide All
    </button>
  </div>

  <div class="flex flex-wrap gap-2">
    {#each columns as column (column.key)}
      <button
        class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium transition-colors duration-150 {visibleColumns[column.key]
          ? 'bg-lime-500/20 text-lime-300 border border-lime-500/40 hover:bg-lime-500/30'
          : 'bg-[#1f2329] text-gray-400 border border-[#333842] hover:text-gray-200 hover:border-[#424854]'
        }"
        on:click={() => onToggle(column.key)}
      >
        {column.pillName}
        {#if visibleColumns[column.key]}
          <svg class="ml-1.5 h-3.5 w-3.5 text-lime-400" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
          </svg>
        {/if}
      </button>
    {/each}
  </div>

  <p class="mt-3 text-xs text-gray-500">
    Click on column names above to show or hide them in the table below.
  </p>
</div>

