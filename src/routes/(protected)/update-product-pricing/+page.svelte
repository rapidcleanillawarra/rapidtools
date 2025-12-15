<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';

  import { toastSuccess, toastError } from '$lib/utils/toast';
  import FiltersPanel from './components/FiltersPanel.svelte';
  import PaginationControls from './components/PaginationControls.svelte';
  import ProductsTable from './components/ProductsTable.svelte';
  import ConfirmSaveModal from './components/ConfirmSaveModal.svelte';
  import PhotoViewerModal from './components/PhotoViewerModal.svelte';
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
    updateProductPricingBySku,
    clearSelection
  } from './stores';

  function resetControlSection() {
    searchSku = '';
    searchProductName = '';
    purchasePriceIncrease = 0;
    markupIncrease = 0;
    listPriceIncrease = 0;
    currentPage.set(1);
  }

  function applyAdjustments() {
    const selected = getSelectedSkusOrToast();
    if (!selected) return;

    const purchasePct = toNumber(purchasePriceIncrease, 0);
    const markupPct = toNumber(markupIncrease, 0);
    const listPct = toNumber(listPriceIncrease, 0);

    if (purchasePct !== 0) applyPurchasePricePercentChange();
    if (markupPct !== 0) applyMarkupPercentChange();
    if (listPct !== 0) applyListPricePercentChange();
  }
  async function handleFilterClick() {
    resetControlSection();
    clearSelection();
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

  function toNumber(value: unknown, fallback = 0): number {
    const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
    return Number.isFinite(n) ? n : fallback;
  }

  type PercentHint = { text: string; cls: string };
  function percentHint(pct: number): PercentHint {
    if (pct > 0) return { text: `Adjustment: +${pct}%`, cls: 'text-green-700' };
    if (pct < 0) return { text: `Adjustment: ${pct}%`, cls: 'text-red-700' };
    return { text: 'No change', cls: 'text-gray-500' };
  }

  function getSelectedSkusOrToast(): string[] | null {
    const selected = Array.from($selectedRows);
    if (selected.length === 0) {
      toastError('Select at least one row first.');
      return null;
    }
    return selected;
  }

  function applyPurchasePricePercentChange() {
    const pct = toNumber(purchasePriceIncrease, 0);
    const selected = getSelectedSkusOrToast();
    if (!selected) return;

    const factor = 1 + pct / 100;
    for (const sku of selected) {
      const base = originalMap.get(sku)?.purchase_price ?? $products.find((p: any) => p?.sku === sku)?.purchase_price;
      const baseNum = toNumber(base, 0);
      const next = Math.max(0, baseNum * factor);
      updateProductPricingBySku(sku, { purchase_price: next }, 'markup');
    }
  }

  function applyMarkupPercentChange() {
    const pct = toNumber(markupIncrease, 0);
    const selected = getSelectedSkusOrToast();
    if (!selected) return;

    const factor = 1 + pct / 100;
    for (const sku of selected) {
      const base = originalMap.get(sku)?.markup ?? $products.find((p: any) => p?.sku === sku)?.markup;
      const baseNum = toNumber(base, 0);
      const next = Math.max(0, baseNum * factor);
      updateProductPricingBySku(sku, { markup: next }, 'markup');
    }
  }

  function applyListPricePercentChange() {
    const pct = toNumber(listPriceIncrease, 0);
    const selected = getSelectedSkusOrToast();
    if (!selected) return;

    const factor = 1 + pct / 100;
    for (const sku of selected) {
      const base = originalMap.get(sku)?.rrp ?? $products.find((p: any) => p?.sku === sku)?.rrp;
      const baseNum = toNumber(base, 0);
      const next = Math.max(0, baseNum * factor);
      updateProductPricingBySku(sku, { rrp: next }, 'price');
    }
  }

  $: purchasePriceIncreaseHint = percentHint(toNumber(purchasePriceIncrease, 0));
  $: markupIncreaseHint = percentHint(toNumber(markupIncrease, 0));
  $: listPriceIncreaseHint = percentHint(toNumber(listPriceIncrease, 0));

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
  let searchSku = '';
  let searchProductName = '';
  let purchasePriceIncrease = 0;
  let markupIncrease = 0;
  let listPriceIncrease = 0;
  let visibleProducts: any[] = [];
  let paginatedProducts: any[] = [];
  let totalPages = 0;
  let leftCollapsed = false;
  let currentPageItems = {
    start: 0,
    end: 0,
    total: 0
  };
  let showConfirmSave = false;
  let originalMap: Map<string, any> = new Map();
  let photoViewerOpen = false;
  let photoViewerImages: string[] = [];
  let photoViewerIndex = 0;
  let photoViewerTitle = '';
  $: originalMap = new Map($originalProducts.map(p => [p.sku, p]));

  $: {
    const skuNeedle = searchSku.trim().toLowerCase();
    const nameNeedle = searchProductName.trim().toLowerCase();
    visibleProducts =
      !skuNeedle && !nameNeedle
        ? $products
        : $products.filter((p: any) => {
            const skuHay = String(p?.sku ?? '').toLowerCase();
            const nameHay = String(p?.product_name ?? '').toLowerCase();
            const skuOk = !skuNeedle || skuHay.includes(skuNeedle);
            const nameOk = !nameNeedle || nameHay.includes(nameNeedle);
            return skuOk && nameOk;
          });
  }

  $: totalPages = getTotalPages(visibleProducts.length, $itemsPerPage);
  $: paginatedProducts = getPaginatedProducts(
    visibleProducts,
    $currentPage,
    $itemsPerPage,
    $sortField || undefined,
    $sortDirection
  );
  $: {
    const total = visibleProducts.length;
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
    if ($sortField !== field) return '';
    return $sortDirection === 'asc' ? '^' : 'v';
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

  function pickImageUrl(img: any): string | null {
    if (!img) return null;
    return (
      img.URL ||
      img.url ||
      img.LargeURL ||
      img.largeUrl ||
      img.LargeThumbURL ||
      img.largeThumbUrl ||
      img.MediumThumbURL ||
      img.mediumThumbUrl ||
      img.ThumbURL ||
      img.thumbUrl ||
      null
    );
  }

  function openPhotoViewer(product: any) {
    const imagesRaw = product?.Images || product?.images || [];
    const images = Array.isArray(imagesRaw) ? imagesRaw : [imagesRaw];
    const urls = images
      .map((img: any) => pickImageUrl(img))
      .filter((u: any) => typeof u === 'string' && u.length > 0) as string[];

    const uniqueUrls = Array.from(new Set(urls));

    const mainIndex = images.findIndex(
      (img: any) => String(img?.Name || img?.name || '').toLowerCase() === 'main'
    );

    photoViewerImages = uniqueUrls;
    photoViewerIndex =
      mainIndex >= 0 && uniqueUrls[mainIndex] ? mainIndex : 0;
    photoViewerTitle = product?.product_name || product?.sku || 'Product image';
    photoViewerOpen = true;
  }
</script>

<div class="min-h-screen bg-gray-100 py-8 px-2 sm:px-3">
  <div class="max-w-[98%] mx-auto bg-white shadow p-6" transition:fade>
    <h2 class="text-2xl font-bold mb-6 text-gray-900">Update Product Pricing</h2>

    <div class="three-col-layout" class:collapsed={leftCollapsed}>
      <FiltersPanel
        collapsed={leftCollapsed}
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
        onToggleCollapse={() => (leftCollapsed = !leftCollapsed)}
      />

      <!-- Middle column: table -->
      <section class="middle-col">
        <div class="control-section mb-3 rounded-md bg-white p-3 shadow-sm ring-1 ring-gray-200">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1" for="purchase_price_increase">
                Purchase Price Adjustment
              </label>
              <div class="flex gap-2 items-center">
                <input
                  id="purchase_price_increase"
                  type="number"
                  bind:value={purchasePriceIncrease}
                  class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-xs h-8 px-2"
                  step="0.01"
                  on:change={applyPurchasePricePercentChange}
                />
              </div>
              <div class={`mt-1 text-[10px] ${purchasePriceIncreaseHint.cls}`}>{purchasePriceIncreaseHint.text}</div>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1" for="markup_increase">
                Markup Adjustment
              </label>
              <div class="flex gap-2 items-center">
                <input
                  id="markup_increase"
                  type="number"
                  bind:value={markupIncrease}
                  class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-xs h-8 px-2"
                  step="0.01"
                  on:change={applyMarkupPercentChange}
                />
              </div>
              <div class={`mt-1 text-[10px] ${markupIncreaseHint.cls}`}>{markupIncreaseHint.text}</div>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1" for="list_price_increase">
                List Price Adjustment
              </label>
              <div class="flex gap-2 items-center">
                <input
                  id="list_price_increase"
                  type="number"
                  bind:value={listPriceIncrease}
                  class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-xs h-8 px-2"
                  step="0.01"
                  on:change={applyListPricePercentChange}
                />
              </div>
              <div class={`mt-1 text-[10px] ${listPriceIncreaseHint.cls}`}>{listPriceIncreaseHint.text}</div>
            </div>
          </div>
          <div class="mt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={$selectedRows.size === 0 ||
                (toNumber(purchasePriceIncrease, 0) === 0 &&
                  toNumber(markupIncrease, 0) === 0 &&
                  toNumber(listPriceIncrease, 0) === 0)}
              on:click={applyAdjustments}
            >
              Apply adjustments
            </button>
          </div>
        </div>

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
          productsLength={visibleProducts.length}
          {paginatedProducts}
          {originalMap}
          selectedRows={$selectedRows}
          selectAll={$selectAll}
          {searchSku}
          {searchProductName}
          onSearchSkuChange={(value) => searchSku = value}
          onSearchProductNameChange={(value) => searchProductName = value}
          onClearSearch={() => {
            searchSku = '';
            searchProductName = '';
            currentPage.set(1);
          }}
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
          onOpenPhotoViewer={openPhotoViewer}
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

<PhotoViewerModal
  open={photoViewerOpen}
  images={photoViewerImages}
  index={photoViewerIndex}
  title={photoViewerTitle}
  onClose={() => (photoViewerOpen = false)}
  onIndexChange={(next) => (photoViewerIndex = next)}
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

    .three-col-layout.collapsed {
      grid-template-columns: 56px minmax(0, 1fr);
    }
  }

  .three-col-layout.collapsed {
    grid-template-columns: 1fr;
  }

  .left-col,
  .middle-col {
    min-width: 0;
  }
</style> 
