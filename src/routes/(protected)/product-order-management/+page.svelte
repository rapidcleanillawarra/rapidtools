<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import ToastContainer from '$lib/components/ToastContainer.svelte';
  import { toastSuccess, toastError } from '$lib/utils/toast';
  import { disableProduct, fetchDisabledProducts } from './services';
  import type { ProductDisableFormData } from './types';
  import { emptyProductDisableForm } from './types';
  import {
    originalData,
    tableData,
    isLoading,
    tableError,
    currentPage,
    itemsPerPage,
    sortField,
    sortDirection,
    searchQuery,
    paginatedData,
    totalPages
  } from './stores';
  import { getSortIcon, sortData, formatDate } from './utils';
  import type { DisabledProduct } from './types';
  import type { SortField } from './stores';

  // State
  let loading = false;
  let error = '';

  let isSubmitting = false;

  // Form state
  let productFormData: ProductDisableFormData = { ...emptyProductDisableForm };

  async function loadDisabledProducts() {
    isLoading.set(true);
    tableError.set(null);
    try {
      const data = await fetchDisabledProducts();
      originalData.set(data);
      tableData.set(data);
    } catch (e) {
      tableError.set(e instanceof Error ? e.message : 'Failed to load disabled products');
    } finally {
      isLoading.set(false);
    }
  }

  onMount(() => {
    loadDisabledProducts();
  });

  // Apply search and sort to table data
  $: {
    const query = $searchQuery.trim().toLowerCase();
    let filtered = $originalData;
    if (query) {
      filtered = filtered.filter(
        (row) =>
          row.sku.toLowerCase().includes(query) ||
          row.replacement_product_sku.toLowerCase().includes(query) ||
          (row.reason ?? '').toLowerCase().includes(query)
      );
    }
    const field = $sortField as keyof DisabledProduct;
    if (field) {
      filtered = sortData(filtered, field, $sortDirection);
    }
    tableData.set(filtered);
    currentPage.set(1);
  }

  function handleSortClick(field: SortField) {
    if (!field) return;
    const nextDir =
      $sortField === field && $sortDirection === 'asc' ? 'desc' : 'asc';
    sortField.set(field);
    sortDirection.set(nextDir);
  }

  async function handleDisableProduct() {
    if (!productFormData.sku.trim()) {
      toastError('SKU is required');
      return;
    }

    if (!productFormData.replacementProductSku.trim()) {
      toastError('Replacement product SKU is required');
      return;
    }

    isSubmitting = true;
    try {
      await disableProduct(productFormData.sku, productFormData.replacementProductSku, productFormData.reason);
      toastSuccess('Product disabled successfully');
      await loadDisabledProducts();
    } catch (err) {
      toastError('Failed to disable product');
      console.error(err);
    } finally {
      isSubmitting = false;
    }
  }

</script>

<ToastContainer />

