<script lang="ts">
  import type { ProductInfo } from './types';
  import type { ColumnConfig } from './config';
  import type { CategoryFlat, HighlightStatus } from './utils';
  import { getSortIcon, getCellContent } from './utils';

  export let columns: ColumnConfig[];
  export let products: ProductInfo[];
  export let isLoading: boolean;
  export let searchFilters: Record<string, string>;
  export let sortField: keyof ProductInfo;
  export let sortDirection: 'asc' | 'desc';
  export let onSort: (field: keyof ProductInfo) => void;
  export let onSearchChange: (key: keyof ProductInfo, value: string) => void;
  export let onImageClick: (product: ProductInfo) => void;
  export let onRowClick: (product: ProductInfo) => void;
  export let onGptInfoClick: (product: ProductInfo) => void;
  export let hasData: boolean;
  export let categories: CategoryFlat[] = [];
  export let highlightStatuses: Record<string, HighlightStatus> = {};
</script>

<div class="overflow-x-auto">
  <table class="w-full min-w-full divide-y divide-[#262a30] text-sm text-gray-200">
    <thead class="bg-[#181b20] text-[11px] font-semibold uppercase tracking-wider text-gray-400">
      <tr>
        {#each columns as column (column.key)}
          <th scope="col" class="px-3 py-2.5 text-left font-semibold">
            <div class="flex flex-col gap-1.5">
              <button
                type="button"
                class="cursor-pointer text-left text-gray-300 hover:text-lime-400 transition-colors"
                on:click={() => onSort(column.key)}
              >
                {column.displayName} {getSortIcon(column.key, sortField, sortDirection)}
              </button>
              {#if column.hasSearch}
                <input
                  type="text"
                  placeholder="Search {column.displayName}..."
                  class="bg-[#0e1012] text-gray-200 border border-[#262a30] rounded px-2 py-1 text-[11px] focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-600 transition-colors"
                  value={searchFilters[column.key] || ''}
                  on:input={(e) => onSearchChange(column.key, e.currentTarget.value)}
                />
              {/if}
            </div>
          </th>
        {/each}
      </tr>
    </thead>
    <tbody class="divide-y divide-[#262a30] bg-[#141619]">
      {#if isLoading}
        <tr>
          <td colspan={columns.length} class="px-4 py-8 text-center">
            <div class="flex items-center justify-center">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-lime-500"></div>
              <span class="ml-3 text-sm text-gray-300">Loading products...</span>
            </div>
          </td>
        </tr>
      {:else if products.length === 0}
        <tr>
          <td colspan={columns.length} class="px-4 py-8 text-center text-gray-400">
            {#if !hasData}
              No products found. Select a brand or enter SKUs to load products.
            {:else}
              No products match your search criteria.
            {/if}
          </td>
        </tr>
      {:else}
        {#each products as product (`${product.sku}-${product.id}`)}
          {@const highlight = highlightStatuses?.[product.sku]}
          <tr
            class={`transition-colors cursor-pointer ${
              highlight === 'saved'
                ? 'bg-lime-950/25 border-l-4 border-lime-500 hover:bg-lime-950/40'
                : highlight === 'gpt'
                  ? 'bg-amber-950/25 border-l-4 border-amber-500 hover:bg-amber-950/40'
                  : 'even:bg-[#181b20]/40 hover:bg-[#1f2329]/70'
            }`}
            on:click={() => onRowClick(product)}
          >
            {#each columns as column (column.key)}
              {#if column.renderType === 'image'}
                <td class="px-3 py-2.5 whitespace-nowrap">
                  {#if product.image}
                    <button
                      type="button"
                      class="cursor-pointer hover:opacity-80 transition-opacity"
                      on:click|stopPropagation={() => onImageClick(product)}
                      title="Click to view full size image"
                    >
                      <img src={product.image} alt={product.name} class="h-10 w-10 rounded-lg object-cover border border-[#262a30] bg-[#0e1012]" />
                    </button>
                  {:else}
                    <div class="h-10 w-10 rounded-lg bg-[#181b20] border border-[#262a30] flex items-center justify-center">
                      <span class="text-[10px] text-gray-500">No img</span>
                    </div>
                  {/if}
                </td>
              {:else if column.renderType === 'boolean-icon'}
                <td class="px-3 py-2.5 text-center" title={product[column.key] as string}>
                  {#if product[column.key]}
                    <svg class="h-4 w-4 text-lime-400 inline-block" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                    </svg>
                  {:else}
                    <span class="text-gray-600">-</span>
                  {/if}
                </td>
              {:else if column.renderType === 'button'}
                <td class="px-3 py-2.5 whitespace-nowrap">
                  <button
                    type="button"
                    class="btn-secondary text-xs px-2.5 py-1 text-lime-400 border-lime-500/30 hover:border-lime-400 hover:text-lime-300"
                    on:click|stopPropagation={() => onGptInfoClick(product)}
                    title="Copy product info to clipboard"
                  >
                    GPT Info
                  </button>
                </td>
              {:else}
                <td class="px-3 py-2.5 whitespace-nowrap {column.key === 'sku' || column.key === 'name' ? 'font-medium text-white' : 'text-gray-300'} text-xs">
                  {getCellContent(product, column, categories)}
                </td>
              {/if}
            {/each}
          </tr>
        {/each}
      {/if}
    </tbody>
  </table>
</div>

