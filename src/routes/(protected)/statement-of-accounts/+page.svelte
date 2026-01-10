<script lang="ts">
	import { onMount } from 'svelte';
	import { toastSuccess } from '$lib/utils/toast';

	// Mock data interface
	interface StatementAccount {
		customer: string;
		totalInvoices: number;
		grandTotal: number;
		lastSent: string | null;
		nextSchedule: string | null;
	}

	// Mock data
	let statementAccounts: StatementAccount[] = [];
	let isLoading = true;
	let error = '';

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

	// Load mock data
	async function loadStatementAccounts() {
		try {
			isLoading = true;
			error = '';

			// Simulate API call delay
			await new Promise(resolve => setTimeout(resolve, 1000));

			// Mock data
			statementAccounts = [
				{
					customer: 'ABC Manufacturing Pty Ltd',
					totalInvoices: 5,
					grandTotal: 12500.75,
					lastSent: '2025-01-01T10:00:00Z',
					nextSchedule: '2025-01-15T10:00:00Z'
				},
				{
					customer: 'XYZ Retail Group',
					totalInvoices: 3,
					grandTotal: 8750.25,
					lastSent: '2024-12-15T10:00:00Z',
					nextSchedule: '2025-01-15T10:00:00Z'
				},
				{
					customer: 'Tech Solutions Inc',
					totalInvoices: 8,
					grandTotal: 22100.50,
					lastSent: '2025-01-05T10:00:00Z',
					nextSchedule: '2025-01-20T10:00:00Z'
				},
				{
					customer: 'Global Logistics Ltd',
					totalInvoices: 2,
					grandTotal: 5400.00,
					lastSent: '2024-12-20T10:00:00Z',
					nextSchedule: '2025-01-20T10:00:00Z'
				},
				{
					customer: 'Premium Services Co',
					totalInvoices: 6,
					grandTotal: 18900.30,
					lastSent: '2025-01-03T10:00:00Z',
					nextSchedule: '2025-01-18T10:00:00Z'
				},
				{
					customer: 'Innovative Designs LLC',
					totalInvoices: 4,
					grandTotal: 11200.00,
					lastSent: null,
					nextSchedule: '2025-01-25T10:00:00Z'
				},
				{
					customer: 'Regional Distributors',
					totalInvoices: 7,
					grandTotal: 25600.80,
					lastSent: '2024-12-28T10:00:00Z',
					nextSchedule: '2025-01-28T10:00:00Z'
				},
				{
					customer: 'Quality Assurance Ltd',
					totalInvoices: 1,
					grandTotal: 3200.50,
					lastSent: '2025-01-08T10:00:00Z',
					nextSchedule: '2025-01-22T10:00:00Z'
				}
			];
		} catch (err) {
			console.error('Error loading statement accounts:', err);
			error = err instanceof Error ? err.message : 'Failed to load statement accounts';
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
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
			<!-- Empty State -->
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
		{:else}
			<!-- Table Container -->
			<div class="overflow-hidden rounded-lg bg-white shadow-md">
				<div class="overflow-x-auto">
					<table class="min-w-full divide-y divide-gray-200">
						<thead class="bg-gray-50">
							<tr>
								<th scope="col" class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
									Customer
								</th>
								<th scope="col" class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
									Total Invoices
								</th>
								<th scope="col" class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
									Grand Total
								</th>
								<th scope="col" class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
									Last Sent
								</th>
								<th scope="col" class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
									Next Schedule
								</th>
								<th scope="col" class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
									Generate Document
								</th>
								<th scope="col" class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
									Send Statement
								</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200 bg-white">
							{#each statementAccounts as account}
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
		{/if}
	</div>
</main>