<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { currentUser } from '$lib/firebase';
	import { supabase } from '$lib/supabase';
	import type { ProcessedOrder } from '../pastDueAccounts';
	import { toastSuccess, toastError } from '$lib/utils/toast';
	import { isSydneyInputInPast, sydneyInputToUtcIso } from '../utils/dueDate';

	export let showModal = false;
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
	let user: import('firebase/auth').User | null = null;

	// Subscribe to current user
	currentUser.subscribe((value) => {
		user = value;
	});

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
			const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
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
	})();

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

		if (assignedTo && !availableUsers.some(user => user.email === assignedTo)) {
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

	async function createTicket() {
		if (!order || !user?.email) return;

		const validation = validateForm();
		if (!validation.isValid) {
			toastError(validation.errors.join('. '));
			return;
		}

		try {
			isLoading = true;

			const ticketData = {
				module: 'Past Due Accounts',
				ticket_title: ticketTitle.trim(),
				ticket_description: ticketDescription.trim() || null,
				assigned_to: assignedTo || null,
				assigned_by: user.email,
				priority,
				status,
				due_date: sydneyInputToUtcIso(dueDate),
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
				toastSuccess(`Ticket #${data.ticket_number} created successfully!`);
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
		const getPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0');
		
		return {
			year: getPart('year'),
			month: getPart('month') - 1, // 0-indexed
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

	// Close modal when clicking outside
	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			closeModal();
		}
	}
</script>

{#if showModal}
	<div
		class="fixed inset-0 z-50 overflow-y-auto"
		aria-labelledby="ticket-modal-title"
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
				class="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all dark:bg-gray-800 sm:my-8 sm:w-full sm:max-w-lg sm:align-middle"
			>
				<div class="bg-white px-4 pb-4 pt-5 dark:bg-gray-800 sm:p-6 sm:pb-4">
					<div class="sm:flex sm:items-start">
						<div class="mt-3 w-full text-center sm:mt-0 sm:text-left">
							<h3
								class="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100"
								id="ticket-modal-title"
							>
								Create Ticket - {order?.customer}
							</h3>
							<div class="mt-4 space-y-4">
								<!-- Ticket Title -->
								<div>
									<label for="ticket-title" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
										Ticket Title <span class="text-red-500">*</span>
									</label>
									<input
										type="text"
										id="ticket-title"
										bind:value={ticketTitle}
										class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 sm:text-sm"
										placeholder="Enter ticket title..."
										required
										disabled={isLoading}
									/>
								</div>

								<!-- Ticket Description -->
								<div>
									<label for="ticket-description" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
										Description
									</label>
									<textarea
										id="ticket-description"
										rows="3"
										bind:value={ticketDescription}
										class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 sm:text-sm"
										placeholder="Enter ticket description..."
										disabled={isLoading}
									></textarea>
								</div>

								<!-- Assigned To -->
								<div>
									<label for="assigned-to" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
										Assign To
									</label>
									{#if usersLoading}
										<div class="mt-1 flex items-center">
											<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
											<span class="ml-2 text-sm text-gray-500 dark:text-gray-400">Loading users...</span>
										</div>
									{:else}
										<select
											id="assigned-to"
											bind:value={assignedTo}
											class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 sm:text-sm"
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
										<label for="priority" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
											Priority <span class="text-red-500">*</span>
										</label>
										<select
											id="priority"
											bind:value={priority}
											class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 sm:text-sm"
											required
											disabled={isLoading}
										>
											<option value="Low">Low</option>
											<option value="Medium">Medium</option>
											<option value="High">High</option>
										</select>
									</div>

									<div>
										<label for="status" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
											Status <span class="text-red-500">*</span>
										</label>
										<select
											id="status"
											bind:value={status}
											class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 sm:text-sm"
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
									<div class="flex items-center justify-between mb-1">
										<label for="due-date" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
											Due Date & Time
										</label>
										<span class="text-xs text-gray-500 dark:text-gray-400">
											Sydney: {currentSydneyTime}
										</span>
									</div>
									<input
										type="datetime-local"
										id="due-date"
										bind:value={dueDate}
										class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 sm:text-sm"
										disabled={isLoading}
									/>
									<div class="mt-2 flex flex-wrap gap-2">
										<button
											type="button"
											on:click={setDueDateEndOfDay}
											class="inline-flex items-center px-2.5 py-1.5 border border-gray-300 rounded text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
											disabled={isLoading}
										>
											End of Day (5PM)
										</button>
										<button
											type="button"
											on:click={setDueDateTwoHours}
											class="inline-flex items-center px-2.5 py-1.5 border border-gray-300 rounded text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
											disabled={isLoading}
										>
											2 Hours
										</button>
										<button
											type="button"
											on:click={setDueDateEndOfMonth}
											class="inline-flex items-center px-2.5 py-1.5 border border-gray-300 rounded text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
											disabled={isLoading}
										>
											End of Month
										</button>
									</div>
								</div>

								<!-- Notes -->
								<div>
									<label for="ticket-notes" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
										Notes
									</label>
									<textarea
										id="ticket-notes"
										rows="2"
										bind:value={notes}
										class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 sm:text-sm"
										placeholder="Additional notes..."
										disabled={isLoading}
									></textarea>
								</div>

								<!-- Order Details Summary -->
								{#if order}
									<div class="rounded-md bg-gray-50 p-3 dark:bg-gray-700">
										<p class="text-sm text-gray-600 dark:text-gray-400">
											<strong>Invoice:</strong> {order.invoice} |
											<strong>Amount:</strong> ${order.amount} |
											<strong>Days Past Due:</strong> {order.pdCounter}
										</p>
									</div>
								{/if}
							</div>
						</div>
					</div>
				</div>
				<div class="bg-gray-50 px-4 py-3 dark:bg-gray-700 sm:flex sm:flex-row-reverse sm:px-6">
					<button
						type="button"
						on:click={createTicket}
						disabled={!ticketTitle.trim() || isLoading}
						class="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:ml-3 sm:w-auto sm:text-sm"
					>
						{#if isLoading}
							Creating...
						{:else}
							Create Ticket
						{/if}
					</button>
					<button
						type="button"
						on:click={closeModal}
						class="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:border-gray-500 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 sm:ml-3 sm:mt-0 sm:w-auto sm:text-sm"
					>
						Cancel
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
