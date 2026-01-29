<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { TicketFilters } from '../tickets';

	export let filters: TicketFilters;
	export let availableModules: string[];
	export let availableUsers: { email: string; full_name: string }[];

	const dispatch = createEventDispatcher();

	// Local state for filter inputs
	let searchInput = filters.search || '';
	let selectedStatuses = [...(filters.status || [])];
	let selectedPriorities = [...(filters.priority || [])];
	let selectedModules = [...(filters.module || [])];
	let selectedAssignedTo = [...(filters.assignedTo || [])];
	let dueDateFrom = filters.dateRange?.from || null;
	let dueDateTo = filters.dateRange?.to || null;
	let createdDateFrom = filters.createdDateRange?.from || null;
	let createdDateTo = filters.createdDateRange?.to || null;

	// Available options
	const statusOptions = ['Not Started', 'In Progress', 'On Hold', 'Completed', 'Closed'];
	const priorityOptions = ['Low', 'Medium', 'High', 'Critical'];

	// Apply filters
	function applyFilters() {
		const newFilters: TicketFilters = {
			search: searchInput,
			status: selectedStatuses,
			priority: selectedPriorities,
			module: selectedModules,
			assignedTo: selectedAssignedTo,
			dateRange: {
				from: dueDateFrom,
				to: dueDateTo,
			},
			createdDateRange: {
				from: createdDateFrom,
				to: createdDateTo,
			},
		};

		dispatch('filtersChange', newFilters);
	}

	// Clear all filters
	function clearFilters() {
		searchInput = '';
		selectedStatuses = [];
		selectedPriorities = [];
		selectedModules = [];
		selectedAssignedTo = [];
		dueDateFrom = null;
		dueDateTo = null;
		createdDateFrom = null;
		createdDateTo = null;

		applyFilters();
	}

	// Create ticket
	function createTicket() {
		dispatch('createTicket');
	}

	// Toggle selection in array
	function toggleSelection(array: string[], value: string): string[] {
		if (array.includes(value)) {
			return array.filter(item => item !== value);
		} else {
			return [...array, value];
		}
	}

	// Check if any filters are active
	$: hasActiveFilters = searchInput ||
		selectedStatuses.length > 0 ||
		selectedPriorities.length > 0 ||
		selectedModules.length > 0 ||
		selectedAssignedTo.length > 0 ||
		dueDateFrom ||
		dueDateTo ||
		createdDateFrom ||
		createdDateTo;
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
	<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
		<div class="flex items-center justify-between">
			<h2 class="text-lg font-medium text-gray-900 dark:text-white">Filters</h2>
			<div class="flex items-center space-x-3">
				{#if hasActiveFilters}
					<button
						type="button"
						on:click={clearFilters}
						class="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
					>
						<svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
						Clear Filters
					</button>
				{/if}
				<button
					type="button"
					on:click={createTicket}
					class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
				>
					<svg class="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
					</svg>
					Create Ticket
				</button>
			</div>
		</div>
	</div>

	<div class="px-6 py-4">
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
			<!-- Search -->
			<div>
				<label for="search" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
					Search
				</label>
				<input
					type="text"
					id="search"
					bind:value={searchInput}
					on:input={applyFilters}
					placeholder="Search tickets..."
					class="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm"
				/>
			</div>

			<!-- Status Filter -->
			<div>
				<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
					Status
				</label>
				<div class="space-y-1 max-h-32 overflow-y-auto">
					{#each statusOptions as status}
						<label class="flex items-center">
							<input
								type="checkbox"
								checked={selectedStatuses.includes(status)}
								on:change={() => {
									selectedStatuses = toggleSelection(selectedStatuses, status);
									applyFilters();
								}}
								class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
							/>
							<span class="ml-2 text-sm text-gray-700 dark:text-gray-300">{status}</span>
						</label>
					{/each}
				</div>
			</div>

			<!-- Priority Filter -->
			<div>
				<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
					Priority
				</label>
				<div class="space-y-1">
					{#each priorityOptions as priority}
						<label class="flex items-center">
							<input
								type="checkbox"
								checked={selectedPriorities.includes(priority)}
								on:change={() => {
									selectedPriorities = toggleSelection(selectedPriorities, priority);
									applyFilters();
								}}
								class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
							/>
							<span class="ml-2 text-sm text-gray-700 dark:text-gray-300">{priority}</span>
						</label>
					{/each}
				</div>
			</div>

			<!-- Module Filter -->
			<div>
				<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
					Module
				</label>
				<div class="space-y-1 max-h-32 overflow-y-auto">
					{#each availableModules as module}
						<label class="flex items-center">
							<input
								type="checkbox"
								checked={selectedModules.includes(module)}
								on:change={() => {
									selectedModules = toggleSelection(selectedModules, module);
									applyFilters();
								}}
								class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
							/>
							<span class="ml-2 text-sm text-gray-700 dark:text-gray-300">{module}</span>
						</label>
					{/each}
				</div>
			</div>

			<!-- Assigned To Filter -->
			<div>
				<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
					Assigned To
				</label>
				<div class="space-y-1 max-h-32 overflow-y-auto">
					{#each availableUsers as user}
						<label class="flex items-center">
							<input
								type="checkbox"
								checked={selectedAssignedTo.includes(user.email)}
								on:change={() => {
									selectedAssignedTo = toggleSelection(selectedAssignedTo, user.email);
									applyFilters();
								}}
								class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
							/>
							<span class="ml-2 text-sm text-gray-700 dark:text-gray-300">{user.full_name}</span>
						</label>
					{/each}
				</div>
			</div>

			<!-- Due Date Range -->
			<div>
				<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
					Due Date From
				</label>
				<input
					type="date"
					bind:value={dueDateFrom}
					on:change={applyFilters}
					class="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm"
				/>
			</div>

			<div>
				<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
					Due Date To
				</label>
				<input
					type="date"
					bind:value={dueDateTo}
					on:change={applyFilters}
					class="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm"
				/>
			</div>

			<!-- Created Date Range -->
			<div>
				<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
					Created From
				</label>
				<input
					type="date"
					bind:value={createdDateFrom}
					on:change={applyFilters}
					class="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm"
				/>
			</div>

			<div>
				<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
					Created To
				</label>
				<input
					type="date"
					bind:value={createdDateTo}
					on:change={applyFilters}
					class="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm"
				/>
			</div>
		</div>
	</div>
</div>