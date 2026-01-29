<script lang="ts">
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';
	import TicketsToolbar from './components/TicketsToolbar.svelte';
	import TicketsTable from './components/TicketsTable.svelte';
	import CreateTicketModal from './components/CreateTicketModal.svelte';
	import ViewTicketModal from './components/ViewTicketModal.svelte';
	import EditTicketModal from './components/EditTicketModal.svelte';
	import type { Ticket, TicketFilters } from './tickets';
	import { fetchAllTickets, getAvailableModules, getAvailableUsers } from './tickets';
	import { toastSuccess, toastError } from '$lib/utils/toast';

	// State management
	let tickets = writable<Ticket[]>([]);
	let isLoading = writable(true);
	let error = writable<string | null>(null);
	let totalTickets = writable(0);

	// Modal state
	let showCreateModal = writable(false);
	let showViewModal = writable(false);
	let showEditModal = writable(false);
	let selectedTicket = writable<Ticket | null>(null);

	// Filter state
	let filters = writable<TicketFilters>({
		search: '',
		status: [],
		priority: [],
		module: [],
		assignedTo: [],
		dateRange: { from: null, to: null },
		createdDateRange: { from: null, to: null },
	});

	// Available options for filters
	let availableModules = writable<string[]>([]);
	let availableUsers = writable<{ email: string; full_name: string }[]>([]);

	// Reactive statement to fetch tickets when filters change
	$: fetchTickets($filters);

	// Load initial data
	onMount(async () => {
		try {
			// Load available options for filters
			const [modules, users] = await Promise.all([
				getAvailableModules(),
				getAvailableUsers(),
			]);

			availableModules.set(modules);
			availableUsers.set(users);

			// Fetch initial tickets
			await fetchTickets($filters);
		} catch (err) {
			console.error('Error loading initial data:', err);
			toastError('Failed to load initial data');
		}
	});

	// Fetch tickets based on current filters
	async function fetchTickets(currentFilters: TicketFilters) {
		try {
			isLoading.set(true);
			error.set(null);

			const ticketData = await fetchAllTickets(currentFilters);
			tickets.set(ticketData);
			totalTickets.set(ticketData.length);
		} catch (err) {
			console.error('Error fetching tickets:', err);
			error.set('Failed to load tickets');
			toastError('Failed to load tickets');
		} finally {
			isLoading.set(false);
		}
	}

	// Handle filter changes
	function handleFiltersChange(newFilters: TicketFilters) {
		filters.set(newFilters);
	}

	// Handle create ticket
	function handleCreateTicket() {
		showCreateModal.set(true);
	}

	// Handle ticket created
	function handleTicketCreated(event: CustomEvent<Ticket>) {
		const newTicket = event.detail;
		tickets.update(current => [newTicket, ...current]);
		totalTickets.update(count => count + 1);
		showCreateModal.set(false);
		toastSuccess(`Ticket #${newTicket.ticket_number} created successfully!`);
	}

	// Handle view ticket
	function handleViewTicket(ticket: Ticket) {
		selectedTicket.set(ticket);
		showViewModal.set(true);
	}

	// Handle edit ticket
	function handleEditTicket(ticket: Ticket) {
		selectedTicket.set(ticket);
		showEditModal.set(true);
	}

	// Handle ticket updated
	function handleTicketUpdated(event: CustomEvent<Ticket>) {
		const updatedTicket = event.detail;
		tickets.update(current =>
			current.map(ticket =>
				ticket.id === updatedTicket.id ? updatedTicket : ticket
			)
		);
		showEditModal.set(false);
		showViewModal.set(false);
		toastSuccess('Ticket updated successfully!');
	}

	// Handle delete ticket
	async function handleDeleteTicket(ticket: Ticket) {
		if (!confirm(`Are you sure you want to delete ticket #${ticket.ticket_number}? This action cannot be undone.`)) {
			return;
		}

		try {
			await import('./tickets').then(({ deleteTicket }) => deleteTicket(ticket.ticket_number));
			tickets.update(current => current.filter(t => t.id !== ticket.id));
			totalTickets.update(count => count - 1);
			toastSuccess('Ticket deleted successfully!');
		} catch (err) {
			console.error('Error deleting ticket:', err);
			toastError('Failed to delete ticket');
		}
	}

	// Close modals
	function closeCreateModal() {
		showCreateModal.set(false);
	}

	function closeViewModal() {
		showViewModal.set(false);
		selectedTicket.set(null);
	}

	function closeEditModal() {
		showEditModal.set(false);
		selectedTicket.set(null);
	}

	// Switch from view to edit mode
	function switchToEditMode() {
		showViewModal.set(false);
		showEditModal.set(true);
	}
</script>

<svelte:head>
	<title>Tickets Dashboard - RapidTools</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900">
	<div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
		<!-- Header -->
		<div class="mb-8">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-3xl font-bold text-gray-900 dark:text-white">Tickets Dashboard</h1>
					<p class="mt-2 text-gray-600 dark:text-gray-400">
						Centralized ticket management across all modules
					</p>
				</div>
				<div class="flex items-center space-x-4">
					<div class="text-center">
						<div class="text-2xl font-bold text-gray-900 dark:text-white">{$totalTickets}</div>
						<div class="text-sm text-gray-500 dark:text-gray-400">Total Tickets</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Toolbar -->
		<TicketsToolbar
			{filters}
			{availableModules}
			{availableUsers}
			on:filtersChange={handleFiltersChange}
			on:createTicket={handleCreateTicket}
		/>

		<!-- Table -->
		<div class="mt-6">
			<TicketsTable
				tickets={$tickets}
				isLoading={$isLoading}
				error={$error}
				on:viewTicket={(event) => handleViewTicket(event.detail)}
				on:editTicket={(event) => handleEditTicket(event.detail)}
				on:deleteTicket={(event) => handleDeleteTicket(event.detail)}
			/>
		</div>
	</div>
</div>

<!-- Create Ticket Modal -->
{#if $showCreateModal}
	<CreateTicketModal
		showModal={$showCreateModal}
		{availableModules}
		{availableUsers}
		on:close={closeCreateModal}
		on:ticketCreated={handleTicketCreated}
	/>
{/if}

<!-- View Ticket Modal -->
{#if $showViewModal && $selectedTicket}
	<ViewTicketModal
		showModal={$showViewModal}
		ticket={$selectedTicket}
		on:close={closeViewModal}
		on:edit={switchToEditMode}
	/>
{/if}

<!-- Edit Ticket Modal -->
{#if $showEditModal && $selectedTicket}
	<EditTicketModal
		showModal={$showEditModal}
		ticket={$selectedTicket}
		{availableModules}
		{availableUsers}
		on:close={closeEditModal}
		on:ticketUpdated={handleTicketUpdated}
	/>
{/if}