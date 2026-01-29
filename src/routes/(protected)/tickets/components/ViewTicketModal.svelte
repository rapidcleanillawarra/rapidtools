<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { getTicketStatusColor, getTicketPriorityColor } from '../tickets';
	import type { Ticket } from '../tickets';

	export let showModal: boolean;
	export let ticket: Ticket | null;

	const dispatch = createEventDispatcher();

	// Format date for display
	function formatDate(dateString: string | null): string {
		if (!dateString) return 'N/A';
		return new Date(dateString).toLocaleDateString('en-AU', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	}

	// Format date and time for display
	function formatDateTime(dateString: string | null): string {
		if (!dateString) return 'N/A';
		return new Date(dateString).toLocaleString('en-AU', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			hour12: true,
		});
	}

	function closeModal() {
		dispatch('close');
	}

	function handleEdit() {
		dispatch('edit');
	}

	// Close modal when clicking outside
	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			closeModal();
		}
	}
</script>

{#if showModal && ticket}
	<div
		class="fixed inset-0 z-50 overflow-y-auto"
		aria-labelledby="view-ticket-modal-title"
		role="dialog"
		aria-modal="true"
		on:click={handleBackdropClick}
		on:keydown={(e) => e.key === 'Escape' && closeModal()}
	>
		<div class="flex min-h-screen items-end justify-center px-4 pb-20 pt-4 text-center sm:block sm:p-0">
			<div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>

			<span class="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>

			<div class="inline-block transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:align-middle">
				<div class="bg-white dark:bg-gray-800 px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
					<div class="sm:flex sm:items-start">
						<div class="mt-3 w-full text-center sm:mt-0 sm:text-left">
							<div class="flex items-center justify-between">
								<h3
									class="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100"
									id="view-ticket-modal-title"
								>
									Ticket #{ticket.ticket_number}
								</h3>
								<button
									type="button"
									on:click={closeModal}
									class="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200 focus:outline-none"
								>
									<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</div>

							<div class="mt-6 space-y-6">
								<!-- Basic Information -->
								<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
									<div>
										<h4 class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">Basic Information</h4>
										<dl class="space-y-3">
											<div>
												<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Module</dt>
												<dd class="mt-1 text-sm text-gray-900 dark:text-white">{ticket.module}</dd>
											</div>
											<div>
												<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Title</dt>
												<dd class="mt-1 text-sm text-gray-900 dark:text-white">{ticket.ticket_title}</dd>
											</div>
											{#if ticket.ticket_description}
												<div>
													<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Description</dt>
													<dd class="mt-1 text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{ticket.ticket_description}</dd>
												</div>
											{/if}
											<div>
												<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Notes</dt>
												<dd class="mt-1 text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{ticket.notes || 'N/A'}</dd>
											</div>
										</dl>
									</div>

									<div>
										<h4 class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">Status & Assignment</h4>
										<dl class="space-y-3">
											<div>
												<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
												<dd class="mt-1">
													<span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {getTicketStatusColor(ticket.status)}">
														{ticket.status}
													</span>
												</dd>
											</div>
											<div>
												<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Priority</dt>
												<dd class="mt-1">
													<span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {getTicketPriorityColor(ticket.priority)}">
														{ticket.priority}
													</span>
												</dd>
											</div>
											<div>
												<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Assigned To</dt>
												<dd class="mt-1 text-sm text-gray-900 dark:text-white">
													{ticket.assigned_to || 'Unassigned'}
												</dd>
											</div>
											<div>
												<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Due Date</dt>
												<dd class="mt-1 text-sm text-gray-900 dark:text-white">{formatDateTime(ticket.due_date)}</dd>
											</div>
										</dl>
									</div>
								</div>

								<!-- Ticket Data (JSON) -->
								{#if ticket.ticket_data && Object.keys(ticket.ticket_data).length > 0}
									<div>
										<h4 class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">Ticket Data</h4>
										<div class="bg-gray-50 dark:bg-gray-700 rounded-md p-4">
											<pre class="text-sm text-gray-900 dark:text-gray-100 overflow-x-auto"><code>{JSON.stringify(ticket.ticket_data, null, 2)}</code></pre>
										</div>
									</div>
								{/if}

								<!-- Audit Information -->
								<div>
									<h4 class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">Audit Information</h4>
									<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
										<dl class="space-y-3">
											<div>
												<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Created By</dt>
												<dd class="mt-1 text-sm text-gray-900 dark:text-white">{ticket.creator_full_name || ticket.assigned_by}</dd>
											</div>
											<div>
												<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Created At</dt>
												<dd class="mt-1 text-sm text-gray-900 dark:text-white">{formatDateTime(ticket.created_at)}</dd>
											</div>
										</dl>
										{#if ticket.updated_at}
											<dl class="space-y-3">
												<div>
													<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Last Updated</dt>
													<dd class="mt-1 text-sm text-gray-900 dark:text-white">{formatDateTime(ticket.updated_at)}</dd>
												</div>
											</dl>
										{/if}
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>

				<div class="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
					<button
						type="button"
						on:click={handleEdit}
						class="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
					>
						Edit Ticket
					</button>
					<button
						type="button"
						on:click={closeModal}
						class="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-600 px-4 py-2 text-base font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:ml-3 sm:mt-0 sm:w-auto sm:text-sm"
					>
						Close
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}