<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { SessionRow } from '../types';
	import { formatSessionDate } from '../utils';

	export let session: SessionRow;

	const dispatch = createEventDispatcher<{ close: void }>();
</script>

<div
	class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto"
	on:click={() => dispatch('close')}
	role="presentation"
>
	<div
		class="relative mx-auto p-6 border border-[#262a30] w-full max-w-5xl shadow-2xl rounded-2xl bg-[#141619] text-gray-200 my-8"
		on:click|stopPropagation
		role="dialog"
		aria-modal="true"
		aria-labelledby="payment-details-title"
	>
		<div>
			<div class="flex justify-between items-center mb-5">
				<div>
					<h3 id="payment-details-title" class="text-xl font-bold text-white tracking-tight">
						Payment Details
					</h3>
					<p class="text-xs text-gray-400 mt-0.5">Session: <span class="text-lime-400 font-mono">{session.sessionId}</span></p>
				</div>
				<button
					type="button"
					class="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#1f2329] transition-colors"
					aria-label="Close payment details"
					on:click={() => dispatch('close')}
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="mb-5 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-[#181b20] border border-[#262a30] rounded-xl">
				<div>
					<p class="text-xs font-medium uppercase tracking-wider text-gray-400">Date Created</p>
					<p class="text-sm font-semibold text-white mt-1">{formatSessionDate(session.dateCreated)}</p>
				</div>
				<div>
					<p class="text-xs font-medium uppercase tracking-wider text-gray-400">Performed By</p>
					<p class="text-sm font-semibold text-white mt-1">
						{session.performedBy?.firstName || ''} {session.performedBy?.lastName || ''}
					</p>
				</div>
				<div>
					<p class="text-xs font-medium uppercase tracking-wider text-gray-400">Total Amount</p>
					<p class="text-sm font-bold text-lime-400 mt-1">${session.totalAmount.toFixed(2)}</p>
				</div>
			</div>

			<div class="mt-4">
				{#if session.payments && session.payments.length > 0}
					<div class="rounded-xl border border-[#262a30] overflow-hidden">
						<div class="overflow-x-auto max-h-[55vh]">
							<table class="w-full min-w-full divide-y divide-[#262a30] text-sm text-gray-200">
								<thead class="bg-[#181b20] text-xs font-semibold uppercase tracking-wider text-gray-400 sticky top-0 z-10">
									<tr>
										<th class="px-5 py-3 text-left">
											Order ID
										</th>
										<th class="px-5 py-3 text-left">
											Payment ID
										</th>
										<th class="px-5 py-3 text-left">
											Payment Mode
										</th>
										<th class="px-5 py-3 text-right">
											Amount
										</th>
										<th class="px-5 py-3 text-left">
											Date Processed
										</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-[#262a30] bg-[#141619]">
									{#each session.payments as payment (payment.paymentId)}
										<tr class="even:bg-[#181b20]/50 hover:bg-[#1f2329]/60 transition-colors">
											<td class="px-5 py-3.5 whitespace-nowrap text-sm font-medium">
												<a
													href="https://www.rapidsupplies.com.au/_cpanel/salesorder/view?id={payment.orderId}"
													target="_blank"
													rel="noopener noreferrer"
													class="text-lime-400 hover:text-lime-300 underline cursor-pointer font-semibold transition-colors"
												>
													{payment.orderId || 'N/A'}
												</a>
											</td>
											<td class="px-5 py-3.5 whitespace-nowrap text-sm text-gray-400">
												<a
													href="https://www.rapidsupplies.com.au/_cpanel/orderpayment/view?id={payment.paymentId}"
													target="_blank"
													rel="noopener noreferrer"
													class="text-lime-400 hover:text-lime-300 underline cursor-pointer font-semibold transition-colors"
												>
													{payment.paymentId || 'N/A'}
												</a>
											</td>
											<td class="px-5 py-3.5 whitespace-nowrap text-sm text-gray-300">
												<span
													class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border {payment.paymentMode ===
													'Credit Payment'
														? 'bg-blue-950/40 text-blue-400 border-blue-500/30'
														: 'bg-lime-950/40 text-lime-400 border-lime-500/30'}"
												>
													{payment.paymentMode || 'N/A'}
												</span>
											</td>
											<td class="px-5 py-3.5 whitespace-nowrap text-sm text-right font-semibold text-lime-400">
												${(payment.amount || 0).toFixed(2)}
											</td>
											<td class="px-5 py-3.5 whitespace-nowrap text-sm text-gray-400">
												{payment.dateProcessed
													? new Date(payment.dateProcessed).toLocaleString()
													: 'N/A'}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				{:else}
					<div class="text-center py-12 bg-[#181b20] border border-[#262a30] rounded-xl">
						<p class="text-sm text-gray-400">No payment details available for this session.</p>
					</div>
				{/if}
			</div>

			<div class="flex justify-end mt-6">
				<button
					type="button"
					class="btn-secondary text-sm"
					on:click={() => dispatch('close')}
				>
					Close
				</button>
			</div>
		</div>
	</div>
</div>
