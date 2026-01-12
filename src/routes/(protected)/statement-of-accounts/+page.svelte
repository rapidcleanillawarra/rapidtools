<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { currentUser } from '$lib/firebase';
	import { toastSuccess, toastError } from '$lib/utils/toast';
	import { supabase } from '$lib/supabase';
	import type { StatementAccount, ColumnKey, Order } from './statementAccounts';
	import { aggregateByCustomer } from './statementAccounts';
	import { fetchOrders, generateDocument } from './statementAccountsApi';
	import { handlePrintStatement, generateStatementHtml, getCustomerInvoices } from './utils/print';

	// Components
	import LoadingState from './components/LoadingState.svelte';
	import ErrorState from './components/ErrorState.svelte';
	import EmptyState from './components/EmptyState.svelte';
	import StatementAccountsTable from './components/StatementAccountsTable.svelte';
	import Pagination from './components/Pagination.svelte';

	// Data state
	let statementAccounts: StatementAccount[] = [];
	let rawOrders: Order[] = [];
	let isLoading = true;
	let isSaving = false;
	let error = '';

	// Save to Supabase
	// Save to Supabase
	async function saveToSupabase() {
		try {
			isSaving = true;

			// 1. Get set of current usernames from the FULL data pull
			const currentApiUsernames = new Set(statementAccounts.map((a) => a.username));

			// 2. Fetch ALL existing records to synchronize state
			const { data: allDbRecords, error: fetchError } = await supabase
				.from('statement_of_accounts')
				.select('id, customer_username');

			if (fetchError) throw fetchError;

			const upsertPayload: any[] = [];
			const processedUsernames = new Set<string>();

			// 3. Process existing DB records
			// Update their status based on whether they are in the current API fetch
			if (allDbRecords) {
				for (const record of allDbRecords) {
					upsertPayload.push({
						id: record.id,
						customer_username: record.customer_username,
						exists_in_statements_list: currentApiUsernames.has(record.customer_username)
					});
					processedUsernames.add(record.customer_username);
				}
			}

			// 4. Process NEW API records (those not found in DB)
			for (const account of statementAccounts) {
				if (!processedUsernames.has(account.username)) {
					upsertPayload.push({
						customer_username: account.username,
						exists_in_statements_list: true
					});
					// Mark as processed to handle potential duplicates in API list (though unrelated to DB)
					processedUsernames.add(account.username);
				}
			}

			if (upsertPayload.length === 0) {
				toastSuccess('No changes to save.');
				return;
			}

			// 5. Upsert EVERYTHING
			const { error: upsertError } = await supabase
				.from('statement_of_accounts')
				.upsert(upsertPayload);

			if (upsertError) throw upsertError;

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
			rawOrders = orders; // Store raw orders for printing
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

	async function handleGenerateDocument(event: CustomEvent<StatementAccount>) {
		const customerName = event.detail.customer;
		const toastId = toastSuccess(`Generating document for ${customerName}...`);

		try {
			// Get invoices for this customer
			const invoices = getCustomerInvoices(rawOrders, customerName);

			if (invoices.length === 0) {
				throw new Error(`No outstanding invoices found for ${customerName}`);
			}

			// Generate HTML with placeholders for images
			const htmlContent = generateStatementHtml(customerName, invoices, true);

			// Generate Filename: Statement_CustomerName_YYYY-MM-DD (No extension)
			const cleanName = customerName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
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
			await generateDocument(htmlContent, fileName, folderName, event.detail.username, createdBy);

			toastSuccess(`Document generated successfully for ${customerName}`);
		} catch (err) {
			console.error('Error generating document:', err);
			const message = err instanceof Error ? err.message : 'Failed to generate document';
			toastError(message);
		}
	}

	function handleSendStatement(event: CustomEvent<StatementAccount>) {
		toastSuccess(`Send Statement clicked for ${event.detail.customer}`);
	}

	function handlePrint(event: CustomEvent<StatementAccount>) {
		try {
			handlePrintStatement(event.detail.customer, rawOrders);
			toastSuccess(`Opening print preview for ${event.detail.customer}`);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to print';
			toastError(message);
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
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold text-gray-700">Accounts List</h2>
				<button
					class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					on:click={saveToSupabase}
					disabled={isSaving || filteredStatementAccounts.length === 0}
				>
					{isSaving ? 'Saving...' : 'Save to Supabase'}
				</button>
			</div>

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
