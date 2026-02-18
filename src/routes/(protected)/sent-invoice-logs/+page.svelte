<script lang="ts">
	import { onMount } from 'svelte';
	import EmailInputModal from './components/EmailInputModal.svelte';
	import { toastSuccess, toastError } from '$lib/utils/toast';
	import {
		fetchInvoiceSendLogs,
		getOrderEmail,
		getCustomerEmail,
		updateOrderEmail,
		triggerInvoiceEmail
	} from './services';
	import type {
		InvoiceSendLog,
		InvoiceSendLogQuery,
		InvoiceSendLogSortField,
		YesNoAll
	} from './types';
	import { getSortIcon, formatCreatedAt } from './utils';

	let logs: InvoiceSendLog[] = [];
	let totalCount = 0;
	let loading = true;
	let error = '';

	let searchOrderId = '';
	let searchCustomerEmail = '';
	let searchDocumentId = '';
	let filterEmailSent: YesNoAll = 'all';
	let filterEmailBounced: YesNoAll = 'all';
	let filterPdfExists: YesNoAll = 'all';
	let filterOrderDetails: YesNoAll = 'all';
	let sortField: InvoiceSendLogSortField = 'created_at';
	let sortDirection: 'asc' | 'desc' = 'desc';
	let currentPage = 1;
	let itemsPerPage = 25;
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	// Helper function to check if error is a timeout/network issue
	function isTimeoutError(error: Error): boolean {
		const message = error.message.toLowerCase();
		return message.includes('504') ||
			   message.includes('gateway timeout') ||
			   message.includes('timeout') ||
			   message.includes('network error');
	}

	// Helper function to get user-friendly error message
	function getUserFriendlyErrorMessage(error: Error): string {
		if (isTimeoutError(error)) {
			return 'Email service is temporarily unavailable. Please try again in a few moments.';
		}
		return error.message || 'Failed to retry email';
	}

	// Retry email state
	let isRetrying = new Set<string>();
	let showEmailModal = false;
	let pendingRetryLog: InvoiceSendLog | null = null;

	onMount(loadLogs);

	async function loadLogs() {
		loading = true;
		error = '';
		try {
			const perPage = Number(itemsPerPage) || 25;
			if (perPage !== itemsPerPage) {
				itemsPerPage = perPage;
			}
			const query: InvoiceSendLogQuery = {
				page: currentPage,
				perPage,
				sortField,
				sortDirection,
				search: {
					orderId: searchOrderId,
					customerEmail: searchCustomerEmail,
					documentId: searchDocumentId
				},
				filters: {
					emailSent: filterEmailSent,
					emailBounced: filterEmailBounced,
					pdfExists: filterPdfExists,
					orderDetails: filterOrderDetails
				}
			};

			const result = await fetchInvoiceSendLogs(query);
			logs = result.data;
			totalCount = result.total;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load logs';
			console.error(e);
		} finally {
			loading = false;
		}
	}

	$: totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));

	function scheduleLoad(resetPage = false) {
		if (resetPage) currentPage = 1;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			loadLogs();
		}, 300);
	}

	function handleFilterChange() {
		scheduleLoad(true);
	}

	function handleSort(f: InvoiceSendLogSortField) {
		if (sortField === f) sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		else {
			sortField = f;
			sortDirection = 'asc';
		}
		currentPage = 1;
		loadLogs();
	}


	function openPdfUrl(url: string | null) {
		if (!url?.trim()) return;
		window.open(url, '_blank', 'noopener,noreferrer');
	}

	async function handleRetryEmail(log: InvoiceSendLog) {
		if (!log.order_id) {
			toastError('Order ID is missing - cannot retry email');
			return;
		}

		// Set loading state
		isRetrying.add(log.id);
		isRetrying = new Set(isRetrying);

		try {
			let emailToUse: string | null = null;
			let username: string | null = null;

			// Step 1: Check if order has email
			console.log('Step 1: Checking order email for', log.order_id);
			const orderData = await getOrderEmail(log.order_id);

			if (orderData.email && orderData.email.trim()) {
				emailToUse = orderData.email.trim();
				console.log('Found email in order record:', emailToUse);
			} else {
				username = orderData.username;
				console.log('No email in order record, checking customer record for username:', username);

				// Step 2: If order email is empty, check customer email
				if (username) {
					const customerEmail = await getCustomerEmail(username);

					if (customerEmail && customerEmail.trim()) {
						emailToUse = customerEmail.trim();
						console.log('Found email in customer record:', emailToUse);
					} else {
						console.log('No email in customer record, showing modal for user input');
						// Step 3: If customer email is also empty, show modal for user input
						pendingRetryLog = log;
						showEmailModal = true;
						return; // Exit here, will continue after modal submission
					}
				} else {
					console.log('No username in order record, showing modal for user input');
					// No username available, show modal for user input
					pendingRetryLog = log;
					showEmailModal = true;
					return; // Exit here, will continue after modal submission
				}
			}

			// If we have an email, proceed with update and trigger
			await proceedWithEmailRetry(log, emailToUse!);

		} catch (error) {
			console.error('Error during email retry process:', error);
			const errorMessage = error instanceof Error ? getUserFriendlyErrorMessage(error) : 'Failed to retry email';
			toastError(errorMessage);
		} finally {
			isRetrying.delete(log.id);
			isRetrying = new Set(isRetrying);
		}
	}

	async function proceedWithEmailRetry(log: InvoiceSendLog, email: string) {
		try {
			// Step 4: Update order email
			console.log('Step 4: Updating order email');
			await updateOrderEmail(log.order_id!, email);

			// Step 5: Trigger invoice email
			console.log('Step 5: Triggering invoice email');
			await triggerInvoiceEmail(log.order_id!);

			// Success - update the UI to show email sent for this log
			logs = logs.map((l) =>
				l.id === log.id ? { ...l, email_sent: true } : l
			);
			toastSuccess('Email retry completed successfully');

		} catch (error) {
			console.error('Error in email retry process:', error);
			const errorMessage = error instanceof Error ? getUserFriendlyErrorMessage(error) : 'Failed to retry email';
			toastError(errorMessage);
			throw error; // Re-throw to ensure loading state is cleared
		}
	}

	function handleEmailModalSubmit(event: CustomEvent<{ email: string }>) {
		const { email } = event.detail;

		if (pendingRetryLog) {
			const logToRetry = pendingRetryLog;
			// Continue with the retry process using the provided email
			proceedWithEmailRetry(logToRetry, email).finally(() => {
				// Clear loading state and pending state regardless of success/failure
				isRetrying.delete(logToRetry.id);
				isRetrying = new Set(isRetrying);
				pendingRetryLog = null;
			});
		}

		showEmailModal = false;
	}

	function handleEmailModalClose() {
		// Clear pending state when modal is closed
		showEmailModal = false;

		// Clear loading state for the pending log if it exists
		if (pendingRetryLog) {
			isRetrying.delete(pendingRetryLog.id);
			isRetrying = new Set(isRetrying);
		}

		// Clear pending state
		pendingRetryLog = null;
	}
