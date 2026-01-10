<script lang="ts">
	import { onMount } from 'svelte';
	import { toastSuccess } from '$lib/utils/toast';
	import type { Order, StatementAccount, ColumnKey } from './statementAccounts';

	// Data state
	let statementAccounts: StatementAccount[] = [];
	let isLoading = true;
	let error = '';

	// Search state
	let searchFilters: Partial<Record<ColumnKey, string>> = {};

	// Pagination state
	let currentPage = 1;
	let itemsPerPage = 25;
	let totalPages = 1;

	async function fetchOrders(): Promise<Order[]> {
		try {
			const response = await fetch(
				'https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=pPhk80gODQOi843ixLjZtPPWqTeXIbIt9ifWZP6CJfY',
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						Filter: {
							OrderStatus: ['Dispatched'],
							PaymentStatus: ['Pending', 'PartialPaid'],
							OutputSelector: [
								'ID',
								'Username',
								'DatePaymentDue',
								'OrderPayment',
								'GrandTotal',
								'DatePlaced',
								'BillAddress',
								'Email'
							]
						},
						action: 'GetOrder'
					})
				}
			);

			if (!response.ok) {
				throw new Error('Failed to fetch orders');
			}

			const data = await response.json();

			if (data && data.Order) {
				return data.Order;
			}

			return [];
		} catch (e) {
			console.error('Error fetching orders:', e);
			throw e;
		}
	}

	// Search functionality
	function handleSearchChange(key: ColumnKey, value: string) {
		searchFilters = { ...searchFilters, [key]: value };
		currentPage = 1; // Reset to first page when search changes
	}

	// Pagination functions
	function goToPage(page: number) {
		if (page >= 1 && page <= totalPages) {
			currentPage = page;
		}
	}

	function nextPage() {
		if (currentPage < totalPages) {
			currentPage++;
		}
	}

	function previousPage() {
		if (currentPage > 1) {
			currentPage--;
		}
	}

	function changeItemsPerPage(newItemsPerPage: number) {
		itemsPerPage = newItemsPerPage;
		currentPage = 1; // Reset to first page when changing items per page
	}

	// Format currency
	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-AU', {
			style: 'currency',
			currency: 'AUD'
		}).format(amount);
	}

	// Format date
	function formatDate(dateString: string | null): string {
		if (!dateString) return '—';
		const date = new Date(dateString);
		if (isNaN(date.getTime())) return '—';
		return date.toLocaleDateString('en-AU');
	}

	// Placeholder action handlers
	async function handleGenerateDocument(account: StatementAccount) {
		toastSuccess(`Generate Document clicked for ${account.customer}`);
		// TODO: Implement actual document generation
	}

	async function handleSendStatement(account: StatementAccount) {
		toastSuccess(`Send Statement clicked for ${account.customer}`);
		// TODO: Implement actual statement sending
	}

	// Load statement accounts data
	async function loadStatementAccounts() {
		try {
			isLoading = true;
			error = '';

			// Fetch orders from API
			const orders = await fetchOrders();

			// Import the aggregation function dynamically to avoid import issues
			const { aggregateByCustomer } = await import('./statementAccounts');

			// Aggregate orders by customer
			statementAccounts = aggregateByCustomer(orders);
		} catch (err) {
			console.error('Error loading statement accounts:', err);
			error = err instanceof Error ? err.message : 'Failed to load statement accounts';
		} finally {
			isLoading = false;
		}
	}

	// Reactive filtered statement accounts
	$: filteredStatementAccounts = statementAccounts
		.filter((account) => {
			return Object.entries(searchFilters).every(([key, value]) => {
				if (!value) return true;
				const normalizedValue = value.toLowerCase();
				const columnKey = key as ColumnKey;

				if (columnKey === 'customer') {
					return account.customer.toLowerCase().includes(normalizedValue);
				} else if (columnKey === 'totalInvoices') {
					return account.totalInvoices.toString().includes(normalizedValue);
				} else if (columnKey === 'grandTotal') {
					return account.grandTotal.toString().includes(normalizedValue);
				} else if (columnKey === 'lastSent' || columnKey === 'nextSchedule') {
					const dateValue = account[columnKey];
					if (!dateValue) return false;
					return formatDate(dateValue).toLowerCase().includes(normalizedValue);
				}

				return true;
			});
		})
		.sort((a, b) => a.customer.localeCompare(b.customer)); // Default sort by customer name

	// Pagination calculations
	$: totalPages = Math.ceil(filteredStatementAccounts.length / itemsPerPage);
	$: paginatedStatementAccounts = filteredStatementAccounts.slice(
		(currentPage - 1) * itemsPerPage,
		currentPage * itemsPerPage
	);

	// Handle edge cases for pagination
	$: if (currentPage > totalPages && totalPages > 0) {
		currentPage = totalPages;
	}
	$: if (currentPage < 1) {
		currentPage = 1;
	}

	// localStorage persistence for pagination
	$: {
		if (typeof window !== 'undefined') {
			localStorage.setItem('statement-accounts-current-page', String(currentPage));
			localStorage.setItem('statement-accounts-items-per-page', String(itemsPerPage));
		}
	}

	onMount(() => {
		// Load pagination preferences from localStorage
		if (typeof window !== 'undefined') {
			const storedCurrentPage = localStorage.getItem('statement-accounts-current-page');
			const storedItemsPerPage = localStorage.getItem('statement-accounts-items-per-page');

			if (storedCurrentPage) currentPage = Number(storedCurrentPage);
			if (storedItemsPerPage) itemsPerPage = Number(storedItemsPerPage);
		}

		loadStatementAccounts();
	});
