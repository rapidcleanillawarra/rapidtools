<script lang="ts">
  import type { ProductInfo } from './types';
  import type { ColumnConfig } from './config';
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
  export let hasData: boolean;
</script>

<div class="overflow-x-auto">
  <table class="min-w-full divide-y divide-gray-200">
    <thead class="bg-gray-50">
      <tr>
        {#each columns as column (column.key)}
          <th scope="col" class="px-2 py-1 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
            <div class="flex flex-col gap-2">
              <button
                type="button"
                class="cursor-pointer text-left hover:text-gray-700 transition-colors"
                on:click={() => onSort(column.key)}
              >
                {column.displayName} {getSortIcon(column.key, sortField, sortDirection)}
              </button>
              {#if column.hasSearch}
                <input
                  type="text"
                  placeholder="Search {column.displayName}..."
                  class="border rounded px-1 py-0.5 text-[10px]"
                  value={searchFilters[column.key] || ''}
                  on:input={(e) => onSearchChange(column.key, e.currentTarget.value)}
                />
              {/if}
            </div>
          </th>
        {/each}
      </tr>
    </thead>
    <tbody class="bg-white divide-y divide-gray-200">
      {#if isLoading}
        <tr>
          <td colspan={columns.length} class="px-2 py-2 text-center">
            <div class="flex items-center justify-center">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              <span class="ml-2">Loading products...</span>
            </div>
          </td>
        </tr>
      {:else if products.length === 0}
        <tr>
          <td colspan={columns.length} class="px-2 py-2 text-center text-gray-500">
            {#if !hasData}
              No products found. Select a brand to load products.
            {:else}
              No products match your search criteria.
            {/if}
          </td>
        </tr>
      {:else}
        {#each products as product (product.id)}
          <tr class="hover:bg-gray-50 cursor-pointer" on:click={() => onRowClick(product)}>
            {#each columns as column (column.key)}
              {#if column.renderType === 'image'}
                <td class="px-2 py-2 whitespace-nowrap">
                  {#if product.image}
                    <button
                      type="button"
                      class="cursor-pointer hover:opacity-75 transition-opacity"
                      on:click|stopPropagation={() => onImageClick(product)}
                      title="Click to view full size image"
                    >
                      <img src={product.image} alt={product.name} class="h-10 w-10 rounded-lg object-cover" />
                    </button>
                  {:else}
                    <div class="h-10 w-10 rounded-lg bg-gray-200 flex items-center justify-center">
                      <span class="text-xs text-gray-500">No img</span>
                    </div>
                  {/if}
                </td>
              {:else if column.renderType === 'boolean-icon'}
                <td class="px-2 py-2 text-center" title={product[column.key] as string}>
                  {#if product[column.key]}
                    <svg class="h-4 w-4 text-green-500 inline-block" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                    </svg>
                  {:else}
                    <span class="text-gray-300">-</span>
                  {/if}
                </td>
              {:else}
                <td class="px-2 py-2 whitespace-nowrap {column.key === 'sku' || column.key === 'name' ? 'font-medium text-gray-900' : 'text-gray-500'} text-xs">
                  {getCellContent(product, column)}
                </td>
              {/if}
            {/each}
          </tr>
        {/each}
      {/if}
    </tbody>
  </table>
</div>

