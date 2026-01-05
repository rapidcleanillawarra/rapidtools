<script lang="ts">
	export let columns: Array<{
		key: string;
		displayName: string;
		pillName: string;
		hasSearch: boolean;
	}>;
	export let visibleColumns: Record<string, boolean>;
	export let onToggle: (column: string) => void;
	export let onShowAll: () => void;
	export let onHideAll: () => void;
</script>

<div class="mb-6 rounded-lg bg-white p-6 shadow">
	<h3 class="mb-4 text-lg font-medium text-gray-900">Show/Hide Columns</h3>

	<div class="mb-4 flex flex-wrap gap-2">
		<button
			class="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800 transition-colors duration-200 hover:bg-green-200"
			on:click={onShowAll}
		>
			Show All
		</button>
		<button
			class="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800 transition-colors duration-200 hover:bg-red-200"
			on:click={onHideAll}
		>
			Hide All
		</button>
	</div>

	<div class="flex flex-wrap gap-2">
		{#each columns as column (column.key)}
			<button
				class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-colors duration-200 {visibleColumns[
					column.key
				]
					? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
					: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				on:click={() => onToggle(column.key)}
			>
				{column.pillName}
				{#if visibleColumns[column.key]}
					<svg class="ml-1 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
							clip-rule="evenodd"
						></path>
					</svg>
				{/if}
			</button>
		{/each}
	</div>

	<p class="mt-2 text-sm text-gray-500">
		Click on column names above to show or hide them in the table below.
	</p>
</div>
