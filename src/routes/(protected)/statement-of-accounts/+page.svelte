<script lang="ts">
	import { onMount } from 'svelte';
	import { toastSuccess } from '$lib/utils/toast';
	import type { StatementAccount, ColumnKey } from './statementAccounts';
	import { aggregateByCustomer } from './statementAccounts';
	import { fetchOrders } from './statementAccountsApi';

	// Components
	import LoadingState from './components/LoadingState.svelte';
	import ErrorState from './components/ErrorState.svelte';
	import EmptyState from './components/EmptyState.svelte';
	import StatementAccountsTable from './components/StatementAccountsTable.svelte';
	import Pagination from './components/Pagination.svelte';

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

	// Format date (used in filtering)
	function formatDate(dateString: string | null): string {
		if (!dateString) return '—';
		const date = new Date(dateString);
		if (isNaN(date.getTime())) return '—';
		return date.toLocaleDateString('en-AU');
	}

	// Load statement accounts data
	async function loadStatementAccounts() {
		try {
			isLoading = true;
			error = '';

			const orders = await fetchOrders();
			statementAccounts = aggregateByCustomer(orders);
		} catch (err) {
			console.error('Error loading statement accounts:', err);
			error = err instanceof Error ? err.message : 'Failed to load statement accounts';
		} finally {
			isLoading = false;
		}
	}

	// Event handlers
	function handleSearchChange(event: CustomEvent<{ key: ColumnKey; value: string }>) {
		searchFilters = { ...searchFilters, [event.detail.key]: event.detail.value };
		currentPage = 1;
	}

	function handlePageChange(event: CustomEvent<number>) {
		currentPage = event.detail;
	}

	function handleItemsPerPageChange(event: CustomEvent<number>) {
		itemsPerPage = event.detail;
		currentPage = 1;
	}

	function handleClearFilters() {
		searchFilters = {};
	}

	function handleGenerateDocument(event: CustomEvent<StatementAccount>) {
		toastSuccess(`Generate Document clicked for ${event.detail.customer}`);
	}

	function handleSendStatement(event: CustomEvent<StatementAccount>) {
		toastSuccess(`Send Statement clicked for ${event.detail.customer}`);
	}

	function handlePrint(event: CustomEvent<StatementAccount>) {
		toastSuccess(`Print clicked for ${event.detail.customer}`);
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
		.sort((a, b) => a.customer.localeCompare(b.customer));

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

		{#if isLoading}
			<LoadingState />
		{:else if error}
			<ErrorState {error} on:retry={loadStatementAccounts} />
		{:else if statementAccounts.length === 0}
			<EmptyState hasData={false} />
		{:else if filteredStatementAccounts.length === 0}
			<EmptyState hasData={true} on:clearFilters={handleClearFilters} />
		{:else}
			<StatementAccountsTable
				accounts={paginatedStatementAccounts}
				{searchFilters}
				on:searchChange={handleSearchChange}
				on:generateDocument={handleGenerateDocument}
				on:sendStatement={handleSendStatement}
				on:print={handlePrint}
			/>

			{#if filteredStatementAccounts.length > 0}
				<Pagination
					{currentPage}
					{totalPages}
					{itemsPerPage}
					totalItems={filteredStatementAccounts.length}
					on:pageChange={handlePageChange}
					on:itemsPerPageChange={handleItemsPerPageChange}
				/>
			{/if}
		{/if}
	</div>
</main>