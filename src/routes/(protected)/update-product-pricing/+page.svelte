<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';

  import { toastSuccess, toastError } from '$lib/utils/toast';
  import FiltersPanel from './components/FiltersPanel.svelte';
  import PaginationControls from './components/PaginationControls.svelte';
  import ProductsTable from './components/ProductsTable.svelte';
  import ConfirmSaveModal from './components/ConfirmSaveModal.svelte';
  import {
    products,
    originalProducts,
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
  let showConfirmSave = false;
  let originalMap: Map<string, any> = new Map();
  $: originalMap = new Map($originalProducts.map(p => [p.sku, p]));

  $: totalPages = getTotalPages($products.length, $itemsPerPage);
  $: paginatedProducts = getPaginatedProducts($products, $currentPage, $itemsPerPage, $sortField, $sortDirection);
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

  async function confirmAndSubmit() {
    showConfirmSave = false;
    await submitCheckedRows();
  }

  // Function to get sort icon
  function getSortIcon(field: string): string {
    if ($sortField !== field) return 'â†•ï¸';
    return $sortDirection === 'asc' ? 'â†‘' : 'â†“';
  }

  // Get the main product image URL (prefers a "Main" named image, falls back to the first)
  function getMainImage(product: any): string | null {
    const images = product?.Images || product?.images || [];
    if (!Array.isArray(images) || images.length === 0) return null;
    const main = images.find(
      (img: any) => (img?.Name || img?.name || '').toLowerCase() === 'main'
    );
    const chosen = main || images[0];
    return chosen?.ThumbURL || chosen?.MediumThumbURL || chosen?.URL || null;
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
      <FiltersPanel
        {skuFilter}
        {productNameFilter}
        {brandFilter}
        {supplierFilter}
        {brands}
        {suppliers}
        {loadingBrands}
        {loadingSuppliers}
        {brandError}
        {supplierError}
        {selectedRows}
        {submitLoading}
        onApplyFilters={handleFilterClick}
        onRequestSave={() => (showConfirmSave = true)}
      />

      <!-- Middle column: table -->
      <section class="middle-col">
        <PaginationControls
          placement="top"
          currentPage={$currentPage}
          {totalPages}
          {currentPageItems}
          onPageChange={handlePageChange}
        />
        <!-- Products Table -->
        <ProductsTable
          loading={$loading}
          productsLength={$products.length}
          {paginatedProducts}
          {originalMap}
          selectedRows={$selectedRows}
          selectAll={$selectAll}
          onSelectAll={handleSelectAll}
          onToggleRowSelected={toggleRowSelected}
          onApplyMarkupToAll={applyMarkupToAll}
          onUpdateProductBySku={updateProductBySku}
          onUpdateProductPricingBySku={updateProductPricingBySku}
          onSortClick={handleSortClick}
          {getSortIcon}
          {getMainImage}
          {getPriceComparisonStatus}
          {onNumberInput}
        />
        <!-- Bottom pagination controls -->
        <PaginationControls
          placement="bottom"
          currentPage={$currentPage}
          {totalPages}
          {currentPageItems}
          onPageChange={handlePageChange}
        />
      </section>

    </div>
  </div>
</div>
<ConfirmSaveModal
  open={showConfirmSave}
  loading={$submitLoading}
  onCancel={() => (showConfirmSave = false)}
  onConfirm={confirmAndSubmit}
/>

<style>
  .three-col-layout {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
    align-items: start;
  }

  @media (min-width: 1024px) {
    .three-col-layout {
      grid-template-columns: 280px minmax(0, 1fr);
    }
  }

  .left-col,
  .middle-col {
    min-width: 0;
  }
</style> 
