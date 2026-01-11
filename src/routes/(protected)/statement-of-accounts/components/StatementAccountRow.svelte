<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { StatementAccount } from '../statementAccounts';

	export let account: StatementAccount;

	const dispatch = createEventDispatcher<{
		generateDocument: StatementAccount;
		sendStatement: StatementAccount;
		print: StatementAccount;
	}>();

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

	function handleGenerateDocument() {
		dispatch('generateDocument', account);
	}

	function handleSendStatement() {
		dispatch('sendStatement', account);
	}

	function handlePrint() {
		dispatch('print', account);
	}
</script>

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
			on:click={handleGenerateDocument}
			class="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
		>
			Generate
		</button>
	</td>
	<td class="whitespace-nowrap px-6 py-4 text-sm">
		<button
			on:click={handleSendStatement}
			class="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
		>
			Send
		</button>
	</td>
	<td class="whitespace-nowrap px-6 py-4 text-sm">
		<button
			on:click={handlePrint}
			class="rounded bg-gray-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
		>
			Print
		</button>
	</td>
</tr>
