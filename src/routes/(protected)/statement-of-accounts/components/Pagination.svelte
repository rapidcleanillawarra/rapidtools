<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let currentPage: number;
	export let totalPages: number;
	export let itemsPerPage: number;
	export let totalItems: number;

	const dispatch = createEventDispatcher<{
		pageChange: number;
		itemsPerPageChange: number;
	}>();

	function goToPage(page: number) {
		if (page >= 1 && page <= totalPages) {
			dispatch('pageChange', page);
		}
	}

	function nextPage() {
		if (currentPage < totalPages) {
			dispatch('pageChange', currentPage + 1);
		}
	}

	function previousPage() {
		if (currentPage > 1) {
			dispatch('pageChange', currentPage - 1);
		}
	}

	function handleItemsPerPageChange(event: Event) {
		const target = event.currentTarget as HTMLSelectElement;
		dispatch('itemsPerPageChange', Number(target.value));
	}

	// Calculate visible page numbers
	$: visiblePages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
		const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
		return pageNum <= totalPages ? pageNum : null;
	}).filter((p): p is number => p !== null);
</script>

<div class="mt-4 flex flex-col items-center justify-between gap-4 sm:flex-row">
	<!-- Items per page selector -->
	<div class="flex items-center gap-2">
		<label for="items-per-page" class="text-sm text-gray-700 dark:text-gray-300">
			Show:
		</label>
		<select
			id="items-per-page"
			value={itemsPerPage}
			on:change={handleItemsPerPageChange}
			class="rounded-md border border-gray-300 py-1 pl-3 pr-8 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
		>
			<option value={10}>10</option>
			<option value={25}>25</option>
			<option value={50}>50</option>
			<option value={100}>100</option>
		</select>
		<span class="text-sm text-gray-700 dark:text-gray-300">
			entries per page
		</span>
	</div>

	<!-- Pagination info and controls -->
	<div class="flex items-center gap-4">
		<div class="text-sm text-gray-700 dark:text-gray-300">
			Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} entries
		</div>

		<div class="flex items-center gap-1">
			<button
				type="button"
				on:click={previousPage}
				disabled={currentPage === 1}
				class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
				title="Previous page"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
				</svg>
			</button>

			<!-- Page numbers -->
			{#each visiblePages as pageNum}
				<button
					type="button"
					on:click={() => goToPage(pageNum)}
					class="rounded-md px-3 py-1.5 text-sm font-medium {pageNum === currentPage
						? 'border border-indigo-500 bg-indigo-50 text-indigo-600 dark:border-indigo-400 dark:bg-indigo-900/30 dark:text-indigo-400'
						: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}"
				>
					{pageNum}
				</button>
			{/each}

			<button
				type="button"
				on:click={nextPage}
				disabled={currentPage === totalPages}
				class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
				title="Next page"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
				</svg>
			</button>
		</div>
	</div>
</div>
