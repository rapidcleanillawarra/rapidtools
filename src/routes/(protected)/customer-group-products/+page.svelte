<script lang="ts">
	import { onMount, afterUpdate } from 'svelte';
	import {
		customerGroups,
		selectedCustomerGroupId,
		products,
		isLoadingCustomerGroups,
		isLoadingProducts,
		currentPage,
		itemsPerPage,
		sortField,
		sortDirection,
		searchFilters,
		totalItems,
		error
	} from './stores';
	import { fetchCustomerGroups, fetchProductsForGroup } from './utils/api';
	import { fade } from 'svelte/transition';
	import Select from 'svelte-select';
	import type { PriceGroupProduct } from './types';
	import { browser } from '$app/environment';
	import Modal from '$lib/components/Modal.svelte';

	let isMounted = false;
	let debounceTimer: ReturnType<typeof setTimeout>;

	// Modal state
	let showBandsModal = false;
	let selectedBands: any[] = [];
	let selectedSku = '';

	onMount(async () => {
		isLoadingCustomerGroups.set(true);
		error.set(null);
		try {
			const groups = await fetchCustomerGroups();
			customerGroups.set(groups);
		} catch (e) {
			error.set('Failed to load customer groups. Please try again later.');
			console.error(e);
		} finally {
			isLoadingCustomerGroups.set(false);
		}
		isMounted = true;
	});

	async function loadProducts() {
		if (!$selectedCustomerGroupId) return;

		isLoadingProducts.set(true);
		error.set(null);
		try {
			const result = await fetchProductsForGroup(
				$selectedCustomerGroupId,
				$currentPage,
				$itemsPerPage,
				{ field: $sortField, direction: $sortDirection },
				$searchFilters
			);
			products.set(result.data);
			totalItems.set(result.count);
		} catch (e) {
			error.set('Failed to load products for the selected group.');
			console.error(e);
			products.set([]);
			totalItems.set(0);
		} finally {
			isLoadingProducts.set(false);
		}
	}

	async function handleGroupChange(selectedItem: { value: number } | null) {
		const groupId = selectedItem?.value || null;
		selectedCustomerGroupId.set(groupId);
		if (groupId) {
			currentPage.set(1);
			searchFilters.set({});
		} else {
			products.set([]);
			totalItems.set(0);
		}
	}

	function handleSortClick(field: keyof PriceGroupProduct) {
		const currentField = $sortField;
		const currentDirection = $sortDirection;
		let newDirection: 'asc' | 'desc' = 'asc';
		if (currentField === field && currentDirection === 'asc') {
			newDirection = 'desc';
		}
		currentPage.set(1);
		sortField.set(field);
		sortDirection.set(newDirection);
	}

	$: if (isMounted) {
		$selectedCustomerGroupId, $currentPage, $itemsPerPage, $sortField, $sortDirection;
		// Debounce search filters separately to avoid re-fetching on every keystroke
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			loadProducts();
		}, 300);
	}

	$: {
		// Reset to page 1 when filters change, but not on other changes
		$searchFilters;
		if (isMounted && browser) {
			currentPage.set(1);
		}
	}

	function getSortIcon(
		field: keyof PriceGroupProduct,
		currentSortField: string,
		direction: 'asc' | 'desc'
	): string {
		if (currentSortField !== field) return '↕️';
		return direction === 'asc' ? '↑' : '↓';
	}

	function formatPrice(price: number | null): string {
		if (price === null) return '0.00';
		return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}

	function formatMultilevelBands(bands: any | null): string {
		if (!bands || !bands.MultiLevelBand) {
			return '-';
		}
		try {
			// Ensure we are always working with an array
			const parsedBands = Array.isArray(bands.MultiLevelBand)
				? bands.MultiLevelBand
				: [bands.MultiLevelBand];

			if (!Array.isArray(parsedBands)) {
				return 'Invalid format';
			}
			return parsedBands
				.map((band: { MinimumQuantity: string; MaximumQuantity: string; Price: string }) => {
					const min = band.MinimumQuantity;
					const max = band.MaximumQuantity;
					const price = parseFloat(band.Price).toFixed(2);
					if (max === '0' || !max) {
						return `${min}+: $${price}`;
					}
					return `${min}-${max}: $${price}`;
				})
				.join(' | ');
		} catch (e) {
			console.error('Error parsing multilevel bands:', e);
			return 'Error';
		}
	}

	function openBandsModal(product: PriceGroupProduct) {
		if (!product.multilevel_bands || !product.multilevel_bands.MultiLevelBand) {
			return;
		}
		const bands = product.multilevel_bands.MultiLevelBand;
		selectedBands = Array.isArray(bands) ? bands : [bands];
		selectedSku = product.sku;
		showBandsModal = true;
	}
