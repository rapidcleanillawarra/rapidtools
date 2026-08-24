<script lang="ts">
  import type { ColumnConfig } from './config';
  import type { ProductInfo } from './types';

  export let columns: ColumnConfig[];
  export let visibleColumns: Record<keyof ProductInfo, boolean>;
  export let onToggle: (column: keyof ProductInfo) => void;
  export let onShowAll: () => void;
  export let onHideAll: () => void;
  let isExpanded = false;

  $: visibleCount = columns.filter((col) => visibleColumns[col.key]).length;
</script>

<div class="rounded-xl border border-[#262a30] bg-[#181b20]/60 p-2.5 sm:p-3 shadow-sm mb-3">
  <div class="flex items-center justify-between gap-2 flex-wrap">
    <button
      type="button"
      class="flex items-center gap-1.5 text-xs font-semibold text-gray-300 hover:text-white transition-colors"
      on:click={() => (isExpanded = !isExpanded)}
    >
      <svg
        class="w-3.5 h-3.5 text-gray-400 transition-transform duration-200 {isExpanded ? 'rotate-90' : ''}"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
      <span>Columns ({visibleCount}/{columns.length} visible)</span>
    </button>

    <div class="flex items-center gap-1.5">
      <button
        type="button"
        class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-lime-500/20 text-lime-400 border border-lime-500/30 hover:bg-lime-500/30 transition-colors duration-150"
        on:click={onShowAll}
      >
        Show All
      </button>
      <button
        type="button"
        class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-red-950/30 text-red-400 border border-red-500/30 hover:bg-red-900/40 transition-colors duration-150"
        on:click={onHideAll}
      >
        Hide All
      </button>
    </div>
  </div>

  {#if isExpanded}
    <div class="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-[#262a30]">
      {#each columns as column (column.key)}
        <button
          type="button"
          class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium transition-colors duration-150 {visibleColumns[column.key]
            ? 'bg-lime-500/20 text-lime-300 border border-lime-500/40 hover:bg-lime-500/30'
            : 'bg-[#1f2329] text-gray-400 border border-[#333842] hover:text-gray-200 hover:border-[#424854]'
          }"
          on:click={() => onToggle(column.key)}
        >
          {column.pillName}
          {#if visibleColumns[column.key]}
            <svg class="ml-1 h-3 w-3 text-lime-400" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
            </svg>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

