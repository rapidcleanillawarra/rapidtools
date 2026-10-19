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

	function getPageItems(current: number, total: number): (number | '...')[] {
		if (total <= 5) {
			return Array.from({ length: total }, (_, i) => i + 1);
		}
		if (current <= 3) {
			return [1, 2, 3, '...', total];
		}
		if (current >= total - 2) {
			return [1, '...', total - 2, total - 1, total];
		}
		return [1, '...', current, '...', total];
	}

	$: pageItems = getPageItems(currentPage, totalPages);
	$: startEntry = filteredCount === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
	$: endEntry = Math.min(currentPage * itemsPerPage, filteredCount);
</script>

<div class="mt-5">
	<div class="flex flex-col items-center justify-between gap-4 sm:flex-row text-sm text-gray-400">
		<!-- Left: Showing info -->
		<div class="text-sm text-gray-400">
			Showing <span class="text-gray-300">{startEntry} &ndash; {endEntry}</span> of
			<span class="font-semibold text-white">{filteredCount}</span> invoices
		</div>

		<!-- Right: Rows per page + Page controls -->
		<div class="flex flex-wrap items-center gap-5">
			<div class="flex items-center gap-2.5">
				<label for="items-per-page" class="text-xs text-gray-400">Rows per page</label>
				<select
					id="items-per-page"
					value={itemsPerPage}
					on:change={(e) => dispatch('changeItemsPerPage', Number(e.currentTarget.value))}
					class="rounded-xl border border-[#262a30] bg-[#141619] py-1.5 pl-3 pr-8 text-xs font-medium text-gray-200 focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
				>
					<option value={10}>10</option>
					<option value={25}>25</option>
					<option value={50}>50</option>
					<option value={100}>100</option>
				</select>
			</div>

			<div class="flex items-center gap-1.5">
				<button
					type="button"
					on:click={() => dispatch('previous')}
					disabled={currentPage === 1}
					class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#262a30] bg-[#141619] text-gray-300 transition hover:border-[#333842] hover:bg-[#1a1d22] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
					title="Previous page"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
					</svg>
				</button>

				{#each pageItems as item}
					{#if item === '...'}
						<span class="px-1.5 text-xs text-gray-500">...</span>
					{:else}
						<button
							type="button"
							on:click={() => dispatch('goToPage', item)}
							class="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg px-2.5 text-xs font-semibold transition {item ===
							currentPage
								? 'bg-lime-400 text-gray-950 font-bold shadow-sm'
								: 'border border-[#262a30] bg-[#141619] text-gray-300 hover:border-[#333842] hover:bg-[#1a1d22] hover:text-white'}"
						>
							{item}
						</button>
					{/if}
				{/each}

				<button
					type="button"
					on:click={() => dispatch('next')}
					disabled={currentPage === totalPages}
					class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#262a30] bg-[#141619] text-gray-300 transition hover:border-[#333842] hover:bg-[#1a1d22] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
					title="Next page"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
					</svg>
				</button>
			</div>
		</div>
	</div>

	<div class="mt-3 text-right text-xs text-gray-500">
		Amounts in AUD
	</div>
</div>

