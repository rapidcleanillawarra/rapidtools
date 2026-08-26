<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let filteredCount = 0;
	export let currentPage = 1;
	export let itemsPerPage = 25;
	export let totalPages = 1;

	const dispatch = createEventDispatcher<{
		previous: void;
		next: void;
		goToPage: number;
		changeItemsPerPage: number;
	}>();
</script>

<div class="mt-4 flex flex-col items-center justify-between gap-4 sm:flex-row text-sm text-gray-400">
	<!-- Items per page selector -->
	<div class="flex items-center gap-2">
		<label for="items-per-page" class="text-sm text-gray-400"> Show: </label>
		<select
			id="items-per-page"
			value={itemsPerPage}
			on:change={(e) => dispatch('changeItemsPerPage', Number(e.currentTarget.value))}
			class="rounded-lg border border-[#262a30] bg-[#0e1012] py-1 pl-3 pr-8 text-sm text-gray-200 shadow-sm focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
		>
			<option value={10}>10</option>
			<option value={25}>25</option>
			<option value={50}>50</option>
			<option value={100}>100</option>
		</select>
		<span class="text-sm text-gray-400"> entries per page </span>
	</div>

	<!-- Pagination info and controls -->
	<div class="flex items-center gap-4">
		<div class="text-sm text-gray-400">
			Showing <span class="font-medium text-gray-200">{Math.min((currentPage - 1) * itemsPerPage + 1, filteredCount)}</span> to <span class="font-medium text-gray-200">{Math.min(
				currentPage * itemsPerPage,
				filteredCount
			)}</span> of <span class="font-medium text-gray-200">{filteredCount}</span> entries
		</div>

		<div class="flex items-center gap-1">
			<button
				type="button"
				on:click={() => dispatch('previous')}
				disabled={currentPage === 1}
				class="rounded-lg border border-[#333842] bg-[#1f2329] px-3 py-1.5 text-sm font-medium text-gray-300 shadow-sm hover:bg-[#262a30] hover:text-white focus:outline-none focus:ring-2 focus:ring-lime-500 focus:ring-offset-2 focus:ring-offset-[#141619] disabled:cursor-not-allowed disabled:opacity-30 transition"
				title="Previous page"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"
					></path>
				</svg>
			</button>

			<!-- Page numbers -->
			{#each Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
				const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
				return pageNum <= totalPages ? pageNum : null;
			}).filter((n): n is number => n !== null) as pageNum}
				<button
					type="button"
					on:click={() => dispatch('goToPage', pageNum)}
					class="rounded-lg px-3 py-1.5 text-sm font-medium transition {pageNum === currentPage
						? 'border border-lime-500 bg-lime-500 text-gray-950 font-bold shadow-sm'
						: 'border border-[#333842] bg-[#1f2329] text-gray-300 hover:bg-[#262a30] hover:text-white'}"
				>
					{pageNum}
				</button>
			{/each}

			<button
				type="button"
				on:click={() => dispatch('next')}
				disabled={currentPage === totalPages}
				class="rounded-lg border border-[#333842] bg-[#1f2329] px-3 py-1.5 text-sm font-medium text-gray-300 shadow-sm hover:bg-[#262a30] hover:text-white focus:outline-none focus:ring-2 focus:ring-lime-500 focus:ring-offset-2 focus:ring-offset-[#141619] disabled:cursor-not-allowed disabled:opacity-30 transition"
				title="Next page"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"
					></path>
				</svg>
			</button>
		</div>
	</div>
</div>
