<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { ProcessedOrder, Ticket } from '../pastDueAccounts';
	import { supabase } from '$lib/supabase';
	import { parseDate } from '../pastDueAccounts';
	import { formatSydneyDisplay, isUtcIsoPast } from '../utils/dueDate';

	function isPastDue(ticketDue: string | null, orderDue: string | null): boolean {
		if (ticketDue) {
			return isUtcIsoPast(ticketDue);
		}
		if (orderDue) {
			const parsed = parseDate(orderDue);
			return parsed ? parsed < Date.now() : false;
		}
		return false;
	}

	function formatDueDate(ticketDue: string | null, orderDue: string | null): string {
		if (ticketDue) {
			return formatSydneyDisplay(ticketDue);
		}
		if (orderDue) {
			return orderDue;
		}
		return 'N/A';
	}

	function getDueDateColor(ticket: any, order: ProcessedOrder | null): string {
		const ticketDue = ticket.due_date || null;
		const orderDue = order?.dueDate || null;
		const isPast = isPastDue(ticketDue, orderDue);
		return isPast
			? 'text-red-600 dark:text-red-400 font-medium'
			: 'text-gray-500 dark:text-gray-300';
	}

	export let showModal = false;
	export let order: ProcessedOrder | null = null;
	export let tickets: Ticket[] = [];

	const dispatch = createEventDispatcher();

	let availableUsers: { email: string; full_name: string }[] = [];
	let usersLoading = false;

	// Fetch users when modal opens
	$: if (showModal && availableUsers.length === 0) {
		fetchUsers();
	}

	async function fetchUsers() {
		if (availableUsers.length > 0) return;
		try {
			usersLoading = true;
			const { data, error } = await supabase
				.from('users')
				.select('email, full_name')
				.order('full_name', { ascending: true });

			if (error) {
				console.error('Error fetching users:', error);
			} else {
				availableUsers = data || [];
			}
		} catch (error) {
			console.error('Error in fetchUsers:', error);
		} finally {
			usersLoading = false;
		}
	}

	function closeModal() {
		dispatch('close');
	}

	function createNewTicket() {
		dispatch('createTicket', order);
	}

	function editTicket(ticket: any) {
		dispatch('editTicket', ticket);
	}

	// Close modal when clicking outside
	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			closeModal();
		}
	}

	function getStatusColor(status: string) {
		switch (status) {
			case 'Completed': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
			case 'In Progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
			default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
		}
	}

	function getPriorityColor(priority: string) {
		switch (priority) {
			case 'High': return 'text-red-600 dark:text-red-400 font-medium';
			case 'Medium': return 'text-yellow-600 dark:text-yellow-400';
			default: return 'text-gray-600 dark:text-gray-400';
		}
	}
</script>

{#if showModal && order}
	<div
		class="fixed inset-0 z-50 overflow-y-auto"
		aria-labelledby="view-tickets-modal-title"
		role="dialog"
		aria-modal="true"
		on:click={handleBackdropClick}
	>
		<div class="flex min-h-screen items-end justify-center px-4 pb-20 pt-4 text-center sm:block sm:p-0">
			<div
				class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
				aria-hidden="true"
			></div>

			<span class="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>

			<div
				class="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all dark:bg-gray-800 sm:my-8 sm:w-full sm:max-w-7xl sm:align-middle sm:h-[90vh]"
			>
				<div class="bg-white px-4 pb-4 pt-5 dark:bg-gray-800 sm:p-6 sm:pb-4">
					<div class="sm:flex sm:items-start">
						<div class="mt-3 w-full text-center sm:mt-0 sm:text-left">
							<h3
								class="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100"
								id="view-tickets-modal-title"
							>
								Tickets for {order.customer} 
								<span class="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">(Invoice: {order.invoice})</span>
							</h3>
							
							<div class="mt-4">
								{#if tickets.length === 0}
									<p class="text-sm text-gray-500 dark:text-gray-400 italic">No tickets found for this order.</p>
								{:else}
									<div class="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 rounded-lg">
										<table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
											<thead class="bg-gray-50 dark:bg-gray-900">
												<tr>
													<th scope="col" class="py-3.5 pl-4 pr-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:pl-6">Ticket #</th>
													<th scope="col" class="px-3 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Title</th>
													<th scope="col" class="px-3 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
													<th scope="col" class="px-3 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Priority</th>
													<th scope="col" class="px-3 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Due Date</th>
													<th scope="col" class="px-3 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Assigned To</th>
													<th scope="col" class="px-3 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 w-32">Actions</th>
												</tr>
											</thead>
											<tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-gray-900">
												{#each tickets as ticket}
													<tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50">
														<td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-gray-100 sm:pl-6">
															#{ticket.ticket_number}
														</td>
														<td class="px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
															{ticket.ticket_title}
														</td>
														<td class="whitespace-nowrap px-3 py-4 text-sm">
															<span class="inline-flex rounded-full px-2 text-xs font-semibold leading-5 {getStatusColor(ticket.status)}">
																{ticket.status}
															</span>
														</td>
														<td class="whitespace-nowrap px-3 py-4 text-sm {getPriorityColor(ticket.priority)}">
															{ticket.priority}
														</td>
														<td class="whitespace-nowrap px-3 py-4 text-sm {getDueDateColor(ticket, order)}">
															{formatDueDate((ticket as any).due_date || null, order?.dueDate || null)}
														</td>
														<td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
															{ticket.assigned_to ? (availableUsers.find(u => u.email === ticket.assigned_to)?.full_name || ticket.assigned_to) : 'Unassigned'}
														</td>
														<td class="whitespace-nowrap px-3 py-4 text-sm w-32">
															<button
																type="button"
																on:click={() => editTicket(ticket)}
																class="inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
																title="Edit ticket"
															>
																<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																	<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
																</svg>
															</button>
														</td>
													</tr>
												{/each}
											</tbody>
										</table>
									</div>
								{/if}
							</div>

						</div>
					</div>
				</div>
				<div class="bg-gray-50 px-4 py-3 dark:bg-gray-700 sm:flex sm:flex-row-reverse sm:px-6">
					<button
						type="button"
						on:click={createNewTicket}
						class="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
					>
						Create New Ticket
					</button>
					<button
						type="button"
						on:click={closeModal}
						class="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:border-gray-500 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 sm:ml-3 sm:mt-0 sm:w-auto sm:text-sm"
					>
						Close
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
