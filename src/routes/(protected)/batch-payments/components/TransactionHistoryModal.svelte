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
	class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto"
	on:click={() => dispatch('close')}
	role="presentation"
>
	<div
		class="relative mx-auto p-6 border border-[#262a30] w-full max-w-4xl shadow-2xl rounded-2xl bg-[#141619] text-gray-200 my-8"
		on:click|stopPropagation
		role="dialog"
		aria-modal="true"
		aria-labelledby="transaction-history-title"
	>
		<div>
			<div class="flex justify-between items-center mb-5">
				<div>
					<h3 id="transaction-history-title" class="text-xl font-bold text-white tracking-tight">
						Transaction History
					</h3>
					<p class="text-xs text-gray-400 mt-0.5">View and review past batch payment sessions</p>
				</div>
				<button
					type="button"
					class="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#1f2329] transition-colors"
					aria-label="Close transaction history"
					on:click={() => dispatch('close')}
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="mt-4">
				{#if sessions.length > 0}
					<div class="rounded-xl border border-[#262a30] overflow-hidden">
						<div class="overflow-x-auto max-h-[60vh]">
							<table class="w-full min-w-full divide-y divide-[#262a30] text-sm text-gray-200">
								<thead class="bg-[#181b20] text-xs font-semibold uppercase tracking-wider text-gray-400 sticky top-0 z-10">
									<tr>
										<th class="px-5 py-3 text-left">
											Session ID
										</th>
										<th class="px-5 py-3 text-left">
											Date Created
										</th>
										<th class="px-5 py-3 text-left">
											Performed By
										</th>
										<th class="px-5 py-3 text-center">
											Payments Count
										</th>
										<th class="px-5 py-3 text-right">
											Total Amount
										</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-[#262a30] bg-[#141619]">
									{#each sessions as session (session.sessionId)}
										<tr class="even:bg-[#181b20]/50 hover:bg-[#1f2329]/60 transition-colors">
											<td class="px-5 py-3.5 whitespace-nowrap text-sm font-medium">
												<button
													type="button"
													class="text-lime-400 hover:text-lime-300 underline font-semibold transition-colors"
													on:click={() => dispatch('selectSession', session)}
												>
													{session.sessionId || 'N/A'}
												</button>
											</td>
											<td class="px-5 py-3.5 whitespace-nowrap text-sm text-gray-400">
												{formatSessionDate(session.dateCreated)}
											</td>
											<td class="px-5 py-3.5 whitespace-nowrap text-sm text-gray-300">
												{session.performedBy?.firstName || ''}
												{session.performedBy?.lastName || ''}
											</td>
											<td class="px-5 py-3.5 whitespace-nowrap text-sm text-center">
												<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#1f2329] border border-[#262a30] text-gray-300">
													{session.payments?.length || 0}
												</span>
											</td>
											<td class="px-5 py-3.5 whitespace-nowrap text-sm text-right font-semibold text-lime-400">
												${session.totalAmount.toFixed(2)}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				{:else}
					<div class="text-center py-12 bg-[#181b20] border border-[#262a30] rounded-xl">
						<svg class="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="1.5"
								d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							/>
						</svg>
						<h3 class="mt-3 text-sm font-semibold text-white">No transaction history</h3>
						<p class="mt-1 text-xs text-gray-400">You haven't processed any payments yet.</p>
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
