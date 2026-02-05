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
		getAccountManagerName,
		validateEmail,
		getEmailValidationError
	} from './utils';
	import { toastSuccess, toastError } from '$lib/utils/toast';
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
		DefaultInvoiceTerms: false,
		AccountBalance: true
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
		},
		{
			key: 'AccountBalance',
			displayName: 'Account Balance',
			pillName: 'Balance',
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
						// Page: 0,
						// Limit: 100, // Fetch more records for local filtering
						OutputSelector: [
							'EmailAddress',
							'BillingAddress',
							'AccountManager',
							'OnCreditHold',
							'DefaultInvoiceTerms',
							'AccountBalance'
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

	// Inline editing state
	let editingCell: { username: string; field: string } | null = null;
	let editValue: string = '';
	let emailValidationError: string | null = null;
	let isSavingEmail: boolean = false;

	function startEditing(customer: Customer, field: string) {
		editingCell = { username: customer.Username, field };
		emailValidationError = null;
		isSavingEmail = false;

		// Initialize editValue based on the field
		if (field === 'managerName') {
			editValue = customer.managerName || '';
		} else if (field === 'OnCreditHold') {
			editValue = customer.OnCreditHold || 'False';
		} else if (field === 'DefaultInvoiceTerms') {
			editValue = customer.DefaultInvoiceTerms || '';
		} else if (field === 'EmailAddress') {
			editValue = customer.EmailAddress || '';
		}
	}

	function cancelEditing() {
		editingCell = null;
		editValue = '';
		emailValidationError = null;
		isSavingEmail = false;
	}

	async function saveEdit() {
		if (!editingCell) return;

		const { username, field } = editingCell;

		// Find current customer values to preserve other fields if needed for the payload,
		// though the requirement only needs the changing fields + identification.
		// Actually, we need to construct the payload with the *new* value for the edited field
		// and the *current* values for the other fields, because the API structure implies sending a Customer object.
		// However, usually "Update" operations might accept partial overrides or require full objects.
		// The user provided payload has 4 fields: Username, DefaultInvoiceTerms, OnCreditHold, AccountManager.
		// It seems we should send all these 4 fields regardless of which one changed,
		// to ensure we don't accidentally wipe out the others if the API expects them?
		// Or maybe just the one that changed?
		// The user said: "if any of the row has been updated here is the payload: { Customer: [{ Username: ..., DefaultInvoiceTerms: ..., OnCreditHold: ..., AccountManager: ... }], ... }"
		// This suggests sending ALL 4 keys is the expected format for an update.

		const customer = $tableData.find((c) => c.Username === username);
		if (!customer) return;

		// Prepare values for payload
		let newAccountManager = customer.AccountManager; // This might be an object in the store based on types.ts, but we need the username string for payload?
		// types.ts says `AccountManager: AccountManager | string;`
		// In fetchCustomers, we transform it? No, we enhance it with `managerName`.
		// Let's check how `AccountManager` is stored.
		// In `fetchCustomers`: `const enhancedCustomers = data.Customer.map...`
		// We assume `AccountManager` field on `customer` object holds the data from API.
		// The API returns it as object or string?
		// `getAccountManagerName` takes `accountManager: any`.

		// Let's deduce the value for AccountManager string to send.
		// If we are editing 'managerName', `editValue` holds the new username (e.g. 'OrlandoC').

		const payloadAccountManager =
			field === 'managerName'
				? editValue
				: typeof customer.AccountManager === 'object'
					? customer.AccountManager.Username
					: customer.AccountManager;

		const payloadOnCreditHold =
			field === 'OnCreditHold'
				? editValue === 'True' // Convert 'True'/'False' string to boolean
				: customer.OnCreditHold === 'True';

		const payloadDefaultInvoiceTerms =
			field === 'DefaultInvoiceTerms' ? editValue : customer.DefaultInvoiceTerms;

		const payloadEmailAddress =
			field === 'EmailAddress' ? editValue : customer.EmailAddress;

		const payload = {
			Customer: [
				{
					Username: username,
					DefaultInvoiceTerms: payloadDefaultInvoiceTerms,
					OnCreditHold: payloadOnCreditHold,
					AccountManager: payloadAccountManager,
					EmailAddress: payloadEmailAddress
				}
			],
			action: 'UpdateCustomer'
		};

		// UI Optimistic Update or Loading State?
		// User didn't request optimistic UI, but usually safer to wait.
		// Let's add a local loading indicator if possible, or just reuse global isLoading?
		// Global isLoading might hide the table, which is jarring.
		// Better to just await and then update.

		try {
			const response = await fetch(API_ENDPOINT, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(payload)
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			// Assume success if no error? Or check Ack?
			// The previous fetch checked for Ack === 'Success'.
			const data = await response.json();
			if (data.Ack !== 'Success') {
				throw new Error('API returned unsuccessful acknowledgment');
			}

			// Update stores locally
			const updateCustomer = (c: Customer) => {
				if (c.Username !== username) return c;

				const updated = { ...c };
				if (field === 'managerName') {
					updated.managerName = getAccountManagerName({
						FirstName: '',
						LastName: '',
						Username: editValue
					}); // We don't have full name immediately available for the new manager without a lookup.
					// Wait, `getAccountManagerName` expects object or string.
					// If we just mapped select values to 'LukeR', 'OrlandoC', etc. we might want to update the `managerName` display properly.
					// The select options are hardcoded in the HTML:
					// <option value="LukeR">Luke Richardson</option>...
					// We can map these for display.
					const managerMap: Record<string, string> = {
						LukeR: 'Luke Richardson',
						sabina: 'Sabina Marfleet',
						OrlandoC: 'Orlando Chiodo'
					};
					updated.managerName = managerMap[editValue] || editValue;
					updated.AccountManager = editValue; // Update the source field too?
				} else if (field === 'OnCreditHold') {
					updated.OnCreditHold = editValue; // 'True' or 'False'
				} else if (field === 'DefaultInvoiceTerms') {
					updated.DefaultInvoiceTerms = editValue;
				} else if (field === 'EmailAddress') {
					updated.EmailAddress = editValue;
				}
				return updated;
			};

			tableData.update((data) => data.map(updateCustomer));
			originalData.update((data) => data.map(updateCustomer));

			toastSuccess('Customer updated successfully');
			cancelEditing();
		} catch (err) {
			console.error('Error updating customer:', err);
			toastError('Failed to update customer', err instanceof Error ? err.message : 'Unknown error');
		}
	}

	// Handle email editing validation and save
	function handleEmailValidation() {
		if (!editingCell || editingCell.field !== 'EmailAddress') return;

		emailValidationError = getEmailValidationError(editValue);
	}

	async function saveEmailEdit() {
		if (!editingCell || editingCell.field !== 'EmailAddress') return;

		// Validate email before saving
		const validationError = getEmailValidationError(editValue);
		if (validationError) {
			emailValidationError = validationError;
			return;
		}

		isSavingEmail = true;
		emailValidationError = null;

		try {
			await saveEdit();
		} catch (err) {
			console.error('Error updating email:', err);
			toastError('Failed to update email address', err instanceof Error ? err.message : 'Unknown error');
		} finally {
			isSavingEmail = false;
		}
	}

	// Handle email input changes with real-time validation
	function handleEmailInput(event: Event) {
		const target = event.target as HTMLInputElement;
		editValue = target.value;

		// Real-time validation
		handleEmailValidation();
	}

	// Handle email keyboard events
	function handleEmailKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			saveEmailEdit();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			cancelEditing();
		}
	}

	// Focus management action for input elements
	function focusInput(node: HTMLInputElement) {
		// Focus the input and position cursor at the end
		node.focus();
		// Use setTimeout to ensure the input is focused before setting cursor position
		setTimeout(() => {
			node.selectionStart = node.selectionEnd = node.value.length;
		}, 0);
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
													<a
														href="https://www.rapidsupplies.com.au/_cpanel/customer/view?id={customer.Username}"
														target="_blank"
														class="text-blue-600 hover:text-blue-900 hover:underline"
													>
														{customer.Username}
													</a>
												{:else if column.key === 'company'}
													{customer.company}
												{:else if column.key === 'customerName'}
													<a
														href="https://www.rapidsupplies.com.au/_cpanel/customer/view?id={customer.Username}"
														target="_blank"
														class="text-blue-600 hover:text-blue-900 hover:underline"
													>
														{customer.customerName}
													</a>
												{:else if column.key === 'displayName'}
													{customer.displayName}
												{:else if column.key === 'EmailAddress'}
													{#if editingCell?.username === customer.Username && editingCell?.field === 'EmailAddress'}
														<div class="flex items-center gap-2">
															<div class="relative flex-1">
																<input
																	type="email"
																	bind:value={editValue}
																	on:input={handleEmailInput}
																	on:keydown={handleEmailKeydown}
																	use:focusInput
																	class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm {emailValidationError ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}"
																	placeholder="Enter email address"
																	aria-label="Email address"
																	aria-invalid={emailValidationError ? 'true' : 'false'}
																	aria-describedby={emailValidationError ? `email-error-${customer.Username}` : undefined}
																	aria-busy={isSavingEmail}
																	disabled={isSavingEmail}
																/>
																{#if isSavingEmail}
																	<div class="absolute right-2 top-1/2 transform -translate-y-1/2">
																		<div class="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
																	</div>
																{/if}
															</div>
															<button
																on:click={saveEmailEdit}
																disabled={isSavingEmail || !!emailValidationError}
																class="text-green-600 hover:text-green-800 disabled:text-gray-400 disabled:cursor-not-allowed"
																title="Save email address"
																aria-label="Save email address"
															>
																<svg
																	class="h-5 w-5"
																	fill="none"
																	stroke="currentColor"
																	viewBox="0 0 24 24"
																>
																	<path
																		stroke-linecap="round"
																		stroke-linejoin="round"
																		stroke-width="2"
																		d="M5 13l4 4L19 7"
																	/>
																</svg>
															</button>
															<button
																on:click={cancelEditing}
																disabled={isSavingEmail}
																class="text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed"
																title="Cancel editing"
																aria-label="Cancel email editing"
															>
																<svg
																	class="h-5 w-5"
																	fill="none"
																	stroke="currentColor"
																	viewBox="0 0 24 24"
																>
																	<path
																		stroke-linecap="round"
																		stroke-linejoin="round"
																		stroke-width="2"
																		d="M6 18L18 6M6 6l12 12"
																	/>
																</svg>
															</button>
														</div>
														{#if emailValidationError}
															<div
																id="email-error-{customer.Username}"
																class="mt-1 text-sm text-red-600"
																role="alert"
																aria-live="polite"
															>
																{emailValidationError}
															</div>
														{/if}
													{:else}
														<div class="group flex items-center justify-between">
															<span class="break-all">{customer.EmailAddress || 'N/A'}</span>
															<button
																on:click={() => startEditing(customer, 'EmailAddress')}
																class="text-gray-400 opacity-0 transition-opacity hover:text-blue-600 focus:opacity-100 group-hover:opacity-100"
																title="Edit email address"
																aria-label="Edit email address for {customer.customerName || customer.Username}"
															>
																<svg
																	class="h-4 w-4"
																	fill="none"
																	stroke="currentColor"
																	viewBox="0 0 24 24"
																	xmlns="http://www.w3.org/2000/svg"
																>
																	<path
																		stroke-linecap="round"
																		stroke-linejoin="round"
																		stroke-width="2"
																		d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
																	/>
																</svg>
															</button>
														</div>
													{/if}
												{:else if column.key === 'phone'}
													{customer.BillingAddress.BillPhone || 'N/A'}
												{:else if column.key === 'managerName'}
													{#if editingCell?.username === customer.Username && editingCell?.field === 'managerName'}
														<div class="flex items-center gap-2">
															<select
																bind:value={editValue}
																class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
															>
																<option value="LukeR">Luke Richardson</option>
																<option value="sabina">Sabina Marfleet</option>
																<option value="OrlandoC">Orlando Chiodo</option>
															</select>
															<button
																on:click={saveEdit}
																class="text-green-600 hover:text-green-800"
																title="Save"
															>
																<svg
																	class="h-5 w-5"
																	fill="none"
																	stroke="currentColor"
																	viewBox="0 0 24 24"
																>
																	<path
																		stroke-linecap="round"
																		stroke-linejoin="round"
																		stroke-width="2"
																		d="M5 13l4 4L19 7"
																	/>
																</svg>
															</button>
															<button
																on:click={cancelEditing}
																class="text-red-600 hover:text-red-800"
																title="Cancel"
															>
																<svg
																	class="h-5 w-5"
																	fill="none"
																	stroke="currentColor"
																	viewBox="0 0 24 24"
																>
																	<path
																		stroke-linecap="round"
																		stroke-linejoin="round"
																		stroke-width="2"
																		d="M6 18L18 6M6 6l12 12"
																	/>
																</svg>
															</button>
														</div>
													{:else}
														<div class="group flex items-center justify-between">
															<span>{customer.managerName}</span>
															<button
																on:click={() => startEditing(customer, 'managerName')}
																class="text-gray-400 opacity-0 transition-opacity hover:text-blue-600 focus:opacity-100 group-hover:opacity-100"
																title="Edit Account Manager"
															>
																<svg
																	class="h-4 w-4"
																	fill="none"
																	stroke="currentColor"
																	viewBox="0 0 24 24"
																	xmlns="http://www.w3.org/2000/svg"
																>
																	<path
																		stroke-linecap="round"
																		stroke-linejoin="round"
																		stroke-width="2"
																		d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
																	/>
																</svg>
															</button>
														</div>
													{/if}
												{:else if column.key === 'OnCreditHold'}
													{#if editingCell?.username === customer.Username && editingCell?.field === 'OnCreditHold'}
														<div class="flex items-center gap-2">
															<select
																bind:value={editValue}
																class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
															>
																<option value="True">Yes</option>
																<option value="False">No</option>
															</select>
															<button
																on:click={saveEdit}
																class="text-green-600 hover:text-green-800"
																title="Save"
															>
																<svg
																	class="h-5 w-5"
																	fill="none"
																	stroke="currentColor"
																	viewBox="0 0 24 24"
																>
																	<path
																		stroke-linecap="round"
																		stroke-linejoin="round"
																		stroke-width="2"
																		d="M5 13l4 4L19 7"
																	/>
																</svg>
															</button>
															<button
																on:click={cancelEditing}
																class="text-red-600 hover:text-red-800"
																title="Cancel"
															>
																<svg
																	class="h-5 w-5"
																	fill="none"
																	stroke="currentColor"
																	viewBox="0 0 24 24"
																>
																	<path
																		stroke-linecap="round"
																		stroke-linejoin="round"
																		stroke-width="2"
																		d="M6 18L18 6M6 6l12 12"
																	/>
																</svg>
															</button>
														</div>
													{:else}
														<div class="group flex items-center justify-between">
															<span
																class="inline-flex rounded-full px-2 py-1 text-xs font-semibold {customer.OnCreditHold ===
																'True'
																	? 'bg-red-100 text-red-800'
																	: 'bg-green-100 text-green-800'}"
															>
																{customer.OnCreditHold === 'True' ? 'Yes' : 'No'}
															</span>
															<button
																on:click={() => startEditing(customer, 'OnCreditHold')}
																class="text-gray-400 opacity-0 transition-opacity hover:text-blue-600 focus:opacity-100 group-hover:opacity-100"
																title="Edit Credit Hold"
															>
																<svg
																	class="h-4 w-4"
																	fill="none"
																	stroke="currentColor"
																	viewBox="0 0 24 24"
																	xmlns="http://www.w3.org/2000/svg"
																>
																	<path
																		stroke-linecap="round"
																		stroke-linejoin="round"
																		stroke-width="2"
																		d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
																	/>
																</svg>
															</button>
														</div>
													{/if}
												{:else if column.key === 'DefaultInvoiceTerms'}
													{#if editingCell?.username === customer.Username && editingCell?.field === 'DefaultInvoiceTerms'}
														<div class="flex items-center gap-2">
															<select
																bind:value={editValue}
																class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
															>
																<option value="Prepaid">Prepaid</option>
																<option value="Due On Invoice">Due On Invoice</option>
																<option value="Due at the end of the month"
																	>Due at the end of the month</option
																>
																<option value="Due 7 days from date of invoice"
																	>Due 7 days from date of invoice</option
																>
																<option value="Due 14 days from date of invoice"
																	>Due 14 days from date of invoice</option
																>
																<option value="Due 30 days from date of invoice"
																	>Due 30 days from date of invoice</option
																>
																<option value="Due 25 days from date of invoice"
																	>Due 25 days from date of invoice</option
																>
																<option value="Due 30 days after EOM">Due 30 days after EOM</option>
															</select>
															<button
																on:click={saveEdit}
																class="text-green-600 hover:text-green-800"
																title="Save"
															>
																<svg
																	class="h-5 w-5"
																	fill="none"
																	stroke="currentColor"
																	viewBox="0 0 24 24"
																>
																	<path
																		stroke-linecap="round"
																		stroke-linejoin="round"
																		stroke-width="2"
																		d="M5 13l4 4L19 7"
																	/>
																</svg>
															</button>
															<button
																on:click={cancelEditing}
																class="text-red-600 hover:text-red-800"
																title="Cancel"
															>
																<svg
																	class="h-5 w-5"
																	fill="none"
																	stroke="currentColor"
																	viewBox="0 0 24 24"
																>
																	<path
																		stroke-linecap="round"
																		stroke-linejoin="round"
																		stroke-width="2"
																		d="M6 18L18 6M6 6l12 12"
																	/>
																</svg>
															</button>
														</div>
													{:else}
														<div class="group flex items-center justify-between">
															<span>{customer.DefaultInvoiceTerms || 'N/A'}</span>
															<button
																on:click={() => startEditing(customer, 'DefaultInvoiceTerms')}
																class="text-gray-400 opacity-0 transition-opacity hover:text-blue-600 focus:opacity-100 group-hover:opacity-100"
																title="Edit Invoice Terms"
															>
																<svg
																	class="h-4 w-4"
																	fill="none"
																	stroke="currentColor"
																	viewBox="0 0 24 24"
																	xmlns="http://www.w3.org/2000/svg"
																>
																	<path
																		stroke-linecap="round"
																		stroke-linejoin="round"
																		stroke-width="2"
																		d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
																	/>
																</svg>
															</button>
														</div>
													{/if}
												{:else if column.key === 'AccountBalance'}
													{new Intl.NumberFormat('en-AU', {
														style: 'decimal',
														minimumFractionDigits: 2,
														maximumFractionDigits: 2
													}).format(customer.AccountBalance || 0)}
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
