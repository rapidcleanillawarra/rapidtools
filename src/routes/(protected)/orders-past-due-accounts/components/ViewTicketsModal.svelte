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
			? 'text-red-400 font-medium'
			: 'text-gray-300';
	}

	export let showModal = false;
	export let order: ProcessedOrder | null = null;
	export let tickets: Ticket[] = [];

	const dispatch = createEventDispatcher();

	// Sort tickets by created_at in descending order (latest first)
	$: sortedTickets = tickets
		.slice()
		.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

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
			case 'Completed':
				return 'border border-emerald-500/30 bg-emerald-950/30 text-emerald-400';
			case 'In Progress':
				return 'border border-sky-500/30 bg-sky-950/30 text-sky-400';
			default:
				return 'border border-[#333842] bg-[#1f2329] text-gray-400';
		}
	}

	function getPriorityColor(priority: string) {
		switch (priority) {
			case 'High':
				return 'text-red-400 font-medium';
			case 'Medium':
				return 'text-yellow-400';
			default:
				return 'text-gray-400';
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
			const utc = date.getTime() + date.getTimezoneOffset() * 60000;
			const sydney = new Date(utc + 10 * 3600000); // UTC+10 for AEST
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
		const user = availableUsers.find((u) => u.email === email);
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

		if (oldTicket.due_date !== newTicket.due_date) {
			const oldDueDate = oldTicket.due_date ? formatSydneyDisplay(oldTicket.due_date) : 'N/A';
			const newDueDate = newTicket.due_date ? formatSydneyDisplay(newTicket.due_date) : 'N/A';
			changes.push(`Due Date: ${formatPlain(oldDueDate)} → ${formatPlain(newDueDate)}`);
		}

		return `<p>Ticket #${ticketNumber} Updated<br>
<br>
Changes:<br>
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
			tickets = tickets.map((t) => (t.id === ticket.id ? newTicket : t));

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
			const { error } = await supabase.from('tickets').delete().eq('id', ticketToDelete.id);

			if (error) throw error;

			// Update local state
			tickets = tickets.filter((t) => t.id !== ticketToDelete!.id);

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

	async function copyTicket(ticket: Ticket) {
		const ticketData = {
			ticket_title: ticket.ticket_title,
			ticket_description: ticket.ticket_description,
			priority: ticket.priority,
			status: ticket.status,
			assigned_to: ticket.assigned_to,
			due_date: ticket.due_date,
			notes: ticket.notes
		};

		try {
			await navigator.clipboard.writeText(JSON.stringify(ticketData));
			toastSuccess('Ticket data copied to clipboard');
		} catch (err) {
			console.error('Failed to copy ticket data:', err);
			toastError('Failed to copy ticket data');
		}
	}
</script>

{#if showModal && order}
	<div
		class="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
		aria-labelledby="view-tickets-modal-title"
		role="dialog"
		aria-modal="true"
		on:click={handleBackdropClick}
	>
		<div
			class="relative flex max-h-[90vh] w-full max-w-6xl flex-col rounded-2xl border border-[#262a30] bg-[#141619] p-6 text-left shadow-2xl transition-all"
		>
			<div class="flex items-center justify-between pb-4 border-b border-[#262a30]">
				<h3
					class="text-lg font-bold text-white"
					id="view-tickets-modal-title"
				>
					Tickets for {order.customer}
					<span class="ml-2 text-sm font-normal text-gray-400"
						>(Invoice: {order.invoice})</span
					>
				</h3>
			</div>

			<div class="mt-4 flex-1 overflow-y-auto pr-1">
				{#if sortedTickets.length === 0}
					<p class="py-8 text-center text-sm italic text-gray-500">
						No tickets found for this order.
					</p>
				{:else}
					<div class="overflow-x-auto rounded-xl border border-[#262a30] bg-[#141619] shadow-xl">
						<table class="w-full min-w-full divide-y divide-[#262a30] text-sm text-gray-200">
							<thead class="bg-[#181b20] text-xs font-semibold uppercase tracking-wider text-gray-400">
								<tr>
									<th
										scope="col"
										class="py-3.5 pl-4 pr-3 text-left sm:pl-6"
										>Ticket #</th
									>
									<th
										scope="col"
										class="px-3 py-3.5 text-left"
										>Title</th
									>
									<th
										scope="col"
										class="px-3 py-3.5 text-left"
										>Status</th
									>
									<th
										scope="col"
										class="px-3 py-3.5 text-left"
										>Mark Complete</th
									>
									<th
										scope="col"
										class="px-3 py-3.5 text-left"
										>Due Date</th
									>
									<th
										scope="col"
										class="px-3 py-3.5 text-left"
										>Assigned To</th
									>
									<th
										scope="col"
										class="w-32 px-3 py-3.5 text-left"
										>Actions</th
									>
								</tr>
							</thead>
							<tbody
								class="divide-y divide-[#262a30] bg-[#141619]"
							>
								{#each sortedTickets as ticket}
									<tr class="hover:bg-[#1f2329]/60 transition-colors">
										<td
											class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-semibold text-lime-400 sm:pl-6"
										>
											#{ticket.ticket_number}
										</td>
										<td class="px-3 py-4 text-sm font-medium text-gray-200">
											{ticket.ticket_title}
										</td>
										<td class="whitespace-nowrap px-3 py-4 text-sm">
											<span
												class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5 {getStatusColor(
													ticket.status
												)}"
											>
												{ticket.status}
											</span>
										</td>
										<td class="whitespace-nowrap px-3 py-4 text-sm">
											{#if ticket.status !== 'Completed'}
												{#if $currentUser?.email === ticket.assigned_to || $currentUser?.email === 'marketing@rapidcleanillawarra.com.au'}
													<button
														type="button"
														on:click={() => markAsComplete(ticket)}
														class="inline-flex items-center rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-2.5 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-900/40 hover:text-emerald-300 transition"
													>
														Mark Complete
													</button>
												{/if}
											{:else}
												<span class="text-xs font-semibold text-emerald-400"
													>Completed</span
												>
											{/if}
										</td>
										<td
											class="whitespace-nowrap px-3 py-4 text-sm {getDueDateColor(ticket, order)}"
										>
											{formatDueDate((ticket as any).due_date || null, order?.dueDate || null)}
										</td>
										<td
											class="whitespace-nowrap px-3 py-4 text-sm text-gray-300"
										>
											{ticket.assigned_to
												? availableUsers.find((u) => u.email === ticket.assigned_to)?.full_name ||
													ticket.assigned_to
												: 'Unassigned'}
										</td>
										<td class="w-32 whitespace-nowrap px-3 py-4 text-sm">
											<div class="flex items-center space-x-2">
												<button
													type="button"
													on:click={() => copyTicket(ticket)}
													class="inline-flex items-center rounded-lg border border-[#333842] bg-[#1f2329] p-1.5 text-xs font-medium text-gray-300 hover:bg-[#262a30] hover:text-white transition"
													title="Copy ticket data"
												>
													<svg
														class="h-4 w-4"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
														/>
													</svg>
												</button>
												<button
													type="button"
													on:click={() => editTicket(ticket)}
													class="inline-flex items-center rounded-lg border border-[#333842] bg-[#1f2329] p-1.5 text-xs font-medium text-gray-300 hover:bg-[#262a30] hover:text-white transition"
													title="Edit ticket"
												>
													<svg
														class="h-4 w-4"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
														/>
													</svg>
												</button>
												{#if $currentUser?.email === 'marketing@rapidcleanillawarra.com.au'}
													<button
														type="button"
														on:click={() => deleteTicket(ticket)}
														class="inline-flex items-center rounded-lg border border-red-500/30 bg-red-950/30 p-1.5 text-xs font-medium text-red-400 hover:bg-red-900/40 hover:text-red-300 transition"
														title="Delete ticket"
													>
														<svg
															class="h-4 w-4"
															fill="none"
															stroke="currentColor"
															viewBox="0 0 24 24"
														>
															<path
																stroke-linecap="round"
																stroke-linejoin="round"
																stroke-width="2"
																d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
															/>
														</svg>
													</button>
												{/if}
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>

			<div class="mt-6 flex justify-end gap-3 border-t border-[#262a30] pt-4">
				<button
					type="button"
					on:click={closeModal}
					class="btn-secondary text-sm"
				>
					Close
				</button>
				<button
					type="button"
					on:click={createNewTicket}
					class="btn-primary text-sm"
				>
					Create New Ticket
				</button>
			</div>
		</div>
	</div>
{/if}

<DeleteConfirmationModal
	show={showDeleteModal}
	title="Delete Ticket"
	message="Are you sure you want to delete this ticket?"
	itemName={ticketToDelete
		? `Ticket #${ticketToDelete.ticket_number}: ${ticketToDelete.ticket_title}`
		: ''}
	{isDeleting}
	on:confirm={confirmDelete}
	on:cancel={() => {
		showDeleteModal = false;
		ticketToDelete = null;
	}}
/>
