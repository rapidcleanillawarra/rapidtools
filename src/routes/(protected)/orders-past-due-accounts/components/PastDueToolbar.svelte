<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let operator: string;
	export let value: number | null;
	export let disableActions: boolean = false;

	const dispatch = createEventDispatcher<{
		apply: void;
		exportCsv: void;
		print: void;
	}>();
</script>

<div
	class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 sm:ml-16 sm:mt-0 sm:flex-none"
>
	<div class="flex items-center gap-2">
		<label for="pd-filter" class="text-sm font-medium text-gray-700 dark:text-gray-300"
			>PD Counter Filter:</label
		>
		<select
			bind:value={operator}
			class="rounded-md border-gray-300 py-1.5 text-sm font-semibold leading-6 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600"
		>
			<option value=">">&gt;</option>
			<option value="<">&lt;</option>
			<option value="=">=</option>
		</select>
		<input
			id="pd-filter"
			type="number"
			placeholder="Days"
			class="block w-24 rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
			bind:value
		/>
		<button
			type="button"
			on:click={() => dispatch('apply')}
			class="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
		>
			Apply Filter
		</button>
	</div>
	<div class="flex items-center gap-2">
		<button
			type="button"
			on:click={() => dispatch('exportCsv')}
			disabled={disableActions}
			class="rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
		>
			Export CSV
		</button>
		<button
			type="button"
			on:click={() => dispatch('print')}
			disabled={disableActions}
			class="rounded-md bg-gray-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
		>
			Print Report
		</button>
		<a
			href="settings"
			class="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
			title="Email Settings"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
				></path>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
				></path>
			</svg>
			Settings
		</a>
	</div>
</div>

