<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { get } from 'svelte/store';
	import { currentUser } from '$lib/firebase';
	import { updateTicket } from '../tickets';
	import { toastSuccess, toastError } from '$lib/utils/toast';
	import type { Ticket } from '../tickets';

	export let showModal: boolean;
	export let ticket: Ticket | null;
	export let availableModules: string[];
	export let availableUsers: { email: string; full_name: string }[];

	const dispatch = createEventDispatcher();

	// Form data
	let module = '';
	let ticketTitle = '';
	let ticketDescription = '';
	let priority = 'Medium';
	let status = 'Not Started';
	let assignedTo = '';
	let dueDate = '';
	let notes = '';
	let originalDueDate: string | null = null;

	// State
	let isLoading = false;

	// Available options
	const priorityOptions = ['Low', 'Medium', 'High', 'Critical'];
	const statusOptions = ['Not Started', 'In Progress', 'On Hold', 'Completed', 'Closed'];

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
			const now = new Date();
			const utc = now.getTime() + now.getTimezoneOffset() * 60000;
			const sydney = new Date(utc + 10 * 3600000);
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

	// Pre-populate form when ticket changes
	$: if (ticket && showModal) {
		module = ticket.module || '';
		ticketTitle = ticket.ticket_title || '';
		ticketDescription = ticket.ticket_description || '';
		priority = ticket.priority || 'Medium';
		status = ticket.status || 'Not Started';
		assignedTo = ticket.assigned_to || '';
		originalDueDate = ticket.due_date || null;
		dueDate = ticket.due_date ? utcIsoToSydneyInput(ticket.due_date) : '';
		notes = ticket.notes || '';
	}

	function utcIsoToSydneyInput(utcIso: string): string {
		try {
			const date = new Date(utcIso);
			const sydneyTime = new Date(date.getTime() - (10 * 60 * 60 * 1000)); // Convert to Sydney time
			return sydneyTime.toISOString().slice(0, 16); // Format for datetime-local input
		} catch (error) {
			console.error('Error converting UTC to Sydney input:', error);
			return '';
		}
	}

	function validateForm(): { isValid: boolean; errors: string[] } {
		const errors: string[] = [];

		if (!module.trim()) {
			errors.push('Module is required');
		}

		if (!ticketTitle.trim() || ticketTitle.trim().length < 3) {
			errors.push('Ticket title must be at least 3 characters long');
		}

		if (!priorityOptions.includes(priority)) {
			errors.push('Please select a valid priority');
		}

		if (!statusOptions.includes(status)) {
			errors.push('Please select a valid status');
		}

		if (assignedTo && !availableUsers.some(user => user.email === assignedTo)) {
			errors.push('Please select a valid user for assignment');
		}

		if (dueDate && !isDueDateValid(dueDate)) {
			errors.push('Due date must be in the future');
		}

		return {
			isValid: errors.length === 0,
			errors
		};
	}

	function isDueDateValid(dateString: string): boolean {
		const selectedDate = new Date(dateString);
		const now = new Date();
		return selectedDate > now;
	}

	async function handleUpdateTicket() {
		if (!ticket) return;

		const validation = validateForm();
		if (!validation.isValid) {
			toastError(validation.errors.join('. '));
			return;
		}

		try {
			isLoading = true;

			const updateData = {
				module: module.trim(),
				ticket_title: ticketTitle.trim(),
				ticket_description: ticketDescription.trim() || null,
				priority,
				status,
				assigned_to: assignedTo || null,
				due_date: dueDate ? sydneyInputToUtcIso(dueDate) : null,
				notes: notes.trim() || null,
			};

			const updatedTicket = await updateTicket(ticket.ticket_number, updateData);
			dispatch('ticketUpdated', updatedTicket);
			resetForm();
		} catch (error) {
			console.error('Error updating ticket:', error);
			toastError('Failed to update ticket');
		} finally {
			isLoading = false;
		}
	}

	function sydneyInputToUtcIso(sydneyInput: string): string {
		try {
			const date = new Date(sydneyInput);
			const utcTime = new Date(date.getTime() + (10 * 60 * 60 * 1000)); // Convert to UTC
			return utcTime.toISOString();
		} catch (error) {
			console.error('Error converting Sydney input to UTC:', error);
			throw error;
		}
	}

	function closeModal() {
		dispatch('close');
		resetForm();
	}

	function resetForm() {
		module = '';
		ticketTitle = '';
		ticketDescription = '';
		priority = 'Medium';
		status = 'Not Started';
		assignedTo = '';
		dueDate = '';
		notes = '';
		originalDueDate = null;
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
		const getPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0');

		return {
			year: getPart('year'),
			month: getPart('month') - 1,
			day: getPart('day'),
			hour: getPart('hour'),
			minute: getPart('minute')
		};
	}

	function formatIsLocal(year: number, month: number, day: number, hour: number, minute: number): string {
		const pad = (n: number) => n.toString().padStart(2, '0');
		return `${year}-${pad(month + 1)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
	}

	function setDueDateEndOfDay() {
		const s = getSydneyDateValues();
		dueDate = formatIsLocal(s.year, s.month, s.day, 17, 0);
	}

	function setDueDateTwoHours() {
		const now = new Date();
		const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
		const s = getSydneyDateValues(twoHoursLater);
		dueDate = formatIsLocal(s.year, s.month, s.day, s.hour, s.minute);
	}

	function setDueDateEndOfMonth() {
		const s = getSydneyDateValues();
		const daysInMonth = new Date(s.year, s.month + 1, 0).getDate();
		dueDate = formatIsLocal(s.year, s.month, daysInMonth, 17, 0);
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
		aria-labelledby="edit-ticket-modal-title"
		role="dialog"
		aria-modal="true"
		on:click={handleBackdropClick}
		on:keydown={(e) => e.key === 'Escape' && closeModal()}
	>
		<div class="flex min-h-screen items-end justify-center px-4 pb-20 pt-4 text-center sm:block sm:p-0">
			<div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>

			<span class="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>

			<div class="inline-block transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle">
				<div class="bg-white dark:bg-gray-800 px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
					<div class="sm:flex sm:items-start">
						<div class="mt-3 w-full text-center sm:mt-0 sm:text-left">
							<div class="flex items-center justify-between">
								<h3
									class="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100"
									id="edit-ticket-modal-title"
								>
									Edit Ticket #{ticket.ticket_number}
								</h3>
								<button
									type="button"
									on:click={closeModal}
									class="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200 focus:outline-none"
									disabled={isLoading}
								>
									<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</div>

							<div class="mt-4 space-y-4">
								<!-- Module -->
								<div>
									<label for="edit-module" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
										Module <span class="text-red-500">*</span>
									</label>
									<select
										id="edit-module"
										bind:value={module}
										class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100 sm:text-sm"
										required
										disabled={isLoading}
									>
										<option value="">Select a module...</option>
										{#each availableModules as mod}
											<option value={mod}>{mod}</option>
										{/each}
									</select>
								</div>

								<!-- Ticket Title -->
								<div>
									<label for="edit-ticket-title" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
										Ticket Title <span class="text-red-500">*</span>
									</label>
									<input
										type="text"
										id="edit-ticket-title"
										bind:value={ticketTitle}
										class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100 sm:text-sm"
										placeholder="Enter ticket title..."
										required
										disabled={isLoading}
									/>
								</div>

								<!-- Ticket Description -->
								<div>
									<label for="edit-ticket-description" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
										Description
									</label>
									<textarea
										id="edit-ticket-description"
										rows="3"
										bind:value={ticketDescription}
										class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100 sm:text-sm"
										placeholder="Enter ticket description..."
										disabled={isLoading}
									></textarea>
								</div>

								<!-- Priority and Status Row -->
								<div class="grid grid-cols-2 gap-4">
									<div>
										<label for="edit-priority" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
											Priority <span class="text-red-500">*</span>
										</label>
										<select
											id="edit-priority"
											bind:value={priority}
											class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100 sm:text-sm"
											required
											disabled={isLoading}
										>
											{#each priorityOptions as prio}
												<option value={prio}>{prio}</option>
											{/each}
										</select>
									</div>

									<div>
										<label for="edit-status" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
											Status <span class="text-red-500">*</span>
										</label>
										<select
											id="edit-status"
											bind:value={status}
											class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100 sm:text-sm"
											required
											disabled={isLoading}
										>
											{#each statusOptions as stat}
												<option value={stat}>{stat}</option>
											{/each}
										</select>
									</div>
								</div>

								<!-- Assigned To -->
								<div>
									<label for="edit-assigned-to" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
										Assign To
									</label>
									<select
										id="edit-assigned-to"
										bind:value={assignedTo}
										class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100 sm:text-sm"
										disabled={isLoading}
									>
										<option value="">Unassigned</option>
										{#each availableUsers as user}
											<option value={user.email}>{user.full_name} ({user.email})</option>
										{/each}
									</select>
								</div>

								<!-- Due Date -->
								<div>
									<div class="mb-1 flex items-center justify-between">
										<label for="edit-due-date" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
											Due Date & Time
										</label>
										<span class="text-xs text-gray-500 dark:text-gray-400">
											Sydney: {currentSydneyTime}
										</span>
									</div>
									<input
										type="datetime-local"
										id="edit-due-date"
										bind:value={dueDate}
										class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100 sm:text-sm"
										disabled={isLoading}
									/>
									<div class="mt-2 flex flex-wrap gap-2">
										<button
											type="button"
											on:click={setDueDateEndOfDay}
											class="inline-flex items-center rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
											disabled={isLoading}
										>
											End of Day (5PM)
										</button>
										<button
											type="button"
											on:click={setDueDateTwoHours}
											class="inline-flex items-center rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
											disabled={isLoading}
										>
											2 Hours
										</button>
										<button
											type="button"
											on:click={setDueDateEndOfMonth}
											class="inline-flex items-center rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
											disabled={isLoading}
										>
											End of Month
										</button>
									</div>
								</div>

								<!-- Notes -->
								<div>
									<label for="edit-notes" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
										Notes
									</label>
									<textarea
										id="edit-notes"
										rows="2"
										bind:value={notes}
										class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100 sm:text-sm"
										placeholder="Additional notes..."
										disabled={isLoading}
									></textarea>
								</div>
							</div>
						</div>
					</div>
				</div>

				<div class="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
					<button
						type="button"
						on:click={handleUpdateTicket}
						disabled={!module.trim() || !ticketTitle.trim() || isLoading}
						class="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:ml-3 sm:w-auto sm:text-sm"
					>
						{#if isLoading}
							Updating...
						{:else}
							Update Ticket
						{/if}
					</button>
					<button
						type="button"
						on:click={closeModal}
						class="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-600 px-4 py-2 text-base font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:ml-3 sm:mt-0 sm:w-auto sm:text-sm"
						disabled={isLoading}
					>
						Cancel
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}