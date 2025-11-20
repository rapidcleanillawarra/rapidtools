<script lang="ts">
  import { onMount } from 'svelte';
  import {
    originalData,
    tableData,
    isLoading,
    currentPage,
    itemsPerPage,
    sortField,
    sortDirection,
    searchFilters,
    selectedBrand,
    visibleColumns,
    paginatedData
  } from './stores';
  import { getSortIcon, sortData } from './utils';
  import type { ProductInfo } from './types';
  import BrandDropdown from './BrandDropdown.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import ToastContainer from '$lib/components/ToastContainer.svelte';
  import { toastSuccess, toastError } from '$lib/utils/toast';

  let selectedBrandValue = '';
  let isTableLoading = false;
  let showProgressModal = false;
  let loadingProgress = {
    currentPage: 0,
    totalProducts: 0,
    estimatedTotal: 0,
    progress: 0
  };

  // Column configuration - single source of truth
  type ColumnConfig = {
    key: keyof ProductInfo;
    displayName: string;
    pillName: string;
    hasSearch: boolean;
    renderType: 'text' | 'image' | 'boolean-icon';
  };

  const columns: ColumnConfig[] = [
    { key: 'image', displayName: 'Img', pillName: 'Image', hasSearch: false, renderType: 'image' },
    { key: 'sku', displayName: 'SKU', pillName: 'SKU', hasSearch: true, renderType: 'text' },
    { key: 'name', displayName: 'Name', pillName: 'Name', hasSearch: true, renderType: 'text' },
    { key: 'brand', displayName: 'Brand', pillName: 'Brand', hasSearch: true, renderType: 'text' },
    { key: 'category_1', displayName: 'Categories', pillName: 'Categories', hasSearch: true, renderType: 'text' },
    { key: 'subtitle', displayName: 'Sub', pillName: 'Subtitle', hasSearch: false, renderType: 'boolean-icon' },
    { key: 'description', displayName: 'Desc', pillName: 'Description', hasSearch: false, renderType: 'boolean-icon' },
    { key: 'short_description', displayName: 'SD', pillName: 'Short Description', hasSearch: false, renderType: 'boolean-icon' },
    { key: 'specifications', displayName: 'Specs', pillName: 'Specifications', hasSearch: false, renderType: 'boolean-icon' },
    { key: 'features', displayName: 'Feat', pillName: 'Features', hasSearch: false, renderType: 'boolean-icon' },
    { key: 'seo_page_title', displayName: 'SEO Title', pillName: 'SEO Page Title', hasSearch: false, renderType: 'boolean-icon' },
    { key: 'seo_meta_description', displayName: 'SEO Desc', pillName: 'SEO Meta Description', hasSearch: false, renderType: 'boolean-icon' },
    { key: 'seo_page_heading', displayName: 'SEO Head', pillName: 'SEO Page Heading', hasSearch: false, renderType: 'boolean-icon' },
  ];

  // Computed visible columns
  $: visibleColumnsList = columns.filter(col => $visibleColumns[col.key]);

  // Handler for clicking a table header to sort
  function handleSortClick(field: keyof ProductInfo) {
    const currentField = $sortField;
    const currentDirection = $sortDirection;

    let newDirection: 'asc' | 'desc' = 'asc';
    if (currentField === field && currentDirection === 'asc') {
      newDirection = 'desc';
    }

    sortField.set(field);
    sortDirection.set(newDirection);
    $tableData = sortData($tableData, field, newDirection);
  }

  // Handle brand selection
  function handleBrandSelect(event: CustomEvent) {
    const brand = event.detail.brand;
    selectedBrand.set(brand.name);
    selectedBrandValue = brand.name;
    loadProducts(brand.name);
  }

  // Handle brand clear
  function handleBrandClear() {
    selectedBrand.set('');
    selectedBrandValue = '';
    originalData.set([]);
    tableData.set([]);
  }

  // Load products by brand with pagination
  async function loadProducts(brandName?: string) {
    try {
      isTableLoading = true;
      isLoading.set(true);
      showProgressModal = true;

      // Initialize progress tracking
      loadingProgress = {
        currentPage: 0,
        totalProducts: 0,
        estimatedTotal: 0,
        progress: 0
      };

      let allProducts: any[] = [];
      let page = 0;
      let hasMorePages = true;
      let totalEstimated = 0;

      while (hasMorePages) {
        // Update progress for current page
        loadingProgress = {
          ...loadingProgress,
          currentPage: page + 1
        };

        const url = brandName
          ? `/api/products?brand=${encodeURIComponent(brandName)}&page=${page}`
          : `/api/products?page=${page}`;

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error('Failed to load products');
        }

        const result = await response.json();

        if (result.success) {
          const pageProducts = result.data;
          allProducts = allProducts.concat(pageProducts);

          // Update progress
          loadingProgress = {
            ...loadingProgress,
            totalProducts: allProducts.length,
            progress: Math.min(90, (allProducts.length / (allProducts.length + 100)) * 100) // Estimate progress
          };

          // If we got fewer than 100 products, this is the last page
          if (pageProducts.length < 100) {
            hasMorePages = false;
            // Final progress update
            loadingProgress = {
              ...loadingProgress,
              progress: 100
            };
          } else {
            page++;
          }
        } else {
          throw new Error('Failed to load products');
        }
      }

      originalData.set(allProducts);
      tableData.set(allProducts);
      toastSuccess(`Loaded ${allProducts.length} products successfully`);
    } catch (error) {
      console.error('Error loading products:', error);
      toastError('Failed to load products');
      originalData.set([]);
      tableData.set([]);
    } finally {
      isTableLoading = false;
      isLoading.set(false);
      showProgressModal = false;
    }
  }

  // Reactive statement to handle searching
  $: {
    let filtered = $originalData;
    for (const [key, value] of Object.entries($searchFilters)) {
      if (value) {
        filtered = filtered.filter(item =>
          String(item[key as keyof ProductInfo]).toLowerCase().includes(value.toLowerCase())
        );
      }
    }
    tableData.set(filtered);
    currentPage.set(1);
  }

  // Toggle column visibility
  function toggleColumnVisibility(column: keyof ProductInfo) {
    visibleColumns.update(current => ({
      ...current,
      [column]: !current[column]
    }));
  }

  // Render cell content based on type
  function getCellContent(product: ProductInfo, column: ColumnConfig) {
    const value = product[column.key];
    
    if (column.renderType === 'text') {
      if (column.key === 'category_1') {
        return value || '-';
      }
      return value;
    }
    
    return value; // For image and boolean-icon, handled in template
  }

  // Export table data to CSV
  function exportToCSV(includeAllColumns = false) {
    if ($tableData.length === 0) {
      toastError('No data to export');
      return;
    }

    // Get columns to export (visible only or all)
    const columnsToExport = includeAllColumns
      ? columns
      : columns.filter(col => $visibleColumns[col.key]);

    // Create CSV headers
    const headers = columnsToExport.map(col => `"${col.displayName}"`);

    // Create CSV rows
    const rows = $tableData.map(product => 
      columnsToExport.map(col => {
        const value = product[col.key];
        const stringValue = value == null ? '' : String(value);
        return `"${stringValue.replace(/"/g, '""')}"`;
      })
    );

    // Combine headers and rows
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const filenameSuffix = includeAllColumns ? 'all-columns' : 'visible-columns';
    link.setAttribute('download', `product-information-${$selectedBrand || 'all'}-${filenameSuffix}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toastSuccess(`Exported ${$tableData.length} products (${includeAllColumns ? 'all columns' : 'visible columns only'}) to CSV`);
  }

  // Products will be loaded when user selects a brand or clicks "Apply Filter"
</script>

<ToastContainer />

<!-- Progress Modal -->
<Modal show={showProgressModal} size="md" allowClose={false}>
  <div slot="header" class="flex items-center">
    <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-3"></div>
    Loading Products
  </div>
  <div slot="body" class="space-y-4">
    <div class="text-center">
      <div class="text-sm text-gray-600 mb-2">
        Loading page {loadingProgress.currentPage}
      </div>
      <div class="text-lg font-semibold text-gray-900">
        {loadingProgress.totalProducts} products loaded
      </div>
    </div>

    <div class="text-center text-xs text-gray-400">
      Please wait while we fetch all products...
    </div>
  </div>
</Modal>

<div class="container mx-auto p-4">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-2xl font-bold">Product Information Update</h1>
  </div>

  <!-- Brand Selection -->
  <div class="bg-white rounded-lg shadow p-6 mb-6">
    <div class="flex gap-4">
      <div class="flex-1 max-w-lg">
        <label for="brand-select" class="block text-sm font-medium text-gray-700 mb-2">
          Select Brand
        </label>
        <div class="flex gap-4">
          <div class="flex-1">
            <BrandDropdown
              id="brand-select"
              placeholder="Search brands..."
              value={selectedBrandValue}
              on:select={handleBrandSelect}
              on:clear={handleBrandClear}
            />
          </div>
          <button
            type="button"
            class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-1 px-2 rounded-lg shadow-sm transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap text-xs"
            on:click={() => {
              if ($selectedBrand) {
                loadProducts($selectedBrand);
              } else {
                loadProducts();
              }
            }}
            disabled={isTableLoading}
          >
            {#if isTableLoading}
              <div class="flex items-center">
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Loading...
              </div>
            {:else}
              Apply Filter
            {/if}
          </button>
          <button
            type="button"
            class="bg-green-600 hover:bg-green-700 text-white font-medium py-1 px-2 rounded-lg shadow-sm transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap text-xs"
            on:click={() => exportToCSV(false)}
            disabled={$tableData.length === 0}
          >
            Export Visible CSV
          </button>
          <button
            type="button"
            class="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-1 px-2 rounded-lg shadow-sm transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap text-xs"
            on:click={() => exportToCSV(true)}
            disabled={$tableData.length === 0}
          >
            Export All CSV
          </button>
        </div>
        <p class="mt-2 text-sm text-gray-500">
          {#if $selectedBrand}
            Showing products for brand: <strong>{$selectedBrand}</strong>
          {:else}
            Showing all products
          {/if}
        </p>
      </div>
    </div>
  </div>

  <!-- Column Visibility Controls -->
  <div class="bg-white rounded-lg shadow p-6 mb-6">
    <h3 class="text-lg font-medium text-gray-900 mb-4">Show/Hide Columns</h3>
    <div class="flex flex-wrap gap-2">
      {#each columns as column}
        <button
          class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium transition-colors duration-200 {$visibleColumns[column.key]
            ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }"
          on:click={() => toggleColumnVisibility(column.key)}
        >
          {column.pillName}
          {#if $visibleColumns[column.key]}
            <svg class="ml-1 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
            </svg>
          {/if}
        </button>
      {/each}
    </div>
    <p class="mt-2 text-sm text-gray-500">
      Click on column names above to show or hide them in the table below.
    </p>
  </div>

  <!-- Products Table -->
  <div class="bg-white rounded-lg shadow overflow-hidden">
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            {#each visibleColumnsList as column (column.key)}
              <th scope="col" class="px-2 py-1 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                <div class="flex flex-col gap-2">
                  <button
                    type="button"
                    class="cursor-pointer text-left hover:text-gray-700 transition-colors"
                    on:click={() => handleSortClick(column.key)}
                  >
                    {column.displayName} {getSortIcon(column.key, $sortField, $sortDirection)}
                  </button>
                  {#if column.hasSearch}
                    <input
                      type="text"
                      placeholder="Search {column.displayName}..."
                      class="border rounded px-1 py-0.5 text-[10px]"
                      bind:value={$searchFilters[column.key]}
                    />
                  {/if}
                </div>
              </th>
            {/each}
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#if $isLoading || isTableLoading}
            <tr>
              <td colspan={visibleColumnsList.length} class="px-2 py-2 text-center">
                <div class="flex items-center justify-center">
                  <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                  <span class="ml-2">Loading products...</span>
                </div>
              </td>
            </tr>
          {:else if $paginatedData.length === 0}
            <tr>
              <td colspan={visibleColumnsList.length} class="px-2 py-2 text-center text-gray-500">
                {#if $originalData.length === 0}
                  No products found. Select a brand to load products.
                {:else}
                  No products match your search criteria.
                {/if}
              </td>
            </tr>
          {:else}
            {#each $paginatedData as product (product.id)}
              <tr class="hover:bg-gray-50">
                {#each visibleColumnsList as column (column.key)}
                  {#if column.renderType === 'image'}
                    <td class="px-2 py-2 whitespace-nowrap">
                      {#if product.image}
                        <img src={product.image} alt={product.name} class="h-10 w-10 rounded-lg object-cover" />
                      {:else}
                        <div class="h-10 w-10 rounded-lg bg-gray-200 flex items-center justify-center">
                          <span class="text-xs text-gray-500">No img</span>
                        </div>
                      {/if}
                    </td>
                  {:else if column.renderType === 'boolean-icon'}
                    <td class="px-2 py-2 text-center" title={product[column.key]}>
                      {#if product[column.key]}
                        <svg class="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
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

    <!-- Pagination -->
    <div class="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
      <div class="flex items-center gap-2">
        <span class="text-xs text-gray-700">Show</span>
        <select
          bind:value={$itemsPerPage}
          class="border rounded px-1 py-0.5 text-xs"
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <span class="text-xs text-gray-700">entries</span>
      </div>

      <div class="flex items-center gap-2">
        <button
          class="relative inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
          on:click={() => currentPage.update(p => Math.max(1, p - 1))}
          disabled={$currentPage === 1}
        >
          Previous
        </button>
        <span class="text-xs text-gray-700">Page {$currentPage}</span>
        <button
          class="relative inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
          on:click={() => currentPage.update(p => p + 1)}
          disabled={$paginatedData.length < $itemsPerPage}
        >
          Next
        </button>
      </div>
    </div>
  </div>
</div>
