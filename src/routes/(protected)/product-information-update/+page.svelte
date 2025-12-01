<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
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
  import { sortData, exportToCSV as exportCSV, filterProducts } from './utils';
  import { columns, PRODUCTS_PER_API_PAGE } from './config';
  import type { ProductInfo } from './types';
  import { fetchProducts } from '$lib/services/products';
  import { transformProductsData } from './productTransformer';
  import { safeAsync } from './errorHandler';
  import type { CategoryFlat } from './utils';
  import BrandDropdown from './BrandDropdown.svelte';
  import ColumnVisibilityControls from './ColumnVisibilityControls.svelte';
  import TablePagination from './TablePagination.svelte';
  import ProductsTable from './ProductsTable.svelte';
  import LoadingProgressModal from './LoadingProgressModal.svelte';
  import ImageViewer from './ImageViewer.svelte';
  import ProductEditModal from './ProductEditModal.svelte';
  import ToastContainer from '$lib/components/ToastContainer.svelte';
  import { toastSuccess, toastError } from '$lib/utils/toast';

  let showProgressModal = false;
  let totalProductsLoaded = 0;
  let showImageViewer = false;
  let showEditModal = false;
  let selectedProduct: ProductInfo | null = null;
  let selectedProductForEdit: ProductInfo | null = null;
  let categories: CategoryFlat[] = [];
  let filterTimeout: number;

  // Load categories for display purposes
  async function loadCategories() {
    await safeAsync(
      async () => {
        const response = await fetch('/api/categories');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            categories = data.data;
          }
        }
      },
      {
        errorMessage: 'Failed to load categories'
      }
    );
  }

  // Computed visible columns
  $: visibleColumnsList = columns.filter(col => $visibleColumns[col.key]);

  // Handler for clicking a table header to sort
  function handleSortClick(field: keyof ProductInfo) {
    const newDirection: 'asc' | 'desc' = 
      $sortField === field && $sortDirection === 'asc' ? 'desc' : 'asc';

    sortField.set(field);
    sortDirection.set(newDirection);
    tableData.set(sortData($tableData, field, newDirection));
  }

  // Handle brand selection
  function handleBrandSelect(event: CustomEvent) {
    const brand = event.detail.brand;
    selectedBrand.set(brand.name);
    loadProducts(brand.name);
  }

  // Handle brand clear
  function handleBrandClear() {
    selectedBrand.set('');
    originalData.set([]);
    tableData.set([]);
  }

  // Fetch a single page of products
  async function fetchProductPage(pageNum: number, brandName?: string): Promise<{ products: ProductInfo[], hasMore: boolean }> {
    // Call the products API directly instead of going through SvelteKit API route
    // This works in GitHub Pages static hosting
    const productData = await fetchProducts(brandName, pageNum);

    // Transform the API response using centralized transformer
    const products = productData.Item ? transformProductsData(productData.Item, brandName) : [];

    return {
      products,
      hasMore: products.length >= PRODUCTS_PER_API_PAGE
    };
  }

  // Load products by brand with parallel pagination
  async function loadProducts(brandName?: string) {
    isLoading.set(true);
    showProgressModal = true;
    totalProductsLoaded = 0;

    await safeAsync(
      async () => {
        let evenPage = 0;
        let oddPage = 1;
        let hasMoreEvenPages = true;
        let hasMoreOddPages = true;
        const evenProducts: ProductInfo[] = [];
        const oddProducts: ProductInfo[] = [];

        // Load even and odd pages in parallel for optimal performance
        while (hasMoreEvenPages || hasMoreOddPages) {
          const promises: Promise<void>[] = [];

          if (hasMoreEvenPages) {
            promises.push(
              fetchProductPage(evenPage, brandName).then(({ products, hasMore }) => {
                evenProducts.push(...products);
                hasMoreEvenPages = hasMore;
                evenPage += 2;
              })
            );
          }

          if (hasMoreOddPages) {
            promises.push(
              fetchProductPage(oddPage, brandName).then(({ products, hasMore }) => {
                oddProducts.push(...products);
                hasMoreOddPages = hasMore;
                oddPage += 2;
              })
            );
          }

          await Promise.all(promises);
          totalProductsLoaded = evenProducts.length + oddProducts.length;
        }

        const allProducts = [...evenProducts, ...oddProducts];
        originalData.set(allProducts);
        tableData.set(allProducts);
        toastSuccess(`Loaded ${allProducts.length} products successfully`);
      },
      {
        errorMessage: 'Failed to load products',
        onError: (error) => {
          toastError(error);
          originalData.set([]);
          tableData.set([]);
        }
      }
    );

    isLoading.set(false);
    showProgressModal = false;
  }

  // Reactive statement to handle searching with debouncing (optimized)
  $: {
    clearTimeout(filterTimeout);
    filterTimeout = window.setTimeout(() => {
      const filtered = filterProducts($originalData, $searchFilters);
      tableData.set(filtered);
      currentPage.set(1);
    }, 150); // 150ms debounce for smoother UX
  }

  // Column visibility handlers
  const toggleColumnVisibility = (column: keyof ProductInfo) => {
    visibleColumns.update(current => ({ ...current, [column]: !current[column] }));
  };

  const showAllColumns = () => {
    const allVisible = Object.keys($visibleColumns).reduce((acc, key) => {
      acc[key as keyof ProductInfo] = true;
      return acc;
    }, {} as Record<keyof ProductInfo, boolean>);
    visibleColumns.set(allVisible);
  };

  const hideAllColumns = () => {
    const hiddenExceptRequired = Object.keys($visibleColumns).reduce((acc, key) => {
      acc[key as keyof ProductInfo] = key === 'image' || key === 'sku';
      return acc;
    }, {} as Record<keyof ProductInfo, boolean>);
    visibleColumns.set(hiddenExceptRequired);
  };

  // Export handlers
  function handleExport(includeAllColumns: boolean) {
    const result = exportCSV($tableData, columns, $visibleColumns, includeAllColumns, $selectedBrand);
    if (result.success) {
      toastSuccess(result.message!);
    } else {
      toastError(result.message!);
    }
  }

  // Search change handler
  function handleSearchChange(key: keyof ProductInfo, value: string) {
    searchFilters.update(current => ({ ...current, [key]: value }));
  }

  // Image viewer handler
  function handleImageClick(product: ProductInfo) {
    selectedProduct = product;
    showImageViewer = true;
  }

  function handleImageViewerClose() {
    showImageViewer = false;
    selectedProduct = null;
  }

  // Handle row click to edit product
  function handleRowClick(product: ProductInfo) {
    // Create a fresh copy of the product to ensure reactivity in the modal
    selectedProductForEdit = { ...product };
    showEditModal = true;
  }

  function handleEditModalClose() {
    showEditModal = false;
    selectedProductForEdit = null;
  }

  // Handle GPT Info button click
  function handleGptInfoClick(product: ProductInfo) {
    const infoText = `Product Name: ${product.name}\nBrand: ${product.brand}\nSKU: ${product.sku}`;
    navigator.clipboard.writeText(infoText).then(() => {
      toastSuccess('Product info copied to clipboard');
    }).catch(() => {
      toastError('Failed to copy to clipboard');
    });
  }

  // Handle product save from edit modal
  function handleOptimisticUpdate(event: CustomEvent) {
    const { product } = event.detail;

    // Apply optimistic updates to the UI immediately
    tableData.update(data => data.map(p => p.id === product.id ? { ...product } : p));
  }

  function handleProductSave(event: CustomEvent) {
    const { product } = event.detail;

    // Update the product in the stores (confirm the optimistic changes)
    // Create fresh copies to ensure reactivity
    originalData.update(data => data.map(p => p.id === product.id ? { ...product } : p));
    tableData.update(data => data.map(p => p.id === product.id ? { ...product } : p));

    showEditModal = false;
    selectedProductForEdit = null;
  }

  function handleRevertOptimistic(event: CustomEvent) {
    const { productId } = event.detail;

    // Revert optimistic changes by restoring from originalData
    originalData.subscribe(original => {
      const originalProduct = original.find(p => p.id === productId);
      if (originalProduct) {
        tableData.update(data => data.map(p => p.id === productId ? originalProduct : p));
      }
    })();
  }

  // Cleanup timeout on component destroy
  onDestroy(() => {
    clearTimeout(filterTimeout);
  });

  // Load categories on component mount
  onMount(() => {
    loadCategories();
  });
