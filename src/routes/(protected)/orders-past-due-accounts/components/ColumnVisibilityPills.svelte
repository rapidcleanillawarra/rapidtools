<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { ColumnDefinition, ColumnKey } from '../pastDueAccounts';

	export let columns: ColumnDefinition[];
	export let columnVisibility: Record<ColumnKey, boolean>;

	const dispatch = createEventDispatcher<{
		toggle: { key: ColumnKey };
	}>();
</script>

<div class="mt-6">
	<h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Visible Columns:</h3>
	<div class="flex flex-wrap gap-2">
		{#each columns as column}
			<button
				type="button"
				on:click={() => dispatch('toggle', { key: column.key })}
				class="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors duration-200 {columnVisibility[column.key]
					? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 hover:bg-indigo-200 dark:hover:bg-indigo-800'
					: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}"
			>
				<span class="mr-1">{column.label}</span>
				{#if columnVisibility[column.key]}
					<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
							clip-rule="evenodd"
						></path>
					</svg>
				{:else}
					<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
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
</div>

