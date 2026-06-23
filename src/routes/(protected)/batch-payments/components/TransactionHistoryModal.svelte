<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { SessionRow } from '../types';
	import { formatSessionDate } from '../utils';

	export let sessions: SessionRow[] = [];

	const dispatch = createEventDispatcher<{
		close: void;
		selectSession: SessionRow;
	}>();
</script>

<div
	class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
	on:click={() => dispatch('close')}
	role="presentation"
>
	<div
		class="relative top-20 mx-auto p-5 border w-4/5 max-w-4xl shadow-lg rounded-md bg-white"
		on:click|stopPropagation
		role="dialog"
		aria-modal="true"
		aria-labelledby="transaction-history-title"
	>
		<div class="mt-3">
			<div class="flex justify-between items-center mb-4">
				<h3 id="transaction-history-title" class="text-lg leading-6 font-medium text-gray-900">
					Transaction History
				</h3>
				<button
					type="button"
					class="text-gray-400 hover:text-gray-600"
					aria-label="Close transaction history"
					on:click={() => dispatch('close')}
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
			<div class="mt-2">
				{#if sessions.length > 0}
					<div class="overflow-x-auto">
						<table class="min-w-full bg-white border border-gray-200">
							<thead class="bg-gray-50">
								<tr>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Session ID
									</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Date Created
									</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Performed By
									</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Payments Count
									</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Total Amount
									</th>
								</tr>
							</thead>
							<tbody class="bg-white divide-y divide-gray-200">
								{#each sessions as session (session.sessionId)}
									<tr class="hover:bg-gray-50">
										<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
											<button
												type="button"
												class="text-blue-600 hover:text-blue-800 underline cursor-pointer"
												on:click={() => dispatch('selectSession', session)}
											>
												{session.sessionId || 'N/A'}
											</button>
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											{formatSessionDate(session.dateCreated)}
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											{session.performedBy?.firstName || ''}
											{session.performedBy?.lastName || ''}
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											{session.payments?.length || 0}
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											${session.totalAmount.toFixed(2)}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<div class="text-center py-8">
						<svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							/>
						</svg>
						<h3 class="mt-2 text-sm font-medium text-gray-900">No transaction history</h3>
						<p class="mt-1 text-sm text-gray-500">You haven't processed any payments yet.</p>
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
