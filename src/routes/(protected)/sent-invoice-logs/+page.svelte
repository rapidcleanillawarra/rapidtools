<script lang="ts">
	import { onMount } from 'svelte';
	import Modal from '$lib/components/Modal.svelte';
	import DeleteConfirmationModal from '$lib/components/DeleteConfirmationModal.svelte';
	import { toastSuccess, toastError } from '$lib/utils/toast';
	import {
		fetchInvoiceSendLogs,
		updateInvoiceSendLog
	} from './services';
	import type { InvoiceSendLog, InvoiceSendLogFormData } from './types';
	import { emptyFormData } from './types';
	import { getSortIcon, sortData, getPaginated, formatCreatedAt } from './utils';

	let logs: InvoiceSendLog[] = [];
	let loading = true;
	let error = '';

	let searchOrderId = '';
	let searchCustomerEmail = '';
	let sortField: keyof InvoiceSendLog | '' = 'created_at';
	let sortDirection: 'asc' | 'desc' = 'desc';
	let currentPage = 1;
	let itemsPerPage = 25;

	let showEditModal = false;
	let isSubmitting = false;
	let formData: InvoiceSendLogFormData = { ...emptyFormData };
	let editingLog: InvoiceSendLog | null = null;

	onMount(loadLogs);

	async function loadLogs() {
		loading = true;
		error = '';
		try {
			logs = await fetchInvoiceSendLogs();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load logs';
			console.error(e);
		} finally {
			loading = false;
		}
	}

	$: filtered = (() => {
		let out = [...logs];
		const o = searchOrderId.trim().toLowerCase();
		const e = searchCustomerEmail.trim().toLowerCase();
		if (o) out = out.filter((l) => l.order_id?.toLowerCase().includes(o));
		if (e) out = out.filter((l) => (l.customer_email ?? '').toLowerCase().includes(e));
		return out;
	})();

	$: sorted = sortField ? sortData(filtered, sortField as keyof InvoiceSendLog, sortDirection) : filtered;
	$: totalPages = Math.max(1, Math.ceil(sorted.length / itemsPerPage));
	$: if (currentPage > totalPages) currentPage = totalPages;
	$: paginated = getPaginated(sorted, currentPage, itemsPerPage);

	function handleSort(f: keyof InvoiceSendLog) {
		if (sortField === f) sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		else {
			sortField = f;
			sortDirection = 'asc';
		}
		currentPage = 1;
	}


	function openEdit(log: InvoiceSendLog) {
		editingLog = log;
		formData = {
			order_id: log.order_id ?? '',
			customer_email: log.customer_email ?? '',
			order_details: log.order_details ?? false,
			document_id: log.document_id ?? '',
			pdf_path: log.pdf_path ?? '',
			pdf_exists: log.pdf_exists ?? false,
			email_sent: log.email_sent ?? false,
			email_bounced: log.email_bounced ?? false
		};
		showEditModal = true;
	}

	function closeEdit() {
		showEditModal = false;
		editingLog = null;
		formData = { ...emptyFormData };
	}



	async function handleEdit() {
		if (!editingLog) return;
		if (!formData.order_id.trim()) {
			toastError('Order ID is required');
			return;
		}
		isSubmitting = true;
		try {
			await updateInvoiceSendLog(editingLog.id, formData);
			await loadLogs();
			closeEdit();
			toastSuccess('Log updated');
		} catch (e) {
			toastError(e instanceof Error ? e.message : 'Failed to update log');
		} finally {
			isSubmitting = false;
		}
	}


	function openPdfUrl(url: string | null) {
		if (!url?.trim()) return;
		window.open(url, '_blank', 'noopener,noreferrer');
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
	<div class="mb-4 flex flex-wrap gap-4">
		<div class="min-w-[180px]">
			<label for="search-order" class="block text-sm font-medium text-gray-700">Order ID</label>
			<input
				id="search-order"
				type="text"
				bind:value={searchOrderId}
				placeholder="Search…"
				class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
			/>
		</div>
		<div class="min-w-[200px]">
			<label for="search-email" class="block text-sm font-medium text-gray-700">Customer email</label>
			<input
				id="search-email"
				type="text"
				bind:value={searchCustomerEmail}
				placeholder="Search…"
				class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
			/>
		</div>
	</div>

	{#if loading}
		<div class="flex justify-center py-12">
			<div
				class="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"
			></div>
		</div>
	{:else if logs.length === 0}
		<div class="rounded-lg border border-gray-200 bg-white py-12 text-center shadow">
			<p class="text-gray-500">No invoice send logs yet.</p>
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
							<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
								Order details
							</th>
							<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
								Document ID
							</th>
							<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
								PDF
							</th>
							<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
								Email sent
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
							<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
								Bounced
							</th>
							<th class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
								Actions
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-200 bg-white">
						{#each paginated as log (log.id)}
							<tr class="hover:bg-gray-50">
								<td class="whitespace-nowrap px-4 py-3 text-sm text-gray-900">{log.order_id}</td>
								<td class="max-w-[200px] truncate px-4 py-3 text-sm text-gray-600" title={log.customer_email ?? ''}>
									{log.customer_email || '—'}
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
									{log.document_id || '—'}
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
									<button
										type="button"
										on:click={() => openEdit(log)}
										class="rounded p-1 text-blue-600 hover:bg-blue-50"
										title="Edit"
									>
										<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
										</svg>
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Pagination -->
			<div class="flex flex-wrap items-center justify-between gap-4 border-t border-gray-200 bg-gray-50 px-4 py-3">
				<div class="text-sm text-gray-600">
					{#if sorted.length === 0}
						No results
					{:else}
						Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, sorted.length)} of {sorted.length}
					{/if}
				</div>
				<div class="flex items-center gap-4">
					<label class="flex items-center gap-2 text-sm text-gray-600">
						Per page
						<select
							bind:value={itemsPerPage}
							class="rounded border border-gray-300 px-2 py-1 text-sm"
							on:change={() => (currentPage = 1)}
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
							on:click={() => (currentPage = currentPage - 1)}
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
							on:click={() => (currentPage = currentPage + 1)}
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


<!-- Edit modal -->
<Modal show={showEditModal} on:close={closeEdit} size="xl">
	<span slot="header">Edit invoice send log</span>
	<div slot="body">
		<form on:submit|preventDefault={handleEdit} class="space-y-4">
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div>
					<label for="edit-order_id" class="block text-sm font-medium text-gray-700">Order ID <span class="text-red-500">*</span></label>
					<input
						id="edit-order_id"
						type="text"
						bind:value={formData.order_id}
						class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
						required
					/>
				</div>
				<div>
					<label for="edit-customer_email" class="block text-sm font-medium text-gray-700">Customer email</label>
					<input
						id="edit-customer_email"
						type="email"
						bind:value={formData.customer_email}
						class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
					/>
				</div>
				<div>
					<label for="edit-document_id" class="block text-sm font-medium text-gray-700">Document ID</label>
					<input
						id="edit-document_id"
						type="text"
						bind:value={formData.document_id}
						class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
					/>
				</div>
				<div>
					<label for="edit-pdf_path" class="block text-sm font-medium text-gray-700">PDF path / URL</label>
					<input
						id="edit-pdf_path"
						type="url"
						bind:value={formData.pdf_path}
						class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
					/>
				</div>
			</div>
			<div class="flex flex-wrap gap-6">
				<label class="flex cursor-pointer items-center gap-2">
					<input type="checkbox" bind:checked={formData.order_details} class="rounded border-gray-300" />
					<span class="text-sm text-gray-700">Order details</span>
				</label>
				<label class="flex cursor-pointer items-center gap-2">
					<input type="checkbox" bind:checked={formData.pdf_exists} class="rounded border-gray-300" />
					<span class="text-sm text-gray-700">PDF exists</span>
				</label>
				<label class="flex cursor-pointer items-center gap-2">
					<input type="checkbox" bind:checked={formData.email_sent} class="rounded border-gray-300" />
					<span class="text-sm text-gray-700">Email sent</span>
				</label>
				<label class="flex cursor-pointer items-center gap-2">
					<input type="checkbox" bind:checked={formData.email_bounced} class="rounded border-gray-300" />
					<span class="text-sm text-gray-700">Email bounced</span>
				</label>
			</div>
		</form>
	</div>
	<div slot="footer" class="flex justify-end gap-3">
		<button
			type="button"
			on:click={closeEdit}
			class="rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
		>
			Cancel
		</button>
		<button
			type="button"
			on:click={handleEdit}
			disabled={isSubmitting}
			class="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
		>
			{#if isSubmitting}
				<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
				Saving…
			{:else}
				Save
			{/if}
		</button>
	</div>
</Modal>

