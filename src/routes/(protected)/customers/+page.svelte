<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { writable, derived } from 'svelte/store';
	import type { Customer, ApiResponse } from './types';
	import {
		sortData,
		filterCustomers,
		getSortIcon,
		getCustomerName,
		getCompanyName,
		getPersonName,
		getAccountManagerName
	} from './utils';
	import ColumnVisibilityControls from './ColumnVisibilityControls.svelte';

	// Stores
	const originalData = writable<Customer[]>([]);
	const tableData = writable<Customer[]>([]);
	const isLoading = writable(true);
	const searchFilters = writable<Record<string, string>>({});
	const sortField = writable<string>('company');
	const sortDirection = writable<'asc' | 'desc'>('asc');
	const currentPageStore = writable(1);
	const itemsPerPage = writable(10);

	// Column visibility with localStorage persistence
	const defaultVisibility = {
		Username: true,
		company: true,
		customerName: true,
		EmailAddress: true,
		phone: true,
		managerName: true,
		OnCreditHold: true,
		DefaultInvoiceTerms: false
	};

	const storedVisibility =
		typeof window !== 'undefined' ? localStorage.getItem('customers-visible-columns') : null;
	const initialVisibility = storedVisibility ? JSON.parse(storedVisibility) : defaultVisibility;

	const visibleColumns = writable<Record<string, boolean>>(initialVisibility);

	// Save to localStorage when visibility changes
	visibleColumns.subscribe((value) => {
		if (typeof window !== 'undefined') {
			localStorage.setItem('customers-visible-columns', JSON.stringify(value));
		}
	});

	// Derived store for paginated data
	const paginatedData = derived(
		[tableData, currentPageStore, itemsPerPage],
		([$tableData, $currentPage, $itemsPerPage]) => {
			const startIndex = ($currentPage - 1) * $itemsPerPage;
			const endIndex = startIndex + $itemsPerPage;
			return $tableData.slice(startIndex, endIndex);
		}
	);

	let error = '';
	let filterTimeout: number;
	let lastFiltersSig = '';

	const API_ENDPOINT =
		'https://prod-56.australiasoutheast.logic.azure.com:443/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=G8m_h5Dl8GpIRQtlN0oShby5zrigLKTWEddou-zGQIs';

	// Column configuration
	const columns = [
		{ key: 'Username', displayName: 'Username', pillName: 'Username', hasSearch: true },
		{ key: 'company', displayName: 'Company', pillName: 'Company', hasSearch: true },
		{
			key: 'customerName',
			displayName: 'Customer Name',
			pillName: 'Customer Name',
			hasSearch: true
		},
		{ key: 'EmailAddress', displayName: 'Email', pillName: 'Email', hasSearch: true },
		{ key: 'phone', displayName: 'Phone', pillName: 'Phone', hasSearch: true },
		{
			key: 'managerName',
			displayName: 'Account Manager',
			pillName: 'Account Manager',
			hasSearch: true
		},
		{ key: 'OnCreditHold', displayName: 'Credit Hold', pillName: 'Credit Hold', hasSearch: true },
		{
			key: 'DefaultInvoiceTerms',
			displayName: 'Invoice Terms',
			pillName: 'Invoice Terms',
			hasSearch: true
		}
	];

	async function fetchCustomers() {
		isLoading.set(true);
		error = '';

		try {
			const response = await fetch(API_ENDPOINT, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					Filter: {
						Active: true,
						Page: 0,
						Limit: 100, // Fetch more records for local filtering
						OutputSelector: [
							'EmailAddress',
							'BillingAddress',
							'AccountManager',
							'OnCreditHold',
							'DefaultInvoiceTerms'
						]
					},
					action: 'GetCustomer'
				})
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data: ApiResponse = await response.json();

			if (data.Ack === 'Success') {
				// Enhance customer data with computed fields
				const enhancedCustomers = data.Customer.map((customer) => ({
					...customer,
					company: getCompanyName(customer),
					customerName: getPersonName(customer),
					displayName: getCustomerName(customer),
					managerName: getAccountManagerName(customer.AccountManager)
				}));

				originalData.set(enhancedCustomers);
				tableData.set(enhancedCustomers);
			} else {
				throw new Error('API returned unsuccessful acknowledgment');
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to fetch customers';
			console.error('Error fetching customers:', err);
		} finally {
			isLoading.set(false);
		}
	}

	// Handle sorting
	function handleSortClick(field: string) {
		const currentSort = $sortField;
		const currentDir = $sortDirection;
		const newDirection: 'asc' | 'desc' =
			currentSort === field && currentDir === 'asc' ? 'desc' : 'asc';

		sortField.set(field);
		sortDirection.set(newDirection);
		tableData.set(sortData($tableData, field, newDirection));
	}

	// Handle search
	function handleSearchChange(key: string, value: string) {
		searchFilters.update((current) => ({ ...current, [key]: value }));
	}

	// Reactive statement to handle searching with debouncing
	$: {
		clearTimeout(filterTimeout);
		filterTimeout = window.setTimeout(() => {
			const filtered = filterCustomers($originalData, $searchFilters);
			tableData.set(filtered);
			const currentSig = JSON.stringify($searchFilters);
			const filtersChanged = currentSig !== lastFiltersSig;
			lastFiltersSig = currentSig;

			const totalPages = Math.max(1, Math.ceil(filtered.length / $itemsPerPage));

			if (filtersChanged) {
				currentPageStore.set(1);
			} else {
				currentPageStore.update((page) => Math.min(page, totalPages));
			}
		}, 150);
	}

	// Pagination handlers
	function handleNextPage() {
		currentPageStore.update((page) => {
			const totalPages = Math.ceil($tableData.length / $itemsPerPage);
			return Math.min(page + 1, totalPages);
		});
	}

	function handlePrevPage() {
		currentPageStore.update((page) => Math.max(page - 1, 1));
	}

	// Column visibility handlers
	function toggleColumnVisibility(columnKey: string) {
		visibleColumns.update((current) => ({ ...current, [columnKey]: !current[columnKey] }));
	}

	function showAllColumns() {
		const allVisible = columns.reduce(
			(acc, col) => {
				acc[col.key] = true;
				return acc;
			},
			{} as Record<string, boolean>
		);
		visibleColumns.set(allVisible);
	}

	function hideAllColumns() {
		const allHidden = columns.reduce(
			(acc, col) => {
				acc[col.key] = false;
				return acc;
			},
			{} as Record<string, boolean>
		);
		visibleColumns.set(allHidden);
	}

	// Computed visible columns
	$: visibleColumnsList = columns.filter((col) => $visibleColumns[col.key]);

	onMount(() => {
		// Fetch customers on mount
		fetchCustomers();

		// Handle sidebar state
		const handleSidebarToggle = (event: CustomEvent) => {
			const mainContent = document.querySelector('main');
			if (mainContent && event.detail.isDesktop) {
				mainContent.style.marginLeft = event.detail.minimized ? '80px' : '280px';
			} else if (mainContent) {
				mainContent.style.marginLeft = '0';
			}
		};

		window.addEventListener('sidebar-toggle', handleSidebarToggle as EventListener);

		return () => {
			window.removeEventListener('sidebar-toggle', handleSidebarToggle as EventListener);
		};
	});

	onDestroy(() => {
		clearTimeout(filterTimeout);
	});