</script>

<main class="min-h-screen bg-gray-50 p-6 transition-all duration-300">
	<div class="mx-auto max-w-7xl">
		<!-- Page Header -->
		<div class="mb-8">
			<h1 class="text-3xl font-bold text-gray-900">Statement of Accounts</h1>
			<p class="mt-2 text-gray-600">View and manage customer account statements</p>
		</div>

		<!-- Loading State -->
		{#if isLoading}
			<div class="flex items-center justify-center rounded-lg bg-white p-12 shadow-md">
				<div class="text-center">
					<div
						class="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-yellow-500"
					></div>
					<p class="text-gray-600">Loading statement accounts...</p>
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
						<h3 class="text-sm font-medium text-red-800">Error loading statement accounts</h3>
						<div class="mt-2 text-sm text-red-700">
							<p>{error}</p>
						</div>
						<div class="mt-4">
							<button
								on:click={loadStatementAccounts}
								class="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
							>
								Try Again
							</button>
						</div>
					</div>
				</div>
			</div>
		{:else if statementAccounts.length === 0}
			<!-- Empty State (No Data) -->
			<div class="rounded-lg bg-white p-12 text-center shadow-md">
				<svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
					/>
				</svg>
				<h3 class="mt-2 text-sm font-medium text-gray-900">No statement accounts</h3>
				<p class="mt-1 text-sm text-gray-500">No statement accounts found at this time.</p>
			</div>
		{:else if filteredStatementAccounts.length === 0}
			<!-- Empty State (Filtered Results) -->
			<div class="rounded-lg bg-white p-12 text-center shadow-md">
				<svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
					/>
				</svg>
				<h3 class="mt-2 text-sm font-medium text-gray-900">No results found</h3>
				<p class="mt-1 text-sm text-gray-500">No statement accounts match your search criteria.</p>
				<div class="mt-4">
					<button
						on:click={() => searchFilters = {}}
						class="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
					>
						Clear Filters
					</button>
				</div>
			</div>
		{:else}
			<!-- Table Container -->
			<div class="overflow-hidden rounded-lg bg-white shadow-md">
				<div class="overflow-x-auto">
					<table class="min-w-full divide-y divide-gray-200">
						<thead class="bg-gray-50">
							<tr>
								<th scope="col" class="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
									<div class="flex flex-col gap-2">
										Customer
										<input
											type="text"
											placeholder="Search..."
											class="w-full rounded border px-2 py-1 text-xs font-normal text-gray-900"
											value={searchFilters['customer'] || ''}
											on:input={(e) => handleSearchChange('customer', e.currentTarget.value)}
										/>
									</div>
								</th>
								<th scope="col" class="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
									<div class="flex flex-col gap-2">
										Total Invoices
										<input
											type="text"
											placeholder="Search..."
											class="w-full rounded border px-2 py-1 text-xs font-normal text-gray-900"
											value={searchFilters['totalInvoices'] || ''}
											on:input={(e) => handleSearchChange('totalInvoices', e.currentTarget.value)}
										/>
									</div>
								</th>
								<th scope="col" class="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
									<div class="flex flex-col gap-2">
										Grand Total
										<input
											type="text"
											placeholder="Search..."
											class="w-full rounded border px-2 py-1 text-xs font-normal text-gray-900"
											value={searchFilters['grandTotal'] || ''}
											on:input={(e) => handleSearchChange('grandTotal', e.currentTarget.value)}
										/>
									</div>
								</th>
								<th scope="col" class="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
									<div class="flex flex-col gap-2">
										Last Sent
										<input
											type="text"
											placeholder="Search..."
											class="w-full rounded border px-2 py-1 text-xs font-normal text-gray-900"
											value={searchFilters['lastSent'] || ''}
											on:input={(e) => handleSearchChange('lastSent', e.currentTarget.value)}
										/>
									</div>
								</th>
								<th scope="col" class="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
									<div class="flex flex-col gap-2">
										Next Schedule
										<input
											type="text"
											placeholder="Search..."
											class="w-full rounded border px-2 py-1 text-xs font-normal text-gray-900"
											value={searchFilters['nextSchedule'] || ''}
											on:input={(e) => handleSearchChange('nextSchedule', e.currentTarget.value)}
										/>
									</div>
								</th>
								<th scope="col" class="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
									Generate Document
								</th>
								<th scope="col" class="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
									Send Statement
								</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200 bg-white">
							{#each paginatedStatementAccounts as account}
								<tr class="hover:bg-gray-50">
									<td class="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
										{account.customer}
									</td>
									<td class="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
										{account.totalInvoices}
									</td>
									<td class="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
										{formatCurrency(account.grandTotal)}
									</td>
									<td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
										{formatDate(account.lastSent)}
									</td>
									<td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
										{formatDate(account.nextSchedule)}
									</td>
									<td class="whitespace-nowrap px-6 py-4 text-sm">
										<button
											on:click={() => handleGenerateDocument(account)}
											class="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
										>
											Generate
										</button>
									</td>
									<td class="whitespace-nowrap px-6 py-4 text-sm">
										<button
											on:click={() => handleSendStatement(account)}
											class="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
										>
											Send
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<!-- Pagination Controls -->
			{#if filteredStatementAccounts.length > 0}
				<div class="mt-4 flex flex-col items-center justify-between gap-4 sm:flex-row">
					<!-- Items per page selector -->
					<div class="flex items-center gap-2">
						<label for="items-per-page" class="text-sm text-gray-700 dark:text-gray-300">
							Show:
						</label>
						<select
							id="items-per-page"
							bind:value={itemsPerPage}
							on:change={(e) => changeItemsPerPage(Number(e.currentTarget.value))}
							class="rounded-md border border-gray-300 py-1 pl-3 pr-8 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
						>
							<option value={10}>10</option>
							<option value={25}>25</option>
							<option value={50}>50</option>
							<option value={100}>100</option>
						</select>
						<span class="text-sm text-gray-700 dark:text-gray-300">
							entries per page
						</span>
					</div>

					<!-- Pagination info and controls -->
					<div class="flex items-center gap-4">
						<div class="text-sm text-gray-700 dark:text-gray-300">
							Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredStatementAccounts.length)} to {Math.min(currentPage * itemsPerPage, filteredStatementAccounts.length)} of {filteredStatementAccounts.length} entries
						</div>

						<div class="flex items-center gap-1">
							<button
								type="button"
								on:click={previousPage}
								disabled={currentPage === 1}
								class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
								title="Previous page"
							>
								<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
								</svg>
							</button>

							<!-- Page numbers -->
							{#each Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
								const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
								return pageNum <= totalPages ? pageNum : null;
							}).filter(Boolean) as pageNum}
								<button
									type="button"
									on:click={() => goToPage(pageNum)}
									class="rounded-md px-3 py-1.5 text-sm font-medium {pageNum === currentPage
										? 'border border-indigo-500 bg-indigo-50 text-indigo-600 dark:border-indigo-400 dark:bg-indigo-900/30 dark:text-indigo-400'
										: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}"
								>
									{pageNum}
								</button>
							{/each}

							<button
								type="button"
								on:click={nextPage}
								disabled={currentPage === totalPages}
								class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
								title="Next page"
							>
								<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
								</svg>
							</button>
						</div>
					</div>
				</div>
			{/if}
		{/if}
	</div>
</main>