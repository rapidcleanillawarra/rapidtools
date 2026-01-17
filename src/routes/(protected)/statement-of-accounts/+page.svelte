<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { currentUser } from '$lib/firebase';
	import { toastSuccess, toastError } from '$lib/utils/toast';
	import type { StatementAccount, ColumnKey, Order } from './statementAccounts';
	import { sortField, sortDirection, sortData, visibleColumns } from './statementAccounts';
	import { fetchStatementData, generateDocument } from './statementAccountsApi';
	import { handlePrintStatement, generateStatementHtml, getCustomerInvoices } from './utils/print';
	import { downloadStatementAccountsCsv } from './utils/csv';
	import { filterStatementAccounts } from './utils/filtering';
	import {
		enrichAccountsWithSoaStatus,
		recordGeneratedStatementPdfFile,
		syncAccountsToSupabase,
		type GeneratedStatementDocumentInfo
	} from './utils/supabaseStatements';
	import {
		loadStatementAccountsPreferences,
		saveStatementAccountsPaginationPreferences,
		saveStatementAccountsSortingPreferences,
		saveStatementAccountsVisibleColumnsPreferences
	} from './utils/preferences';

	// Components
	import LoadingState from './components/LoadingState.svelte';
	import ErrorState from './components/ErrorState.svelte';
	import EmptyState from './components/EmptyState.svelte';
	import StatementAccountsTable from './components/StatementAccountsTable.svelte';
	import Pagination from './components/Pagination.svelte';
	import OrdersModal from './components/OrdersModal.svelte';

	// Data state
	let statementAccounts: StatementAccount[] = [];
	let rawOrders: Order[] = [];
	let isLoading = true;
	let isSaving = false;
	let error = '';

	let filteredStatementAccounts: StatementAccount[] = [];
	let sortedStatementAccounts: StatementAccount[] = [];
	let paginatedStatementAccounts: StatementAccount[] = [];

	// Modal state
	let showOrdersModal = false;
	let selectedAccount: StatementAccount | null = null;

	// Save to Supabase
	async function saveToSupabase() {
		try {
			isSaving = true;
			const { updates, inserts } = await syncAccountsToSupabase(statementAccounts);

			if (updates === 0 && inserts === 0) {
				toastSuccess('No changes to save.');
				return;
			}

			toastSuccess('Data synchronized with Supabase successfully');
		} catch (err) {
			console.error('Error saving to Supabase:', err);
			toastError('Failed to save data to Supabase');
		} finally {
			isSaving = false;
		}
	}

	// Search state
	let searchFilters: Partial<Record<ColumnKey, string>> = {};

	// Pagination state
	let currentPage = 1;
	let itemsPerPage = 25;
	let totalPages = 1;

	// Load statement accounts data
	async function loadStatementAccounts() {
		try {
			isLoading = true;
			error = '';

			const { accounts, orders } = await fetchStatementData();
			rawOrders = orders; // Store raw orders for printing

			// Log filtering stats
			console.log(
				JSON.stringify(
					{
						stats: {
							api_orders_fetched: orders.length,
							unique_customers: accounts.length
						}
					},
					null,
					2
				)
			);

			// Check status after loading accounts
			statementAccounts = await enrichAccountsWithSoaStatus(accounts);
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

	function handleSortChange(event: CustomEvent<{ field: ColumnKey; direction: 'asc' | 'desc' }>) {
		const { field, direction } = event.detail;
		sortField.set(field);
		sortDirection.set(direction);
	}

	async function handleGenerateDocument(event: CustomEvent<StatementAccount>) {
		const companyName = event.detail.companyName;
		toastSuccess(`Generating document for ${companyName}...`);

		try {
			// Get invoices for this customer
			const invoices = getCustomerInvoices(rawOrders, companyName, event.detail.username);

			if (invoices.length === 0) {
				throw new Error(`No outstanding invoices found for ${companyName}`);
			}

			// Generate HTML with placeholders for images
			const htmlContent = generateStatementHtml(companyName, invoices, true);

			// Generate Filename: Statement_CompanyName_YYYY-MM-DD (No extension)
			const cleanName = companyName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
			const now = new Date();
			const dateStr = now.toISOString().split('T')[0];
			const fileName = `Statement_${cleanName}_${dateStr}`;

			// Generate Folder Name: Statement_Month_Day_Year
			const month = now.toLocaleString('en-US', { month: 'long' });
			const day = now.getDate();
			const year = now.getFullYear();
			const folderName = `Statement_${month}_${day}_${year}`;

			// Call API
			const user = get(currentUser);
			const createdBy = user?.email || '';
			const generationResponse = await generateDocument(
				htmlContent,
				fileName,
				folderName,
				event.detail.username,
				createdBy
			);

			// Update Supabase tables
			if (generationResponse) {
				console.log('Generation Response:', generationResponse);

				const { pdfError, accountError } = await recordGeneratedStatementPdfFile(
					generationResponse as GeneratedStatementDocumentInfo
				);

				if (pdfError) {
					console.error('Error saving PDF file record:', pdfError);
					toastError('Document generated but failed to save record.');
				}

				if (accountError) {
					console.error('Error updating account record:', accountError);
				}
			}

			toastSuccess(`Document generated successfully for ${companyName}`);
		} catch (err) {
			console.error('Error generating document:', err);
			const message = err instanceof Error ? err.message : 'Failed to generate document';
			toastError(message);
		}
	}

	function handleSendStatement(event: CustomEvent<StatementAccount>) {
		toastSuccess(`Send Statement clicked for ${event.detail.companyName}`);
	}

	function handlePrint(event: CustomEvent<StatementAccount>) {
		try {
			handlePrintStatement(event.detail.companyName, event.detail.username, rawOrders);
			toastSuccess(`Opening print preview for ${event.detail.companyName}`);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to print';
			toastError(message);
		}
	}

	function handleViewOrders(event: CustomEvent<StatementAccount>) {
		selectedAccount = event.detail;
		showOrdersModal = true;
	}

	function handleCloseOrdersModal() {
		showOrdersModal = false;
		selectedAccount = null;
	}

	function handleExportCSV() {
		if (sortedStatementAccounts.length === 0) {
			toastError('No data to export');
			return;
		}

		downloadStatementAccountsCsv(sortedStatementAccounts);

		toastSuccess(`Exported ${sortedStatementAccounts.length} accounts to CSV`);
	}

	// Reactive filtered and sorted statement accounts
	$: filteredStatementAccounts = filterStatementAccounts(statementAccounts, searchFilters);

	// Apply sorting reactively
	$: sortedStatementAccounts = (() => {
		if ($sortField && filteredStatementAccounts.length > 0) {
			return sortData(filteredStatementAccounts, $sortField, $sortDirection);
		}
		return filteredStatementAccounts;
	})();

	// Pagination calculations
	$: totalPages = Math.ceil(sortedStatementAccounts.length / itemsPerPage);
	$: paginatedStatementAccounts = sortedStatementAccounts.slice(
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
	$: saveStatementAccountsPaginationPreferences(currentPage, itemsPerPage);

	// localStorage persistence for column visibility
	$: saveStatementAccountsVisibleColumnsPreferences($visibleColumns);

	// localStorage persistence for sorting
	$: saveStatementAccountsSortingPreferences($sortField, $sortDirection);

	onMount(() => {
		const preferences = loadStatementAccountsPreferences();

		if (preferences.currentPage) currentPage = preferences.currentPage;
		if (preferences.itemsPerPage) itemsPerPage = preferences.itemsPerPage;

		if (preferences.visibleColumns) {
			visibleColumns.update((current) => ({ ...current, ...preferences.visibleColumns }));
		}

		if (preferences.sortField) sortField.set(preferences.sortField);
		if (preferences.sortDirection) sortDirection.set(preferences.sortDirection);

		loadStatementAccounts();
	});
</script>

<main class="min-h-screen bg-gray-50 px-8 py-6 transition-all duration-300">
	<div class="mx-auto max-w-full">
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
		{:else if sortedStatementAccounts.length === 0}
			<EmptyState hasData={true} on:clearFilters={handleClearFilters} />
		{:else}
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold text-gray-700">Accounts List</h2>
				<div class="flex gap-2">
					<button
						class="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
						on:click={handleExportCSV}
						disabled={sortedStatementAccounts.length === 0}
					>
						Export CSV
					</button>
					<button
						class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
						on:click={saveToSupabase}
						disabled={isSaving || sortedStatementAccounts.length === 0}
					>
						{isSaving ? 'Saving...' : 'Save to Supabase'}
					</button>
				</div>
			</div>

			<StatementAccountsTable
				accounts={paginatedStatementAccounts}
				{searchFilters}
				on:searchChange={handleSearchChange}
				on:sortChange={handleSortChange}
				on:generateDocument={handleGenerateDocument}
				on:sendStatement={handleSendStatement}
				on:print={handlePrint}
				on:viewOrders={handleViewOrders}
			/>

			{#if sortedStatementAccounts.length > 0}
				<Pagination
					{currentPage}
					{totalPages}
					{itemsPerPage}
					totalItems={sortedStatementAccounts.length}
					on:pageChange={handlePageChange}
					on:itemsPerPageChange={handleItemsPerPageChange}
				/>
			{/if}
		{/if}

		<!-- Orders Modal -->
		<OrdersModal
			show={showOrdersModal}
			account={selectedAccount}
			orders={rawOrders}
			on:close={handleCloseOrdersModal}
		/>
	</div>
</main>