</script>

<ToastContainer />

<ImageViewer
  showImageViewer={showImageViewer}
  product={selectedProduct}
  on:close={handleImageViewerClose}
/>

<ProductEditModal
  show={showEditModal}
  product={selectedProductForEdit}
  on:close={handleEditModalClose}
  on:save={handleProductSave}
  on:optimistic-update={handleOptimisticUpdate}
  on:revert-optimistic={handleRevertOptimistic}
/>

<LoadingProgressModal show={showProgressModal} totalProducts={totalProductsLoaded} />

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
              value={$selectedBrand}
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
            disabled={$isLoading}
          >
            {#if $isLoading}
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
            on:click={() => handleExport(false)}
            disabled={$tableData.length === 0}
          >
            Export Visible CSV
          </button>
          <button
            type="button"
            class="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-1 px-2 rounded-lg shadow-sm transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap text-xs"
            on:click={() => handleExport(true)}
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

  <ColumnVisibilityControls
    {columns}
    visibleColumns={$visibleColumns}
    onToggle={toggleColumnVisibility}
    onShowAll={showAllColumns}
    onHideAll={hideAllColumns}
  />

  <!-- Products Table -->
  <div class="bg-white rounded-lg shadow overflow-hidden">
    <ProductsTable
      columns={visibleColumnsList}
      products={$paginatedData}
      categories={categories}
      isLoading={$isLoading}
      searchFilters={$searchFilters}
      sortField={$sortField}
      sortDirection={$sortDirection}
      onSort={handleSortClick}
      onSearchChange={handleSearchChange}
      onImageClick={handleImageClick}
      onRowClick={handleRowClick}
      onGptInfoClick={handleGptInfoClick}
      hasData={$originalData.length > 0}
    />

    <TablePagination
      currentPage={$currentPage}
      itemsPerPage={$itemsPerPage}
      hasNextPage={$paginatedData.length >= $itemsPerPage}
      onPageChange={(page) => currentPage.set(page)}
      onItemsPerPageChange={(items) => itemsPerPage.set(items)}
    />
  </div>
</div>
