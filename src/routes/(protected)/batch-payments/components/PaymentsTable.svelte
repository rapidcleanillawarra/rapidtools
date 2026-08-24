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

<div class="rounded-2xl border border-[#262a30] bg-[#141619] shadow-xl overflow-hidden mb-6">
	<div class="overflow-x-auto">
		<table class="w-full min-w-[900px] divide-y divide-[#262a30] text-sm text-gray-200">
			<thead class="bg-[#181b20] text-xs font-semibold uppercase tracking-wider text-gray-400">
				<tr>
					<th class="px-4 py-3 text-left w-1/4">Invoice ID</th>
					<th class="px-4 py-3 text-left w-32">Order Status</th>
					<th class="px-4 py-3 text-left w-44">Payment</th>
					<th class="px-4 py-3 text-left w-52">
						<div class="flex items-center justify-between gap-2">
							<span>Payment Mode</span>
							<button
								type="button"
								class="text-xs bg-lime-500/10 text-lime-400 border border-lime-500/30 hover:bg-lime-500/20 px-2 py-0.5 rounded-md font-medium transition"
								on:click={() => dispatch('applyPaymentModeToAll')}
							>
								Apply to All
							</button>
						</div>
					</th>
					<th class="px-4 py-3 text-left w-60">
						<div class="flex items-center justify-between gap-2">
							<span>Balance</span>
							<button
								type="button"
								class="text-xs bg-lime-500/10 text-lime-400 border border-lime-500/30 hover:bg-lime-500/20 px-2 py-0.5 rounded-md font-medium transition"
								on:click={() => dispatch('applyBalanceToPayments')}
							>
								Apply to Payments
							</button>
						</div>
					</th>
					<th class="px-4 py-3 text-center w-24">Action</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-[#262a30] bg-[#141619]">
				{#each payments as payment, index (payment.id)}
					{@const remaining = getPaymentRemaining(payment)}
					<tr class="transition-colors {payment.isOverCredit ? 'bg-red-950/30 hover:bg-red-950/40' : 'even:bg-[#181b20]/50 hover:bg-[#1f2329]/60'}">
						<td class="px-4 py-3">
							<input
								type="text"
								bind:value={payment.reference}
								class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-3 py-1.5 text-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-600 transition-colors"
								on:paste={(event) => dispatch('paste', { event, index, field: 'reference' })}
								placeholder="Paste invoice IDs here..."
							/>
							{#if payment.isOverCredit}
								<div class="text-xs text-red-400 mt-1 font-medium">{payment.creditError}</div>
							{/if}
						</td>
						<td class="px-4 py-3 text-sm text-gray-300">
							<span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-[#1f2329] border border-[#262a30] text-gray-300">
								{payment.orderStatus || '—'}
							</span>
						</td>
						<td class="px-4 py-3">
							<input
								type="number"
								bind:value={payment.amount}
								class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-3 py-1.5 text-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-600 transition-colors"
								min="0"
								step="0.01"
								on:paste={(event) => dispatch('paste', { event, index, field: 'amount' })}
								placeholder="Paste amounts here..."
							/>
						</td>
						<td class="px-4 py-3">
							<select
								bind:value={payment.paymentMode}
								class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-3 py-1.5 text-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
							>
								<option value="Direct Deposit">Direct Deposit</option>
								<option value="Credit Payment">Credit Payment</option>
							</select>
						</td>
						<td class="px-4 py-3">
							<input
								type="number"
								bind:value={payment.balance}
								class="w-full bg-[#0e1012]/60 text-gray-400 border border-[#262a30] rounded-lg px-3 py-1.5 text-sm cursor-not-allowed"
								min="0"
								step="0.01"
								placeholder="Balance: {payment.balance || 0}"
								readonly
							/>
							<div
								class="text-xs mt-1.5 font-medium flex items-center justify-between"
							>
								<span class="text-gray-400">Bal: ${(payment.balance || 0).toFixed(2)}</span>
								<span class="{remaining <= 0 ? 'text-lime-400' : 'text-red-400'}">
									Rem: ${remaining.toFixed(2)}
								</span>
							</div>
						</td>
						<td class="px-4 py-3 text-center">
							<button
								type="button"
								class="inline-flex items-center justify-center rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-900/40 hover:text-red-300 disabled:opacity-30 transition"
								on:click={() => dispatch('remove', index)}
							>
								Remove
							</button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<div class="flex justify-start">
	<button
		type="button"
		class="btn-secondary text-sm inline-flex items-center gap-2"
		on:click={() => dispatch('addPayment')}
	>
		<svg class="w-4 h-4 text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
		</svg>
		Add Payment
	</button>
</div>
