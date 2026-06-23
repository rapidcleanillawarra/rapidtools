<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { BatchPayment } from '../types';
	import { getPaymentRemaining } from '../utils';

	export let payments: BatchPayment[] = [];

	const dispatch = createEventDispatcher<{
		paste: { event: ClipboardEvent; index: number; field: 'reference' | 'amount' };
		remove: number;
		applyPaymentModeToAll: void;
		applyBalanceToPayments: void;
		addPayment: void;
	}>();
</script>

<table class="min-w-full bg-white">
	<thead>
		<tr>
			<th class="py-2 w-1/3">Invoice ID</th>
			<th class="py-2 w-1/6">Order Status</th>
			<th class="py-2 w-1/3">Payment</th>
			<th class="py-2 w-1/6">
				<div class="flex items-center justify-between px-2">
					<span>Payment Mode</span>
					<button
						type="button"
						class="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded"
						on:click={() => dispatch('applyPaymentModeToAll')}
					>
						Apply to All
					</button>
				</div>
			</th>
			<th class="py-2 w-1/2">
				<div class="flex items-center justify-between px-2">
					<span>Balance</span>
					<button
						type="button"
						class="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded"
						on:click={() => dispatch('applyBalanceToPayments')}
					>
						Apply to Payments
					</button>
				</div>
			</th>
			<th class="py-2 w-1/6">Action</th>
		</tr>
	</thead>
	<tbody>
		{#each payments as payment, index (payment.id)}
			{@const remaining = getPaymentRemaining(payment)}
			<tr class="text-center" class:bg-red-100={payment.isOverCredit}>
				<td class="border px-4 py-2">
					<input
						type="text"
						bind:value={payment.reference}
						class="w-full border-none focus:ring-0 bg-transparent"
						on:paste={(event) => dispatch('paste', { event, index, field: 'reference' })}
						placeholder="Paste invoice IDs here..."
					/>
					{#if payment.isOverCredit}
						<div class="text-xs text-red-600 mt-1">{payment.creditError}</div>
					{/if}
				</td>
				<td class="border px-4 py-2 text-sm text-gray-700">
					{payment.orderStatus || '—'}
				</td>
				<td class="border px-4 py-2">
					<input
						type="number"
						bind:value={payment.amount}
						class="w-full border-none focus:ring-0 bg-transparent"
						min="0"
						step="0.01"
						on:paste={(event) => dispatch('paste', { event, index, field: 'amount' })}
						placeholder="Paste amounts here..."
					/>
				</td>
				<td class="border px-4 py-2">
					<select
						bind:value={payment.paymentMode}
						class="w-full border-none focus:ring-0 bg-transparent text-xs"
					>
						<option value="Direct Deposit">Direct Deposit</option>
						<option value="Credit Payment">Credit Payment</option>
					</select>
				</td>
				<td
					class="border px-4 py-2"
					class:bg-green-100={remaining <= 0}
					class:bg-red-100={remaining > 0}
				>
					<input
						type="number"
						bind:value={payment.balance}
						class="w-full border-none focus:ring-0 bg-transparent"
						min="0"
						step="0.01"
						placeholder="Balance: {payment.balance || 0}"
						readonly
					/>
					<div
						class="text-xs mt-1"
						class:text-green-600={remaining <= 0}
						class:text-red-600={remaining > 0}
					>
						Balance: ${(payment.balance || 0).toFixed(2)} | Remaining: ${remaining.toFixed(2)}
					</div>
				</td>
				<td class="border px-4 py-2">
					<button
						type="button"
						class="text-red-600 hover:text-red-800"
						on:click={() => dispatch('remove', index)}
					>
						Remove
					</button>
				</td>
			</tr>
		{/each}
	</tbody>
</table>

<div class="flex justify-start mt-4">
	<button
		type="button"
		class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
		on:click={() => dispatch('addPayment')}
	>
		Add Payment
	</button>
</div>
