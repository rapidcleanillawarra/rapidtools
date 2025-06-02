<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import Select from 'svelte-select';
  import { SvelteToast } from '@zerodevx/svelte-toast';
  import { toastSuccess, toastError } from '$lib/utils/toast';
  import {
    products,
    originalProducts,
    filteredProducts,
    brands,
    suppliers,
    categories,
    loading,
    loadingBrands,
    loadingSuppliers,
    loadingCategories,
    brandError,
    supplierError,
    categoryError,
    selectedRows,
    selectAll,
    submitLoading,
    skuFilter,
    productNameFilter,
    brandFilter,
    supplierFilter,
    categoryFilter,
    calculatePrices,
    applyClientMupToAll,
    applyRetailMupToAll,
    fetchBrands,
    fetchSuppliers,
    fetchCategories,
    handleSelectAll,
    handleSubmitChecked,
    handleFilterSubmit
  } from './page';

  interface SelectOption {
    value: string;
    label: string;
  }

  interface PriceGroupDetail {
    Multiple?: string;
    Price: string;
    MaximumQuantity?: string;
    MinimumQuantity?: string;
    MultipleStartQuantity?: string;
    Group: string;
    GroupID: string;
  }

  interface ApiProductItem {
    PrimarySupplier: string;
    Categories: string[];
    RRP: string;
    Model: string;
    InventoryID: string;
    Brand: string;
    Misc09: string;
    DefaultPurchasePrice: string;
    PriceGroups: {
      PriceGroup: PriceGroupDetail | PriceGroupDetail[];
    };
    SKU: string;
    Misc02: string;
  }

  // API Endpoints
  const brandsUrl = 'https://prod-06.australiasoutheast.logic.azure.com:443/workflows/58215302c1c24203886ccf481adbaac5/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=RFQ4OtbS6cyjB_JzaIsowmww4KBqPQgavWLg18znE5s';
  const suppliersUrl = 'https://prod-06.australiasoutheast.logic.azure.com:443/workflows/da5c5708146642768d63293d2bbb9668/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=-n0W0PxlF1G83xHYHGoEOhv3XmHXWlesbRk5NcgNT9w';
  const categoriesUrl = 'https://prod-47.australiasoutheast.logic.azure.com:443/workflows/0d67bc8f1bb64e78a2495f13a7498081/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=fJJzmNyuARuwEcNCoMuWwMS9kmWZQABw9kJXsUj9Wk8';
  const updatePricingUrl = 'https://prod-06.australiasoutheast.logic.azure.com:443/workflows/a14abba8479c457bafd63fe32fd9fea4/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=Evz4dRmWiP8p-hxjZxofNX1q_o_-ufQK2c_XI4Quxto';

  export let data: { products: any[] };

  // Add logging for when data changes
  $: {
    console.log('Data changed:', {
      hasData: !!data,
      productsLength: data?.products?.length || 0
    });
  }

  $: {
    // Initialize products from data prop
    if (data?.products && Array.isArray(data.products)) {
      console.log('Processing products data:', {
        receivedCount: data.products.length,
        currentOriginalCount: $originalProducts.length
      });

      if ($originalProducts.length === 0) {
        console.log('Initializing products arrays');
        $originalProducts = [...data.products];
        $products = [...data.products];
        $filteredProducts = [...data.products];
        console.log('Products arrays initialized:', {
          originalCount: $originalProducts.length,
          productsCount: $products.length,
          filteredCount: $filteredProducts.length
        });
      }
    } else {
      console.warn('Invalid or missing products data:', data);
    }
  }

  onMount(async () => {
    console.log('Component mounted');
    console.log('Current data state:', {
      originalProducts: $originalProducts.length,
      products: $products.length,
      filteredProducts: $filteredProducts.length
    });
    
    await Promise.all([
      fetchBrands(),
      fetchSuppliers(),
      fetchCategories()
    ]);
  });
</script>

<SvelteToast options={{ 
  duration: 4000,
  pausable: true,
  reversed: false,
  intro: { y: -200 }
}} />

