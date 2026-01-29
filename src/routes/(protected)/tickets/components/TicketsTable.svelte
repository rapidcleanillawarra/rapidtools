<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { writable } from 'svelte/store';
	import TicketRow from './TicketRow.svelte';
	import type { Ticket } from '../tickets';

	export let tickets: Ticket[];
	export let isLoading: boolean;
	export let error: string | null;

	const dispatch = createEventDispatcher();

	// Sorting state
	let sortField = writable<keyof Ticket | ''>('');
	let sortDirection = writable<'asc' | 'desc'>('desc');

	// Handle sorting
	function handleSort(field: keyof Ticket) {
		if ($sortField === field) {
			// Toggle direction if same field
			sortDirection.update(dir => dir === 'asc' ? 'desc' : 'asc');
		} else {
			// New field, default to asc
			sortField.set(field);
			sortDirection.set('asc');
		}
	}

	// Get sort icon
	function getSortIcon(field: keyof Ticket) {
		if ($sortField !== field) return '↕️';
		return $sortDirection === 'asc' ? '↑' : '↓';
	}

	// Sorted tickets
	$: sortedTickets = (() => {
		if (!$sortField) return tickets;

		return [...tickets].sort((a, b) => {
			const aValue = a[$sortField as keyof Ticket];
			const bValue = b[$sortField as keyof Ticket];

			// Handle null values
			if (aValue === null && bValue === null) return 0;
			if (aValue === null) return $sortDirection === 'asc' ? -1 : 1;
			if (bValue === null) return $sortDirection === 'asc' ? 1 : -1;

			// Handle dates
			if ($sortField === 'created_at' || $sortField === 'due_date') {
				const aDate = new Date(aValue as string);
				const bDate = new Date(bValue as string);
				return $sortDirection === 'asc' ? aDate.getTime() - bDate.getTime() : bDate.getTime() - aDate.getTime();
			}

			// Handle numbers
			if (typeof aValue === 'number' && typeof bValue === 'number') {
				return $sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
			}

			// Handle strings
			const aStr = String(aValue).toLowerCase();
			const bStr = String(bValue).toLowerCase();
			return $sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
		});
	})();

	// Handle ticket actions
	function handleViewTicket(ticket: Ticket) {
		dispatch('viewTicket', ticket);
	}

	function handleEditTicket(ticket: Ticket) {
		dispatch('editTicket', ticket);
	}

	function handleDeleteTicket(ticket: Ticket) {
		dispatch('deleteTicket', ticket);
	}
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
	<div class="overflow-x-auto">
		<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
			<thead class="bg-gray-50 dark:bg-gray-700">
				<tr>
					<th
						scope="col"
						class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
						on:click={() => handleSort('ticket_number')}
					>
						Ticket # {getSortIcon('ticket_number')}
					</th>
					<th
						scope="col"
						class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
						on:click={() => handleSort('module')}
					>
						Module {getSortIcon('module')}
					</th>
					<th
						scope="col"
						class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
						on:click={() => handleSort('ticket_title')}
					>
						Title {getSortIcon('ticket_title')}
					</th>
					<th
						scope="col"
						class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
						on:click={() => handleSort('status')}
					>
						Status {getSortIcon('status')}
					</th>
					<th
						scope="col"
						class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
						on:click={() => handleSort('priority')}
					>
						Priority {getSortIcon('priority')}
					</th>
					<th
						scope="col"
						class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
						on:click={() => handleSort('assigned_to')}
					>
						Assigned To {getSortIcon('assigned_to')}
					</th>
					<th
						scope="col"
						class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
						on:click={() => handleSort('due_date')}
					>
						Due Date {getSortIcon('due_date')}
					</th>
					<th
						scope="col"
						class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
						on:click={() => handleSort('created_at')}
					>
						Created {getSortIcon('created_at')}
					</th>
					<th scope="col" class="relative px-6 py-3">
						<span class="sr-only">Actions</span>
					</th>
				</tr>
			</thead>
			<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
				{#if isLoading}
					<tr>
						<td colspan="9" class="px-6 py-12 text-center">
							<div class="flex items-center justify-center">
								<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
								<span class="ml-3 text-gray-500 dark:text-gray-400">Loading tickets...</span>
							</div>
						</td>
					</tr>
				{:else if error}
					<tr>
						<td colspan="9" class="px-6 py-12 text-center">
							<div class="text-red-600 dark:text-red-400">
								<svg class="mx-auto h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
								</svg>
								<h3 class="mt-2 text-sm font-medium text-red-800 dark:text-red-200">Error loading tickets</h3>
								<p class="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
							</div>
						</td>
					</tr>
				{:else if sortedTickets.length === 0}
					<tr>
						<td colspan="9" class="px-6 py-12 text-center">
							<div class="text-gray-500 dark:text-gray-400">
								<svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
								</svg>
								<h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No tickets found</h3>
								<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
									No tickets match the current filters. Try adjusting your search criteria.
								</p>
							</div>
						</td>
					</tr>
				{:else}
					{#each sortedTickets as ticket (ticket.id)}
						<TicketRow
							{ticket}
							on:view={() => handleViewTicket(ticket)}
							on:edit={() => handleEditTicket(ticket)}
							on:delete={() => handleDeleteTicket(ticket)}
						/>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</div>