</script>

<div class="container mx-auto px-4 py-8">
	<div class="bg-white rounded-lg shadow-lg overflow-hidden">
		<div class="px-6 py-4 border-b border-gray-200">
			<h1 class="text-xl font-semibold">Customer Group Products</h1>
			<p class="text-gray-600">Select a customer group to view and manage their products.</p>
		</div>

		<div class="p-6">
			{#if $isLoadingCustomerGroups}
				<div class="text-center py-4">
					<p>Loading customer groups...</p>
				</div>
			{:else if $error && !$customerGroups.length}
				<div class="text-center py-4 text-red-500">
					<p>{$error}</p>
				</div>
			{:else}
				<div class="mb-6 relative z-20">
					<label for="customer-group-select" class="block text-sm font-medium text-gray-700 mb-2"
						>Select Customer Group:</label
					>
					<Select
						items={$customerGroups.map((group) => ({ value: group.id, label: group.name }))}
						on:change={(e) => handleGroupChange(e.detail)}
						value={$selectedCustomerGroupId
							? {
									value: $selectedCustomerGroupId,
									label: $customerGroups.find((g) => g.id === $selectedCustomerGroupId)?.name || ''
							  }
							: null}
						placeholder="Search or select a group..."
						searchable={true}
					/>
				</div>
			{/if}

			{#if $selectedCustomerGroupId}
				<div transition:fade>
					{#if $isLoadingProducts && !$products.length}
						<div class="text-center py-4">
							<p>Loading products...</p>
						</div>
					{:else if $error && !$products.length}
						<div class="text-center py-4 text-red-500">
							<p>{$error}</p>
						</div>
					{:else if $products.length === 0 && !$isLoadingProducts}
						<div class="text-center py-4 border-t border-gray-200">
							<p class="text-gray-500">No products found for this group.</p>
						</div>
					{:else}
						<div class="relative">
							{#if $isLoadingProducts}
								<div
									class="absolute inset-0 bg-white bg-opacity-60 flex items-center justify-center z-20 rounded-lg"
								>
									<div class="text-center">
										<p class="text-lg font-semibold text-gray-700">Loading...</p>
									</div>
								</div>
							{/if}
							<div class="pagination-controls flex items-center justify-between mb-4">
								<div>
									<select bind:value={$itemsPerPage} class="text-sm rounded-md">
										<option value={10}>10</option>
										<option value={20}>20</option>
										<option value={50}>50</option>
										<option value={100}>100</option>
									</select>
									<span class="text-sm ml-2">items per page</span>
								</div>
								<div class="flex items-center">
									<button
										on:click={() => currentPage.update((p) => Math.max(1, p - 1))}
										disabled={$currentPage === 1}
										class="px-3 py-1 border rounded-md text-sm disabled:opacity-50"
									>
										Previous
									</button>
									<span class="px-3 py-1 text-sm"
										>Page {$currentPage} of {Math.ceil($totalItems / $itemsPerPage) || 1}</span
									>
									<button
										on:click={() => currentPage.update((p) => p + 1)}
										disabled={$currentPage * $itemsPerPage >= $totalItems}
										class="px-3 py-1 border rounded-md text-sm disabled:opacity-50"
									>
										Next
									</button>
								</div>
							</div>
							<div
								class="overflow-x-auto overflow-y-auto"
								style="height: 600px; transition: height 0.2s ease-in-out;"
							>
								<table class="min-w-full divide-y divide-gray-200">
									<thead class="bg-gray-50 sticky-header">
										<tr>
											<th
												class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
												on:click={() => handleSortClick('sku')}
											>
												SKU {getSortIcon('sku', $sortField, $sortDirection)}
											</th>
											<th
												class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
												on:click={() => handleSortClick('price')}
											>
												Price {getSortIcon('price', $sortField, $sortDirection)}
											</th>
											<th
												class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
												on:click={() => handleSortClick('promotion_price')}
											>
												Promo Price {getSortIcon('promotion_price', $sortField, $sortDirection)}
											</th>
											<th
												class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
												on:click={() => handleSortClick('minimum_quantity')}
											>
												Min Qty {getSortIcon('minimum_quantity', $sortField, $sortDirection)}
											</th>
											<th
												class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
												on:click={() => handleSortClick('maximum_quantity')}
											>
												Max Qty {getSortIcon('maximum_quantity', $sortField, $sortDirection)}
											</th>
											<th
												class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
												on:click={() => handleSortClick('multiple')}
											>
												Multiple {getSortIcon('multiple', $sortField, $sortDirection)}
											</th>
											<th
												class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
												on:click={() => handleSortClick('multilevel_bands')}
											>
												Bands {getSortIcon('multilevel_bands', $sortField, $sortDirection)}
											</th>
										</tr>
										<tr>
											<th class="px-2 py-1">
												<input
													type="text"
													class="text-xs w-full"
													placeholder="Search SKU..."
													bind:value={$searchFilters.sku}
												/>
											</th>
											<th class="px-2 py-1">
												<input
													type="text"
													class="text-xs w-full"
													placeholder="Search Price..."
													bind:value={$searchFilters.price}
												/>
											</th>
											<th class="px-2 py-1">
												<input
													type="text"
													class="text-xs w-full"
													placeholder="Search Promo..."
													bind:value={$searchFilters.promotion_price}
												/>
											</th>
											<th class="px-2 py-1">
												<input
													type="text"
													class="text-xs w-full"
													placeholder="Search Min..."
													bind:value={$searchFilters.minimum_quantity}
												/>
											</th>
											<th class="px-2 py-1">
												<input
													type="text"
													class="text-xs w-full"
													placeholder="Search Max..."
													bind:value={$searchFilters.maximum_quantity}
												/>
											</th>
											<th class="px-2 py-1">
												<input
													type="text"
													class="text-xs w-full"
													placeholder="Search Multiple..."
													bind:value={$searchFilters.multiple}
												/>
											</th>
											<th class="px-2 py-1">
												<!-- No search for bands column -->
											</th>
										</tr>
									</thead>
									<tbody class="bg-white divide-y divide-gray-200">
										{#each $products as product (product.inventory_id)}
											<tr transition:fade>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
													<a
														href="https://www.rapidsupplies.com.au/_cpanel/products/view?id={product.inventory_id}"
														target="_blank"
														rel="noopener noreferrer"
														class="text-indigo-600 hover:text-indigo-900 hover:underline"
													>
														{product.sku}
													</a>
												</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
													>$ {formatPrice(product.price)}</td
												>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
													>$ {formatPrice(product.promotion_price)}</td
												>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
													>{product.minimum_quantity || 0}</td
												>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
													>{product.maximum_quantity || 0}</td
												>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
													>{product.multiple || 0}</td
												>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
													{#if product.multilevel_bands && product.multilevel_bands.MultiLevelBand}
														<button
															class="text-sm bg-blue-500 hover:bg-blue-600 text-white font-semibold py-1 px-3 rounded-md transition duration-150 ease-in-out"
															on:click={() => openBandsModal(product)}
														>
															View Bands
														</button>
													{:else}
														-
													{/if}
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>

<Modal show={showBandsModal} on:close={() => (showBandsModal = false)}>
	<div slot="header">
		Multi-Level Bands for <span class="font-bold">{selectedSku}</span>
	</div>
	<div slot="body">
		<table class="min-w-full divide-y divide-gray-200">
			<thead class="bg-gray-50">
				<tr>
					<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Min Qty</th>
					<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Max Qty</th>
					<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
				</tr>
			</thead>
			<tbody class="bg-white divide-y divide-gray-200">
				{#each selectedBands as band}
					<tr>
						<td class="px-4 py-2 whitespace-nowrap text-sm">{band.MinimumQuantity}</td>
						<td class="px-4 py-2 whitespace-nowrap text-sm">{band.MaximumQuantity === '0' ? 'And up' : band.MaximumQuantity}</td>
						<td class="px-4 py-2 whitespace-nowrap text-sm">$ {parseFloat(band.Price).toFixed(2)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</Modal>

<style>
	.sticky-header th {
		position: sticky;
		top: 0;
		z-index: 10;
		background-color: rgb(249 250 251); /* bg-gray-50 equivalent */
	}
</style> 