<div class="min-h-screen bg-gray-100 py-8 px-2 sm:px-3">
  <div class="max-w-[98%] mx-auto bg-white shadow p-6" transition:fade>
    <h2 class="text-2xl font-bold mb-6 text-gray-900">Update Product Pricing</h2>
    
    <!-- Filter Form -->
    <div class="mb-6 bg-white rounded-lg shadow">
      <div class="p-6">
        <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label for="sku_filter" class="block text-sm font-medium text-gray-700 mb-1">SKU</label>
            <textarea
              id="sku_filter"
              bind:value={$skuFilter}
              class="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              rows="3"
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
                containerStyles="position: relative;"
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
                containerStyles="position: relative;"
              />
            {/if}
          </div>
          
          <div>
            <label for="category_filter" class="block text-sm font-medium text-gray-700 mb-1">Category</label>
            {#if $loadingCategories}
              <div class="animate-pulse bg-gray-200 h-7 rounded"></div>
            {:else if $categoryError}
              <div class="text-red-600 text-xs">{$categoryError}</div>
            {:else}
              <Select
                items={$categories}
                bind:value={$categoryFilter}
                placeholder="Select Category"
                containerStyles="position: relative;"
              />
            {/if}
          </div>
        </div>
        
        <div class="mt-4 flex justify-end space-x-4">
          <button
            class="bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            on:click={() => {
              $skuFilter = '';
              $productNameFilter = '';
              $brandFilter = null;
              $supplierFilter = null;
              $categoryFilter = null;
              $products = [...$originalProducts];
              $filteredProducts = [...$originalProducts];
            }}
          >
            Reset Filters
          </button>
          <button
            class="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            on:click={async () => {
              const result = await handleFilterSubmit({
                skuFilter: $skuFilter,
                productNameFilter: $productNameFilter,
                brandFilter: $brandFilter,
                supplierFilter: $supplierFilter,
                categoryFilter: $categoryFilter
              });
              if (result.success) {
                toastSuccess(result.message);
              } else {
                toastError(result.message);
              }
            }}
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="flex justify-between items-center sticky top-0 bg-white/80 backdrop-blur-sm py-4 z-50 border-b border-gray-200 shadow-sm">
      <button
        class="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[160px]"
        on:click={async () => {
          const result = await handleSubmitChecked();
          if (result.success) {
            toastSuccess(result.message);
          } else {
            toastError(result.message);
          }
        }}
        disabled={$selectedRows.size === 0 || $submitLoading}
      >
        {#if $submitLoading}
          <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
          Updating...
        {:else}
          Submit Checked Rows
        {/if}
      </button>
    </div>

    <!-- Products Table -->
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200 table-fixed">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[40px]">
              <input
                type="checkbox"
                bind:checked={$selectAll}
                on:change={(e) => {
                  const target = e.target as HTMLInputElement | null;
                  if (target) {
                    handleSelectAll(target.checked);
                  }
                }}
                class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </th>
            <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px]">SKU</th>
            <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[150px]">Product Name</th>
            <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[120px]">Brand</th>
            <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[120px]">Primary Supplier</th>
            <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[120px]">Category</th>
            <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px]">Purchase Price</th>
            <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px]">
              Client MUP
              <button 
                class="ml-1 text-blue-600 hover:text-blue-800 text-xs"
                on:click={applyClientMupToAll}
              >Apply All</button>
            </th>
            <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px]">
              Retail MUP
              <button 
                class="ml-1 text-blue-600 hover:text-blue-800 text-xs"
                on:click={applyRetailMupToAll}
              >Apply All</button>
            </th>
            <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px]">Client Price</th>
            <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px]">RRP</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#each $products as product (product.sku)}
            <tr class={product.updated ? 'bg-green-50' : ''}>
              <td class="px-2 py-1 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={$selectedRows.has(product.sku)}
                  on:change={(event) => {
                    const target = event.target as HTMLInputElement;
                    if (target.checked) {
                      $selectedRows = new Set([...$selectedRows, product.sku]);
                    } else {
                      $selectedRows.delete(product.sku);
                      $selectedRows = $selectedRows;
                    }
                  }}
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </td>
              <td class="px-2 py-1 text-sm break-words">{product.sku}</td>
              <td class="px-2 py-1 text-sm break-words">{product.product_name}</td>
              <td class="px-2 py-1 text-sm">
                {#if $loadingBrands}
                  <div class="animate-pulse bg-gray-200 h-7 rounded"></div>
                {:else if $brandError}
                  <div class="text-red-600 text-xs">{$brandError}</div>
                {:else}
                  <div class="relative">
                    <Select
                      items={$brands}
                      value={$brands.find(b => b.value === product.brand)}
                      placeholder="Select Brand"
                      containerStyles="position: static;"
                      on:change={(e) => {
                        product.brand = e.detail?.value || '';
                        $products = $products;
                      }}
                    />
                  </div>
                {/if}
              </td>
              <td class="px-2 py-1 text-sm">
                {#if $loadingSuppliers}
                  <div class="animate-pulse bg-gray-200 h-7 rounded"></div>
                {:else if $supplierError}
                  <div class="text-red-600 text-xs">{$supplierError}</div>
                {:else}
                  <div class="relative">
                    <Select
                      items={$suppliers}
                      value={$suppliers.find(s => s.value === product.primary_supplier)}
                      placeholder="Select Supplier"
                      containerStyles="position: static;"
                      on:change={(e) => {
                        product.primary_supplier = e.detail?.value || '';
                        $products = $products;
                      }}
                    />
                  </div>
                {/if}
              </td>
              <td class="px-2 py-1 text-sm">
                {#if $loadingCategories}
                  <div class="animate-pulse bg-gray-200 h-7 rounded"></div>
                {:else if $categoryError}
                  <div class="text-red-600 text-xs">{$categoryError}</div>
                {:else}
                  <div class="relative">
                    <Select
                      items={$categories}
                      value={$categories.find(c => c.value === product.category)}
                      placeholder="Select Category"
                      containerStyles="position: static;"
                      on:change={(e) => {
                        product.category = e.detail?.value || '';
                        $products = $products;
                      }}
                    />
                  </div>
                {/if}
              </td>
              <td class="px-2 py-1 text-sm">
                <input
                  type="number"
                  bind:value={product.purchase_price}
                  on:input={() => calculatePrices(product)}
                  class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm h-7 px-1"
                  step="0.01"
                />
              </td>
              <td class="px-2 py-1 text-sm">
                <input
                  type="number"
                  bind:value={product.client_mup}
                  on:input={() => calculatePrices(product, 'mup')}
                  class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm h-7 px-1"
                  step="0.01"
                />
              </td>
              <td class="px-2 py-1 text-sm">
                <input
                  type="number"
                  bind:value={product.retail_mup}
                  on:input={() => calculatePrices(product, 'mup')}
                  class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm h-7 px-1"
                  step="0.01"
                />
              </td>
              <td class="px-2 py-1 text-sm">
                <input
                  type="number"
                  bind:value={product.client_price}
                  on:input={() => calculatePrices(product, 'price')}
                  class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm h-7 px-1"
                  step="0.01"
                />
              </td>
              <td class="px-2 py-1 text-sm">
                <input
                  type="number"
                  bind:value={product.rrp}
                  on:input={() => calculatePrices(product, 'price')}
                  class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm h-7 px-1"
                  step="0.01"
                />
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>

<style>
</style> 