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
    paginatedData
  } from './stores';
  import { getSortIcon, sortData } from './utils';
  import type { ProductInfo } from './types';
  import BrandDropdown from './BrandDropdown.svelte';
  import ToastContainer from '$lib/components/ToastContainer.svelte';
  import { toastSuccess, toastError } from '$lib/utils/toast';

  let selectedBrandValue = '';
  let isTableLoading = false;

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
    <div class="max-w-md">
      <label for="brand-select" class="block text-sm font-medium text-gray-700 mb-2">
        Select Brand
      </label>
      <BrandDropdown
        id="brand-select"
        placeholder="Search brands..."
        value={selectedBrandValue}
        on:select={handleBrandSelect}
        on:clear={handleBrandClear}
      />
      <p class="mt-2 text-sm text-gray-500">
        {#if $selectedBrand}
          Showing products for brand: <strong>{$selectedBrand}</strong>
        {:else}
          Showing all products
        {/if}
      </p>
    </div>
  </div>

  <!-- Products Table -->
  <div class="bg-white rounded-lg shadow overflow-hidden">
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div class="flex flex-col gap-2">
                <div class="cursor-pointer" on:click={() => handleSortClick('image')}>
                  Image {getSortIcon('image', $sortField, $sortDirection)}
                </div>
              </div>
            </th>
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
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div class="flex flex-col gap-2">
                <div class="cursor-pointer" on:click={() => handleSortClick('subtitle')}>
                  Subtitle {getSortIcon('subtitle', $sortField, $sortDirection)}
                </div>
              </div>
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div class="flex flex-col gap-2">
                <div class="cursor-pointer" on:click={() => handleSortClick('brand')}>
                  Brand {getSortIcon('brand', $sortField, $sortDirection)}
                </div>
              </div>
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div class="flex flex-col gap-2">
                <div class="cursor-pointer" on:click={() => handleSortClick('description')}>
                  Description {getSortIcon('description', $sortField, $sortDirection)}
                </div>
              </div>
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div class="flex flex-col gap-2">
                <div class="cursor-pointer" on:click={() => handleSortClick('short_description')}>
                  Short Description {getSortIcon('short_description', $sortField, $sortDirection)}
                </div>
              </div>
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div class="flex flex-col gap-2">
                <div class="cursor-pointer" on:click={() => handleSortClick('specifications')}>
                  Specifications {getSortIcon('specifications', $sortField, $sortDirection)}
                </div>
              </div>
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div class="flex flex-col gap-2">
                <div class="cursor-pointer" on:click={() => handleSortClick('features')}>
                  Features {getSortIcon('features', $sortField, $sortDirection)}
                </div>
              </div>
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div class="flex flex-col gap-2">
                <div class="cursor-pointer" on:click={() => handleSortClick('category_1')}>
                  Category 1 {getSortIcon('category_1', $sortField, $sortDirection)}
                </div>
              </div>
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div class="flex flex-col gap-2">
                <div class="cursor-pointer" on:click={() => handleSortClick('category_2')}>
                  Category 2 {getSortIcon('category_2', $sortField, $sortDirection)}
                </div>
              </div>
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div class="flex flex-col gap-2">
                <div class="cursor-pointer" on:click={() => handleSortClick('seo_page_title')}>
                  SEO Page Title {getSortIcon('seo_page_title', $sortField, $sortDirection)}
                </div>
              </div>
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div class="flex flex-col gap-2">
                <div class="cursor-pointer" on:click={() => handleSortClick('seo_meta_description')}>
                  SEO Meta Description {getSortIcon('seo_meta_description', $sortField, $sortDirection)}
                </div>
              </div>
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div class="flex flex-col gap-2">
                <div class="cursor-pointer" on:click={() => handleSortClick('seo_page_heading')}>
                  SEO Page Heading {getSortIcon('seo_page_heading', $sortField, $sortDirection)}
                </div>
              </div>
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#if $isLoading || isTableLoading}
            <tr>
              <td colspan="15" class="px-6 py-4 text-center">
                <div class="flex items-center justify-center">
                  <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                  <span class="ml-2">Loading products...</span>
                </div>
              </td>
            </tr>
          {:else if $paginatedData.length === 0}
            <tr>
              <td colspan="15" class="px-6 py-4 text-center text-gray-500">
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
                <td class="px-6 py-4 whitespace-nowrap">
                  {#if product.image}
                    <img src={product.image} alt={product.name} class="h-12 w-12 rounded-lg object-cover" />
                  {:else}
                    <div class="h-12 w-12 rounded-lg bg-gray-200 flex items-center justify-center">
                      <span class="text-xs text-gray-500">No img</span>
                    </div>
                  {/if}
                </td>
                <td class="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{product.sku}</td>
                <td class="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{product.name}</td>
                <td class="px-6 py-4 whitespace-nowrap text-gray-500">{product.subtitle || '-'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-gray-500">{product.brand}</td>
                <td class="px-6 py-4 text-gray-500 max-w-xs truncate" title={product.description}>
                  {product.description || '-'}
                </td>
                <td class="px-6 py-4 text-gray-500 max-w-xs truncate" title={product.short_description}>
                  {product.short_description || '-'}
                </td>
                <td class="px-6 py-4 text-gray-500 max-w-xs truncate" title={product.specifications}>
                  {product.specifications || '-'}
                </td>
                <td class="px-6 py-4 text-gray-500 max-w-xs truncate" title={product.features}>
                  {product.features || '-'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-gray-500">{product.category_1 || '-'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-gray-500">{product.category_2 || '-'}</td>
                <td class="px-6 py-4 text-gray-500 max-w-xs truncate" title={product.seo_page_title}>
                  {product.seo_page_title || '-'}
                </td>
                <td class="px-6 py-4 text-gray-500 max-w-xs truncate" title={product.seo_meta_description}>
                  {product.seo_meta_description || '-'}
                </td>
                <td class="px-6 py-4 text-gray-500 max-w-xs truncate" title={product.seo_page_heading}>
                  {product.seo_page_heading || '-'}
                </td>
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
