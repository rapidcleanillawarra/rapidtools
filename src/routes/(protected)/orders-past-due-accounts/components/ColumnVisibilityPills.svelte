<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { ColumnDefinition, ColumnKey } from '../pastDueAccounts';

	export let columns: ColumnDefinition[];
	export let columnVisibility: Record<ColumnKey, boolean>;

	const dispatch = createEventDispatcher<{
		toggle: { key: ColumnKey };
	}>();
</script>

<div class="rounded-2xl border border-[#262a30] bg-[#181b20] p-4 shadow-xl">
	<h3 class="mb-3 text-sm font-semibold text-gray-300">Visible Columns:</h3>
	<div class="flex flex-wrap gap-2">
		{#each columns.filter((column) => column.key !== 'customer') as column}
			<button
				type="button"
				on:click={() => dispatch('toggle', { key: column.key })}
				class="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150 {columnVisibility[
					column.key
				]
					? 'border border-lime-500/40 bg-lime-500/10 text-lime-400 hover:bg-lime-500/20'
					: 'border border-[#333842] bg-[#1f2329] text-gray-400 hover:bg-[#262a30] hover:text-gray-200'}"
			>
				<span class="mr-1.5">{column.label}</span>
				{#if columnVisibility[column.key]}
					<svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
							clip-rule="evenodd"
						></path>
					</svg>
				{:else}
					<svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
							clip-rule="evenodd"
						></path>
					</svg>
				{/if}
			</button>
		{/each}
	</div>
	<p class="mt-2 text-xs text-gray-500">Customer is always shown.</p>
</div>