</script>

<main class="min-h-screen bg-gray-50 p-6 transition-all duration-300">
	<div class="mx-auto max-w-7xl">
		<!-- Page Header -->
		<div class="mb-8">
			<h1 class="text-3xl font-bold text-gray-900">Customers</h1>
			<p class="mt-2 text-gray-600">Manage and view customer information</p>
		</div>

		<!-- Loading State -->
		{#if $isLoading}
			<div class="flex items-center justify-center rounded-lg bg-white p-12 shadow-md">
				<div class="text-center">
					<div
						class="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-yellow-500"
					></div>
					<p class="text-gray-600">Loading customers...</p>
				</div>
			</div>
		{:else if error}
			<!-- Error State -->
			<div class="rounded-lg bg-red-50 p-6 shadow-md">
				<div class="flex">
					<div class="flex-shrink-0">
						<svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
							<path
								fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
								clip-rule="evenodd"
							/>
						</svg>
					</div>
					<div class="ml-3">
						<h3 class="text-sm font-medium text-red-800">Error loading customers</h3>
						<div class="mt-2 text-sm text-red-700">
							<p>{error}</p>
						</div>
						<div class="mt-4">
							<button
								on:click={fetchCustomers}
								class="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
							>
								Try Again
							</button>
						</div>
					</div>
				</div>
			</div>
		{:else if $tableData.length === 0 && Object.values($searchFilters).every((v) => !v)}
			<!-- Empty State -->
			<div class="rounded-lg bg-white p-12 text-center shadow-md">
				<p class="text-gray-600">No customers found</p>
			</div>
		{:else}
			<!-- Column Visibility Controls -->
			<ColumnVisibilityControls
				{columns}
				visibleColumns={$visibleColumns}
				onToggle={toggleColumnVisibility}
				onShowAll={showAllColumns}
				onHideAll={hideAllColumns}
			/>

			<!-- Customers Table -->
			<div class="overflow-hidden rounded-lg bg-white shadow-md">
				<div class="overflow-x-auto">
					<table class="min-w-full divide-y divide-gray-200">
						<thead class="bg-gray-50">
							<tr>
								{#each visibleColumnsList as column (column.key)}
									<th
										scope="col"
										class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
									>
										<div class="flex flex-col gap-2">
											<button
												type="button"
												class="cursor-pointer text-left transition-colors hover:text-gray-700"
												on:click={() => handleSortClick(column.key)}
											>
												{column.displayName}
												{getSortIcon(column.key, $sortField, $sortDirection)}
											</button>
											{#if column.hasSearch}
												<input
													type="text"
													placeholder="Search {column.displayName}..."
													class="rounded border px-2 py-1 text-xs"
													value={$searchFilters[column.key] || ''}
													on:input={(e) => handleSearchChange(column.key, e.currentTarget.value)}
												/>
											{/if}
										</div>
									</th>
								{/each}
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200 bg-white">
							{#if $paginatedData.length === 0}
								<tr>
									<td
										colspan={visibleColumnsList.length}
										class="px-6 py-4 text-center text-gray-500"
									>
										No customers match your search criteria.
									</td>
								</tr>
							{:else}
								{#each $paginatedData as customer (customer.Username)}
									<tr class="transition-colors hover:bg-gray-50">
										{#each visibleColumnsList as column (column.key)}
											<td
												class="whitespace-nowrap px-6 py-4 text-sm {column.key === 'Username'
													? 'font-medium text-gray-900'
													: 'text-gray-600'}"
											>
												{#if column.key === 'Username'}
													{customer.Username}
												{:else if column.key === 'company'}
													{customer.company}
												{:else if column.key === 'customerName'}
													{customer.customerName}
												{:else if column.key === 'displayName'}
													{customer.displayName}
												{:else if column.key === 'EmailAddress'}
													{customer.EmailAddress || 'N/A'}
												{:else if column.key === 'phone'}
													{customer.BillingAddress.BillPhone || 'N/A'}
												{:else if column.key === 'managerName'}
													{customer.managerName}
												{:else if column.key === 'OnCreditHold'}
													<span
														class="inline-flex rounded-full px-2 py-1 text-xs font-semibold {customer.OnCreditHold ===
														'True'
															? 'bg-red-100 text-red-800'
															: 'bg-green-100 text-green-800'}"
													>
														{customer.OnCreditHold === 'True' ? 'Yes' : 'No'}
													</span>
												{:else if column.key === 'DefaultInvoiceTerms'}
													{customer.DefaultInvoiceTerms || 'N/A'}
												{/if}
											</td>
										{/each}
									</tr>
								{/each}
							{/if}
						</tbody>
					</table>
				</div>

				<!-- Pagination Controls -->
				{#if $tableData.length > 0}
					<div class="border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
						<div class="flex items-center justify-between">
							<div class="flex flex-1 justify-between sm:hidden">
								<button
									on:click={handlePrevPage}
									disabled={$currentPageStore === 1}
									class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
								>
									Previous
								</button>
								<button
									on:click={handleNextPage}
									disabled={$currentPageStore >= Math.ceil($tableData.length / $itemsPerPage)}
									class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
								>
									Next
								</button>
							</div>
							<div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
								<div>
									<p class="text-sm text-gray-700">
										Showing
										<span class="font-medium">{($currentPageStore - 1) * $itemsPerPage + 1}</span>
										to
										<span class="font-medium"
											>{Math.min($currentPageStore * $itemsPerPage, $tableData.length)}</span
										>
										of
										<span class="font-medium">{$tableData.length}</span>
										results
									</p>
								</div>
								<div>
									<nav
										class="relative z-0 inline-flex -space-x-px rounded-md shadow-sm"
										aria-label="Pagination"
									>
										<button
											on:click={handlePrevPage}
											disabled={$currentPageStore === 1}
											class="relative inline-flex items-center rounded-l-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
										>
											<span class="sr-only">Previous</span>
											<svg
												class="h-5 w-5"
												xmlns="http://www.w3.org/2000/svg"
												viewBox="0 0 20 20"
												fill="currentColor"
												aria-hidden="true"
											>
												<path
													fill-rule="evenodd"
													d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
													clip-rule="evenodd"
												/>
											</svg>
										</button>
										<span
											class="relative inline-flex items-center border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
										>
											Page {$currentPageStore} of {Math.ceil($tableData.length / $itemsPerPage)}
										</span>
										<button
											on:click={handleNextPage}
											disabled={$currentPageStore >= Math.ceil($tableData.length / $itemsPerPage)}
											class="relative inline-flex items-center rounded-r-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
										>
											<span class="sr-only">Next</span>
											<svg
												class="h-5 w-5"
												xmlns="http://www.w3.org/2000/svg"
												viewBox="0 0 20 20"
												fill="currentColor"
												aria-hidden="true"
											>
												<path
													fill-rule="evenodd"
													d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
													clip-rule="evenodd"
												/>
											</svg>
										</button>
									</nav>
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</main>
