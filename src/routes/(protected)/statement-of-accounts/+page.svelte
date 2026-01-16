<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { currentUser } from '$lib/firebase';
	import { toastSuccess, toastError } from '$lib/utils/toast';
	import { supabase } from '$lib/supabase';
	import type { StatementAccount, ColumnKey, Order } from './statementAccounts';
	import { sortField, sortDirection, sortData } from './statementAccounts';
	import { fetchStatementData, generateDocument } from './statementAccountsApi';
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
			const timestamp = new Date().toISOString();

			// 1. Get set of current usernames from the FULL data pull
			const currentApiUsernames = new Set(statementAccounts.map((a) => a.username));

			// 2. Fetch ALL existing records to synchronize state
			const { data: allDbRecords, error: fetchError } = await supabase
				.from('statement_of_accounts')
				.select('id, customer_username');

			if (fetchError) throw fetchError;

			const updates: any[] = [];
			const inserts: any[] = [];
			const processedUsernames = new Set<string>();

			// 3. Process existing DB records
			// Update their status based on whether they are in the current API fetch
			if (allDbRecords) {
				for (const record of allDbRecords) {
					updates.push({
						id: record.id,
						customer_username: record.customer_username,
						exists_in_statements_list: currentApiUsernames.has(record.customer_username),
						last_check: timestamp
					});
					processedUsernames.add(record.customer_username);
				}
			}

			// 4. Process NEW API records (those not found in DB)
			for (const account of statementAccounts) {
				if (!processedUsernames.has(account.username)) {
					inserts.push({
						customer_username: account.username,
						exists_in_statements_list: true,
						last_check: timestamp
					});
					// Mark as processed to handle potential duplicates in API list (though unrelated to DB)
					processedUsernames.add(account.username);
				}
			}

			if (updates.length === 0 && inserts.length === 0) {
				toastSuccess('No changes to save.');
				return;
			}

			// 5. Perform Database Operations
			const promises = [];

			if (updates.length > 0) {
				promises.push(supabase.from('statement_of_accounts').upsert(updates));
			}

			if (inserts.length > 0) {
				promises.push(supabase.from('statement_of_accounts').insert(inserts));
			}

			const results = await Promise.all(promises);

			// Check for errors in any of the results
			for (const result of results) {
				if (result.error) throw result.error;
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

	// Format date (used in filtering)
	function formatDate(dateString: string | null): string {
		if (!dateString) return '—';
		const date = new Date(dateString);
		if (isNaN(date.getTime())) return '—';
		return date.toLocaleDateString('en-AU');
	}

	// Check statement status from Supabase
	async function check_soa_status(accounts: StatementAccount[]) {
		try {
			if (accounts.length === 0) return;

			const usernames = accounts.map((a) => a.username);

			// Chunk usernames if there are too many to avoid URL length issues
			// Supabase generic limit is quite high, but good practice
			const { data, error } = await supabase
				.from('statement_of_accounts')
				.select(
					`
					customer_username,
					last_sent,
					last_check,
					last_file_generation,
					statement_of_accounts_pdf_files (
						onedrive_id
					)
				`
				)
				.in('customer_username', usernames);

			if (error) {
				console.error('Error fetching statement status:', error);
				return;
			}

			if (data) {
				const statusMap = new Map(data.map((item) => [item.customer_username, item]));

				// Update accounts withfetched status
				statementAccounts = statementAccounts.map((account) => {
					const status = statusMap.get(account.username);
					if (status) {
						// Extract onedrive_id safely from the joined relationship
						const pdfFile = status.statement_of_accounts_pdf_files;
						// Supabase returns an object or array depending on relation type, usually object for single relation or array for many
						// Assuming one-to-one or taking the first if array
						const oneDriveId = Array.isArray(pdfFile)
							? pdfFile[0]?.onedrive_id
							: (pdfFile as any)?.onedrive_id;

						return {
							...account,
							lastSent: status.last_sent,
							lastCheck: status.last_check,
							lastFileGeneration: status.last_file_generation,
							oneDriveId: oneDriveId || null
						};
					}
					return account;
				});
			}
		} catch (err) {
			console.error('Error in check_soa_status:', err);
		}
	}

	// Load statement accounts data
	async function loadStatementAccounts() {
		try {
			isLoading = true;
			error = '';

			const { accounts, orders } = await fetchStatementData();
			rawOrders = orders; // Store raw orders for printing
			statementAccounts = accounts; // Use pre-aggregated accounts from API

			// Log filtering stats
			console.log(JSON.stringify({
				stats: {
					api_orders_fetched: orders.length,
					unique_customers: accounts.length,
				}
			}, null, 2));

			// Check status after loading accounts
			await check_soa_status(accounts);
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
		const toastId = toastSuccess(`Generating document for ${companyName}...`);

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

				// 1. Insert into statement_of_accounts_pdf_files
				const { data: pdfFile, error: pdfError } = await supabase
					.from('statement_of_accounts_pdf_files')
					.insert({
						file_name: generationResponse.file_name,
						folder_path: generationResponse.folder_path,
						// Use the response created_at if available, otherwise now
						created_at: generationResponse.created_at || new Date().toISOString(),
						created_by: generationResponse.created_by,
						onedrive_id: generationResponse.onedrive_id,
						customer_username: generationResponse.customer_username
					})
					.select()
					.single();

				if (pdfError) {
					console.error('Error saving PDF file record:', pdfError);
					toastError('Document generated but failed to save record.');
				} else if (pdfFile) {
					// 2. Update statement_of_accounts
					// Find the account record by customer_username
					const { error: accountError } = await supabase
						.from('statement_of_accounts')
						.update({
							last_file_generation: pdfFile.created_at,
							statement_of_accounts_pdf_files_id: pdfFile.id
						})
						.eq('customer_username', generationResponse.customer_username);

					if (accountError) {
						console.error('Error updating account record:', accountError);
						// Not critical enough to fail the whole process visually if the PDF was generated
					}
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

	function handleExportCSV() {
		if (sortedStatementAccounts.length === 0) {
			toastError('No data to export');
			return;
		}

		// Create CSV content
		const headers = ['customer_username', 'total_invoices', 'all_invoices_balance', 'due_invoice_balance', 'total_balance_customer'];
		const csvContent = [
			headers.join(','),
			...sortedStatementAccounts.map(account =>
				[
					account.username,
					account.totalInvoices,
					account.allInvoicesBalance.toFixed(2),
					account.dueInvoiceBalance.toFixed(2),
					account.totalBalanceCustomer !== null ? account.totalBalanceCustomer.toFixed(2) : 'N/A'
				].join(',')
			)
		].join('\n');

		// Create and download file
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');
		const url = URL.createObjectURL(blob);

		link.setAttribute('href', url);
		link.setAttribute('download', `statement_accounts_${new Date().toISOString().split('T')[0]}.csv`);
		link.style.visibility = 'hidden';

		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);

		toastSuccess(`Exported ${sortedStatementAccounts.length} accounts to CSV`);
	}

	// Reactive filtered and sorted statement accounts
	$: filteredStatementAccounts = (() => {
		// First filter the accounts
		let filtered = statementAccounts.filter((account) => {
			return Object.entries(searchFilters).every(([key, value]) => {
				if (!value) return true;
				const normalizedValue = value.toLowerCase();
				const columnKey = key as ColumnKey;

				if (columnKey === 'companyName') {
					return account.companyName.toLowerCase().includes(normalizedValue);
				} else if (columnKey === 'username') {
					return account.username.toLowerCase().includes(normalizedValue);
				} else if (columnKey === 'totalInvoices') {
					return account.totalInvoices.toString().includes(normalizedValue);
				} else if (columnKey === 'allInvoicesBalance') {
					return account.allInvoicesBalance.toString().includes(normalizedValue);
				} else if (columnKey === 'dueInvoiceBalance') {
					return account.dueInvoiceBalance.toString().includes(normalizedValue);
				} else if (columnKey === 'totalBalanceCustomer') {
					return account.totalBalanceCustomer?.toString().includes(normalizedValue) || false;
				} else if (columnKey === 'lastSent') {
					const dateValue = account[columnKey];
					if (!dateValue) return false;
					return formatDate(dateValue).toLowerCase().includes(normalizedValue);
				}

				return true;
			});
		});

		return filtered;
	})();

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
	</div>
</main>
