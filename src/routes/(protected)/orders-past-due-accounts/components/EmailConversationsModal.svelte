<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { supabase } from '$lib/supabase';
	import type { ProcessedOrder, EmailConversation } from '../pastDueAccounts';

	// API Types
	interface PowerAutomateRequest {
		query: string;
	}

	interface PowerAutomateResponseItem {
		from: string;
		subject: string;
		bodyPreview: string;
		id: string;
		webLink: string;
	}

	interface PowerAutomateResponse {
		value: PowerAutomateResponseItem[];
	}

	export let showModal = false;
	export let order: ProcessedOrder | null = null;

	const dispatch = createEventDispatcher<{
		close: void;
	}>();

	// Filter state management
	let filters: string[] = [];
	let newFilter = '';

	// API state management
	let apiLoading = false;
	let apiConversations: EmailConversation[] = [];

	// API endpoint
	const POWER_AUTOMATE_URL = 'https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/cc753c3b1e8a4aee8a80f233c080144e/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=heCHmHU5mvtcMc2Tqo1MOg5g4vd8wJ8ZwNdZNMrfRks';

	// Build search query from order_id and filters
	function buildSearchQuery(orderId: string, filters: string[]): string {
		let query = `(subject:"${orderId}" AND body:"${orderId}")`;

		for (const filter of filters) {
			query += ` OR (subject:"${filter}" body:"${filter}")`;
		}

		return query;
	}

	// Create Outlook Web deep link from message ID
	function createDeepLink(messageId: string): string {
		return `https://outlook.office365.com/owa/?ItemID=${encodeURIComponent(messageId)}&exvsurl=1&viewmodel=ReadMessageItem`;
	}

	// Fetch conversations from Power Automate API
	async function fetchConversations(orderId: string, filters: string[]): Promise<void> {
		try {
			apiLoading = true;
			const query = buildSearchQuery(orderId, filters);

			const requestBody: PowerAutomateRequest = {
				query
			};

			const response = await fetch(POWER_AUTOMATE_URL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(requestBody)
			});

			if (!response.ok) {
				throw new Error(`API request failed: ${response.status}`);
			}

			const data: PowerAutomateResponse = await response.json();

			// Map API response to EmailConversation format
			apiConversations = data.value.map(item => ({
				from: item.from,
				subject: item.subject,
				body_preview: item.bodyPreview,
				web_link: createDeepLink(item.id),
				order_id: orderId,
				has_value: 'true' // API responses always have value
			}));

		} catch (error) {
			console.error('Error fetching conversations:', error);
			apiConversations = [];
		} finally {
			apiLoading = false;
		}
	}

	// Initialize filters from order data when modal opens
	$: if (showModal && order) {
		filters = [...(order.emailFilters || [])];
	}

	// Use API conversations instead of local filtering
	$: filteredConversations = apiConversations;

	// Fetch conversations when modal opens or filters change
	$: if (showModal && order) {
		filters = [...(order.emailFilters || [])];
		fetchConversations(order.invoice, filters);
	}

	// Re-fetch when filters change
	$: if (order && filters !== undefined) {
		fetchConversations(order.invoice, filters);
	}

	function closeModal() {
		dispatch('close');
	}

	// Filter management functions
	async function updateFilters(newFilters: string[]) {
		if (!order) return;

		try {
			// Update local state immediately for UI responsiveness
			filters = [...newFilters];
			order.emailFilters = [...newFilters];

			// Update database
			const { error } = await supabase
				.from('orders_past_due_accounts_invoice_tracking')
				.update({ email_filters: newFilters })
				.eq('order_id', order.invoice);

			if (error) {
				console.error('Error updating email filters:', error);
				// Revert local state on error
				filters = [...(order.emailFilters || [])];
			}
		} catch (error) {
			console.error('Error in updateFilters:', error);
		}
	}

	function addFilter() {
		const trimmedFilter = newFilter.trim();
		if (trimmedFilter && !filters.includes(trimmedFilter)) {
			const newFilters = [...filters, trimmedFilter];
			updateFilters(newFilters);
			newFilter = '';
		}
	}

	function removeFilter(filterToRemove: string) {
		const newFilters = filters.filter(f => f !== filterToRemove);
		updateFilters(newFilters);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			addFilter();
		}
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

								<!-- Email Filters Section -->
								<div class="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-700/50">
									<h4 class="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">
										Email Filters
									</h4>

									<!-- Filter Input -->
									<div class="mb-3 flex gap-2">
										<input
											type="text"
											bind:value={newFilter}
											on:keydown={handleKeydown}
											placeholder="Enter keyword to filter emails..."
											class="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
										/>
										<button
											type="button"
											on:click={addFilter}
											disabled={!newFilter.trim()}
											class="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
										>
											Add
										</button>
									</div>

									<!-- Active Filters -->
									{#if filters.length > 0}
										<div class="flex flex-wrap gap-2">
											{#each filters as filter}
												<span class="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
													{filter}
													<button
														type="button"
														on:click={() => removeFilter(filter)}
														class="ml-1 inline-flex items-center justify-center rounded-full p-0.5 text-indigo-600 hover:bg-indigo-200 hover:text-indigo-900 dark:text-indigo-400 dark:hover:bg-indigo-800 dark:hover:text-indigo-100"
													>
														<span class="sr-only">Remove filter</span>
														<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
														</svg>
													</button>
												</span>
											{/each}
										</div>
									{:else}
										<p class="text-xs text-gray-500 dark:text-gray-400">
											No filters applied. All emails will be shown.
										</p>
									{/if}
								</div>

								<!-- Loading State -->
								{#if apiLoading}
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
								{:else if filteredConversations.length === 0}
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
											{filters.length > 0 ? 'No matching conversations' : 'No conversations found'}
										</h3>
										<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
											{filters.length > 0
												? 'Try adjusting your filters or remove them to see all conversations.'
												: 'There are no email conversations for this order.'
											}
										</p>
									</div>
								{:else}
									<!-- Email Conversations List -->
									<div class="mb-2 text-sm text-gray-600 dark:text-gray-400">
										Showing {filteredConversations.length} conversations
										{filters.length > 0 ? ` (searched for: ${filters.join(', ')})` : ''}
									</div>
									<div class="max-h-96 overflow-y-auto">
										<div class="space-y-3">
											{#each filteredConversations as conversation}
												<div class="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-700/50">
													<div class="flex items-start justify-between">
														<div class="flex-1 min-w-0">
															<p class="text-sm font-medium text-gray-900 dark:text-gray-100">
																{conversation.from}
															</p>
															{#if conversation.subject}
																<p class="mt-1 text-sm font-medium text-gray-800 dark:text-gray-200">
																	Subject: {conversation.subject}
																</p>
															{/if}
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