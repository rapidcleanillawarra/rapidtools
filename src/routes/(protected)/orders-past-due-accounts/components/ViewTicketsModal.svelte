<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { ProcessedOrder, Ticket } from '../pastDueAccounts';
	import { supabase } from '$lib/supabase';
	import { parseDate } from '../pastDueAccounts';
	import { formatSydneyDisplay, isUtcIsoPast } from '../utils/dueDate';
	import { currentUser } from '$lib/firebase';
	import DeleteConfirmationModal from '$lib/components/DeleteConfirmationModal.svelte';
	import { toastSuccess, toastError } from '$lib/utils/toast';

	const TICKET_WEBHOOK_URL =
		'https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/c616bc7890dc4174877af4a47898eca2/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=huzEhEV42TBgQraOgxHRDDp_ZD6GjCmrD-Nuy4YtOFA';

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

	// Sort tickets by created_at in descending order (latest first)
	$: sortedTickets = tickets.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

	let availableUsers: { email: string; full_name: string }[] = [];
	let usersLoading = false;

	// Delete modal state
	let showDeleteModal = false;
	let ticketToDelete: Ticket | null = null;
	let isDeleting = false;

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

	function formatSydneyDateTime(date: Date): string {
		try {
			return new Intl.DateTimeFormat('en-AU', {
				timeZone: 'Australia/Sydney',
				year: 'numeric',
				month: 'long',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
				hour12: true
			}).format(date);
		} catch (error) {
			// Fallback for Windows timezone issues
			const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
			const sydney = new Date(utc + (10 * 3600000)); // UTC+10 for AEST
			return new Intl.DateTimeFormat('en-AU', {
				year: 'numeric',
				month: 'long',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
				hour12: true
			}).format(sydney);
		}
	}

	function formatPlain(value: any): string {
		if (value === null || value === undefined || value === '') return 'N/A';
		return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}

	function getUserFullName(email: string): string {
		const user = availableUsers.find(u => u.email === email);
		return user ? user.full_name : email;
	}

	function buildUpdateNotificationHtml(options: {
		ticketNumber: number;
		oldTicket: Ticket;
		newTicket: Ticket;
		order: ProcessedOrder;
		updatedBy: string;
	}): string {
		const { ticketNumber, oldTicket, newTicket, order, updatedBy } = options;
		const changes: string[] = [];

		// Compare all fields that can change
		if (oldTicket.status !== newTicket.status) {
			changes.push(`Status: ${formatPlain(oldTicket.status)} → ${formatPlain(newTicket.status)}`);
		}

		if (changes.length === 0) {
			return `<p>Ticket #${ticketNumber} - No changes detected<br>
Ticket #${ticketNumber} was updated but no fields changed.<br>
<br>
Customer: ${formatPlain(order.customer)}<br>
Invoice: ${formatPlain(order.invoice)} | Amount: $${formatPlain(order.amount)}<br>
Updated by: ${formatPlain(updatedBy)}<br>
Updated: ${formatPlain(formatSydneyDateTime(new Date()))}</p>`;
		}

		return `<p>Ticket #${ticketNumber} Updated<br>
Ticket #${ticketNumber} has been updated in RapidTools.<br>
<br>
<b>Changes:</b><br>
${changes.join('<br>')}<br>
<br>
Customer: ${formatPlain(order.customer)}<br>
Invoice: ${formatPlain(order.invoice)} | Amount: $${formatPlain(order.amount)}<br>
Updated by: ${formatPlain(updatedBy)}<br>
Updated: ${formatPlain(formatSydneyDateTime(new Date()))}</p>`;
	}

	async function sendTicketUpdateNotification(options: {
		ticketNumber: number;
		oldTicket: Ticket;
		newTicket: Ticket;
		order: ProcessedOrder;
		updatedBy: string;
	}): Promise<void> {
		const htmlBody = buildUpdateNotificationHtml(options);

		const payload = {
			body: htmlBody,
			action: 'accounts'
		};

		const response = await fetch(TICKET_WEBHOOK_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(payload)
		});

		if (!response.ok) {
			throw new Error(`Ticket update webhook failed with status ${response.status}`);
		}
	}

	async function markAsComplete(ticket: Ticket) {
		if (!$currentUser?.email) {
			console.error('User not logged in');
			return;
		}

		// Capture the old ticket state for notification
		const oldTicket = { ...ticket };

		try {
			const { error } = await supabase
				.from('tickets')
				.update({
					status: 'Completed'
				})
				.eq('id', ticket.id);

			if (error) throw error;

			// Create the updated ticket state
			const newTicket = { ...ticket, status: 'Completed' };

			// Update local state
			tickets = tickets.map(t =>
				t.id === ticket.id
					? newTicket
					: t
			);

			// Send notification with comparison
			try {
				if (order) {
					await sendTicketUpdateNotification({
						ticketNumber: ticket.ticket_number,
						oldTicket,
						newTicket,
						order,
						updatedBy: getUserFullName($currentUser.email)
					});
				}
			} catch (notificationError) {
				console.error('Failed to send ticket update notification:', notificationError);
				// Don't block the ticket update if notification fails
			}

			// Optional: Dispatch event if parent needs to refresh strict state
			// dispatch('ticketUpdated', ticket);
		} catch (error) {
			console.error('Error marking ticket as complete:', error);
			alert('Failed to update ticket');
		}
	}

	function deleteTicket(ticket: Ticket) {
		ticketToDelete = ticket;
		showDeleteModal = true;
	}

	async function confirmDelete() {
		if (!ticketToDelete) return;

		try {
			isDeleting = true;
			const { error } = await supabase
				.from('tickets')
				.delete()
				.eq('id', ticketToDelete.id);

			if (error) throw error;

			// Update local state
			tickets = tickets.filter(t => t.id !== ticketToDelete!.id);

			// Dispatch event to refresh parent data
			dispatch('ticketUpdated');

			toastSuccess(`Ticket #${ticketToDelete.ticket_number} deleted successfully!`);

			// Close modal and reset state
			showDeleteModal = false;
			ticketToDelete = null;
		} catch (error) {
			console.error('Error deleting ticket:', error);
			toastError('Failed to delete ticket');
		} finally {
			isDeleting = false;
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
						</div>
					</div>
				</div>

				<div class="overflow-y-auto px-4 pt-4 dark:bg-gray-800 sm:px-6" style="max-height: 60vh;">
								{#if sortedTickets.length === 0}
									<p class="text-sm text-gray-500 dark:text-gray-400 italic">No tickets found for this order.</p>
								{:else}
									<div class="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 rounded-lg">
										<table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
											<thead class="bg-gray-50 dark:bg-gray-900">
												<tr>
													<th scope="col" class="py-3.5 pl-4 pr-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:pl-6">Ticket #</th>
													<th scope="col" class="px-3 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Title</th>
													<th scope="col" class="px-3 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
													<th scope="col" class="px-3 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Mark Complete</th>
													<th scope="col" class="px-3 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Due Date</th>
													<th scope="col" class="px-3 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Assigned To</th>
													<th scope="col" class="px-3 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 w-32">Actions</th>
												</tr>
											</thead>
											<tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-gray-900">
												{#each sortedTickets as ticket}
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
														<td class="whitespace-nowrap px-3 py-4 text-sm">
															{#if ticket.status !== 'Completed'}
																{#if $currentUser?.email === ticket.assigned_to || $currentUser?.email === 'marketing@rapidcleanillawarra.com.au'}
																	<button
																		type="button"
																		on:click={() => markAsComplete(ticket)}
																		class="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-900"
																	>
																		Mark Complete
																	</button>
																{/if}
															{:else}
																<span class="text-green-600 dark:text-green-400 text-xs font-medium">Completed</span>
															{/if}
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
															{#if $currentUser?.email === 'marketing@rapidcleanillawarra.com.au'}
																<button
																	type="button"
																	on:click={() => deleteTicket(ticket)}
																	class="inline-flex items-center ml-2 px-2 py-1 border border-red-300 text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:border-red-600 dark:bg-gray-700 dark:text-red-300 dark:hover:bg-red-900/50"
																	title="Delete ticket"
																>
																	<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
																	</svg>
																</button>
															{/if}
														</td>
													</tr>
												{/each}
											</tbody>
										</table>
									</div>
								{/if}
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

<DeleteConfirmationModal
	show={showDeleteModal}
	title="Delete Ticket"
	message="Are you sure you want to delete this ticket?"
	itemName={ticketToDelete ? `Ticket #${ticketToDelete.ticket_number}: ${ticketToDelete.ticket_title}` : ''}
	isDeleting={isDeleting}
	on:confirm={confirmDelete}
	on:cancel={() => { showDeleteModal = false; ticketToDelete = null; }}
/>