</script>

<div class="container mx-auto px-4 py-8">
	<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<h1 class="text-2xl font-bold text-gray-900">Sent Invoice Logs</h1>
		<div class="flex flex-wrap gap-2">
			<button
				type="button"
				on:click={loadLogs}
				disabled={loading}
				class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
			>
				Refresh
			</button>
		</div>
	</div>

	{#if error}
		<div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>
	{/if}

	<!-- Filters -->
	<div class="mb-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
		<div>
			<label for="search-order" class="block text-sm font-medium text-gray-700">Order ID</label>
			<input
				id="search-order"
				type="text"
				bind:value={searchOrderId}
				placeholder="Search..."
				class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				on:input={handleFilterChange}
			/>
		</div>
		<div>
			<label for="search-email" class="block text-sm font-medium text-gray-700">Customer email</label>
			<input
				id="search-email"
				type="text"
				bind:value={searchCustomerEmail}
				placeholder="Search..."
				class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				on:input={handleFilterChange}
			/>
		</div>
		<div>
			<label for="search-document" class="block text-sm font-medium text-gray-700">Document ID</label>
			<input
				id="search-document"
				type="text"
				bind:value={searchDocumentId}
				placeholder="Search..."
				class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				on:input={handleFilterChange}
			/>
		</div>
		<div>
			<label for="filter-email-sent" class="block text-sm font-medium text-gray-700">Email sent</label>
			<select
				id="filter-email-sent"
				bind:value={filterEmailSent}
				class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				on:change={handleFilterChange}
			>
				<option value="all">All</option>
				<option value="yes">Yes</option>
				<option value="no">No</option>
			</select>
		</div>
		<div>
			<label for="filter-email-bounced" class="block text-sm font-medium text-gray-700">Email bounced</label>
			<select
				id="filter-email-bounced"
				bind:value={filterEmailBounced}
				class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				on:change={handleFilterChange}
			>
				<option value="all">All</option>
				<option value="yes">Yes</option>
				<option value="no">No</option>
			</select>
		</div>
		<div>
			<label for="filter-pdf-exists" class="block text-sm font-medium text-gray-700">PDF exists</label>
			<select
				id="filter-pdf-exists"
				bind:value={filterPdfExists}
				class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				on:change={handleFilterChange}
			>
				<option value="all">All</option>
				<option value="yes">Yes</option>
				<option value="no">No</option>
			</select>
		</div>
		<div>
			<label for="filter-order-details" class="block text-sm font-medium text-gray-700">Order details</label>
			<select
				id="filter-order-details"
				bind:value={filterOrderDetails}
				class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
				on:change={handleFilterChange}
			>
				<option value="all">All</option>
				<option value="yes">Yes</option>
				<option value="no">No</option>
			</select>
		</div>
		<div class="flex items-end">
			<button
				type="button"
				on:click={() => {
					searchOrderId = '';
					searchCustomerEmail = '';
					searchDocumentId = '';
					filterEmailSent = 'all';
					filterEmailBounced = 'all';
					filterPdfExists = 'all';
					filterOrderDetails = 'all';
					currentPage = 1;
					loadLogs();
				}}
				class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
			>
				Clear filters
			</button>
		</div>
	</div>

	{#if loading}
		<div class="flex justify-center py-12">
			<div
				class="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"
			></div>
		</div>
	{:else if totalCount === 0}
		<div class="rounded-lg border border-gray-200 bg-white py-12 text-center shadow">
			<p class="text-gray-500">No results found.</p>
		</div>
	{:else}
		<div class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th
								class="cursor-pointer select-none px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:bg-gray-100"
								on:click={() => handleSort('order_id')}
								role="button"
								tabindex="0"
								on:keydown={(e) => e.key === 'Enter' && handleSort('order_id')}
							>
								Order ID {getSortIcon('order_id', sortField, sortDirection)}
							</th>
							<th
								class="cursor-pointer select-none px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:bg-gray-100"
								on:click={() => handleSort('customer_email')}
								role="button"
								tabindex="0"
								on:keydown={(e) => e.key === 'Enter' && handleSort('customer_email')}
							>
								Customer email {getSortIcon('customer_email', sortField, sortDirection)}
							</th>
							<th
								class="cursor-pointer select-none px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:bg-gray-100"
								on:click={() => handleSort('order_details')}
								role="button"
								tabindex="0"
								on:keydown={(e) => e.key === 'Enter' && handleSort('order_details')}
							>
								Order details {getSortIcon('order_details', sortField, sortDirection)}
							</th>
							<th
								class="cursor-pointer select-none px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:bg-gray-100"
								on:click={() => handleSort('document_id')}
								role="button"
								tabindex="0"
								on:keydown={(e) => e.key === 'Enter' && handleSort('document_id')}
							>
								Document ID {getSortIcon('document_id', sortField, sortDirection)}
							</th>
							<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
								PDF
							</th>
							<th
								class="cursor-pointer select-none px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:bg-gray-100"
								on:click={() => handleSort('email_sent')}
								role="button"
								tabindex="0"
								on:keydown={(e) => e.key === 'Enter' && handleSort('email_sent')}
							>
								Email sent {getSortIcon('email_sent', sortField, sortDirection)}
							</th>
							<th
								class="cursor-pointer select-none px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:bg-gray-100"
								on:click={() => handleSort('created_at')}
								role="button"
								tabindex="0"
								on:keydown={(e) => e.key === 'Enter' && handleSort('created_at')}
							>
								Created {getSortIcon('created_at', sortField, sortDirection)}
							</th>
							<th
								class="cursor-pointer select-none px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:bg-gray-100"
								on:click={() => handleSort('email_bounced')}
								role="button"
								tabindex="0"
								on:keydown={(e) => e.key === 'Enter' && handleSort('email_bounced')}
							>
								Bounced {getSortIcon('email_bounced', sortField, sortDirection)}
							</th>
							<th class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
								Actions
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-200 bg-white">
						{#each logs as log}
							<tr class="hover:bg-gray-50">
								<td class="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
									{#if log.order_id}
										<a
											href="https://www.rapidsupplies.com.au/_cpanel/salesorder/view?id={log.order_id}"
											target="_blank"
											rel="noopener noreferrer"
											class="text-blue-600 hover:text-blue-800 hover:underline"
										>
											{log.order_id}
										</a>
									{:else}
										—
									{/if}
								</td>
								<td class="max-w-[200px] truncate px-4 py-3 text-sm text-gray-600" title={log.customer_email ?? ''}>
									{log.customer_email || '-'}
								</td>
								<td class="px-4 py-3">
									{#if log.order_details == null}
										<span class="text-gray-400">—</span>
									{:else}
									<span class={log.order_details ? 'text-green-600' : 'text-gray-500'}>
										{log.order_details ? 'Yes' : 'No'}
									</span>
									{/if}
								</td>
								<td class="max-w-[120px] truncate px-4 py-3 font-mono text-xs text-gray-600" title={log.document_id ?? ''}>
									{log.document_id || '-'}
								</td>
								<td class="px-4 py-3">
									{#if log.pdf_path}
										<button
											type="button"
											on:click={() => openPdfUrl(log.pdf_path)}
											class="text-blue-600 hover:underline"
										>
											{log.pdf_exists ? 'Open' : 'Link'}
										</button>
									{:else}
										—
									{/if}
								</td>
								<td class="px-4 py-3">
									<span class={log.email_sent ? 'text-green-600' : 'text-gray-500'}>
										{log.email_sent ? 'Yes' : 'No'}
									</span>
								</td>
								<td class="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
									{formatCreatedAt(log.created_at)}
								</td>
								<td class="px-4 py-3">
									{#if log.email_bounced == null}
										<span class="text-gray-400">—</span>
									{:else}
										<span class={log.email_bounced ? 'text-amber-600' : 'text-gray-500'}>
											{log.email_bounced ? 'Yes' : 'No'}
										</span>
									{/if}
								</td>
								<td class="whitespace-nowrap px-4 py-3 text-right text-sm">
									<div class="flex items-center justify-end gap-1">
										<button
											type="button"
											on:click={() => handleRetryEmail(log)}
											disabled={isRetrying.has(log.id)}
											class="rounded p-1 text-green-600 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
											title="Retry Email"
										>
											{#if isRetrying.has(log.id)}
												<svg class="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
													<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
													<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
												</svg>
											{:else}
												<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
												</svg>
											{/if}
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Pagination -->
			<div class="flex flex-wrap items-center justify-between gap-4 border-t border-gray-200 bg-gray-50 px-4 py-3">
				<div class="text-sm text-gray-600">
					{#if totalCount === 0}
						No results
					{:else}
						Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount}
					{/if}
				</div>
				<div class="flex items-center gap-4">
					<label class="flex items-center gap-2 text-sm text-gray-600">
						Per page
						<select
							bind:value={itemsPerPage}
							class="rounded border border-gray-300 px-2 py-1 text-sm"
							on:change={() => {
								currentPage = 1;
								loadLogs();
							}}
						>
							<option value={10}>10</option>
							<option value={25}>25</option>
							<option value={50}>50</option>
							<option value={100}>100</option>
						</select>
					</label>
					<div class="flex gap-1">
						<button
							type="button"
							disabled={currentPage <= 1}
							on:click={() => {
								currentPage = currentPage - 1;
								loadLogs();
							}}
							class="rounded border border-gray-300 bg-white px-3 py-1 text-sm disabled:opacity-50 hover:bg-gray-100"
						>
							Previous
						</button>
						<span class="flex items-center px-3 text-sm text-gray-600">
							Page {currentPage} of {totalPages}
						</span>
						<button
							type="button"
							disabled={currentPage >= totalPages}
							on:click={() => {
								currentPage = currentPage + 1;
								loadLogs();
							}}
							class="rounded border border-gray-300 bg-white px-3 py-1 text-sm disabled:opacity-50 hover:bg-gray-100"
						>
							Next
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>


<!-- Email input modal -->
<EmailInputModal
	show={showEmailModal}
	on:close={handleEmailModalClose}
	on:submit={handleEmailModalSubmit}
/>

