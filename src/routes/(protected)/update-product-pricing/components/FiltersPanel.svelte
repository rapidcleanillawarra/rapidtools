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
  <div class="bg-[#141619] border border-[#262a30] rounded-xl shadow-md relative {collapsed ? 'p-2' : 'p-4 sm:p-5'}">
    <!-- Toggle button -->
    <button
      type="button"
      class="absolute -left-3 top-4 z-10 bg-[#1f2329] border border-[#333842] rounded-full p-1 shadow-md hover:bg-[#262a30] text-gray-300 hover:text-lime-400 transition-colors"
      class:rotated={collapsed}
      on:click={onToggleCollapse}
      aria-label={collapsed ? "Expand filters panel" : "Collapse filters panel"}
    >
      <svg class="w-4 h-4 text-gray-300 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
      </svg>
    </button>

    {#if !collapsed}
      <div>
        <div class="grid grid-cols-1 gap-4">
          <div>
            <label for="sku_filter" class="form-label text-xs">SKU</label>
            <textarea
              id="sku_filter"
              bind:value={$skuFilter}
              class="input-field p-2.5 text-xs placeholder-gray-500"
              rows="4"
              placeholder="Enter one SKU per line"
            ></textarea>
          </div>

          <div>
            <label for="product_name_filter" class="form-label text-xs">Product Name</label>
            <input
              type="text"
              id="product_name_filter"
              bind:value={$productNameFilter}
              class="input-field h-8 px-2.5 text-xs placeholder-gray-500"
              placeholder="Enter product name"
            />
          </div>

          <div>
            <label for="brand_filter" class="form-label text-xs">Brand</label>
            {#if $loadingBrands}
              <div class="animate-pulse bg-[#1f2329] border border-[#262a30] h-9 rounded-lg"></div>
            {:else if $brandError}
              <div class="text-red-400 text-xs">{$brandError}</div>
            {:else}
              <Select
                items={$brands}
                bind:value={$brandFilter}
                placeholder="Select Brand"
                clearable={true}
              />
            {/if}
          </div>

          <div>
            <label for="supplier_filter" class="form-label text-xs">Primary Supplier</label>
            {#if $loadingSuppliers}
              <div class="animate-pulse bg-[#1f2329] border border-[#262a30] h-9 rounded-lg"></div>
            {:else if $supplierError}
              <div class="text-red-400 text-xs">{$supplierError}</div>
            {:else}
              <Select
                items={$suppliers}
                bind:value={$supplierFilter}
                placeholder="Select Supplier"
                clearable={true}
              />
            {/if}
          </div>
        </div>

        <div class="mt-4">
          <button
            class="btn-secondary w-full text-xs font-semibold py-2 px-3 justify-center flex items-center"
            on:click={onApplyFilters}
          >
            Apply Filters
          </button>
        </div>

        <div class="mt-5 pt-4 border-t border-[#262a30] space-y-2.5">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-400">Actions</h3>
          <button
            class="btn-primary w-full text-xs font-bold py-2 px-3 inline-flex items-center justify-center gap-2"
            on:click={onRequestSave}
            disabled={$selectedRows.size === 0 || $submitLoading}
          >
            {#if $submitLoading}
              <div class="animate-spin rounded-full h-3.5 w-3.5 border-2 border-gray-950 border-t-transparent"></div>
              <span>Updating...</span>
            {:else}
              <span>Save</span>
            {/if}
          </button>
        </div>
      </div>
    {/if}
  </div>
</aside>

<style>
  .left-col {
    transition: width 0.3s ease-in-out;
  }

  .rotated {
    transform: rotate(180deg);
  }
</style>
