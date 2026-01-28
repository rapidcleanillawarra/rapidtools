<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { ProcessedOrder, EmailConversation } from '../pastDueAccounts';

	export let showModal = false;
	export let order: ProcessedOrder | null = null;
	export let loading = false;
	export let conversations: EmailConversation[] = [];

	const dispatch = createEventDispatcher<{
		close: void;
	}>();

	function closeModal() {
		dispatch('close');
	}
</script>

{#if showModal && order}
	<div
		class="fixed inset-0 z-50 overflow-y-auto"
		aria-labelledby="modal-title"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="flex min-h-screen items-end justify-center px-4 pb-20 pt-4 text-center sm:block sm:p-0"
		>
			<div
				class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
				aria-hidden="true"
				on:click={closeModal}
			></div>

			<span class="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true"
				>&#8203;</span
			>

			<div
				class="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all dark:bg-gray-800 sm:my-8 sm:w-full sm:max-w-2xl sm:align-middle"
			>
				<div class="bg-white px-4 pb-4 pt-5 dark:bg-gray-800 sm:p-6 sm:pb-4">
					<div class="sm:flex sm:items-start">
						<div class="mt-3 w-full text-center sm:mt-0 sm:text-left">
							<h3
								class="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100"
								id="modal-title"
							>
								Email Conversations - Invoice {order.invoice}
							</h3>
							<div class="mt-4">
								<p class="mb-4 text-sm text-gray-500 dark:text-gray-400">
									Customer: {order.customer}
								</p>

								<!-- Loading State -->
								{#if loading}
									<div class="flex items-center justify-center py-8">
										<div class="flex items-center space-x-2">
											<svg
												class="h-5 w-5 animate-spin text-gray-400"
												xmlns="http://www.w3.org/2000/svg"
												fill="none"
												viewBox="0 0 24 24"
											>
												<circle
													class="opacity-25"
													cx="12"
													cy="12"
													r="10"
													stroke="currentColor"
													stroke-width="4"
												></circle>
												<path
													class="opacity-75"
													fill="currentColor"
													d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
												></path>
											</svg>
											<span class="text-sm text-gray-500 dark:text-gray-400">Loading conversations...</span>
										</div>
									</div>
								{:else if conversations.length === 0}
									<div class="py-8 text-center">
										<svg
											class="mx-auto h-12 w-12 text-gray-400"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
											xmlns="http://www.w3.org/2000/svg"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
											></path>
										</svg>
										<h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
											No conversations found
										</h3>
										<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
											There are no email conversations for this order.
										</p>
									</div>
								{:else}
									<!-- Email Conversations List -->
									<div class="max-h-96 overflow-y-auto">
										<div class="space-y-3">
											{#each conversations as conversation}
												<div class="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-700/50">
													<div class="flex items-start justify-between">
														<div class="flex-1 min-w-0">
															<p class="text-sm font-medium text-gray-900 dark:text-gray-100">
																{conversation.from}
															</p>
															<p class="mt-1 text-sm text-gray-700 dark:text-gray-300">
																{conversation.body_preview}
															</p>
														</div>
														<div class="ml-4 flex-shrink-0">
															<a
																href={conversation.web_link}
																target="_blank"
																rel="noopener noreferrer"
																class="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-3 py-2 text-sm font-medium leading-4 text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
															>
																<svg
																	class="mr-2 h-4 w-4"
																	fill="none"
																	stroke="currentColor"
																	viewBox="0 0 24 24"
																	xmlns="http://www.w3.org/2000/svg"
																>
																	<path
																		stroke-linecap="round"
																		stroke-linejoin="round"
																		stroke-width="2"
																		d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
																	></path>
																</svg>
																Open
															</a>
														</div>
													</div>
												</div>
											{/each}
										</div>
									</div>
								{/if}
							</div>
						</div>
					</div>
				</div>
				<div class="bg-gray-50 px-4 py-3 dark:bg-gray-700 sm:flex sm:flex-row-reverse sm:px-6">
					<button
						type="button"
						class="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
						on:click={closeModal}
					>
						Close
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}