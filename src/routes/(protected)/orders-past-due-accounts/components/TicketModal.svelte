<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { currentUser } from '$lib/firebase';
	import { supabase } from '$lib/supabase';
	import type { ProcessedOrder } from '../pastDueAccounts';
	import { toastSuccess, toastError } from '$lib/utils/toast';
	import { isSydneyInputInPast, sydneyInputToUtcIso, utcIsoToSydneyInput } from '../utils/dueDate';

	export let showModal = false;
	export let order: ProcessedOrder | null = null;

	const dispatch = createEventDispatcher();
	const TICKET_WEBHOOK_URL =
		'https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/c616bc7890dc4174877af4a47898eca2/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=huzEhEV42TBgQraOgxHRDDp_ZD6GjCmrD-Nuy4YtOFA';

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
	let user: import('firebase/auth').User | null = null;

	// Subscribe to current user
	currentUser.subscribe((value) => {
		user = value;
	});

	// Current time in Sydney timezone
	$: currentSydneyTime = (() => {
		return formatSydneyDateTime(new Date());
	})();

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

	// Fetch users when modal opens
	$: if (showModal && !availableUsers.length) {
		fetchUsers();
	}

	// Pre-populate form when order changes
	$: if (order && showModal) {
		ticketTitle = `Past Due: ${order.customer} - Invoice ${order.invoice}`;
		ticketDescription = `Customer: ${order.customer}
Invoice: ${order.invoice}
Amount: $${order.amount}
Days Past Due: ${order.pdCounter}
Date Issued: ${order.dateIssued}
Due Date: ${order.dueDate}`;

		// Reset other fields
		assignedTo = '';
		priority = 'Medium';
		status = 'Not Started';
		dueDate = '';
		notes = '';
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

		const validStatuses = ['Not Started', 'In Progress', 'Completed'];
		if (!validStatuses.includes(status)) {
			errors.push('Please select a valid status');
		}

		if (!assignedTo || assignedTo.trim() === '') {
			errors.push('Assigned to is required');
		} else if (!availableUsers.some((user) => user.email === assignedTo)) {
			errors.push('Please select a valid user for assignment');
		}

		if (!dueDate || dueDate.trim() === '') {
			errors.push('Due date is required');
		} else if (isSydneyInputInPast(dueDate)) {
			errors.push('Due date must be in the future');
		}

		return {
			isValid: errors.length === 0,
			errors
		};
	}

	type TicketInsertData = {
		module: string;
		ticket_title: string;
		ticket_description: string | null;
		assigned_to: string | null;
		assigned_by: string;
		priority: string;
		status: string;
		due_date: string;
		notes: string | null;
		ticket_data: { order_id: string };
	};

	const HTML_ESCAPE_MAP: Record<string, string> = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;'
	};

	function escapeHtml(value: string): string {
		return value.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char]);
	}

	function getUserFullName(email: string): string {
		const user = availableUsers.find((u) => u.email === email);
		return user ? user.full_name : email;
	}

	function formatPlain(value: unknown): string {
		if (value === null || value === undefined) return 'N/A';
		if (typeof value === 'string' && value.trim() === '') return 'N/A';
		return escapeHtml(String(value));
	}

	function buildTicketHtml(options: {
		ticketNumber: number;
		ticket: TicketInsertData;
		dueDateInput: string;
		order: ProcessedOrder;
		createdAtIso: string;
		createdAtSydney: string;
	}): string {
		const { ticketNumber, ticket, dueDateInput, order, createdAtSydney } = options;
		const dueDateSydney = dueDateInput ? dueDateInput.replace('T', ' ') : 'N/A';

		return `<p>New Past Due Ticket Created<br>
Ticket #${ticketNumber}<br>
${formatPlain(ticket.ticket_title)}<br>
Priority: ${formatPlain(ticket.priority)} | Status: ${formatPlain(ticket.status)} | Due: ${formatPlain(dueDateSydney)}<br>
<br>
Customer: ${formatPlain(order.customer)}<br>
Invoice: ${formatPlain(order.invoice)} | Amount: $${formatPlain(order.amount)}<br>
Days Past Due: ${formatPlain(order.pdCounter)}<br>
<br>
Assigned to: ${formatPlain(getUserFullName(ticket.assigned_to || ''))}<br>
Created by: ${formatPlain(getUserFullName(ticket.assigned_by))}<br>
Created: ${formatPlain(createdAtSydney)}</p>`;
	}

	async function sendTicketNotification(options: {
		ticketNumber: number;
		ticket: TicketInsertData;
		dueDateInput: string;
		order: ProcessedOrder;
	}): Promise<void> {
		const createdAt = new Date();
		const htmlBody = buildTicketHtml({
			...options,
			createdAtIso: createdAt.toISOString(),
			createdAtSydney: formatSydneyDateTime(createdAt)
		});

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
			throw new Error(`Ticket webhook failed with status ${response.status}`);
		}
	}

	async function createTicket() {
		if (!order || !user?.email) return;

		const validation = validateForm();
		if (!validation.isValid) {
			toastError(validation.errors.join('. '));
			return;
		}

		try {
			isLoading = true;

			const dueDateUtc = sydneyInputToUtcIso(dueDate) as string;
			const dueDateInput = dueDate;
			const ticketData: TicketInsertData = {
				module: 'Past Due Accounts',
				ticket_title: ticketTitle.trim(),
				ticket_description: ticketDescription.trim() || null,
				assigned_to: assignedTo || null,
				assigned_by: user.email,
				priority,
				status,
				due_date: dueDateUtc,
				notes: notes.trim() || null,
				ticket_data: { order_id: order.invoice }
			};

			const { data, error } = await supabase
				.from('tickets')
				.insert(ticketData)
				.select('ticket_number')
				.single();

			if (error) {
				console.error('Error creating ticket:', error);
				toastError(`Failed to create ticket: ${error.message}`);
			} else {
				try {
					await sendTicketNotification({
						ticketNumber: data.ticket_number,
						ticket: ticketData,
						dueDateInput,
						order
					});
					toastSuccess(`Ticket #${data.ticket_number} created successfully!`);
				} catch (notifyError) {
					console.error('Error sending ticket notification:', notifyError);
					toastSuccess(`Ticket #${data.ticket_number} created successfully!`);
					toastError('Ticket created, but failed to send notification.');
				}
				dispatch('ticketCreated', {
					...ticketData,
					ticket_number: data.ticket_number
				});
				dispatch('close');
				resetForm();
			}
		} catch (error) {
			console.error('Error in createTicket:', error);
			toastError('An unexpected error occurred while creating the ticket');
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

	async function pasteTicketData() {
		try {
			const text = await navigator.clipboard.readText();
			if (!text) return;

			const data = JSON.parse(text);

			if (data.ticket_title) ticketTitle = data.ticket_title;
			if (data.ticket_description) ticketDescription = data.ticket_description;
			if (data.priority) priority = data.priority;
			if (data.status) status = data.status;
			if (data.notes) notes = data.notes;

			if (data.assigned_to) {
				// Check if user exists
				if (availableUsers.some((u) => u.email === data.assigned_to)) {
					assignedTo = data.assigned_to;
				}
			}

			if (data.due_date) {
				// Try to convert ISO to local input format
				try {
					dueDate = utcIsoToSydneyInput(data.due_date);
				} catch (e) {
					console.error('Error parsing due date', e);
				}
			}

			toastSuccess('Ticket data pasted successfully');
		} catch (err) {
			console.error('Failed to paste ticket data:', err);
			toastError('Failed to paste ticket data');
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
		aria-labelledby="ticket-modal-title"
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
					id="ticket-modal-title"
				>
					Create Ticket - {order?.customer}
				</h3>
				<button
					type="button"
					on:click={pasteTicketData}
					class="btn-secondary text-xs inline-flex items-center gap-1.5"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
						/>
					</svg>
					Paste Data
				</button>
			</div>

			<div class="mt-4 space-y-4 max-h-[75vh] overflow-y-auto pr-1">
				<!-- Ticket Title -->
				<div>
					<label
						for="ticket-title"
						class="block text-sm font-medium text-gray-300 mb-1.5"
					>
						Ticket Title <span class="text-red-400">*</span>
					</label>
					<input
						type="text"
						id="ticket-title"
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
						for="ticket-description"
						class="block text-sm font-medium text-gray-300 mb-1.5"
					>
						Description
					</label>
					<textarea
						id="ticket-description"
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
						for="assigned-to"
						class="block text-sm font-medium text-gray-300 mb-1.5"
					>
						Assign To <span class="text-red-400">*</span>
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
							id="assigned-to"
							bind:value={assignedTo}
							class="w-full rounded-lg bg-[#0e1012] border border-[#262a30] px-3 py-2 text-sm text-gray-200 focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
							required
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
							for="priority"
							class="block text-sm font-medium text-gray-300 mb-1.5"
						>
							Priority <span class="text-red-400">*</span>
						</label>
						<select
							id="priority"
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
							for="status"
							class="block text-sm font-medium text-gray-300 mb-1.5"
						>
							Status <span class="text-red-400">*</span>
						</label>
						<select
							id="status"
							bind:value={status}
							class="w-full rounded-lg bg-[#0e1012] border border-[#262a30] px-3 py-2 text-sm text-gray-200 focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
							required
							disabled={isLoading}
						>
							<option value="Not Started">Not Started</option>
							<option value="In Progress">In Progress</option>
							<option value="Completed">Completed</option>
						</select>
					</div>
				</div>

				<!-- Due Date -->
				<div>
					<div class="mb-1 flex items-center justify-between">
						<label
							for="due-date"
							class="block text-sm font-medium text-gray-300 mb-1.5"
						>
							Due Date &amp; Time <span class="text-red-400">*</span>
						</label>
						<span class="text-xs text-gray-400">
							Sydney: {currentSydneyTime}
						</span>
					</div>
					<input
						type="datetime-local"
						id="due-date"
						bind:value={dueDate}
						class="w-full rounded-lg bg-[#0e1012] border border-[#262a30] px-3 py-2 text-sm text-gray-200 focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
						required
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
						for="ticket-notes"
						class="block text-sm font-medium text-gray-300 mb-1.5"
					>
						Notes
					</label>
					<textarea
						id="ticket-notes"
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
					on:click={createTicket}
					disabled={!ticketTitle.trim() || isLoading}
					class="btn-primary text-sm"
				>
					{#if isLoading}
						Creating...
					{:else}
						Create Ticket
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
