<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { sortField, sortDirection, visibleColumns, getSortIcon, sortData } from '../statementAccounts';
	import type { StatementAccount, ColumnKey, NumericFilter } from '../statementAccounts';
	import StatementAccountRow from './StatementAccountRow.svelte';

	export let accounts: StatementAccount[];
	export let searchFilters: Partial<Record<ColumnKey, string>>;
	export let numericFilters: Partial<Record<ColumnKey, NumericFilter>>;

	const dispatch = createEventDispatcher<{
		searchChange: { key: ColumnKey; value: string };
		numericFilterChange: { key: ColumnKey; filter: NumericFilter };
		sortChange: { field: ColumnKey; direction: 'asc' | 'desc' };
		generateDocument: StatementAccount;
		sendStatement: StatementAccount;
		print: StatementAccount;
		viewOrders: StatementAccount;
	}>();

	function handleSearchInput(key: ColumnKey, event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		dispatch('searchChange', { key, value: target.value });
	}

	function handleNumericFilterChange(key: ColumnKey, value: string, operator: string) {
		const numValue = parseFloat(value);
		if (isNaN(numValue)) {
			// If value is not a valid number, don't dispatch
			return;
		}
		dispatch('numericFilterChange', {
			key,
			filter: { value: numValue, operator: operator as 'gt' | 'lt' | 'eq' }
		});
	}

	function handleOperatorChange(key: ColumnKey, operator: string, currentValue: string) {
		const numValue = parseFloat(currentValue);
		if (isNaN(numValue)) {
			// If value is not a valid number, don't dispatch
			return;
		}
		dispatch('numericFilterChange', {
			key,
			filter: { value: numValue, operator: operator as 'gt' | 'lt' | 'eq' }
		});
	}

	function handleSortClick(field: ColumnKey) {
		const currentField = $sortField;
		const currentDirection = $sortDirection;

		let newDirection: 'asc' | 'desc' = 'asc';
		if (currentField === field && currentDirection === 'asc') {
			newDirection = 'desc';
		}

		sortField.set(field);
		sortDirection.set(newDirection);
		dispatch('sortChange', { field, direction: newDirection });
	}

	function toggleColumnVisibility(column: ColumnKey) {
		visibleColumns.update(columns => ({
			...columns,
			[column]: !columns[column]
		}));
	}
</script>

