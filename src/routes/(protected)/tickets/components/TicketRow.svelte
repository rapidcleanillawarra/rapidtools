<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { getTicketStatusColor, getTicketPriorityColor } from '../tickets';
	import type { Ticket } from '../tickets';

	export let ticket: Ticket;

	const dispatch = createEventDispatcher();

	// Format date for display
	function formatDate(dateString: string | null): string {
		if (!dateString) return 'N/A';
		return new Date(dateString).toLocaleDateString('en-AU', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	}

	// Handle actions
	function handleView() {
		dispatch('view');
	}

	function handleEdit() {
		dispatch('edit');
	}

	function handleDelete() {
		dispatch('delete');
	}
</script>

<tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
	<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
		#{ticket.ticket_number}
	</td>
	<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
		{ticket.module}
	</td>
	<td class="px-6 py-4 text-sm text-gray-900 dark:text-white">
		<div class="max-w-xs truncate" title={ticket.ticket_title}>
			{ticket.ticket_title}
		</div>
		{#if ticket.ticket_description}
			<div class="text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate" title={ticket.ticket_description}>
				{ticket.ticket_description}
			</div>
		{/if}
	</td>
	<td class="px-6 py-4 whitespace-nowrap">
		<span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {getTicketStatusColor(ticket.status)}">
			{ticket.status}
		</span>
	</td>
	<td class="px-6 py-4 whitespace-nowrap">
		<span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {getTicketPriorityColor(ticket.priority)}">
			{ticket.priority}
		</span>
	</td>
	<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
		{ticket.assigned_to || 'Unassigned'}
	</td>
	<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
		{formatDate(ticket.due_date)}
	</td>
	<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
		{formatDate(ticket.created_at)}
	</td>
	<td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
		<div class="flex items-center justify-end space-x-2">
			<button
				on:click={handleView}
				class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
				title="View ticket"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
				</svg>
			</button>
			<button
				on:click={handleEdit}
				class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
				title="Edit ticket"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
				</svg>
			</button>
			<button
				on:click={handleDelete}
				class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
				title="Delete ticket"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
				</svg>
			</button>
		</div>
	</td>
</tr>