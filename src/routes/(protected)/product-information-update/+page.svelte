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
  import ToastContainer from '$lib/components/ToastContainer.svelte';
  import { toastSuccess, toastError } from '$lib/utils/toast';

  let selectedBrandValue = '';
  let isTableLoading = false;

  // Column display names for the UI
  const columnDisplayNames: Record<keyof ProductInfo, string> = {
    id: 'ID',
    image: 'Image',
    sku: 'SKU',
    name: 'Name',
    subtitle: 'Subtitle',
    brand: 'Brand',
    description: 'Description',
    short_description: 'Short Description',
    specifications: 'Specifications',
    features: 'Features',
    category_1: 'Category 1',
    category_2: 'Category 2',
    seo_page_title: 'SEO Page Title',
    seo_meta_description: 'SEO Meta Description',
    seo_page_heading: 'SEO Page Heading',
  };

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

  // Load products by brand
  async function loadProducts(brandName?: string) {
    try {
      isTableLoading = true;
      isLoading.set(true);

      const url = brandName ? `/api/products?brand=${encodeURIComponent(brandName)}` : '/api/products';
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to load products');
      }

      const result = await response.json();

      if (result.success) {
        originalData.set(result.data);
        tableData.set(result.data);
        toastSuccess(`Loaded ${result.data.length} products successfully`);
      } else {
        throw new Error('Failed to load products');
      }
    } catch (error) {
      console.error('Error loading products:', error);
      toastError('Failed to load products');
      originalData.set([]);
      tableData.set([]);
    } finally {
      isTableLoading = false;
      isLoading.set(false);
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

  // Calculate visible column count for colspan
  $: visibleColumnCount = Object.values($visibleColumns).filter(Boolean).length;

  // Toggle column visibility
  function toggleColumnVisibility(column: keyof ProductInfo) {
    visibleColumns.update(current => ({
      ...current,
      [column]: !current[column]
    }));
  }

  // Export table data to CSV
  function exportToCSV(includeAllColumns = false) {
    if ($tableData.length === 0) {
      toastError('No data to export');
      return;
    }

    // Get columns to export (visible only or all)
    const columnKeys = includeAllColumns
      ? Object.keys(columnDisplayNames) as (keyof ProductInfo)[]
      : Object.entries($visibleColumns)
          .filter(([_, visible]) => visible)
          .map(([key, _]) => key as keyof ProductInfo);

    // Create CSV headers
    const headers = columnKeys.map(key => `"${columnDisplayNames[key]}"`);

    // Create CSV rows
    const rows = $tableData.map(product => {
      return columnKeys.map(key => {
        const value = product[key];
        // Handle null/undefined values and escape quotes
        const stringValue = value == null ? '' : String(value);
        // Escape quotes by doubling them and wrap in quotes
        return `"${stringValue.replace(/"/g, '""')}"`;
      });
    });

    // Combine headers and rows
    const csvContent = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');

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

  // Load all products on mount
  onMount(() => {
    loadProducts();
  });
</script>

<ToastContainer />

<div class="container mx-auto p-4">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-2xl font-bold">Product Information Update</h1>
  </div>

  <!-- Brand Selection -->
  <div class="bg-white rounded-lg shadow p-6 mb-6">
    <div class="flex gap-4">
      <div class="flex-1 max-w-md">
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
            class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg shadow-sm transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap"
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
              Load Products
            {/if}
          </button>
          <button
            type="button"
            class="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg shadow-sm transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap"
            on:click={() => exportToCSV(false)}
            disabled={$tableData.length === 0}
          >
            Export Visible CSV
          </button>
          <button
            type="button"
            class="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg shadow-sm transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap"
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
      {#each Object.entries(columnDisplayNames) as [columnKey, displayName]}
        {@const column = columnKey as keyof ProductInfo}
        {#if column !== 'id'}
          <button
            class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200 {($visibleColumns)[column]
              ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }"
            on:click={() => toggleColumnVisibility(column)}
          >
            {displayName}
            {#if ($visibleColumns)[column]}
              <svg class="ml-1 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
              </svg>
            {/if}
          </button>
        {/if}
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
            {#if $visibleColumns.image}
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div class="flex flex-col gap-2">
                  <div class="cursor-pointer" on:click={() => handleSortClick('image')}>
                    Image {getSortIcon('image', $sortField, $sortDirection)}
                  </div>
                </div>
              </th>
            {/if}
            {#if $visibleColumns.sku}
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div class="flex flex-col gap-2">
                  <div class="cursor-pointer" on:click={() => handleSortClick('sku')}>
                    SKU {getSortIcon('sku', $sortField, $sortDirection)}
                  </div>
                  <input
                    type="text"
                    placeholder="Search SKU..."
                    class="border rounded px-2 py-1 text-xs"
                    bind:value={$searchFilters.sku}
                  />
                </div>
              </th>
            {/if}
            {#if $visibleColumns.name}
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div class="flex flex-col gap-2">
                  <div class="cursor-pointer" on:click={() => handleSortClick('name')}>
                    Name {getSortIcon('name', $sortField, $sortDirection)}
                  </div>
                  <input
                    type="text"
                    placeholder="Search Name..."
                    class="border rounded px-2 py-1 text-xs"
                    bind:value={$searchFilters.name}
                  />
                </div>
              </th>
            {/if}
            {#if $visibleColumns.subtitle}
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div class="flex flex-col gap-2">
                  <div class="cursor-pointer" on:click={() => handleSortClick('subtitle')}>
                    Subtitle {getSortIcon('subtitle', $sortField, $sortDirection)}
                  </div>
                </div>
              </th>
            {/if}
            {#if $visibleColumns.brand}
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div class="flex flex-col gap-2">
                  <div class="cursor-pointer" on:click={() => handleSortClick('brand')}>
                    Brand {getSortIcon('brand', $sortField, $sortDirection)}
                  </div>
                </div>
              </th>
            {/if}
            {#if $visibleColumns.description}
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div class="flex flex-col gap-2">
                  <div class="cursor-pointer" on:click={() => handleSortClick('short_description')}>
                    Short Description {getSortIcon('short_description', $sortField, $sortDirection)}
                  </div>
                </div>
              </th>
            {/if}
            {#if $visibleColumns.short_description}
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div class="flex flex-col gap-2">
                  <div class="cursor-pointer" on:click={() => handleSortClick('short_description')}>
                    Short Description {getSortIcon('short_description', $sortField, $sortDirection)}
                  </div>
                </div>
              </th>
            {/if}
            {#if $visibleColumns.specifications}
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div class="flex flex-col gap-2">
                  <div class="cursor-pointer" on:click={() => handleSortClick('specifications')}>
                    Specifications {getSortIcon('specifications', $sortField, $sortDirection)}
                  </div>
                </div>
              </th>
            {/if}
            {#if $visibleColumns.features}
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div class="flex flex-col gap-2">
                  <div class="cursor-pointer" on:click={() => handleSortClick('features')}>
                    Features {getSortIcon('features', $sortField, $sortDirection)}
                  </div>
                </div>
              </th>
            {/if}
            {#if $visibleColumns.category_1}
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div class="flex flex-col gap-2">
                  <div class="cursor-pointer" on:click={() => handleSortClick('category_1')}>
                    Category 1 {getSortIcon('category_1', $sortField, $sortDirection)}
                  </div>
                </div>
              </th>
            {/if}
            {#if $visibleColumns.category_2}
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div class="flex flex-col gap-2">
                  <div class="cursor-pointer" on:click={() => handleSortClick('category_2')}>
                    Category 2 {getSortIcon('category_2', $sortField, $sortDirection)}
                  </div>
                </div>
              </th>
            {/if}
            {#if $visibleColumns.seo_page_title}
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div class="flex flex-col gap-2">
                  <div class="cursor-pointer" on:click={() => handleSortClick('seo_page_title')}>
                    SEO Page Title {getSortIcon('seo_page_title', $sortField, $sortDirection)}
                  </div>
                </div>
              </th>
            {/if}
            {#if $visibleColumns.seo_meta_description}
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div class="flex flex-col gap-2">
                  <div class="cursor-pointer" on:click={() => handleSortClick('seo_meta_description')}>
                    SEO Meta Description {getSortIcon('seo_meta_description', $sortField, $sortDirection)}
                  </div>
                </div>
              </th>
            {/if}
            {#if $visibleColumns.seo_page_heading}
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div class="flex flex-col gap-2">
                  <div class="cursor-pointer" on:click={() => handleSortClick('seo_page_heading')}>
                    SEO Page Heading {getSortIcon('seo_page_heading', $sortField, $sortDirection)}
                  </div>
                </div>
              </th>
            {/if}
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#if $isLoading || isTableLoading}
            <tr>
              <td colspan={visibleColumnCount} class="px-6 py-4 text-center">
                <div class="flex items-center justify-center">
                  <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                  <span class="ml-2">Loading products...</span>
                </div>
              </td>
            </tr>
          {:else if $paginatedData.length === 0}
            <tr>
              <td colspan={visibleColumnCount} class="px-6 py-4 text-center text-gray-500">
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
                {#if $visibleColumns.image}
                  <td class="px-6 py-4 whitespace-nowrap">
                    {#if product.image}
                      <img src={product.image} alt={product.name} class="h-12 w-12 rounded-lg object-cover" />
                    {:else}
                      <div class="h-12 w-12 rounded-lg bg-gray-200 flex items-center justify-center">
                        <span class="text-xs text-gray-500">No img</span>
                      </div>
                    {/if}
                  </td>
                {/if}
                {#if $visibleColumns.sku}
                  <td class="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{product.sku}</td>
                {/if}
                {#if $visibleColumns.name}
                  <td class="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{product.name}</td>
                {/if}
                {#if $visibleColumns.subtitle}
                  <td class="px-6 py-4 whitespace-nowrap text-gray-500">{product.subtitle || '-'}</td>
                {/if}
                {#if $visibleColumns.brand}
                  <td class="px-6 py-4 whitespace-nowrap text-gray-500">{product.brand}</td>
                {/if}
                {#if $visibleColumns.description}
                  <td class="px-6 py-4 text-gray-500 max-w-xs truncate" title={product.description}>
                    {product.description || '-'}
                  </td>
                {/if}
                {#if $visibleColumns.short_description}
                  <td class="px-6 py-4 text-gray-500 max-w-xs truncate" title={product.short_description}>
                    {product.short_description || '-'}
                  </td>
                {/if}
                {#if $visibleColumns.specifications}
                  <td class="px-6 py-4 text-gray-500 max-w-xs truncate" title={product.specifications}>
                    {product.specifications || '-'}
                  </td>
                {/if}
                {#if $visibleColumns.features}
                  <td class="px-6 py-4 text-gray-500 max-w-xs truncate" title={product.features}>
                    {product.features || '-'}
                  </td>
                {/if}
                {#if $visibleColumns.category_1}
                  <td class="px-6 py-4 whitespace-nowrap text-gray-500">{product.category_1 || '-'}</td>
                {/if}
                {#if $visibleColumns.category_2}
                  <td class="px-6 py-4 whitespace-nowrap text-gray-500">{product.category_2 || '-'}</td>
                {/if}
                {#if $visibleColumns.seo_page_title}
                  <td class="px-6 py-4 text-gray-500 max-w-xs truncate" title={product.seo_page_title}>
                    {product.seo_page_title || '-'}
                  </td>
                {/if}
                {#if $visibleColumns.seo_meta_description}
                  <td class="px-6 py-4 text-gray-500 max-w-xs truncate" title={product.seo_meta_description}>
                    {product.seo_meta_description || '-'}
                  </td>
                {/if}
                {#if $visibleColumns.seo_page_heading}
                  <td class="px-6 py-4 text-gray-500 max-w-xs truncate" title={product.seo_page_heading}>
                    {product.seo_page_heading || '-'}
                  </td>
                {/if}
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div class="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
      <div class="flex items-center gap-2">
        <span class="text-sm text-gray-700">Show</span>
        <select
          bind:value={$itemsPerPage}
          class="border rounded px-2 py-1 text-sm"
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <span class="text-sm text-gray-700">entries</span>
      </div>

      <div class="flex items-center gap-2">
        <button
          class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
          on:click={() => currentPage.update(p => Math.max(1, p - 1))}
          disabled={$currentPage === 1}
        >
          Previous
        </button>
        <span class="text-sm text-gray-700">Page {$currentPage}</span>
        <button
          class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
          on:click={() => currentPage.update(p => p + 1)}
          disabled={$paginatedData.length < $itemsPerPage}
        >
          Next
        </button>
      </div>
    </div>
  </div>
</div>
