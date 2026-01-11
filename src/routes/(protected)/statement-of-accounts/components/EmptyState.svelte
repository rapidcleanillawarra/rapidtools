<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let hasData: boolean = false;

	const dispatch = createEventDispatcher<{ clearFilters: void }>();

	function handleClearFilters() {
		dispatch('clearFilters');
	}
</script>

{#if !hasData}
	<!-- Empty State (No Data) -->
	<div class="rounded-lg bg-white p-12 text-center shadow-md">
		<svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
			/>
		</svg>
		<h3 class="mt-2 text-sm font-medium text-gray-900">No statement accounts</h3>
		<p class="mt-1 text-sm text-gray-500">No statement accounts found at this time.</p>
	</div>
{:else}
	<!-- Empty State (Filtered Results) -->
	<div class="rounded-lg bg-white p-12 text-center shadow-md">
		<svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
			/>
		</svg>
		<h3 class="mt-2 text-sm font-medium text-gray-900">No results found</h3>
		<p class="mt-1 text-sm text-gray-500">No statement accounts match your search criteria.</p>
		<div class="mt-4">
			<button
				on:click={handleClearFilters}
				class="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
			>
				Clear Filters
			</button>
		</div>
	</div>
{/if}