<div class="overflow-hidden rounded-lg bg-white shadow-md">
	<!-- Column Visibility Controls -->
	<div class="bg-gray-50 p-4 border-b border-gray-200">
		<div class="flex flex-wrap gap-2 items-center">
			<span class="text-sm font-medium text-gray-700 mr-2">Show Columns:</span>
			{#each Object.entries($visibleColumns) as [key, visible]}
				<label class="flex items-center gap-1 text-sm">
					<input
						type="checkbox"
						checked={visible}
						on:change={() => toggleColumnVisibility(key as ColumnKey)}
						class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
					/>
					<span class="capitalize">
						{key === 'companyName' ? 'Company Name' :
						 key === 'allInvoicesBalance' ? 'All Invoices Balance' :
						 key === 'dueInvoiceBalance' ? 'Due Invoice Balance' :
						 key === 'totalBalanceCustomer' ? 'Total Balance' :
						 key === 'aibVsTb' ? 'AIB vs TB' :
						 key === 'lastSent' ? 'Last Sent' :
						 key.replace(/([A-Z])/g, ' $1').trim()}
					</span>
				</label>
			{/each}
		</div>
	</div>

	<div class="overflow-x-auto">
		<table class="min-w-full divide-y divide-gray-200">
			<thead class="bg-gray-50">
				<tr>
					{#if $visibleColumns.companyName}
					<th
						scope="col"
						class="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100"
						on:click={() => handleSortClick('companyName')}
					>
						<div class="flex flex-col gap-2">
							<div class="flex items-center gap-1">
								Company Name
								<span class="text-xs">{getSortIcon('companyName', $sortField, $sortDirection)}</span>
							</div>
							<input
								type="text"
								placeholder="Search..."
								class="w-full rounded border px-2 py-1 text-xs font-normal text-gray-900"
								value={searchFilters['companyName'] || ''}
								on:input={(e) => handleSearchInput('companyName', e)}
							/>
						</div>
					</th>
					{/if}
					{#if $visibleColumns.username}
					<th
						scope="col"
						class="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100"
						on:click={() => handleSortClick('username')}
					>
						<div class="flex flex-col gap-2">
							<div class="flex items-center gap-1">
								Username
								<span class="text-xs">{getSortIcon('username', $sortField, $sortDirection)}</span>
							</div>
							<input
								type="text"
								placeholder="Search..."
								class="w-full rounded border px-2 py-1 text-xs font-normal text-gray-900"
								value={searchFilters['username'] || ''}
								on:input={(e) => handleSearchInput('username', e)}
							/>
						</div>
					</th>
					{/if}
					{#if $visibleColumns.totalInvoices}
					<th
						scope="col"
						class="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100"
						on:click={() => handleSortClick('totalInvoices')}
					>
						<div class="flex flex-col gap-2">
							<div class="flex items-center gap-1">
								Total Invoices
								<span class="text-xs">{getSortIcon('totalInvoices', $sortField, $sortDirection)}</span>
							</div>
							<input
								type="text"
								placeholder="Search..."
								class="w-full rounded border px-2 py-1 text-xs font-normal text-gray-900"
								value={searchFilters['totalInvoices'] || ''}
								on:input={(e) => handleSearchInput('totalInvoices', e)}
							/>
						</div>
					</th>
					{/if}
					{#if $visibleColumns.allInvoicesBalance}
					<th
						scope="col"
						class="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100"
						on:click={() => handleSortClick('allInvoicesBalance')}
					>
						<div class="flex flex-col gap-2">
							<div class="flex items-center gap-1">
								All Invoices Balance
								<span class="text-xs">{getSortIcon('allInvoicesBalance', $sortField, $sortDirection)}</span>
							</div>
							<div class="flex gap-1">
								<select
									class="rounded border px-1 py-1 text-xs text-gray-900 bg-white"
									value={numericFilters['allInvoicesBalance']?.operator || 'gt'}
									on:change={(e) => handleOperatorChange('allInvoicesBalance', e.currentTarget.value, (numericFilters['allInvoicesBalance']?.value || 0).toString())}
								>
									<option value="gt">&gt;</option>
									<option value="lt">&lt;</option>
									<option value="eq">=</option>
								</select>
								<input
									type="number"
									step="0.01"
									placeholder="0.00"
									class="flex-1 rounded border px-2 py-1 text-xs font-normal text-gray-900"
									value={numericFilters['allInvoicesBalance']?.value || ''}
									on:input={(e) => handleNumericFilterChange('allInvoicesBalance', e.currentTarget.value, numericFilters['allInvoicesBalance']?.operator || 'gt')}
								/>
							</div>
						</div>
					</th>
					{/if}
					{#if $visibleColumns.dueInvoiceBalance}
					<th
						scope="col"
						class="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100"
						on:click={() => handleSortClick('dueInvoiceBalance')}
					>
						<div class="flex flex-col gap-2">
							<div class="flex items-center gap-1">
								Due Invoice Balance
								<span class="text-xs">{getSortIcon('dueInvoiceBalance', $sortField, $sortDirection)}</span>
							</div>
							<input
								type="text"
								placeholder="Search..."
								class="w-full rounded border px-2 py-1 text-xs font-normal text-gray-900"
								value={searchFilters['dueInvoiceBalance'] || ''}
								on:input={(e) => handleSearchInput('dueInvoiceBalance', e)}
							/>
						</div>
					</th>
					{/if}
					{#if $visibleColumns.totalBalanceCustomer}
					<th
						scope="col"
						class="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100"
						on:click={() => handleSortClick('totalBalanceCustomer')}
					>
						<div class="flex flex-col gap-2">
							<div class="flex items-center gap-1">
								Total Balance (Customer)
								<span class="text-xs">{getSortIcon('totalBalanceCustomer', $sortField, $sortDirection)}</span>
							</div>
							<input
								type="text"
								placeholder="Search..."
								class="w-full rounded border px-2 py-1 text-xs font-normal text-gray-900"
								value={searchFilters['totalBalanceCustomer'] || ''}
								on:input={(e) => handleSearchInput('totalBalanceCustomer', e)}
							/>
						</div>
					</th>
					{/if}
					{#if $visibleColumns.aibVsTb}
					<th
						scope="col"
						class="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
					>
						AIB vs TB
					</th>
					{/if}
					{#if $visibleColumns.lastSent}
					<th
						scope="col"
						class="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100"
						on:click={() => handleSortClick('lastSent')}
					>
						<div class="flex flex-col gap-2">
							<div class="flex items-center gap-1">
								Last Sent
								<span class="text-xs">{getSortIcon('lastSent', $sortField, $sortDirection)}</span>
							</div>
							<input
								type="text"
								placeholder="Search..."
								class="w-full rounded border px-2 py-1 text-xs font-normal text-gray-900"
								value={searchFilters['lastSent'] || ''}
								on:input={(e) => handleSearchInput('lastSent', e)}
							/>
						</div>
					</th>
					{/if}

					<th
						scope="col"
						class="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
					>
						PDF
					</th>
					<th
						scope="col"
						class="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
					>
						Send Statement
					</th>
					<th
						scope="col"
						class="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
					>
						Print
					</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-gray-200 bg-white">
				{#each accounts as account}
					<StatementAccountRow
						{account}
						on:generateDocument={(e) => dispatch('generateDocument', e.detail)}
						on:sendStatement={(e) => dispatch('sendStatement', e.detail)}
						on:print={(e) => dispatch('print', e.detail)}
						on:viewOrders={(e) => dispatch('viewOrders', e.detail)}
					/>
				{/each}
			</tbody>
		</table>
	</div>
</div>
