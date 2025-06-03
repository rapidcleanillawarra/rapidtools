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
    handleFilterSubmit,
    currentPage,
    itemsPerPage,
    sortField,
    sortDirection,
    getPaginatedProducts,
    getTotalPages,
    handleSort
  } from './stores';

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

  // Initialize products only on mount, not on every data change
  onMount(() => {
    console.log('Component mounted, initializing data');
    if (data?.products && Array.isArray(data.products)) {
      console.log('Setting initial products:', data.products.length);
      $originalProducts = [...data.products];
      $products = [...data.products];
      $filteredProducts = [...data.products];
    }
  });

  // Add reactive statement to log products store changes
  $: {
    console.log('Products store changed:', {
      productsLength: $products.length,
      sampleProduct: $products[0],
      allProducts: $products
    });
  }

  // Add logging to filter submit
  async function handleFilterClick() {
    console.log('Filter button clicked');
    const result = await handleFilterSubmit({
      skuFilter: $skuFilter,
      productNameFilter: $productNameFilter,
      brandFilter: $brandFilter,
      supplierFilter: $supplierFilter,
      categoryFilter: $categoryFilter
    });
    console.log('Filter result:', result);
    if (result.success) {
      toastSuccess(result.message);
    } else {
      toastError(result.message);
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

  // Add reactive statements for pagination and sorting
  $: paginatedProducts = getPaginatedProducts($products);
  $: totalPages = getTotalPages($products.length);
  
  // Add reactive statement for sort changes
  $: {
    if ($sortField !== null) {
      console.log('Sorting by:', $sortField, 'Direction:', $sortDirection);
      // Force a recalculation of paginatedProducts when sort changes
      paginatedProducts = getPaginatedProducts($products);
    }
  }

  // Function to handle page change
  function handlePageChange(newPage: number) {
    if (newPage >= 1 && newPage <= totalPages) {
      currentPage.set(newPage);
    }
  }

  // Function to get sort icon
  function getSortIcon(field: string): string {
    if ($sortField !== field) return '↕️';
    return $sortDirection === 'asc' ? '↑' : '↓';
  }

  // Function to handle sorting
  function handleSortClick(field: string) {
    console.log('Sorting by field:', field);
    handleSort(field);
  }
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
              console.log('Reset filters clicked');
              $skuFilter = '';
              $productNameFilter = '';
              $brandFilter = null;
              $supplierFilter = null;
              $categoryFilter = null;
              $products = [...$originalProducts];
              $filteredProducts = [...$originalProducts];
              console.log('After reset:', {
                productsLength: $products.length,
                filteredLength: $filteredProducts.length
              });
            }}
          >
            Reset Filters
          </button>
          <button
            class="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            on:click={handleFilterClick}
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
      {#if $loading}
        <div class="flex justify-center items-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
        </div>
      {:else if $products.length === 0}
        <div class="text-center py-8 text-gray-500">
          No products found
        </div>
      {:else}
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
              <th 
                class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px] cursor-pointer hover:bg-gray-100"
                on:click={() => handleSortClick('sku')}
              >
                SKU {getSortIcon('sku')}
              </th>
              <th 
                class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[150px] cursor-pointer hover:bg-gray-100"
                on:click={() => handleSortClick('product_name')}
              >
                Product Name {getSortIcon('product_name')}
              </th>
              <th 
                class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[120px] cursor-pointer hover:bg-gray-100"
                on:click={() => handleSortClick('brand')}
              >
                Brand {getSortIcon('brand')}
              </th>
              <th 
                class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[120px] cursor-pointer hover:bg-gray-100"
                on:click={() => handleSortClick('primary_supplier')}
              >
                Primary Supplier {getSortIcon('primary_supplier')}
              </th>
              <th 
                class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[120px] cursor-pointer hover:bg-gray-100"
                on:click={() => handleSortClick('category')}
              >
                Category {getSortIcon('category')}
              </th>
              <th 
                class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px] cursor-pointer hover:bg-gray-100"
                on:click={() => handleSortClick('purchase_price')}
              >
                Purchase Price {getSortIcon('purchase_price')}
              </th>
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
              <th 
                class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px] cursor-pointer hover:bg-gray-100"
                on:click={() => handleSortClick('client_price')}
              >
                Client Price {getSortIcon('client_price')}
              </th>
              <th 
                class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px] cursor-pointer hover:bg-gray-100"
                on:click={() => handleSortClick('rrp')}
              >
                RRP {getSortIcon('rrp')}
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#each paginatedProducts as product (product.sku)}
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
      {/if}
    </div>

    <!-- Add pagination controls after the table -->
    <div class="mt-4 flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
      <div class="flex flex-1 justify-between sm:hidden">
        <button
          class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          on:click={() => handlePageChange($currentPage - 1)}
          disabled={$currentPage === 1}
        >
          Previous
        </button>
        <button
          class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          on:click={() => handlePageChange($currentPage + 1)}
          disabled={$currentPage === totalPages}
        >
          Next
        </button>
      </div>
      <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p class="text-sm text-gray-700">
            Showing <span class="font-medium">{($currentPage - 1) * $itemsPerPage + 1}</span> to{' '}
            <span class="font-medium">{Math.min($currentPage * $itemsPerPage, $products.length)}</span> of{' '}
            <span class="font-medium">{$products.length}</span> results
          </p>
        </div>
        <div>
          <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
            <button
              class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
              on:click={() => handlePageChange($currentPage - 1)}
              disabled={$currentPage === 1}
            >
              <span class="sr-only">Previous</span>
              <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clip-rule="evenodd" />
              </svg>
            </button>
            {#each Array(totalPages) as _, i}
              <button
                class="relative inline-flex items-center px-4 py-2 text-sm font-semibold {$currentPage === i + 1 ? 'bg-blue-600 text-white' : 'text-gray-900'} ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                on:click={() => handlePageChange(i + 1)}
              >
                {i + 1}
              </button>
            {/each}
            <button
              class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
              on:click={() => handlePageChange($currentPage + 1)}
              disabled={$currentPage === totalPages}
            >
              <span class="sr-only">Next</span>
              <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
              </svg>
            </button>
          </nav>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
</style> 