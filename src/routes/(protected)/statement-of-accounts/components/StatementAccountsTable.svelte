<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { StatementAccount, ColumnKey } from '../statementAccounts';
	import StatementAccountRow from './StatementAccountRow.svelte';

	export let accounts: StatementAccount[];
	export let searchFilters: Partial<Record<ColumnKey, string>>;

	const dispatch = createEventDispatcher<{
		searchChange: { key: ColumnKey; value: string };
		generateDocument: StatementAccount;
		sendStatement: StatementAccount;
		print: StatementAccount;
	}>();

	function handleSearchInput(key: ColumnKey, event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		dispatch('searchChange', { key, value: target.value });
	}
</script>

<div class="overflow-hidden rounded-lg bg-white shadow-md">
	<div class="overflow-x-auto">
		<table class="min-w-full divide-y divide-gray-200">
			<thead class="bg-gray-50">
				<tr>
					<th
						scope="col"
						class="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
					>
						<div class="flex flex-col gap-2">
							Company Name
							<input
								type="text"
								placeholder="Search..."
								class="w-full rounded border px-2 py-1 text-xs font-normal text-gray-900"
								value={searchFilters['companyName'] || ''}
								on:input={(e) => handleSearchInput('companyName', e)}
							/>
						</div>
					</th>
					<th
						scope="col"
						class="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
					>
						<div class="flex flex-col gap-2">
							Username
							<input
								type="text"
								placeholder="Search..."
								class="w-full rounded border px-2 py-1 text-xs font-normal text-gray-900"
								value={searchFilters['username'] || ''}
								on:input={(e) => handleSearchInput('username', e)}
							/>
						</div>
					</th>
					<th
						scope="col"
						class="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
					>
						<div class="flex flex-col gap-2">
							Total Invoices
							<input
								type="text"
								placeholder="Search..."
								class="w-full rounded border px-2 py-1 text-xs font-normal text-gray-900"
								value={searchFilters['totalInvoices'] || ''}
								on:input={(e) => handleSearchInput('totalInvoices', e)}
							/>
						</div>
					</th>
					<th
						scope="col"
						class="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
					>
						<div class="flex flex-col gap-2">
							All Invoices Balance (Order)
							<input
								type="text"
								placeholder="Search..."
								class="w-full rounded border px-2 py-1 text-xs font-normal text-gray-900"
								value={searchFilters['allInvoicesBalance'] || ''}
								on:input={(e) => handleSearchInput('allInvoicesBalance', e)}
							/>
						</div>
					</th>
					<th
						scope="col"
						class="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
					>
						<div class="flex flex-col gap-2">
							Due Invoice Balance (Order)
							<input
								type="text"
								placeholder="Search..."
								class="w-full rounded border px-2 py-1 text-xs font-normal text-gray-900"
								value={searchFilters['dueInvoiceBalance'] || ''}
								on:input={(e) => handleSearchInput('dueInvoiceBalance', e)}
							/>
						</div>
					</th>
					<th
						scope="col"
						class="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
					>
						<div class="flex flex-col gap-2">
							Total Balance (Customer)
							<input
								type="text"
								placeholder="Search..."
								class="w-full rounded border px-2 py-1 text-xs font-normal text-gray-900"
								value={searchFilters['totalBalanceCustomer'] || ''}
								on:input={(e) => handleSearchInput('totalBalanceCustomer', e)}
							/>
						</div>
					</th>
					<th
						scope="col"
						class="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
					>
						<div class="flex flex-col gap-2">
							Last Sent
							<input
								type="text"
								placeholder="Search..."
								class="w-full rounded border px-2 py-1 text-xs font-normal text-gray-900"
								value={searchFilters['lastSent'] || ''}
								on:input={(e) => handleSearchInput('lastSent', e)}
							/>
						</div>
					</th>
					<th
						scope="col"
						class="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
					>
						Detailed Payments
					</th>

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
					/>
				{/each}
			</tbody>
		</table>
	</div>
</div>
