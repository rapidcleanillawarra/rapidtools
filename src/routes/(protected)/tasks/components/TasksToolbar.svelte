<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import {
		activeTab,
		taskFilters,
		groupBy,
		viewMode,
		taskSummaryStats,
		availableAssignees
	} from '../stores';
	import { TASK_STATUSES, type TaskTab, type TaskGroupBy, type DueDateFilter } from '../types';

	const dispatch = createEventDispatcher<{
		newTask: void;
	}>();

	const tabs: { id: TaskTab; label: string }[] = [
		{ id: 'all', label: 'All tasks' },
		{ id: 'my_tasks', label: 'My tasks' },
		{ id: 'assigned_by_me', label: 'Assigned by me' }
	];

	const groupOptions: { value: TaskGroupBy; label: string }[] = [
		{ value: 'department', label: 'Group by: Department' },
		{ value: 'status', label: 'Group by: Status' },
		{ value: 'priority', label: 'Group by: Priority' },
		{ value: 'assignee', label: 'Group by: Assignee' }
	];

	const dueDateOptions: { value: DueDateFilter; label: string }[] = [
		{ value: 'all', label: 'Due date' },
		{ value: 'overdue', label: 'Overdue' },
		{ value: 'today', label: 'Due today' },
		{ value: 'tomorrow', label: 'Due tomorrow' },
		{ value: 'upcoming', label: 'Upcoming' }
	];
</script>

<div class="space-y-5">
	<!-- Row 1: Page Title & "+ New task" Button -->
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight text-white sm:text-3xl">Tasks</h1>
			<p class="mt-0.5 text-sm text-gray-400">Keep every task moving.</p>
		</div>

		<button
			type="button"
			on:click={() => dispatch('newTask')}
			class="inline-flex items-center justify-center gap-2 rounded-lg bg-lime-400 px-4 py-2.5 text-sm font-semibold text-gray-950 shadow-md transition hover:bg-lime-300 focus:outline-none focus:ring-2 focus:ring-lime-400 focus:ring-offset-2 focus:ring-offset-[#0e1012]"
		>
			<svg class="h-4 w-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
			</svg>
			<span>New task</span>
		</button>
	</div>

	<!-- Row 2: Navigation Tabs & Open/Due/Overdue Summary Counters -->
	<div class="flex flex-col justify-between gap-3 border-b border-[#262a30] sm:flex-row sm:items-center">
		<!-- Tabs -->
		<div class="-mb-px flex items-center gap-6 overflow-x-auto">
			{#each tabs as tab}
				<button
					type="button"
					on:click={() => activeTab.set(tab.id)}
					class="whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition-colors {$activeTab === tab.id
						? 'border-lime-400 font-semibold text-white'
						: 'border-transparent text-gray-400 hover:border-[#333842] hover:text-gray-200'}"
				>
					{tab.label}
				</button>
			{/each}
		</div>

		<!-- Summary Stats -->
		<div class="flex items-center gap-2 pb-2.5 text-xs sm:pb-3 sm:text-sm">
			<span class="font-medium text-gray-200">{$taskSummaryStats.openCount} open</span>
			<span class="text-gray-600">&middot;</span>
			<span class="font-medium text-amber-400">{$taskSummaryStats.dueTodayCount} due today</span>
			<span class="text-gray-600">&middot;</span>
			<span class="font-medium text-red-400">{$taskSummaryStats.overdueCount} overdue</span>
		</div>
	</div>

	<!-- Row 3: Search, Filter Pills, Group By & View Switcher -->
	<div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
		<!-- Left: Search + Filter Dropdowns -->
		<div class="flex flex-1 flex-wrap items-center gap-2.5">
			<!-- Search Input -->
			<div class="relative w-full sm:w-64">
				<svg
					class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"
					/>
				</svg>
				<input
					type="text"
					bind:value={$taskFilters.search}
					placeholder="Search tasks..."
					class="w-full rounded-lg border border-[#262a30] bg-[#141619] py-2 pl-9 pr-3 text-xs text-gray-200 placeholder-gray-500 transition focus:border-lime-500 focus:outline-none sm:text-sm"
				/>
			</div>

			<!-- Assignee Filter -->
			<div class="relative">
				<svg
					class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
					/>
				</svg>
				<select
					bind:value={$taskFilters.assignee}
					class="appearance-none rounded-lg border border-[#262a30] bg-[#141619] py-2 pl-9 pr-8 text-xs font-medium text-gray-200 transition hover:border-[#333842] focus:border-lime-500 focus:outline-none sm:text-sm"
				>
					<option value="all">Assignee</option>
					{#each $availableAssignees as person}
						<option value={person}>{person}</option>
					{/each}
				</select>
				<svg
					class="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
				</svg>
			</div>

			<!-- Status Filter -->
			<div class="relative">
				<svg
					class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
					/>
				</svg>
				<select
					bind:value={$taskFilters.status}
					class="appearance-none rounded-lg border border-[#262a30] bg-[#141619] py-2 pl-9 pr-8 text-xs font-medium text-gray-200 transition hover:border-[#333842] focus:border-lime-500 focus:outline-none sm:text-sm"
				>
					<option value="all">Status</option>
					{#each TASK_STATUSES as st}
						<option value={st}>{st}</option>
					{/each}
				</select>
				<svg
					class="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
				</svg>
			</div>

			<!-- Due Date Filter -->
			<div class="relative">
				<svg
					class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
					/>
				</svg>
				<select
					bind:value={$taskFilters.dueDate}
					class="appearance-none rounded-lg border border-[#262a30] bg-[#141619] py-2 pl-9 pr-8 text-xs font-medium text-gray-200 transition hover:border-[#333842] focus:border-lime-500 focus:outline-none sm:text-sm"
				>
					{#each dueDateOptions as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
				<svg
					class="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
				</svg>
			</div>
		</div>

		<!-- Right: Group By Dropdown + Board / List View Toggle -->
		<div class="flex items-center gap-2.5">
			<!-- Group By -->
			<div class="relative">
				<select
					bind:value={$groupBy}
					class="appearance-none rounded-lg border border-[#262a30] bg-[#141619] py-2 pl-3.5 pr-8 text-xs font-medium text-gray-200 transition hover:border-[#333842] focus:border-lime-500 focus:outline-none sm:text-sm"
				>
					{#each groupOptions as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
				<svg
					class="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
				</svg>
			</div>

			<!-- Board View Button -->
			<button
				type="button"
				on:click={() => viewMode.set('board')}
				class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition sm:text-sm {$viewMode === 'board'
					? 'border-lime-500/60 bg-lime-500/10 text-lime-400'
					: 'border-[#262a30] bg-[#141619] text-gray-400 hover:border-[#333842] hover:text-gray-200'}"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10-3a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z"
					/>
				</svg>
				<span>Board</span>
			</button>

			<!-- List View Button -->
			<button
				type="button"
				on:click={() => viewMode.set('list')}
				class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition sm:text-sm {$viewMode === 'list'
					? 'border-lime-500/60 bg-lime-500/10 text-lime-400'
					: 'border-[#262a30] bg-[#141619] text-gray-400 hover:border-[#333842] hover:text-gray-200'}"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 6h16M4 12h16M4 18h16"
					/>
				</svg>
				<span>List</span>
			</button>
		</div>
	</div>
</div>
