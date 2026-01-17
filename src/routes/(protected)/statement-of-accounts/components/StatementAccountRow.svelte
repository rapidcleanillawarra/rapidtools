<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { visibleColumns } from '../statementAccounts';
	import type { StatementAccount } from '../statementAccounts';

	export let account: StatementAccount;

	const dispatch = createEventDispatcher<{
		generateDocument: StatementAccount;
		sendStatement: StatementAccount;
		print: StatementAccount;
		viewOrders: StatementAccount;
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

	function isToday(dateString: string | null): boolean {
		if (!dateString) return false;
		const date = new Date(dateString);
		if (isNaN(date.getTime())) return false;
		const now = new Date();
		return (
			date.getDate() === now.getDate() &&
			date.getMonth() === now.getMonth() &&
			date.getFullYear() === now.getFullYear()
		);
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

	function handleViewOrders() {
		dispatch('viewOrders', account);
	}

	$: canSend = (() => {
		// 1. last_file_generation and last_check must be today
		const isGeneratedToday = isToday(account.lastFileGeneration);
		const isCheckedToday = isToday(account.lastCheck);

		if (!isGeneratedToday || !isCheckedToday) return false;

		// 2. last_sent is either null OR last_sent < last_file_generation
		if (!account.lastSent) return true;

		const sentTime = new Date(account.lastSent).getTime();
		const genTime = new Date(account.lastFileGeneration!).getTime();

		return sentTime < genTime;
	})();
</script>

<tr class="hover:bg-gray-50">
	{#if $visibleColumns.companyName}
	<td class="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
		{account.companyName}
	</td>
	{/if}
	{#if $visibleColumns.username}
	<td class="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
		<a
			href="https://www.rapidsupplies.com.au/_cpanel/customer/view?id={account.username}"
			target="_blank"
			rel="noopener noreferrer"
			class="text-blue-600 hover:text-blue-800 hover:underline"
		>
			{account.username}
		</a>
	</td>
	{/if}
	{#if $visibleColumns.totalInvoices}
	<td class="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
		<button
			on:click={handleViewOrders}
			class="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium"
			title="View order details"
		>
			{account.totalInvoices}
		</button>
	</td>
	{/if}
	{#if $visibleColumns.allInvoicesBalance}
	<td class="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
		{formatCurrency(account.allInvoicesBalance)}
	</td>
	{/if}
	{#if $visibleColumns.dueInvoiceBalance}
	<td class="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
		{formatCurrency(account.dueInvoiceBalance)}
	</td>
	{/if}
	{#if $visibleColumns.totalBalanceCustomer}
	<td class="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
		{account.totalBalanceCustomer !== null ? formatCurrency(account.totalBalanceCustomer) : 'N/A'}
	</td>
	{/if}
	{#if $visibleColumns.aibVsTb}
	<td class="whitespace-nowrap px-6 py-4 text-sm text-center">
		{#if account.totalBalanceCustomer !== null}
			{#if Math.abs(account.allInvoicesBalance - account.totalBalanceCustomer) < 0.01}
				<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
					✓ Match
				</span>
			{:else}
				<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
					✗ Not Matched
				</span>
			{/if}
		{:else}
			<span class="text-gray-400 text-xs">N/A</span>
		{/if}
	</td>
	{/if}
	{#if $visibleColumns.lastSent}
	<td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
		{formatDate(account.lastSent)}
	</td>
	{/if}

	<td class="whitespace-nowrap px-6 py-4 text-sm">
		<div class="flex flex-col items-start gap-2">
			{#if account.oneDriveId}
				<a
					href={account.oneDriveId}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center rounded bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-800 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
				>
					View
				</a>
			{/if}
			<button
				on:click={handleGenerateDocument}
				class="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
			>
				Regenerate
			</button>
		</div>
	</td>
	<td class="whitespace-nowrap px-6 py-4 text-sm">
		{#if canSend}
			<button
				on:click={handleSendStatement}
				class="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
			>
				Send
			</button>
		{/if}
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
