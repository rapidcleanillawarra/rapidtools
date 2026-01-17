<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Modal from '$lib/components/Modal.svelte';
	import type { StatementAccount, Order } from '../statementAccounts';
	import { getCustomerInvoices } from '../utils/print';
	import { downloadCustomerInvoicesCsv } from '../utils/csv';
	import { toastSuccess } from '$lib/utils/toast';

	export let show: boolean = false;
	export let account: StatementAccount | null = null;
	export let orders: Order[] = [];

	const dispatch = createEventDispatcher();

	// Format currency
	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-AU', {
			style: 'currency',
			currency: 'AUD'
		}).format(amount);
	}

	// Format date
	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		if (isNaN(date.getTime())) return '—';
		return date.toLocaleDateString('en-AU', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	// Get customer invoices for the account
	$: customerInvoices = account
		? getCustomerInvoices(orders, account.companyName, account.username)
		: [];

	function handleClose() {
		dispatch('close');
	}

	function handleExportCSV() {
		if (account && customerInvoices.length > 0) {
			const fileName = downloadCustomerInvoicesCsv(customerInvoices, account.companyName);
			toastSuccess(`Exported ${customerInvoices.length} invoices to ${fileName}`);
		}
	}
</script>

<Modal {show} size="xl" style="max-height: 80vh;" on:close={handleClose}>
	<svelte:fragment slot="header">
		Order Details - {account?.companyName || ''}
	</svelte:fragment>

	<svelte:fragment slot="body">
		{#if account && customerInvoices.length > 0}
			<div class="space-y-4">
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
					<div>
						<label class="block text-sm font-medium text-gray-700">Company Name</label>
						<p class="mt-1 text-sm text-gray-900">{account.companyName}</p>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700">Username</label>
						<p class="mt-1 text-sm text-gray-900">{account.username}</p>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700">Total Invoices</label>
						<p class="mt-1 text-sm text-gray-900 font-semibold">{customerInvoices.length}</p>
					</div>
				</div>

				<div class="overflow-hidden border border-gray-200 rounded-lg">
					<div class="max-h-96 overflow-y-auto">
						<table class="min-w-full divide-y divide-gray-200">
							<thead class="bg-gray-50 sticky top-0 z-10">
								<tr>
									<th
										scope="col"
										class="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 w-16"
									>
										#
									</th>
									<th
										scope="col"
										class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
									>
										Order #
									</th>
									<th
										scope="col"
										class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
									>
										Date Placed
									</th>
									<th
										scope="col"
										class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
									>
										Due Date
									</th>
									<th
										scope="col"
										class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
									>
										Order Total
									</th>
									<th
										scope="col"
										class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
									>
										Payments
									</th>
									<th
										scope="col"
										class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
									>
										Balance
									</th>
								</tr>
							</thead>
							<tbody class="bg-white divide-y divide-gray-200">
								{#each customerInvoices as invoice, index}
									<tr class="hover:bg-gray-50">
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
											{index + 1}
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
											{invoice.orderID}
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
											{formatDate(invoice.datePlaced)}
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
											{formatDate(invoice.datePaymentDue)}
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
											{formatCurrency(invoice.grandTotal)}
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
											{formatCurrency(invoice.payments)}
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
											{formatCurrency(invoice.balance)}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
					<!-- Total balance footer - fixed at bottom -->
					<div class="bg-gray-50 border-t border-gray-200 px-6 py-4">
						<div class="flex justify-end items-center">
							<span class="text-sm font-semibold text-gray-900 mr-4">Total Balance:</span>
							<span class="text-sm font-bold text-gray-900">
								{formatCurrency(
									customerInvoices.reduce((sum, inv) => sum + inv.balance, 0)
								)}
							</span>
						</div>
					</div>
				</div>
			</div>
		{:else if account}
			<div class="text-center py-8">
				<p class="text-gray-500">No outstanding invoices found for this customer.</p>
			</div>
		{/if}
	</svelte:fragment>

	<svelte:fragment slot="footer">
		{#if account && customerInvoices.length > 0}
			<div class="flex justify-between items-center">
				<div class="text-sm text-gray-500">
					Showing {customerInvoices.length} invoice{customerInvoices.length !== 1 ? 's' : ''}
				</div>
				<button
					on:click={handleExportCSV}
					class="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
					disabled={customerInvoices.length === 0}
				>
					Export CSV
				</button>
			</div>
		{/if}
	</svelte:fragment>
</Modal>
