<script lang="ts">
  import Select from 'svelte-select';
  import type { Writable } from 'svelte/store';
  import type { SelectOption } from '../types';

  export let skuFilter: Writable<string>;
  export let productNameFilter: Writable<string>;
  export let brandFilter: Writable<SelectOption | null>;
  export let supplierFilter: Writable<SelectOption | null>;

  export let brands: Writable<SelectOption[]>;
  export let suppliers: Writable<SelectOption[]>;

  export let loadingBrands: Writable<boolean>;
  export let loadingSuppliers: Writable<boolean>;
  export let brandError: Writable<string>;
  export let supplierError: Writable<string>;

  export let selectedRows: Writable<Set<string>>;
  export let submitLoading: Writable<boolean>;

  export let onApplyFilters: () => void;
  export let onRequestSave: () => void;
  export let onToggleCollapse: () => void;
  export let collapsed: boolean = false;
</script>

<!-- Left column: filters -->
<aside class="left-col" class:collapsed>
  <div class="bg-white rounded-lg shadow relative">
    <!-- Toggle button -->
    <button
      type="button"
      class="absolute -left-3 top-4 z-10 bg-white border border-gray-300 rounded-full p-1 shadow-md hover:bg-gray-50 transition-colors"
      class:rotated={collapsed}
      on:click={onToggleCollapse}
      aria-label={collapsed ? "Expand filters panel" : "Collapse filters panel"}
    >
      <svg class="w-4 h-4 text-gray-600 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
      </svg>
    </button>

    {#if !collapsed}
  <div class="bg-white rounded-lg shadow">
    <div class="p-6">
      <div class="grid grid-cols-1 gap-4">
        <div>
          <label for="sku_filter" class="block text-sm font-medium text-gray-700 mb-1">SKU</label>
          <textarea
            id="sku_filter"
            bind:value={$skuFilter}
            class="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            rows="4"
            placeholder="Enter one SKU per line"
          ></textarea>
        </div>

        <div>
          <label for="product_name_filter" class="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
          <input
            type="text"
            id="product_name_filter"
            bind:value={$productNameFilter}
            class="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Enter product name"
          />
        </div>

        <div>
          <label for="brand_filter" class="block text-sm font-medium text-gray-700 mb-1">Brand</label>
          {#if $loadingBrands}
            <div class="animate-pulse bg-gray-200 h-7 rounded"></div>
          {:else if $brandError}
            <div class="text-red-600 text-xs">{$brandError}</div>
          {:else}
            <Select
              items={$brands}
              bind:value={$brandFilter}
              placeholder="Select Brand"
              clearable={false}
            />
          {/if}
        </div>

        <div>
          <label for="supplier_filter" class="block text-sm font-medium text-gray-700 mb-1">Primary Supplier</label>
          {#if $loadingSuppliers}
            <div class="animate-pulse bg-gray-200 h-7 rounded"></div>
          {:else if $supplierError}
            <div class="text-red-600 text-xs">{$supplierError}</div>
          {:else}
            <Select
              items={$suppliers}
              bind:value={$supplierFilter}
              placeholder="Select Supplier"
              clearable={false}
            />
          {/if}
        </div>
      </div>

      <div class="mt-4">
        <button
          class="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          on:click={onApplyFilters}
        >
          Apply Filters
        </button>
      </div>
    </div>
  </div>

    <div class="mt-4 bg-white rounded-lg shadow p-4 space-y-2">
      <h3 class="text-sm font-semibold text-gray-800">Actions</h3>
      <button
        class="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center"
        on:click={onRequestSave}
        disabled={$selectedRows.size === 0 || $submitLoading}
      >
        {#if $submitLoading}
          <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
          Updating...
        {:else}
          Save
        {/if}
      </button>
    </div>
  {/if}
</aside>

<style>
  .left-col {
    transition: width 0.3s ease-in-out;
  }

  .rotated {
    transform: rotate(180deg);
  }
</style>