<div class="container mx-auto px-4 py-8">
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
    <h1 class="text-2xl font-bold text-gray-900">Product & Order Management</h1>
  </div>

  <!-- Error Message -->
  {#if error}
    <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6" transition:fade>
      <div class="flex items-center">
        <svg class="w-5 h-5 text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="text-red-800">{error}</p>
      </div>
    </div>
  {/if}

  <div class="bg-white rounded-lg shadow p-6">
      <div class="mb-6">
        <h2 class="text-xl font-semibold text-gray-900">Disable Product</h2>
        <p class="text-gray-600 mt-1">Disable a product by SKU to remove it from active listings</p>
      </div>

      <!-- Disable Product Form -->
      <form on:submit|preventDefault={handleDisableProduct} class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="product-sku" class="block text-sm font-medium text-gray-700 mb-1">
              Product SKU <span class="text-red-500">*</span>
            </label>
            <input
              id="product-sku"
              type="text"
              bind:value={productFormData.sku}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Enter the product SKU to disable"
              required
            />
          </div>
          <div>
            <label for="replacement-product-sku" class="block text-sm font-medium text-gray-700 mb-1">
              Replacement Product SKU <span class="text-red-500">*</span>
            </label>
            <input
              id="replacement-product-sku"
              type="text"
              bind:value={productFormData.replacementProductSku}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Enter the replacement product SKU"
              required
            />
          </div>
        </div>
        <div>
          <label for="disable-reason" class="block text-sm font-medium text-gray-700 mb-1">
            Reason
          </label>
          <textarea
            id="disable-reason"
            bind:value={productFormData.reason}
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-vertical"
            placeholder="Optional: reason for disabling this product"
          ></textarea>
        </div>
        <div class="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            class="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {#if isSubmitting}
              <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Disabling...
            {:else}
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Disable Product
            {/if}
          </button>
        </div>
      </form>
    </div>

  <!-- Disabled Products Table -->
  <div class="bg-white rounded-lg shadow p-6 mt-8">
    <div class="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <h2 class="text-xl font-semibold text-gray-900">Disabled Products</h2>
      <div class="flex items-center gap-3">
        <label for="disabled-search" class="text-sm text-gray-600 sr-only">Search</label>
        <input
          id="disabled-search"
          type="text"
          placeholder="Search SKU, replacement, or reason..."
          bind:value={$searchQuery}
          class="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
        />
      </div>
    </div>

    {#if $tableError}
      <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
        {$tableError}
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th
                scope="col"
                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                on:click={() => handleSortClick('sku')}
              >
                SKU {getSortIcon('sku', $sortField, $sortDirection)}
              </th>
              <th
                scope="col"
                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                on:click={() => handleSortClick('replacement_product_sku')}
              >
                Replacement SKU {getSortIcon('replacement_product_sku', $sortField, $sortDirection)}
              </th>
              <th
                scope="col"
                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                on:click={() => handleSortClick('reason')}
              >
                Reason {getSortIcon('reason', $sortField, $sortDirection)}
              </th>
              <th
                scope="col"
                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                on:click={() => handleSortClick('created_at')}
              >
                Disabled at {getSortIcon('created_at', $sortField, $sortDirection)}
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#if $isLoading}
              <tr>
                <td colspan="4" class="px-4 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            {:else if $paginatedData.length === 0}
              <tr>
                <td colspan="4" class="px-4 py-8 text-center text-gray-500">
                  No disabled products found.
                </td>
              </tr>
            {:else}
              {#each $paginatedData as row (row.id)}
                <tr class="hover:bg-gray-50">
                  <td class="px-4 py-3 text-sm text-gray-900">{row.sku}</td>
                  <td class="px-4 py-3 text-sm text-gray-900">{row.replacement_product_sku}</td>
                  <td class="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title={row.reason ?? ''}>
                    {row.reason ?? '—'}
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {formatDate(row.created_at)}
                  </td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>

      {#if !$isLoading && $tableData.length > 0}
        <div class="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-3">
          <div class="text-sm text-gray-600">
            Showing {($currentPage - 1) * $itemsPerPage + 1}–{Math.min($currentPage * $itemsPerPage, $tableData.length)} of {$tableData.length}
          </div>
          <div class="flex items-center gap-3">
            <select
              bind:value={$itemsPerPage}
              class="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
            </select>
            <div class="flex items-center gap-1">
              <button
                type="button"
                on:click={() => currentPage.update((p) => Math.max(1, p - 1))}
                disabled={$currentPage === 1}
                class="px-2 py-1 text-sm rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span class="px-2 text-sm text-gray-600">Page {$currentPage} of {$totalPages}</span>
              <button
                type="button"
                on:click={() => currentPage.update((p) => Math.min($totalPages, p + 1))}
                disabled={$currentPage >= $totalPages}
                class="px-2 py-1 text-sm rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      {/if}
    {/if}
  </div>
</div>
