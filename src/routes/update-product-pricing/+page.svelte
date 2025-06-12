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
  import type { MultiSelectOption, SelectOption } from './types';

  // Interface for Select component events
  interface SelectChangeEvent {
    detail: SelectOption | null;
  }

  // Interface for MultiSelect component events
  interface MultiSelectChangeEvent {
    detail: SelectOption[] | null;
  }

  // Store previous category selections for each product
  let previousCategorySelections = new Map<string, SelectOption[]>();
  
  // API Endpoints
  const brandsUrl = 'https://prod-06.australiasoutheast.logic.azure.com:443/workflows/58215302c1c24203886ccf481adbaac5/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=RFQ4OtbS6cyjB_JzaIsowmww4KBqPQgavWLg18znE5s';
  const suppliersUrl = 'https://prod-06.australiasoutheast.logic.azure.com:443/workflows/da5c5708146642768d63293d2bbb9668/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=-n0W0PxlF1G83xHYHGoEOhv3XmHXWlesbRk5NcgNT9w';
  const categoriesUrl = 'https://prod-47.australiasoutheast.logic.azure.com:443/workflows/0d67bc8f1bb64e78a2495f13a7498081/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=fJJzmNyuARuwEcNCoMuWwMS9kmWZQABw9kJXsUj9Wk8';
  const updatePricingUrl = 'https://prod-56.australiasoutheast.logic.azure.com:443/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=G8m_h5Dl8GpIRQtlN0oShby5zrigLKTWEddou-zGQIs';

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
      
      // Ensure all products have original_category initialized
      const productsWithOriginalCategory = data.products.map(product => {
        if (!product.original_category && product.category) {
          return {
            ...product,
            original_category: [...product.category]
          };
        }
        return product;
      });
      
      $originalProducts = [...productsWithOriginalCategory];
      $products = [...productsWithOriginalCategory];
      $filteredProducts = [...productsWithOriginalCategory];
    }
  });


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

  // Declare reactive variables
  let paginatedProducts: any[] = [];
  let totalPages = 0;
  let currentPageItems = {
    start: 0,
    end: 0,
    total: 0
  };

  // Add reactive statements for pagination and sorting
  $: {
    // Recalculate pagination and sorting
    paginatedProducts = getPaginatedProducts($products);
    totalPages = getTotalPages($products.length);
    
    // Update current page items info
    currentPageItems = {
      start: ($currentPage - 1) * $itemsPerPage + 1,
      end: Math.min($currentPage * $itemsPerPage, $products.length),
      total: $products.length
    };
    
    // Debug log to track updated products when products change
    const updatedCount = $products.filter(p => p.updated).length;
    if (updatedCount > 0) {
      console.log('DEBUG - Products with updated flag during reactive update:', updatedCount);
    }
  }

  // Watch for sort changes
  $: if ($sortField !== null || $sortDirection) {
    paginatedProducts = getPaginatedProducts($products);
  }

  // Reset to first page when products length changes
  let previousLength = $products.length;
  $: if ($products && $products.length !== previousLength) {
    previousLength = $products.length;
    currentPage.set(1);
  }

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

    // Check client price ratio
    if (product.client_price) {
      const clientRatio = (product.purchase_price / product.client_price) * 100;
      if (clientRatio >= 85) {
        statuses.push('PP>CP');
      }
    }

    // Check RRP ratio
    if (product.rrp) {
      const rrpRatio = (product.purchase_price / product.rrp) * 100;
      if (rrpRatio >= 85) {
        statuses.push('PP>RRP');
      }
    }

    return statuses;
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
                placeholder="Select Categories"
                containerStyles="position: relative;"
                searchable={true}
                multiple={true}
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
              $categoryFilter = [];
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

    <!-- Action Buttons -->
    <div class="flex justify-between items-center sticky top-0 bg-white/80 backdrop-blur-sm py-4 z-50 border-b border-gray-200 shadow-sm">
      <button
        class="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[160px]"
        on:click={async () => {
          console.log('Submit button clicked, checking category data...');
          
          // Ensure all category data is synchronized before submission
          $products = $products.map(product => {
            // Make sure category arrays are initialized properly
            if (!product.category) {
              product.category = [];
            }
            if (!product.category_name) {
              product.category_name = [];
            }
            if (!product.original_category) {
              product.original_category = product.category ? [...product.category] : [];
            }
            
            // Make sure the categories are properly formatted as arrays
            if (product.category && !Array.isArray(product.category)) {
              console.warn(`Converting non-array category to array for product ${product.sku}`);
              product.category = [product.category];
            }
            
            return product;
          });
          
          // Now submit the data with verified categories
          const result = await handleSubmitChecked();
          if (result.success) {
            console.log('DEBUG - Submission successful');
            
            // Log the first updated product in detail
            const updatedProducts = $products.filter(p => $selectedRows.has(p.sku));
            console.log('DEBUG - Number of products with updated flag:', updatedProducts.length);
            
            console.log('DEBUG - Selected rows after update:', Array.from($selectedRows));
            
            // Ensure all updated products stay marked as updated
            $products = $products.map(product => {
              if ($selectedRows.has(product.sku)) {
                const updatedProduct = { ...product, updated: true };
                console.log(`DEBUG - Setting updated=true for ${product.sku}`);
                return updatedProduct;
              }
              return product;
            });
            
            // Log the products again after ensuring they're marked as updated
            console.log('DEBUG - Products with updated flag after reassignment:', 
              $products.filter(p => p.updated).length
            );
            
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
                      if (target.checked) {
                        $selectedRows = new Set([...$selectedRows, product.sku]);
                      } else {
                        const newSet = new Set($selectedRows);
                        newSet.delete(product.sku);
                        $selectedRows = newSet;
                      }
                      console.log('Selected rows count after change:', $selectedRows.size);
                    }}
                    class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>
                <td class="px-2 py-1 text-sm break-words">
                  <a href={`https://www.rapidsupplies.com.au/_cpanel/products/view?id=${product.inventory_id}`} target="_blank" class="text-blue-600 hover:underline">
                    {product.sku}
                  </a>
                </td>
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
                        on:change={(e: SelectChangeEvent) => {
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
                        on:change={(e: SelectChangeEvent) => {
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
                        value={product.category ? $categories.filter(c => product.category.includes(c.value)) : []}
                        placeholder="Select Categories"
                        containerStyles="position: static;"
                        searchable={true}
                        multiple={true}
                        on:select={() => {
                          console.log('select event for', product.sku);
                        }}
                        on:input={(e: MultiSelectChangeEvent) => {
                          // Get current selection
                          const currentSelection = e.detail || [];
                          
                          // Get previous selection for this product
                          const prevSelection = previousCategorySelections.get(product.sku) || [];
                          
                          // Add more detailed logging
                          console.log('Category change detected:', {
                            sku: product.sku,
                            productName: product.product_name,
                            previousSelection: prevSelection.map(item => `${item.label} (${item.value})`),
                            currentSelection: currentSelection.map(item => `${item.label} (${item.value})`),
                            changeType: prevSelection.length > currentSelection.length ? 'Item removed' : 
                                       prevSelection.length < currentSelection.length ? 'Item added' : 'Items reordered'
                          });
                          
                          // Find removed items by comparing previous with current
                          const removedItems = prevSelection.filter(
                            (prev: SelectOption) => !currentSelection.some((curr: SelectOption) => curr.value === prev.value)
                          );
                          
                          // If exactly one item was removed, log which one it was
                          if (removedItems.length === 1) {
                            const removedItem = removedItems[0];
                            console.log('Item removed:', {
                              item: removedItem.label,
                              value: removedItem.value,
                              method: 'User clicked X button or used backspace/delete key'
                            });
                            // You can add specific logic here for when an item is removed
                          }
                          
                          // Find added items
                          const addedItems = currentSelection.filter(
                            (curr: SelectOption) => !prevSelection.some((prev: SelectOption) => prev.value === curr.value)
                          );
                          
                          // If items were added, log them
                          if (addedItems.length > 0) {
                            console.log('Items added:', addedItems.map(item => ({
                              item: item.label,
                              value: item.value
                            })));
                          }
                          
                          // Ensure original_category is initialized if it doesn't exist
                          if (!product.original_category) {
                            product.original_category = product.category ? [...product.category] : [];
                          }
                          
                          // Update the current categories
                          product.category = e.detail ? e.detail.map((item: SelectOption) => item.value) : [];
                          
                          // Find and set the category names when category IDs change
                          if (e.detail && e.detail.length) {
                            product.category_name = e.detail.map((item: SelectOption) => item.label);
                          } else {
                            product.category_name = [];
                          }
                          
                          // Store current selection as previous for next change
                          previousCategorySelections.set(product.sku, [...currentSelection]);
                          
                          $products = $products;
                        }}
                      />
                      <!-- Display selected categories as badges/tags -->
                      {#if product.category && product.category.length > 0}
                        <div class="mt-1 flex flex-wrap gap-1">
                          {#each product.category_name as catName, idx}
                            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              {catName}
                            </span>
                          {/each}
                        </div>
                      {/if}
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
                <td class="px-2 py-1 text-sm flex gap-2">
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
        </table>
      {/if}
    </div>

    <!-- Add items per page selector before the pagination controls -->
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
  </div>
</div>

<style>
</style> 