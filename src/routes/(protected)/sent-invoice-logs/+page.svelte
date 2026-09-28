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

<svelte:head>
	<title>Sent Invoice Logs - RapidTools</title>
</svelte:head>

<div class="min-h-screen py-6 px-2 sm:px-4 lg:px-6">
	<div class="w-full bg-[#141619] border border-[#262a30] shadow-xl rounded-2xl p-4 sm:p-6 lg:p-8">
		<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-2xl font-bold text-white tracking-tight">Sent Invoice Logs</h1>
				<p class="mt-1 text-sm text-gray-400">Monitor and retry sent invoice delivery statuses</p>
			</div>
			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					on:click={loadLogs}
					disabled={loading}
					class="btn-secondary inline-flex items-center gap-2 text-sm font-medium"
				>
					<svg class="h-4 w-4 {loading ? 'animate-spin text-lime-400' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
					</svg>
					Refresh
				</button>
			</div>
		</div>

		{#if error}
			<div class="mb-6 rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-400">
				{error}
			</div>
		{/if}

		<!-- Filters -->
		<div class="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			<div>
				<label for="search-order" class="form-label">Order ID</label>
				<input
					id="search-order"
					type="text"
					bind:value={searchOrderId}
					placeholder="Search order ID..."
					class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-3 py-2 text-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-500 transition-colors"
					on:input={handleFilterChange}
				/>
			</div>
			<div>
				<label for="search-email" class="form-label">Customer email</label>
				<input
					id="search-email"
					type="text"
					bind:value={searchCustomerEmail}
					placeholder="Search customer email..."
					class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-3 py-2 text-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-500 transition-colors"
					on:input={handleFilterChange}
				/>
			</div>
			<div>
				<label for="search-document" class="form-label">Document ID</label>
				<input
					id="search-document"
					type="text"
					bind:value={searchDocumentId}
					placeholder="Search document ID..."
					class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-3 py-2 text-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-500 transition-colors"
					on:input={handleFilterChange}
				/>
			</div>
			<div>
				<label for="filter-email-sent" class="form-label">Email sent</label>
				<select
					id="filter-email-sent"
					bind:value={filterEmailSent}
					class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-3 py-2 text-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500 transition-colors"
					on:change={handleFilterChange}
				>
					<option value="all" class="bg-[#141619] text-gray-200">All</option>
					<option value="yes" class="bg-[#141619] text-gray-200">Yes</option>
					<option value="no" class="bg-[#141619] text-gray-200">No</option>
				</select>
			</div>
			<div>
				<label for="filter-email-bounced" class="form-label">Email bounced</label>
				<select
					id="filter-email-bounced"
					bind:value={filterEmailBounced}
					class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-3 py-2 text-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500 transition-colors"
					on:change={handleFilterChange}
				>
					<option value="all" class="bg-[#141619] text-gray-200">All</option>
					<option value="yes" class="bg-[#141619] text-gray-200">Yes</option>
					<option value="no" class="bg-[#141619] text-gray-200">No</option>
				</select>
			</div>
			<div>
				<label for="filter-pdf-exists" class="form-label">PDF exists</label>
				<select
					id="filter-pdf-exists"
					bind:value={filterPdfExists}
					class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-3 py-2 text-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500 transition-colors"
					on:change={handleFilterChange}
				>
					<option value="all" class="bg-[#141619] text-gray-200">All</option>
					<option value="yes" class="bg-[#141619] text-gray-200">Yes</option>
					<option value="no" class="bg-[#141619] text-gray-200">No</option>
				</select>
			</div>
			<div>
				<label for="filter-order-details" class="form-label">Order details</label>
				<select
					id="filter-order-details"
					bind:value={filterOrderDetails}
					class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-3 py-2 text-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500 transition-colors"
					on:change={handleFilterChange}
				>
					<option value="all" class="bg-[#141619] text-gray-200">All</option>
					<option value="yes" class="bg-[#141619] text-gray-200">Yes</option>
					<option value="no" class="bg-[#141619] text-gray-200">No</option>
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
					class="btn-secondary w-full text-sm font-medium h-[38px] flex items-center justify-center gap-1.5"
				>
					Clear filters
				</button>
			</div>
		</div>

		{#if loading}
			<div class="flex flex-col items-center justify-center py-16 gap-3">
				<div
					class="h-10 w-10 animate-spin rounded-full border-2 border-lime-500 border-t-transparent"
				></div>
				<p class="text-sm text-gray-400">Loading invoice logs...</p>
			</div>
		{:else if totalCount === 0}
			<div class="rounded-2xl border border-[#262a30] bg-[#141619] py-16 text-center shadow-xl">
				<svg class="mx-auto h-12 w-12 text-gray-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
				</svg>
				<p class="text-base font-semibold text-gray-300">No results found</p>
				<p class="text-sm text-gray-500 mt-1">Try adjusting your filters or search terms.</p>
			</div>
		{:else}
			<div class="overflow-hidden rounded-2xl border border-[#262a30] bg-[#141619] shadow-xl">
				<div class="overflow-x-auto">
					<table class="w-full min-w-full divide-y divide-[#262a30] text-sm text-gray-200">
						<thead class="bg-[#181b20] text-xs font-semibold uppercase tracking-wider text-gray-400">
							<tr>
								<th
									class="cursor-pointer select-none px-4 py-3 text-left transition-colors hover:text-lime-400 hover:bg-[#1f2329]/60"
									on:click={() => handleSort('order_id')}
									role="button"
									tabindex="0"
									on:keydown={(e) => e.key === 'Enter' && handleSort('order_id')}
								>
									Order ID {getSortIcon('order_id', sortField, sortDirection)}
								</th>
								<th
									class="cursor-pointer select-none px-4 py-3 text-left transition-colors hover:text-lime-400 hover:bg-[#1f2329]/60"
									on:click={() => handleSort('customer_email')}
									role="button"
									tabindex="0"
									on:keydown={(e) => e.key === 'Enter' && handleSort('customer_email')}
								>
									Customer email {getSortIcon('customer_email', sortField, sortDirection)}
								</th>
								<th
									class="cursor-pointer select-none px-4 py-3 text-left transition-colors hover:text-lime-400 hover:bg-[#1f2329]/60"
									on:click={() => handleSort('order_details')}
									role="button"
									tabindex="0"
									on:keydown={(e) => e.key === 'Enter' && handleSort('order_details')}
								>
									Order details {getSortIcon('order_details', sortField, sortDirection)}
								</th>
								<th
									class="cursor-pointer select-none px-4 py-3 text-left transition-colors hover:text-lime-400 hover:bg-[#1f2329]/60"
									on:click={() => handleSort('document_id')}
									role="button"
									tabindex="0"
									on:keydown={(e) => e.key === 'Enter' && handleSort('document_id')}
								>
									Document ID {getSortIcon('document_id', sortField, sortDirection)}
								</th>
								<th class="px-4 py-3 text-left">
									PDF
								</th>
								<th
									class="cursor-pointer select-none px-4 py-3 text-left transition-colors hover:text-lime-400 hover:bg-[#1f2329]/60"
									on:click={() => handleSort('email_sent')}
									role="button"
									tabindex="0"
									on:keydown={(e) => e.key === 'Enter' && handleSort('email_sent')}
								>
									Email sent {getSortIcon('email_sent', sortField, sortDirection)}
								</th>
								<th
									class="cursor-pointer select-none px-4 py-3 text-left transition-colors hover:text-lime-400 hover:bg-[#1f2329]/60"
									on:click={() => handleSort('created_at')}
									role="button"
									tabindex="0"
									on:keydown={(e) => e.key === 'Enter' && handleSort('created_at')}
								>
									Created {getSortIcon('created_at', sortField, sortDirection)}
								</th>
								<th
									class="cursor-pointer select-none px-4 py-3 text-left transition-colors hover:text-lime-400 hover:bg-[#1f2329]/60"
									on:click={() => handleSort('email_bounced')}
									role="button"
									tabindex="0"
									on:keydown={(e) => e.key === 'Enter' && handleSort('email_bounced')}
								>
									Bounced {getSortIcon('email_bounced', sortField, sortDirection)}
								</th>
								<th class="px-4 py-3 text-right">
									Actions
								</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-[#262a30] bg-[#141619]">
							{#each logs as log}
								<tr class="even:bg-[#181b20]/50 hover:bg-[#1f2329]/60 transition-colors">
									<td class="whitespace-nowrap px-4 py-3 text-sm">
										{#if log.order_id}
											<a
												href="https://www.rapidsupplies.com.au/_cpanel/salesorder/view?id={log.order_id}"
												target="_blank"
												rel="noopener noreferrer"
												class="text-lime-400 hover:text-lime-300 font-medium hover:underline inline-flex items-center gap-1"
											>
												{log.order_id}
												<svg class="h-3.5 w-3.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
												</svg>
											</a>
										{:else}
											<span class="text-gray-500">—</span>
										{/if}
									</td>
									<td class="max-w-[200px] truncate px-4 py-3 text-sm text-gray-300" title={log.customer_email ?? ''}>
										{log.customer_email || '—'}
									</td>
									<td class="px-4 py-3">
										{#if log.order_details == null}
											<span class="text-gray-500">—</span>
										{:else}
											<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {log.order_details ? 'bg-lime-500/10 text-lime-400 border border-lime-500/20' : 'bg-gray-800 text-gray-400 border border-[#333842]'}">
												{log.order_details ? 'Yes' : 'No'}
											</span>
										{/if}
									</td>
									<td class="max-w-[120px] truncate px-4 py-3 font-mono text-xs text-gray-400" title={log.document_id ?? ''}>
										{log.document_id || '—'}
									</td>
									<td class="px-4 py-3">
										{#if log.pdf_path}
											<button
												type="button"
												on:click={() => openPdfUrl(log.pdf_path)}
												class="text-lime-400 hover:text-lime-300 hover:underline font-medium inline-flex items-center gap-1 text-sm"
											>
												<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
												</svg>
												{log.pdf_exists ? 'Open' : 'Link'}
											</button>
										{:else}
											<span class="text-gray-500">—</span>
										{/if}
									</td>
									<td class="px-4 py-3">
										<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {log.email_sent ? 'bg-lime-500/10 text-lime-400 border border-lime-500/20' : 'bg-gray-800 text-gray-400 border border-[#333842]'}">
											{log.email_sent ? 'Yes' : 'No'}
										</span>
									</td>
									<td class="whitespace-nowrap px-4 py-3 text-sm text-gray-400">
										{formatCreatedAt(log.created_at)}
									</td>
									<td class="px-4 py-3">
										{#if log.email_bounced == null}
											<span class="text-gray-500">—</span>
										{:else}
											<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {log.email_bounced ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-gray-800 text-gray-400 border border-[#333842]'}">
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
												class="inline-flex items-center justify-center rounded-lg border border-[#333842] bg-[#1f2329] p-1.5 text-gray-300 hover:text-lime-400 hover:border-lime-500/50 hover:bg-[#262a30] transition disabled:opacity-40 disabled:cursor-not-allowed"
												title="Retry Email"
											>
												{#if isRetrying.has(log.id)}
													<svg class="h-4 w-4 animate-spin text-lime-400" fill="none" viewBox="0 0 24 24">
														<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
														<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
													</svg>
												{:else}
													<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
				<div class="flex flex-wrap items-center justify-between gap-4 border-t border-[#262a30] bg-[#181b20] px-4 py-3">
					<div class="text-sm text-gray-400">
						{#if totalCount === 0}
							No results
						{:else}
							Showing <span class="font-medium text-gray-200">{(currentPage - 1) * itemsPerPage + 1}</span>–<span class="font-medium text-gray-200">{Math.min(currentPage * itemsPerPage, totalCount)}</span> of <span class="font-medium text-gray-200">{totalCount}</span>
						{/if}
					</div>
					<div class="flex items-center gap-4">
						<label class="flex items-center gap-2 text-sm text-gray-400">
							Per page
							<select
								bind:value={itemsPerPage}
								class="rounded-lg border border-[#262a30] bg-[#0e1012] px-2 py-1 text-sm text-gray-200 focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
								on:change={() => {
									currentPage = 1;
									loadLogs();
								}}
							>
								<option value={10} class="bg-[#141619] text-gray-200">10</option>
								<option value={25} class="bg-[#141619] text-gray-200">25</option>
								<option value={50} class="bg-[#141619] text-gray-200">50</option>
								<option value={100} class="bg-[#141619] text-gray-200">100</option>
							</select>
						</label>
						<div class="flex items-center gap-1.5">
							<button
								type="button"
								disabled={currentPage <= 1}
								on:click={() => {
									currentPage = currentPage - 1;
									loadLogs();
								}}
								class="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
							>
								Previous
							</button>
							<span class="flex items-center px-3 text-sm text-gray-400">
								Page <span class="mx-1 font-medium text-gray-200">{currentPage}</span> of <span class="ml-1 font-medium text-gray-200">{totalPages}</span>
							</span>
							<button
								type="button"
								disabled={currentPage >= totalPages}
								on:click={() => {
									currentPage = currentPage + 1;
									loadLogs();
								}}
								class="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
							>
								Next
							</button>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>


<!-- Email input modal -->
<EmailInputModal
	show={showEmailModal}
	on:close={handleEmailModalClose}
	on:submit={handleEmailModalSubmit}
/>

