<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { SessionRow } from '../types';
	import { formatSessionDate } from '../utils';

	export let session: SessionRow;

	const dispatch = createEventDispatcher<{ close: void }>();
</script>

<div
	class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
	on:click={() => dispatch('close')}
	role="presentation"
>
	<div
		class="relative top-20 mx-auto p-5 border w-4/5 max-w-5xl shadow-lg rounded-md bg-white"
		on:click|stopPropagation
		role="dialog"
		aria-modal="true"
		aria-labelledby="payment-details-title"
	>
		<div class="mt-3">
			<div class="flex justify-between items-center mb-4">
				<div>
					<h3 id="payment-details-title" class="text-lg leading-6 font-medium text-gray-900">
						Payment Details
					</h3>
					<p class="text-sm text-gray-500">Session: {session.sessionId}</p>
				</div>
				<button
					type="button"
					class="text-gray-400 hover:text-gray-600"
					aria-label="Close payment details"
					on:click={() => dispatch('close')}
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
				<div>
					<p class="text-sm font-medium text-gray-500">Date Created</p>
					<p class="text-sm text-gray-900">{formatSessionDate(session.dateCreated)}</p>
				</div>
				<div>
					<p class="text-sm font-medium text-gray-500">Performed By</p>
					<p class="text-sm text-gray-900">
						{session.performedBy?.firstName || ''} {session.performedBy?.lastName || ''}
					</p>
				</div>
				<div>
					<p class="text-sm font-medium text-gray-500">Total Amount</p>
					<p class="text-sm text-gray-900 font-semibold">${session.totalAmount.toFixed(2)}</p>
				</div>
			</div>

			<div class="mt-4">
				{#if session.payments && session.payments.length > 0}
					<div class="overflow-x-auto">
						<table class="min-w-full bg-white border border-gray-200">
							<thead class="bg-gray-50">
								<tr>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Order ID
									</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Payment ID
									</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Payment Mode
									</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Amount
									</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Date Processed
									</th>
								</tr>
							</thead>
							<tbody class="bg-white divide-y divide-gray-200">
								{#each session.payments as payment (payment.paymentId)}
									<tr class="hover:bg-gray-50">
										<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
											<a
												href="https://www.rapidsupplies.com.au/_cpanel/salesorder/view?id={payment.orderId}"
												target="_blank"
												rel="noopener noreferrer"
												class="text-blue-600 hover:text-blue-800 underline cursor-pointer"
											>
												{payment.orderId || 'N/A'}
											</a>
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											<a
												href="https://www.rapidsupplies.com.au/_cpanel/orderpayment/view?id={payment.paymentId}"
												target="_blank"
												rel="noopener noreferrer"
												class="text-blue-600 hover:text-blue-800 underline cursor-pointer"
											>
												{payment.paymentId || 'N/A'}
											</a>
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											<span
												class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {payment.paymentMode ===
												'Credit Payment'
													? 'bg-blue-100 text-blue-800'
													: 'bg-green-100 text-green-800'}"
											>
												{payment.paymentMode || 'N/A'}
											</span>
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-semibold">
											${(payment.amount || 0).toFixed(2)}
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											{payment.dateProcessed
												? new Date(payment.dateProcessed).toLocaleString()
												: 'N/A'}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<div class="text-center py-8">
						<p class="text-sm text-gray-500">No payment details available for this session.</p>
					</div>
				{/if}
			</div>

			<div class="flex justify-end mt-6">
				<button
					type="button"
					class="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
					on:click={() => dispatch('close')}
				>
					Close
				</button>
			</div>
		</div>
	</div>
</div>
