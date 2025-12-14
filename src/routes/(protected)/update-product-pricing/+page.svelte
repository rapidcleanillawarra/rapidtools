<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import Select from 'svelte-select';

  import { toastSuccess, toastError } from '$lib/utils/toast';
  import {
    products,
    originalProducts,
    filteredProducts,
    brands,
    suppliers,
    loading,
    loadingBrands,
    loadingSuppliers,
    brandError,
    supplierError,
    selectedRows,
    selectAll,
    submitLoading,
    skuFilter,
    productNameFilter,
    brandFilter,
    supplierFilter,
    applyMarkupToAll,
    fetchBrands,
    fetchSuppliers,
    fetchPriceGroups,
    fetchAllProducts,
    handleSelectAll,
    handleSubmitChecked,
    handleFilterSubmit,
    currentPage,
    itemsPerPage,
    sortField,
    sortDirection,
    getPaginatedProducts,
    getTotalPages,
    toggleRowSelected,
    updateProductBySku,
    updateProductPricingBySku
  } from './stores';
  async function handleFilterClick() {
    const result = await handleFilterSubmit({
      skuFilter: $skuFilter,
      productNameFilter: $productNameFilter,
      brandFilter: $brandFilter,
      supplierFilter: $supplierFilter
    });
    if (result.success) {
      toastSuccess(result.message);
    } else {
      toastError(result.message);
    }
  }

  async function submitCheckedRows() {
    const result = await handleSubmitChecked();
    if (result.success) toastSuccess(result.message);
    else toastError(result.message);
  }

  function onNumberInput(e: Event): number {
    const target = e.target as HTMLInputElement | null;
    if (!target) return 0;
    const n = parseFloat(target.value);
    return Number.isFinite(n) ? n : 0;
  }

  onMount(async () => {
    // Load products and reference data in parallel
    const [productsResult] = await Promise.all([
      fetchAllProducts(),
      fetchPriceGroups(),
      fetchBrands(),
      fetchSuppliers()
    ]);
    if (productsResult && !productsResult.success) {
      toastError(productsResult.message || 'Failed to load products. Please try again.');
    }
  });

  // Declare reactive variables
  let paginatedProducts: any[] = [];
  let totalPages = 0;
  let currentPageItems = {
    start: 0,
    end: 0,
    total: 0
  };

  $: totalPages = getTotalPages($products.length);
  $: paginatedProducts = getPaginatedProducts($products);
  $: {
    const total = $products.length;
    const start = total === 0 ? 0 : ($currentPage - 1) * $itemsPerPage + 1;
    const end = total === 0 ? 0 : Math.min($currentPage * $itemsPerPage, total);
    currentPageItems = { start, end, total };
  }
  $: if ($currentPage > totalPages) currentPage.set(totalPages);

  // Function to handle page change
  function handlePageChange(newPage: number) {
    if (newPage >= 1 && newPage <= totalPages) {
      currentPage.set(newPage);
      // Scroll to top of table
      document.querySelector('.overflow-x-auto')?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // Function to handle items per page change
  function handleItemsPerPageChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const value = parseInt(select.value);
    if (!isNaN(value)) {
      itemsPerPage.set(value);
      currentPage.set(1); // Reset to first page when changing items per page
    }
  }

  // Function to get sort icon
  function getSortIcon(field: string): string {
    if ($sortField !== field) return '↕️';
    return $sortDirection === 'asc' ? '↑' : '↓';
  }

  // Function to handle sorting
  function handleSortClick(field: string) {
    if ($sortField === field) {
      // If clicking the same field, toggle direction
      sortDirection.update(dir => dir === 'asc' ? 'desc' : 'asc');
    } else {
      // If clicking a new field, set it and default to asc
      sortField.set(field);
      sortDirection.set('asc');
    }
  }

  // Function to get price comparison status
  function getPriceComparisonStatus(product: any): string[] {
    const statuses: string[] = [];
    
    if (!product.purchase_price) return statuses;

    if (product.rrp) {
      const rrpRatio = (product.purchase_price / product.rrp) * 100;
      if (rrpRatio >= 85) {
        statuses.push('PP>RRP');
      }
    }

    return statuses;
  }
</script>

<div class="min-h-screen bg-gray-100 py-8 px-2 sm:px-3">
  <div class="max-w-[98%] mx-auto bg-white shadow p-6" transition:fade>
    <h2 class="text-2xl font-bold mb-6 text-gray-900">Update Product Pricing</h2>

    <div class="three-col-layout">
      <!-- Left column: filters -->
      <aside class="left-col">
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

            <div class="mt-4 flex justify-end space-x-4">
              <button
                class="bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                on:click={() => {
                  $skuFilter = '';
                  $productNameFilter = '';
                  $brandFilter = null;
                  $supplierFilter = null;
                  $products = [...$originalProducts];
                  $filteredProducts = [...$originalProducts];
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
      </aside>

      <!-- Middle column: table -->
      <section class="middle-col">

        <!-- Add items per page selector before the pagination controls -->
        <div class="mb-4 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
          <div class="flex items-center">
            <span class="mr-2 text-sm text-gray-700">Items per page:</span>
            <select
              class="rounded border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
              on:change={handleItemsPerPageChange}
              value={$itemsPerPage}
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>

          <div class="flex flex-1 justify-between sm:hidden">
            <button
              class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              on:click={() => handlePageChange($currentPage - 1)}
              disabled={$currentPage === 1}
            >
              Previous
            </button>
            <button
              class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              on:click={() => handlePageChange($currentPage + 1)}
              disabled={$currentPage === totalPages}
            >
              Next
            </button>
          </div>

          <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p class="text-sm text-gray-700">
                Showing <span class="font-medium">{currentPageItems.start}</span> to{' '}
                <span class="font-medium">{currentPageItems.end}</span> of{' '}
                <span class="font-medium">{currentPageItems.total}</span> results
              </p>
            </div>
            <div>
              <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  on:click={() => handlePageChange($currentPage - 1)}
                  disabled={$currentPage === 1}
                >
                  <span class="sr-only">Previous</span>
                  <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clip-rule="evenodd" />
                  </svg>
                </button>

                <!-- Show ellipsis and limited page numbers -->
                {#if totalPages <= 7}
                  {#each Array(totalPages) as _, i}
                    <button
                      class="relative inline-flex items-center px-4 py-2 text-sm font-semibold {$currentPage === i + 1 ? 'bg-blue-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600' : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'}"
                      on:click={() => handlePageChange(i + 1)}
                    >
                      {i + 1}
                    </button>
                  {/each}
                {:else}
                  <!-- First page -->
                  <button
                    class="relative inline-flex items-center px-4 py-2 text-sm font-semibold {$currentPage === 1 ? 'bg-blue-600 text-white' : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'}"
                    on:click={() => handlePageChange(1)}
                  >
                    1
                  </button>

                  <!-- Left ellipsis -->
                  {#if $currentPage > 3}
                    <span class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300">...</span>
                  {/if}

                  <!-- Pages around current page -->
                  {#each Array(3) as _, i}
                    {#if $currentPage - 1 + i > 1 && $currentPage - 1 + i < totalPages}
                      <button
                        class="relative inline-flex items-center px-4 py-2 text-sm font-semibold {$currentPage === $currentPage - 1 + i ? 'bg-blue-600 text-white' : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'}"
                        on:click={() => handlePageChange($currentPage - 1 + i)}
                      >
                        {$currentPage - 1 + i}
                      </button>
                    {/if}
                  {/each}

                  <!-- Right ellipsis -->
                  {#if $currentPage < totalPages - 2}
                    <span class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300">...</span>
                  {/if}

                  <!-- Last page -->
                  <button
                    class="relative inline-flex items-center px-4 py-2 text-sm font-semibold {$currentPage === totalPages ? 'bg-blue-600 text-white' : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'}"
                    on:click={() => handlePageChange(totalPages)}
                  >
                    {totalPages}
                  </button>
                {/if}

                <button
                  class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px] cursor-pointer hover:bg-gray-100"
                    on:click={() => handleSortClick('purchase_price')}
                  >
                    Purchase Price {getSortIcon('purchase_price')}
                  </th>
                  <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px]">
                    Markup
                    <button 
                      class="ml-1 text-blue-600 hover:text-blue-800 text-xs"
                      on:click={applyMarkupToAll}
                    >Apply All</button>
                  </th>
                  <th 
                    class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px] cursor-pointer hover:bg-gray-100"
                    on:click={() => handleSortClick('rrp')}
                  >
                    List Price {getSortIcon('rrp')}
                  </th>
                  <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[120px]">
                    Remove PriceGroups
                  </th>
                  <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[80px]">
                    Tax Free
                  </th>
                  <th 
                    class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px] cursor-pointer hover:bg-gray-100"
                    on:click={() => handleSortClick('updated')}
                  >
                    Status {getSortIcon('updated')}
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {#each paginatedProducts as product (product.sku)}
                  <tr class={product.updated ? 'bg-green-50' : ''} data-is-updated={product.updated ? 'true' : 'false'}>
                    <td class="px-2 py-1 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={$selectedRows.has(product.sku)}
                        on:change={(event) => {
                          const target = event.target as HTMLInputElement;
                          toggleRowSelected(product.sku, target.checked);
                        }}
                        class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td class="px-2 py-1 text-xs break-words">
                      <a href={`https://www.rapidsupplies.com.au/_cpanel/products/view?id=${product.inventory_id}`} target="_blank" class="text-blue-600 hover:underline">
                        {product.sku}
                      </a>
                    </td>
                    <td class="px-2 py-1 text-xs break-words">{product.product_name}</td>
                    <td class="px-2 py-1 text-xs">
                      <input
                        type="number"
                        value={product.purchase_price}
                        on:input={(e) => updateProductPricingBySku(product.sku, { purchase_price: onNumberInput(e) }, 'markup')}
                        class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-xs h-7 px-1"
                        step="0.01"
                      />
                    </td>
                    <td class="px-2 py-1 text-xs">
                      <input
                        type="number"
                        value={product.markup}
                        on:input={(e) => updateProductPricingBySku(product.sku, { markup: onNumberInput(e) }, 'markup')}
                        class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-xs h-7 px-1"
                        step="0.01"
                      />
                    </td>
                    <td class="px-2 py-1 text-xs">
                      <input
                        type="number"
                        value={product.rrp}
                        on:input={(e) => updateProductPricingBySku(product.sku, { rrp: onNumberInput(e) }, 'price')}
                        class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-xs h-7 px-1"
                        step="0.01"
                      />
                    </td>
                    <td class="px-2 py-1 text-xs text-center">
                      <input
                        type="checkbox"
                        checked={product.remove_pricegroups}
                        on:change={(e) => {
                          const target = e.target as HTMLInputElement;
                          updateProductBySku(product.sku, { remove_pricegroups: target.checked });
                        }}
                        class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td class="px-2 py-1 text-xs">
                      <input
                        type="checkbox"
                        checked={product.tax_free}
                        on:change={(e) => {
                          const target = e.target as HTMLInputElement;
                          updateProductBySku(product.sku, { tax_free: target.checked });
                        }}
                        class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td class="px-2 py-1 text-xs flex gap-2">
                      {#each getPriceComparisonStatus(product) as status}
                        <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${
                          status === 'PP>CP' 
                            ? 'bg-purple-900' 
                            : 'bg-red-900'
                        }`}>
                          {status}
                        </span>
                      {/each}
                      {#if product.updated}
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Updated
                        </span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
              <tfoot class="bg-gray-50">
                <tr>
                  <td colspan="9" class="px-2 py-4 text-center">
                    <button
                      class="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[160px] mx-auto"
                      on:click={submitCheckedRows}
                      disabled={$selectedRows.size === 0 || $submitLoading}
                    >
                      {#if $submitLoading}
                        <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                        Updating...
                      {:else}
                        Submit Checked Rows
                      {/if}
                    </button>
                  </td>
                </tr>
              </tfoot>
            </table>
          {/if}
        </div>

        <!-- Bottom pagination controls -->
        <div class="mt-4 flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
          <div class="flex items-center">
            <span class="mr-2 text-sm text-gray-700">Items per page:</span>
            <select
              class="rounded border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
              on:change={handleItemsPerPageChange}
              value={$itemsPerPage}
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>

          <div class="flex flex-1 justify-between sm:hidden">
            <button
              class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              on:click={() => handlePageChange($currentPage - 1)}
              disabled={$currentPage === 1}
            >
              Previous
            </button>
            <button
              class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              on:click={() => handlePageChange($currentPage + 1)}
              disabled={$currentPage === totalPages}
            >
              Next
            </button>
          </div>

          <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p class="text-sm text-gray-700">
                Showing <span class="font-medium">{currentPageItems.start}</span> to{' '}
                <span class="font-medium">{currentPageItems.end}</span> of{' '}
                <span class="font-medium">{currentPageItems.total}</span> results
              </p>
            </div>
            <div>
              <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  on:click={() => handlePageChange($currentPage - 1)}
                  disabled={$currentPage === 1}
                >
                  <span class="sr-only">Previous</span>
                  <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clip-rule="evenodd" />
                  </svg>
                </button>

                <!-- Show ellipsis and limited page numbers -->
                {#if totalPages <= 7}
                  {#each Array(totalPages) as _, i}
                    <button
                      class="relative inline-flex items-center px-4 py-2 text-sm font-semibold {$currentPage === i + 1 ? 'bg-blue-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600' : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'}"
                      on:click={() => handlePageChange(i + 1)}
                    >
                      {i + 1}
                    </button>
                  {/each}
                {:else}
                  <!-- First page -->
                  <button
                    class="relative inline-flex items-center px-4 py-2 text-sm font-semibold {$currentPage === 1 ? 'bg-blue-600 text-white' : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'}"
                    on:click={() => handlePageChange(1)}
                  >
                    1
                  </button>

                  <!-- Left ellipsis -->
                  {#if $currentPage > 3}
                    <span class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300">...</span>
                  {/if}

                  <!-- Pages around current page -->
                  {#each Array(3) as _, i}
                    {#if $currentPage - 1 + i > 1 && $currentPage - 1 + i < totalPages}
                      <button
                        class="relative inline-flex items-center px-4 py-2 text-sm font-semibold {$currentPage === $currentPage - 1 + i ? 'bg-blue-600 text-white' : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'}"
                        on:click={() => handlePageChange($currentPage - 1 + i)}
                      >
                        {$currentPage - 1 + i}
                      </button>
                    {/if}
                  {/each}

                  <!-- Right ellipsis -->
                  {#if $currentPage < totalPages - 2}
                    <span class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300">...</span>
                  {/if}

                  <!-- Last page -->
                  <button
                    class="relative inline-flex items-center px-4 py-2 text-sm font-semibold {$currentPage === totalPages ? 'bg-blue-600 text-white' : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'}"
                    on:click={() => handlePageChange(totalPages)}
                  >
                    {totalPages}
                  </button>
                {/if}

                <button
                  class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
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
      </section>

      <!-- Right column: intentionally empty (reserved) -->
      <aside class="right-col" aria-label="Reserved panel"></aside>
    </div>
  </div>
</div>

<style>
  .three-col-layout {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
    align-items: start;
  }

  @media (min-width: 1024px) {
    .three-col-layout {
      grid-template-columns: 360px minmax(0, 1fr) 320px;
    }
  }

  .left-col,
  .middle-col,
  .right-col {
    min-width: 0;
  }
</style> 