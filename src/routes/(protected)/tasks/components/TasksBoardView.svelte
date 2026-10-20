<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { groupedTasks } from '../stores';
	import TaskBoardColumn from './TaskBoardColumn.svelte';
	import type { TaskItem, TaskStatus } from '../types';

	const dispatch = createEventDispatcher<{
		addTask: string;
		selectTask: TaskItem;
		statusChange: { task: TaskItem; status: TaskStatus };
		deleteTask: TaskItem;
	}>();
</script>

<div class="overflow-x-auto pb-4">
	<div class="flex items-start gap-4 min-w-max">
		{#each $groupedTasks as column (column.key)}
			<div class="w-80 flex-shrink-0">
				<TaskBoardColumn
					{column}
					on:addTask={(e) => dispatch('addTask', e.detail)}
					on:selectTask={(e) => dispatch('selectTask', e.detail)}
					on:statusChange={(e) => dispatch('statusChange', e.detail)}
					on:deleteTask={(e) => dispatch('deleteTask', e.detail)}
				/>
			</div>
		{/each}
	</div>
</div>
