<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { supabase } from '$lib/supabase';
	import type { ProcessedOrder, EmailConversation } from '../pastDueAccounts';

	// API Types
	interface PowerAutomateRequest {
		filter_query: string;
	}

	interface PowerAutomateResponseItem {
		from: string;
		toRecipients?: string;
		subject: string;
		bodyPreview: string;
		receivedDateTime?: string;
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
		const allTerms = [orderId, ...filters];
		return allTerms.join(' OR ');
	}

	// Create Outlook Web deep link from message ID
	function createDeepLink(messageId: string): string {
		return `https://outlook.office365.com/owa/?ItemID=${encodeURIComponent(messageId)}&exvsurl=1&viewmodel=ReadMessageItem`;
	}

	// Format date for display
	function formatReceivedDate(dateString: string): string {
		if (!dateString) return '';
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: '2-digit'
		}) + ' ' + date.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
	}

	// Fetch conversations from Power Automate API
	async function fetchConversations(orderId: string, filters: string[]): Promise<void> {
		try {
			apiLoading = true;
			const query = buildSearchQuery(orderId, filters);

			const requestBody: PowerAutomateRequest = {
				filter_query: query
			};

			console.log('Email conversations fetch payload:', requestBody);

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
				to: item.toRecipients,
				subject: item.subject,
				body_preview: item.bodyPreview,
				received_datetime: item.receivedDateTime,
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
		class="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
		aria-labelledby="modal-title"
		role="dialog"
		aria-modal="true"
	>
		<div class="fixed inset-0" aria-hidden="true" on:click={closeModal}></div>

		<div
			class="relative w-full max-w-2xl rounded-2xl border border-[#262a30] bg-[#141619] p-6 text-left shadow-2xl transition-all"
		>
			<div>
				<h3
					class="text-lg font-bold text-white"
					id="modal-title"
				>
					Email Conversations - Invoice {order.invoice}
				</h3>
				<p class="mt-1 mb-4 text-sm text-gray-400">
					Customer: <span class="text-gray-200 font-medium">{order.customer}</span>
				</p>

				<!-- Email Filters Section -->
				<div class="mb-6 rounded-xl border border-[#262a30] bg-[#181b20] p-4">
					<h4 class="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
						Email Filters
					</h4>

					<!-- Filter Input -->
					<div class="mb-3 flex gap-2">
						<input
							type="text"
							bind:value={newFilter}
							on:keydown={handleKeydown}
							placeholder="Enter keyword to filter emails..."
							class="flex-1 rounded-lg bg-[#0e1012] border border-[#262a30] px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
						/>
						<button
							type="button"
							on:click={addFilter}
							disabled={!newFilter.trim()}
							class="btn-primary text-sm"
						>
							Add
						</button>
					</div>

					<!-- Active Filters -->
					{#if filters.length > 0}
						<div class="flex flex-wrap gap-2">
							{#each filters as filter}
								<span class="inline-flex items-center rounded-full border border-lime-500/40 bg-lime-500/10 px-2.5 py-0.5 text-xs font-medium text-lime-400">
									{filter}
									<button
										type="button"
										on:click={() => removeFilter(filter)}
										class="ml-1.5 inline-flex items-center justify-center rounded-full p-0.5 hover:bg-lime-500/20 text-lime-400 focus:outline-none"
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
						<p class="text-xs text-gray-500">
							No filters applied. All emails will be shown.
						</p>
					{/if}
				</div>

				<!-- Loading State -->
				{#if apiLoading}
					<div class="flex items-center justify-center py-8">
						<div class="flex items-center space-x-2">
							<svg
								class="h-5 w-5 animate-spin text-lime-400"
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
							<span class="text-sm text-gray-400">Loading conversations...</span>
						</div>
					</div>
				{:else if filteredConversations.length === 0}
					<div class="py-8 text-center">
						<svg
							class="mx-auto h-12 w-12 text-gray-600"
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
						<h3 class="mt-2 text-sm font-semibold text-gray-200">
							{filters.length > 0 ? 'No matching conversations' : 'No conversations found'}
						</h3>
						<p class="mt-1 text-sm text-gray-500">
							{filters.length > 0
								? 'Try adjusting your filters or remove them to see all conversations.'
								: 'There are no email conversations for this order.'
							}
						</p>
					</div>
				{:else}
					<!-- Email Conversations List -->
					<div class="mb-2 text-sm text-gray-400">
						Showing {filteredConversations.length} conversations
						{filters.length > 0 ? ` (searched for: ${filters.join(', ')})` : ''}
					</div>
					<div class="max-h-96 overflow-y-auto pr-1">
						<div class="space-y-3">
							{#each filteredConversations as conversation}
								<div class="rounded-xl border border-[#262a30] bg-[#181b20] p-4">
									<div class="flex items-start justify-between">
										<div class="flex-1 min-w-0">
											<p class="text-sm font-medium text-white">
												From: {conversation.from}
											</p>
											{#if conversation.to}
												<p class="text-sm text-gray-400">
													To: {conversation.to}
												</p>
											{/if}
											{#if conversation.subject}
												<p class="mt-1 text-sm font-semibold text-lime-400">
													Subject: {conversation.subject}
												</p>
											{/if}
											{#if conversation.received_datetime}
												<p class="mt-1 text-xs text-gray-500">
													{formatReceivedDate(conversation.received_datetime)}
												</p>
											{/if}
											<p class="mt-1 text-sm text-gray-300">
												{conversation.body_preview}
											</p>
										</div>
										<div class="ml-4 flex-shrink-0">
											<a
												href={conversation.web_link}
												target="_blank"
												rel="noopener noreferrer"
												class="btn-secondary text-xs inline-flex items-center gap-1.5"
											>
												<svg
													class="h-3.5 w-3.5"
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

			<div class="mt-6 flex justify-end border-t border-[#262a30] pt-4">
				<button
					type="button"
					class="btn-secondary text-sm"
					on:click={closeModal}
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}