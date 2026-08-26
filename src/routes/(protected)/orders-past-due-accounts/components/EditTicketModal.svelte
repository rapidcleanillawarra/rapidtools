<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { toastSuccess, toastError } from '$lib/utils/toast';
	import { currentUser } from '$lib/firebase';
	import type { Ticket, ProcessedOrder } from '../pastDueAccounts';
	import { updateTicket } from '../ticketTracking';
	import {
		isSydneyInputInPast,
		sydneyInputToUtcIso,
		utcIsoToSydneyInput,
		formatSydneyDisplay
	} from '../utils/dueDate';

	const TICKET_WEBHOOK_URL =
		'https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/c616bc7890dc4174877af4a47898eca2/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=huzEhEV42TBgQraOgxHRDDp_ZD6GjCmrD-Nuy4YtOFA';

	export let showModal = false;
	export let ticket: Ticket | null = null;
	export let order: ProcessedOrder | null = null;

	const dispatch = createEventDispatcher();

	// Form data
	let ticketTitle = '';
	let ticketDescription = '';
	let assignedTo = '';
	let priority = 'Medium';
	let status = 'Not Started';
	let dueDate = '';
	let notes = '';

	// State
	let isLoading = false;
	let usersLoading = false;
	let availableUsers: { email: string; full_name: string }[] = [];
	let originalDueDate: string | null = null; // Track original due date from database

	// Current time in Sydney timezone
	$: currentSydneyTime = (() => {
		try {
			return new Intl.DateTimeFormat('en-AU', {
				timeZone: 'Australia/Sydney',
				year: 'numeric',
				month: 'long',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
				hour12: true
			}).format(new Date());
		} catch (error) {
			// Fallback for Windows timezone issues
			const now = new Date();
			const utc = now.getTime() + now.getTimezoneOffset() * 60000;
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
	})();

	// Fetch users when modal opens
	$: if (showModal && !availableUsers.length) {
		fetchUsers();
	}

	// Pre-populate form when ticket changes
	$: if (ticket && showModal) {
		ticketTitle = ticket.ticket_title || '';
		ticketDescription = ticket.ticket_description || '';
		assignedTo = ticket.assigned_to || '';
		priority = ticket.priority || 'Medium';
		status = ticket.status || 'Not Started';
		originalDueDate = ticket.due_date || null; // Store original due date
		dueDate = ticket.due_date ? utcIsoToSydneyInput(ticket.due_date) : '';
		notes = ticket.notes || '';
	}

	async function fetchUsers() {
		if (availableUsers.length > 0) return; // Already loaded

		try {
			usersLoading = true;
			const { data, error } = await supabase
				.from('users')
				.select('email, full_name')
				.order('full_name', { ascending: true });

			if (error) {
				console.error('Error fetching users:', error);
				toastError('Failed to load users for assignment');
			} else {
				availableUsers = data || [];
			}
		} catch (error) {
			console.error('Error in fetchUsers:', error);
			toastError('Failed to load users for assignment');
		} finally {
			usersLoading = false;
		}
	}

	function validateForm(): { isValid: boolean; errors: string[] } {
		const errors: string[] = [];

		if (!ticketTitle.trim() || ticketTitle.trim().length < 3) {
			errors.push('Ticket title must be at least 3 characters long');
		}

		const validPriorities = ['Low', 'Medium', 'High'];
		if (!validPriorities.includes(priority)) {
			errors.push('Please select a valid priority');
		}

		const validStatuses = ['Not Started', 'In Progress', 'Completed', 'Closed'];
		if (!validStatuses.includes(status)) {
			errors.push('Please select a valid status');
		}

		if (assignedTo && !availableUsers.some((user) => user.email === assignedTo)) {
			errors.push('Please select a valid user for assignment');
		}

		if (isSydneyInputInPast(dueDate)) {
			errors.push('Due date must be in the future');
		}

		return {
			isValid: errors.length === 0,
			errors
		};
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
		newTicket: any; // Updated ticket data
		order: ProcessedOrder;
		updatedBy: string;
	}): string {
		const { ticketNumber, oldTicket, newTicket, order, updatedBy } = options;
		const changes: string[] = [];

		// Compare all fields that can change
		if (oldTicket.ticket_title !== newTicket.ticket_title) {
			changes.push(
				`Title: ${formatPlain(oldTicket.ticket_title)} → ${formatPlain(newTicket.ticket_title)}`
			);
		}

		if (oldTicket.ticket_description !== newTicket.ticket_description) {
			changes.push(
				`Description: ${formatPlain(oldTicket.ticket_description)} → ${formatPlain(newTicket.ticket_description)}`
			);
		}

		if (oldTicket.status !== newTicket.status) {
			changes.push(`Status: ${formatPlain(oldTicket.status)} → ${formatPlain(newTicket.status)}`);
		}

		if (oldTicket.priority !== newTicket.priority) {
			changes.push(
				`Priority: ${formatPlain(oldTicket.priority)} → ${formatPlain(newTicket.priority)}`
			);
		}

		if (oldTicket.assigned_to !== newTicket.assigned_to) {
			const oldName = oldTicket.assigned_to ? getUserFullName(oldTicket.assigned_to) : 'Unassigned';
			const newName = newTicket.assigned_to ? getUserFullName(newTicket.assigned_to) : 'Unassigned';
			changes.push(`Assigned To: ${formatPlain(oldName)} → ${formatPlain(newName)}`);
		}

		if (originalDueDate !== newTicket.due_date) {
			const oldDueDate = originalDueDate ? formatSydneyDisplay(originalDueDate) : 'N/A';
			const newDueDate = newTicket.due_date ? formatSydneyDisplay(newTicket.due_date) : 'N/A';
			changes.push(`Due Date: ${formatPlain(oldDueDate)} → ${formatPlain(newDueDate)}`);
		}

		if (oldTicket.notes !== newTicket.notes) {
			changes.push(`Notes: ${formatPlain(oldTicket.notes)} → ${formatPlain(newTicket.notes)}`);
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
		newTicket: any;
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

	async function updateTicketRecord() {
		if (!ticket) return;

		const validation = validateForm();
		if (!validation.isValid) {
			toastError(validation.errors.join('. '));
			return;
		}

		// Capture the old ticket state for notification
		const oldTicket = { ...ticket };

		// Prepare the update data
		const updateData = {
			ticket_title: ticketTitle.trim(),
			ticket_description: ticketDescription.trim() || null,
			status,
			priority,
			assigned_to: assignedTo || null,
			due_date: sydneyInputToUtcIso(dueDate),
			notes: notes.trim() || null
		};

		try {
			isLoading = true;

			const result = await updateTicket(ticket.ticket_number, updateData);

			if (result.success) {
				// Send notification with comparison
				try {
					if (order) {
						await sendTicketUpdateNotification({
							ticketNumber: ticket.ticket_number,
							oldTicket,
							newTicket: updateData,
							order,
							updatedBy: getUserFullName($currentUser?.email || '')
						});
					}
				} catch (notificationError) {
					console.error('Failed to send ticket update notification:', notificationError);
					// Don't block the ticket update if notification fails
				}

				toastSuccess('Ticket updated successfully!');
				dispatch('ticketUpdated');
				closeModal();
			} else {
				toastError(`Failed to update ticket: ${result.error}`);
			}
		} catch (error) {
			console.error('Error in updateTicket:', error);
			toastError('An unexpected error occurred while updating the ticket');
		} finally {
			isLoading = false;
		}
	}

	function closeModal() {
		dispatch('close');
		resetForm();
	}

	function resetForm() {
		ticketTitle = '';
		ticketDescription = '';
		assignedTo = '';
		priority = 'Medium';
		status = 'Not Started';
		originalDueDate = null;
		dueDate = '';
		notes = '';
	}

	function getSydneyDateValues(date: Date = new Date()) {
		const tf = new Intl.DateTimeFormat('en-US', {
			timeZone: 'Australia/Sydney',
			year: 'numeric',
			month: 'numeric',
			day: 'numeric',
			hour: 'numeric',
			minute: 'numeric',
			second: 'numeric',
			hour12: false
		});
		const parts = tf.formatToParts(date);
		const getPart = (type: string) => parseInt(parts.find((p) => p.type === type)?.value || '0');

		return {
			year: getPart('year'),
			month: getPart('month') - 1, // 0-indexed
			day: getPart('day'),
			hour: getPart('hour'),
			minute: getPart('minute')
		};
	}

	function formatIsLocal(
		year: number,
		month: number,
		day: number,
		hour: number,
		minute: number
	): string {
		const pad = (n: number) => n.toString().padStart(2, '0');
		return `${year}-${pad(month + 1)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
	}

	function setDueDateEndOfDay() {
		// Target: Today 17:00 Sydney Wall Time
		const s = getSydneyDateValues();
		dueDate = formatIsLocal(s.year, s.month, s.day, 17, 0);
	}

	function setDueDateTwoHours() {
		// Target: Now + 2 hours Sydney Wall Time
		// We calculate 2 hours ahead in real time, then get the Sydney Wall Time for that moment
		const now = new Date();
		const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

		const s = getSydneyDateValues(twoHoursLater);
		dueDate = formatIsLocal(s.year, s.month, s.day, s.hour, s.minute);
	}

	function setDueDateEndOfMonth() {
		// Target: Last day of current Sydney month, 17:00 Sydney Wall Time
		const s = getSydneyDateValues();

		// Find last day of this sydney month
		// new Date(year, month + 1, 0) works in local time, but days in month are constant regardless of timezone
		// (except very rare historic calendar changes which don't apply here)
		const daysInMonth = new Date(s.year, s.month + 1, 0).getDate();

		dueDate = formatIsLocal(s.year, s.month, daysInMonth, 17, 0);
	}

	async function copyTicketData() {
		const ticketData = {
			ticket_title: ticketTitle,
			ticket_description: ticketDescription,
			priority: priority,
			status: status,
			assigned_to: assignedTo,
			due_date: ticket?.due_date, // Use the ISO string from the ticket if available, or we might want to construct it
			notes: notes
		};

		// If we want to copy the currently edited values:
		// We should construct the due_date properly if it was changed
		if (dueDate) {
			ticketData.due_date = sydneyInputToUtcIso(dueDate);
		}

		try {
			await navigator.clipboard.writeText(JSON.stringify(ticketData));
			toastSuccess('Ticket data copied to clipboard');
		} catch (err) {
			console.error('Failed to copy ticket data:', err);
			toastError('Failed to copy ticket data');
		}
	}

	// Close modal when clicking outside
	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			closeModal();
		}
	}
</script>

{#if showModal}
	<div
		class="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
		aria-labelledby="edit-ticket-modal-title"
		role="dialog"
		aria-modal="true"
		on:click={handleBackdropClick}
	>
		<div
			class="relative w-full max-w-lg rounded-2xl border border-[#262a30] bg-[#141619] p-6 text-left shadow-2xl transition-all"
		>
			<div class="flex items-center justify-between">
				<h3
					class="text-lg font-bold text-white"
					id="edit-ticket-modal-title"
				>
					Edit Ticket #{ticket?.ticket_number}
				</h3>
				<button
					type="button"
					on:click={copyTicketData}
					class="btn-secondary text-xs inline-flex items-center gap-1.5"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
						/>
					</svg>
					Copy Data
				</button>
			</div>

			<div class="mt-4 space-y-4 max-h-[75vh] overflow-y-auto pr-1">
				<!-- Ticket Title -->
				<div>
					<label
						for="edit-ticket-title"
						class="block text-sm font-medium text-gray-300 mb-1.5"
					>
						Ticket Title <span class="text-red-400">*</span>
					</label>
					<input
						type="text"
						id="edit-ticket-title"
						bind:value={ticketTitle}
						class="w-full rounded-lg bg-[#0e1012] border border-[#262a30] px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
						placeholder="Enter ticket title..."
						required
						disabled={isLoading}
					/>
				</div>

				<!-- Ticket Description -->
				<div>
					<label
						for="edit-ticket-description"
						class="block text-sm font-medium text-gray-300 mb-1.5"
					>
						Description
					</label>
					<textarea
						id="edit-ticket-description"
						rows="3"
						bind:value={ticketDescription}
						class="w-full rounded-lg bg-[#0e1012] border border-[#262a30] p-3 text-sm text-gray-200 placeholder-gray-600 focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
						placeholder="Enter ticket description..."
						disabled={isLoading}
					></textarea>
				</div>

				<!-- Assigned To -->
				<div>
					<label
						for="edit-assigned-to"
						class="block text-sm font-medium text-gray-300 mb-1.5"
					>
						Assign To
					</label>
					{#if usersLoading}
						<div class="mt-1 flex items-center">
							<div
								class="h-4 w-4 animate-spin rounded-full border-b-2 border-lime-500"
							></div>
							<span class="ml-2 text-sm text-gray-400"
								>Loading users...</span
							>
						</div>
					{:else}
						<select
							id="edit-assigned-to"
							bind:value={assignedTo}
							class="w-full rounded-lg bg-[#0e1012] border border-[#262a30] px-3 py-2 text-sm text-gray-200 focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
							disabled={isLoading}
						>
							<option value="">Unassigned</option>
							{#each availableUsers as user}
								<option value={user.email}>{user.full_name} ({user.email})</option>
							{/each}
						</select>
					{/if}
				</div>

				<!-- Priority and Status Row -->
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label
							for="edit-priority"
							class="block text-sm font-medium text-gray-300 mb-1.5"
						>
							Priority <span class="text-red-400">*</span>
						</label>
						<select
							id="edit-priority"
							bind:value={priority}
							class="w-full rounded-lg bg-[#0e1012] border border-[#262a30] px-3 py-2 text-sm text-gray-200 focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
							required
							disabled={isLoading}
						>
							<option value="Low">Low</option>
							<option value="Medium">Medium</option>
							<option value="High">High</option>
						</select>
					</div>

					<div>
						<label
							for="edit-status"
							class="block text-sm font-medium text-gray-300 mb-1.5"
						>
							Status <span class="text-red-400">*</span>
						</label>
						<select
							id="edit-status"
							bind:value={status}
							class="w-full rounded-lg bg-[#0e1012] border border-[#262a30] px-3 py-2 text-sm text-gray-200 focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
							required
							disabled={isLoading}
						>
							<option value="Not Started">Not Started</option>
							<option value="In Progress">In Progress</option>
							<option value="Completed">Completed</option>
							<option value="Closed">Closed</option>
						</select>
					</div>
				</div>

				<!-- Due Date -->
				<div>
					<div class="mb-1 flex items-center justify-between">
						<label
							for="edit-due-date"
							class="block text-sm font-medium text-gray-300 mb-1.5"
						>
							Due Date &amp; Time
						</label>
						<span class="text-xs text-gray-400">
							Sydney: {currentSydneyTime}
						</span>
					</div>
					<input
						type="datetime-local"
						id="edit-due-date"
						bind:value={dueDate}
						class="w-full rounded-lg bg-[#0e1012] border border-[#262a30] px-3 py-2 text-sm text-gray-200 focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
						disabled={isLoading}
					/>
					<div class="mt-2 flex flex-wrap gap-2">
						<button
							type="button"
							on:click={setDueDateEndOfDay}
							class="inline-flex items-center rounded-lg border border-[#333842] bg-[#1f2329] px-2.5 py-1.5 text-xs font-medium text-gray-300 hover:bg-[#262a30] hover:text-white transition"
							disabled={isLoading}
						>
							End of Day (5PM)
						</button>
						<button
							type="button"
							on:click={setDueDateTwoHours}
							class="inline-flex items-center rounded-lg border border-[#333842] bg-[#1f2329] px-2.5 py-1.5 text-xs font-medium text-gray-300 hover:bg-[#262a30] hover:text-white transition"
							disabled={isLoading}
						>
							2 Hours
						</button>
						<button
							type="button"
							on:click={setDueDateEndOfMonth}
							class="inline-flex items-center rounded-lg border border-[#333842] bg-[#1f2329] px-2.5 py-1.5 text-xs font-medium text-gray-300 hover:bg-[#262a30] hover:text-white transition"
							disabled={isLoading}
						>
							End of Month
						</button>
					</div>
				</div>

				<!-- Notes -->
				<div>
					<label
						for="edit-ticket-notes"
						class="block text-sm font-medium text-gray-300 mb-1.5"
					>
						Notes
					</label>
					<textarea
						id="edit-ticket-notes"
						rows="2"
						bind:value={notes}
						class="w-full rounded-lg bg-[#0e1012] border border-[#262a30] p-3 text-sm text-gray-200 placeholder-gray-600 focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
						placeholder="Additional notes..."
						disabled={isLoading}
					></textarea>
				</div>

				<!-- Order Details Summary -->
				{#if order}
					<div class="rounded-xl border border-[#262a30] bg-[#181b20] p-3 text-sm text-gray-300">
						<p>
							<strong class="text-white">Invoice:</strong>
							{order.invoice} |
							<strong class="text-white">Amount:</strong> ${order.amount} |
							<strong class="text-white">Days Past Due:</strong>
							{order.pdCounter}
						</p>
					</div>
				{/if}
			</div>

			<div class="mt-6 flex justify-end gap-3 border-t border-[#262a30] pt-4">
				<button
					type="button"
					on:click={closeModal}
					class="btn-secondary text-sm"
				>
					Cancel
				</button>
				<button
					type="button"
					on:click={updateTicketRecord}
					disabled={!ticketTitle.trim() || isLoading}
					class="btn-primary text-sm"
				>
					{#if isLoading}
						Updating...
					{:else}
						Update Ticket
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
