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
		selectedSkus,
		visibleColumns,
		paginatedData
	} from './stores';
	import {
		sortData,
		exportToCSV as exportCSV,
		filterProducts,
		loadHighlightStatuses,
		saveHighlightStatuses,
		clearHighlightStatuses,
		type HighlightStatus
	} from './utils';
	import { columns, PRODUCTS_PER_API_PAGE } from './config';
	import type { ProductInfo } from './types';
	import { fetchProducts, fetchCategories } from '$lib/services/products';
	import { transformProductsData } from './productTransformer';
	import { safeAsync } from './errorHandler';
	import type { CategoryFlat } from './utils';
	import BrandDropdown from './BrandDropdown.svelte';
	import SkuTextarea from './SkuTextarea.svelte';
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
	let highlightStatuses: Record<string, HighlightStatus> = {};
	let lastFiltersSig = '';

	// Load categories for display purposes
	async function loadCategories() {
		await safeAsync(
			async () => {
				categories = await fetchCategories();
			},
			{
				errorMessage: 'Failed to load categories'
			}
		);
	}

	// Computed visible columns
	$: visibleColumnsList = columns.filter((col) => $visibleColumns[col.key]);

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
		// Clear SKU filter when brand is selected (only one filter allowed)
		selectedSkus.set('');
		// Removed auto-submit - user must click Apply Filter button
	}

	// Handle brand clear
	function handleBrandClear() {
		selectedBrand.set('');
		// Clear data only if both filters are now empty
		if (!parseSkus($selectedSkus).length) {
			originalData.set([]);
			tableData.set([]);
		}
	}

	// Parse SKUs from textarea input (split by newlines, trim, filter empty)
	function parseSkus(skuText: string): string[] {
		return skuText
			.split('\n')
			.map((sku) => sku.trim())
			.filter((sku) => sku.length > 0);
	}

	// Handle SKU textarea input
	function handleSkuInput(event: CustomEvent) {
		const skusText = event.detail.value;
		selectedSkus.set(skusText);
		// Clear brand filter when SKUs are entered (only one filter allowed)
		if (skusText.trim()) {
			selectedBrand.set('');
		}
	}

	// Handle SKU clear
	function handleSkuClear() {
		selectedSkus.set('');
		// Clear data only if both filters are now empty
		if (!$selectedBrand) {
			originalData.set([]);
			tableData.set([]);
		}
	}

	// Fetch a single page of products
	async function fetchProductPage(
		pageNum: number,
		brandName?: string,
		skus?: string[]
	): Promise<{ products: ProductInfo[]; hasMore: boolean }> {
		// Call the products API directly instead of going through SvelteKit API route
		// This works in GitHub Pages static hosting
		const productData = await fetchProducts(brandName, pageNum, skus);

		// Transform the API response using centralized transformer
		const products = productData.Item ? transformProductsData(productData.Item, brandName) : [];

		return {
			products,
			hasMore: products.length >= PRODUCTS_PER_API_PAGE
		};
	}

	// Load products by brand or SKUs with parallel pagination
	async function loadProducts(brandName?: string, skus?: string[]) {
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
							fetchProductPage(evenPage, brandName, skus).then(({ products, hasMore }) => {
								evenProducts.push(...products);
								hasMoreEvenPages = hasMore;
								evenPage += 2;
							})
						);
					}

					if (hasMoreOddPages) {
						promises.push(
							fetchProductPage(oddPage, brandName, skus).then(({ products, hasMore }) => {
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
			const currentSig = JSON.stringify($searchFilters);
			const filtersChanged = currentSig !== lastFiltersSig;
			lastFiltersSig = currentSig;

			const totalPages = Math.max(1, Math.ceil(filtered.length / $itemsPerPage));

			if (filtersChanged) {
				currentPage.set(1);
			} else {
				currentPage.update((page) => Math.min(page, totalPages));
			}
		}, 150); // 150ms debounce for smoother UX
	}

	// Column visibility handlers
	const toggleColumnVisibility = (column: keyof ProductInfo) => {
		visibleColumns.update((current) => ({ ...current, [column]: !current[column] }));
	};

	const showAllColumns = () => {
		const allVisible = Object.keys($visibleColumns).reduce(
			(acc, key) => {
				acc[key as keyof ProductInfo] = true;
				return acc;
			},
			{} as Record<keyof ProductInfo, boolean>
		);
		visibleColumns.set(allVisible);
	};

	const hideAllColumns = () => {
		const hiddenExceptRequired = Object.keys($visibleColumns).reduce(
			(acc, key) => {
				acc[key as keyof ProductInfo] = key === 'image' || key === 'sku';
				return acc;
			},
			{} as Record<keyof ProductInfo, boolean>
		);
		visibleColumns.set(hiddenExceptRequired);
	};

	// Export handlers
	function handleExport(includeAllColumns: boolean) {
		const parsedSkus = parseSkus($selectedSkus);
		const filterInfo = parsedSkus.length > 0 ? `SKUs_${parsedSkus.length}` : $selectedBrand;
		const result = exportCSV($tableData, columns, $visibleColumns, includeAllColumns, filterInfo);
		if (result.success) {
			toastSuccess(result.message!);
		} else {
			toastError(result.message!);
		}
	}

	// Search change handler
	function handleSearchChange(key: keyof ProductInfo, value: string) {
		searchFilters.update((current) => ({ ...current, [key]: value }));
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
		if (product?.sku) {
			applyHighlightStatus(product.sku, 'gpt');
		}

		const infoText = `Product Name: ${product.name}\nBrand: ${product.brand}\nSKU: ${product.sku}\nInventory ID: ${product.inventory_id || 'N/A'}`;
		navigator.clipboard
			.writeText(infoText)
			.then(() => {
				toastSuccess('Product info copied to clipboard');
			})
			.catch(() => {
				toastError('Failed to copy to clipboard');
			});
	}

	// Handle product save from edit modal
	function handleOptimisticUpdate(event: CustomEvent) {
		const { product } = event.detail;

		// Apply optimistic updates to the UI immediately
		tableData.update((data) => data.map((p) => (p.id === product.id ? { ...product } : p)));
	}

	function handleProductSave(event: CustomEvent) {
		const { product } = event.detail;

		// Update the product in the stores (confirm the optimistic changes)
		// Create fresh copies to ensure reactivity
		originalData.update((data) => data.map((p) => (p.id === product.id ? { ...product } : p)));
		tableData.update((data) => data.map((p) => (p.id === product.id ? { ...product } : p)));

		if (product.sku) {
			applyHighlightStatus(product.sku, 'saved');
		}

		showEditModal = false;
		selectedProductForEdit = null;
	}

	function handleRevertOptimistic(event: CustomEvent) {
		const { productId } = event.detail;

		// Revert optimistic changes by restoring from originalData
		originalData.subscribe((original) => {
			const originalProduct = original.find((p) => p.id === productId);
			if (originalProduct) {
				tableData.update((data) => data.map((p) => (p.id === productId ? originalProduct : p)));
			}
		})();
	}

	function applyHighlightStatus(sku: string, status: HighlightStatus) {
		const existing = highlightStatuses[sku];
		const nextStatus: HighlightStatus =
			status === 'saved' ? 'saved' : existing === 'saved' ? 'saved' : 'gpt';

		highlightStatuses = { ...highlightStatuses, [sku]: nextStatus };
		saveHighlightStatuses(highlightStatuses);
	}

	function resetHighlights() {
		highlightStatuses = {};
		clearHighlightStatuses();
	}

	function handleModalGptInfo(event: CustomEvent<{ sku?: string; status?: HighlightStatus }>) {
		const { sku } = event.detail;
		if (sku) {
			applyHighlightStatus(sku, 'gpt');
		}
	}

	// Cleanup timeout on component destroy
	onDestroy(() => {
		clearTimeout(filterTimeout);
	});

	// Load categories on component mount
	onMount(() => {
		loadCategories();
		highlightStatuses = loadHighlightStatuses();
	});
</script>

<ToastContainer />

<ImageViewer {showImageViewer} product={selectedProduct} on:close={handleImageViewerClose} />

<ProductEditModal
	show={showEditModal}
	product={selectedProductForEdit}
	on:close={handleEditModalClose}
	on:save={handleProductSave}
	on:optimistic-update={handleOptimisticUpdate}
	on:revert-optimistic={handleRevertOptimistic}
	on:gpt-info={handleModalGptInfo}
/>

<LoadingProgressModal show={showProgressModal} totalProducts={totalProductsLoaded} />

<svelte:head>
	<title>Product Information Update - RapidTools</title>
</svelte:head>

<div class="min-h-screen p-2 sm:p-3 lg:p-4">
	<div class="w-full bg-[#141619] border border-[#262a30] shadow-xl rounded-xl p-3 sm:p-4">
		<!-- Header -->
		<div class="flex flex-wrap items-center justify-between gap-2 mb-3">
			<div class="flex items-center gap-3">
				<h1 class="text-lg sm:text-xl font-bold text-white tracking-tight">Product Information Update</h1>
				{#if parseSkus($selectedSkus).length > 0}
					<span class="text-xs px-2 py-0.5 rounded-full bg-lime-500/20 text-lime-300 border border-lime-500/30 font-medium">
						{parseSkus($selectedSkus).length} SKU(s)
					</span>
				{:else if $selectedBrand}
					<span class="text-xs px-2 py-0.5 rounded-full bg-lime-500/20 text-lime-300 border border-lime-500/30 font-medium">
						Brand: {$selectedBrand}
					</span>
				{/if}
			</div>
			<p class="text-xs text-gray-400 hidden sm:block">Search, update, and manage product catalog data</p>
		</div>

		<!-- Filter Selection & Actions -->
		<div class="mb-3 rounded-xl border border-[#262a30] bg-[#181b20]/60 p-3 shadow-sm">
			<div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
				<!-- Brand Selection -->
				<div class="md:col-span-4">
					<label for="brand-select" class="block text-xs font-medium text-gray-300 mb-1">
						Filter by Brand
					</label>
					<BrandDropdown
						id="brand-select"
						placeholder="Search brands..."
						value={$selectedBrand}
						disabled={parseSkus($selectedSkus).length > 0}
						on:select={handleBrandSelect}
						on:clear={handleBrandClear}
					/>
					{#if parseSkus($selectedSkus).length > 0}
						<p class="mt-0.5 text-[11px] text-gray-500">Disabled: SKU filter active</p>
					{/if}
				</div>

				<!-- SKU Selection -->
				<div class="md:col-span-4">
					<SkuTextarea
						value={$selectedSkus}
						disabled={$selectedBrand !== ''}
						on:input={handleSkuInput}
						on:clear={handleSkuClear}
					/>
					{#if $selectedBrand !== ''}
						<p class="mt-0.5 text-[11px] text-gray-500">Disabled: Brand filter active</p>
					{/if}
				</div>

				<!-- Action Buttons -->
				<div class="md:col-span-4 flex flex-wrap items-center gap-2">
					<button
						type="button"
						class="btn-primary flex-1 min-w-[110px] py-1.5 px-3 text-xs font-semibold justify-center"
						on:click={() => {
							resetHighlights();
							const parsedSkus = parseSkus($selectedSkus);
							if (parsedSkus.length > 0) {
								loadProducts(undefined, parsedSkus);
							} else if ($selectedBrand) {
								loadProducts($selectedBrand);
							} else {
								loadProducts();
							}
						}}
						disabled={$isLoading}
					>
						{#if $isLoading}
							<div class="flex items-center justify-center">
								<div class="mr-1.5 h-3.5 w-3.5 animate-spin rounded-full border-b-2 border-gray-950"></div>
								Loading...
							</div>
						{:else}
							Apply Filter
						{/if}
					</button>
					<button
						type="button"
						class="btn-secondary py-1.5 px-2.5 text-xs font-medium whitespace-nowrap"
						on:click={() => handleExport(false)}
						disabled={$tableData.length === 0}
						title="Export Visible CSV"
					>
						Export Visible
					</button>
					<button
						type="button"
						class="btn-secondary py-1.5 px-2.5 text-xs font-medium whitespace-nowrap"
						on:click={() => handleExport(true)}
						disabled={$tableData.length === 0}
						title="Export All CSV"
					>
						Export All
					</button>
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

		<!-- Products Table Container -->
		<div class="overflow-hidden rounded-xl border border-[#262a30] bg-[#141619] shadow-xl">
			<ProductsTable
				columns={visibleColumnsList}
				products={$paginatedData}
				{categories}
				{highlightStatuses}
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
</div>
