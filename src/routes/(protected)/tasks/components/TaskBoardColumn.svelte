<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import TaskCard from './TaskCard.svelte';
	import type { TaskColumnGroup, TaskItem, TaskStatus } from '../types';

	export let column: TaskColumnGroup;

	const dispatch = createEventDispatcher<{
		addTask: string;
		selectTask: TaskItem;
		statusChange: { task: TaskItem; status: TaskStatus };
		deleteTask: TaskItem;
	}>();
</script>

<div class="flex flex-col rounded-xl border border-[#262a30] bg-[#131519] p-3">
	<!-- Column Header -->
	<div class="mb-3 flex items-center justify-between px-1">
		<div class="flex items-center gap-2 min-w-0">
			<span class="h-2.5 w-2.5 flex-shrink-0 rounded-full {column.dotColorClass}"></span>
			<h2 class="truncate text-sm font-bold text-white">{column.label}</h2>
			<span
				class="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#20242b] px-1.5 text-[11px] font-semibold text-gray-300"
			>
				{column.tasks.length}
			</span>
		</div>

		<button
			type="button"
			on:click={() => dispatch('addTask', column.key)}
			class="rounded-md p-1 text-gray-400 transition hover:bg-[#1f2329] hover:text-gray-200"
			title="Add task to {column.label}"
		>
			<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
				<path
					d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0zm4 2a2 2 0 100-4 2 2 0 000 4z"
				/>
			</svg>
		</button>
	</div>

	<!-- Cards List -->
	<div class="flex-1 space-y-3">
		{#each column.tasks as task (task.id)}
			<TaskCard
				{task}
				on:select={(e) => dispatch('selectTask', e.detail)}
				on:statusChange={(e) => dispatch('statusChange', e.detail)}
				on:delete={(e) => dispatch('deleteTask', e.detail)}
			/>
		{/each}
	</div>

	<!-- Bottom "+ Add task" Button -->
	<button
		type="button"
		on:click={() => dispatch('addTask', column.key)}
		class="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#262a30] bg-[#16191e] py-2.5 text-xs font-semibold text-lime-400 transition hover:border-lime-500/40 hover:bg-[#1d2128]"
	>
		<svg class="h-3.5 w-3.5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
		</svg>
		<span>Add task</span>
	</button>
</div>
