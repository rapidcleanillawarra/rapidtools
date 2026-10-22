<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import {
		activeTab,
		taskFilters,
		groupBy,
		sortBy,
		viewMode,
		taskSummaryStats,
		availableAssignees,
		filteredTasks,
		orderedDepartments,
		bucketPreferences,
		hiddenBucketsCount,
		departmentColors,
		toggleBucketVisibility,
		moveBucket,
		showAllBuckets,
		resetBucketPreferences
	} from '../stores';
	import {
		TASK_STATUSES,
		TASK_SORT_OPTIONS,
		getDepartmentDotColor,
		type TaskTab,
		type TaskGroupBy,
		type DueDateFilter
	} from '../types';

	const dispatch = createEventDispatcher<{
		newTask: void;
		addBucket: void;
	}>();

	let bucketMenuOpen = false;

	$: isBucketCustomized =
		$bucketPreferences.order.length > 0 || $bucketPreferences.hidden.length > 0;

	function isBucketHidden(dept: string, hiddenList: string[]): boolean {
		const lower = dept.toLowerCase();
		return hiddenList.some((h) => h.toLowerCase() === lower);
	}

	function getDeptTaskCount(dept: string, tasksList: typeof $filteredTasks): number {
		const lower = dept.toLowerCase();
		return tasksList.filter((t) => (t.department || '').toLowerCase() === lower).length;
	}

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

		<div class="flex items-center gap-2.5">
			<button
				type="button"
				on:click={() => dispatch('addBucket')}
				class="inline-flex items-center justify-center gap-2 rounded-lg border border-[#262a30] bg-[#141619] px-3.5 py-2.5 text-sm font-semibold text-gray-200 transition hover:border-lime-500/50 hover:bg-[#1a1e24] hover:text-lime-400 focus:outline-none"
			>
				<svg class="h-4 w-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
				</svg>
				<span>Add bucket</span>
			</button>

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
			{#if $taskSummaryStats.newAssignedCount > 0}
				<button
					type="button"
					on:click={() => taskFilters.update((f) => ({ ...f, onlyNew: !f.onlyNew }))}
					class="inline-flex items-center gap-1.5 font-semibold text-rose-400 hover:text-rose-300 transition rounded-md px-1 py-0.5 {$taskFilters.onlyNew ? 'bg-rose-500/20 ring-1 ring-rose-500/40' : ''}"
					title={$taskFilters.onlyNew ? 'Showing only new assigned tasks (click to show all)' : 'Click to filter only new assigned tasks'}
				>
					<span class="h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse"></span>
					<span>{$taskSummaryStats.newAssignedCount} new</span>
				</button>
				<span class="text-gray-600">&middot;</span>
			{/if}
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
			<label
				class="flex cursor-pointer items-center rounded-lg border border-[#262a30] bg-[#141619] pl-3 text-xs font-medium text-gray-200 transition hover:border-[#333842] focus-within:border-lime-500 sm:text-sm"
			>
				<svg
					class="pointer-events-none h-4 w-4 flex-shrink-0 text-gray-400"
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
					class="cursor-pointer border-0 bg-transparent py-2 pl-2 pr-8 text-xs font-medium text-gray-200 focus:ring-0 focus:outline-none sm:text-sm"
				>
					<option value="all" class="bg-[#141619] text-gray-200">Assignee</option>
					{#each $availableAssignees as person}
						<option value={person} class="bg-[#141619] text-gray-200">{person}</option>
					{/each}
				</select>
			</label>

			<!-- Status Filter -->
			<label
				class="flex cursor-pointer items-center rounded-lg border border-[#262a30] bg-[#141619] pl-3 text-xs font-medium text-gray-200 transition hover:border-[#333842] focus-within:border-lime-500 sm:text-sm"
			>
				<svg
					class="pointer-events-none h-4 w-4 flex-shrink-0 text-gray-400"
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
					class="cursor-pointer border-0 bg-transparent py-2 pl-2 pr-8 text-xs font-medium text-gray-200 focus:ring-0 focus:outline-none sm:text-sm"
				>
					<option value="all" class="bg-[#141619] text-gray-200">Status</option>
					{#each TASK_STATUSES as st}
						<option value={st} class="bg-[#141619] text-gray-200">{st}</option>
					{/each}
				</select>
			</label>

			<!-- Due Date Filter -->
			<label
				class="flex cursor-pointer items-center rounded-lg border border-[#262a30] bg-[#141619] pl-3 text-xs font-medium text-gray-200 transition hover:border-[#333842] focus-within:border-lime-500 sm:text-sm"
			>
				<svg
					class="pointer-events-none h-4 w-4 flex-shrink-0 text-gray-400"
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
					class="cursor-pointer border-0 bg-transparent py-2 pl-2 pr-8 text-xs font-medium text-gray-200 focus:ring-0 focus:outline-none sm:text-sm"
				>
					{#each dueDateOptions as opt}
						<option value={opt.value} class="bg-[#141619] text-gray-200">{opt.label}</option>
					{/each}
				</select>
			</label>

			<!-- New Assigned Tasks Filter Pill Button -->
			<button
				type="button"
				on:click={() => taskFilters.update((f) => ({ ...f, onlyNew: !f.onlyNew }))}
				class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition sm:text-sm {$taskFilters.onlyNew
					? 'border-rose-500/50 bg-rose-500/15 text-rose-300 shadow-sm'
					: 'border-[#262a30] bg-[#141619] text-gray-300 hover:border-[#333842] hover:text-white'}"
				title={$taskFilters.onlyNew ? 'Showing only new assigned tasks' : 'Filter by new assigned tasks'}
			>
				<span class="h-2 w-2 rounded-full bg-rose-500 {$taskFilters.onlyNew ? 'animate-ping' : ''}"></span>
				<span>New assigned</span>
				{#if $taskSummaryStats.newAssignedCount > 0}
					<span
						class="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold {$taskFilters.onlyNew
							? 'bg-rose-500 text-white'
							: 'bg-[#2a2f37] text-gray-300'}"
					>
						{$taskSummaryStats.newAssignedCount}
					</span>
				{/if}
			</button>
		</div>

		<!-- Right: Sort By + Group By Dropdown + Board / List View Toggle -->
		<div class="flex flex-wrap items-center gap-2.5">
			<!-- Sort By -->
			<label
				class="flex cursor-pointer items-center rounded-lg border border-[#262a30] bg-[#141619] pl-3 text-xs font-medium text-gray-200 transition hover:border-[#333842] focus-within:border-lime-500 sm:text-sm"
			>
				<svg
					class="pointer-events-none h-4 w-4 flex-shrink-0 text-gray-400"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
					/>
				</svg>
				<select
					bind:value={$sortBy}
					aria-label="Sort tasks"
					class="cursor-pointer border-0 bg-transparent py-2 pl-2 pr-8 text-xs font-medium text-gray-200 focus:ring-0 focus:outline-none sm:text-sm"
				>
					{#each TASK_SORT_OPTIONS as opt}
						<option value={opt.key} class="bg-[#141619] text-gray-200">{opt.label}</option>
					{/each}
				</select>
			</label>

			<!-- Group By -->
			<select
				bind:value={$groupBy}
				class="cursor-pointer rounded-lg border border-[#262a30] bg-[#141619] py-2 pl-3.5 pr-8 text-xs font-medium text-gray-200 transition hover:border-[#333842] focus:border-lime-500 focus:outline-none sm:text-sm"
			>
				{#each groupOptions as opt}
					<option value={opt.value} class="bg-[#141619] text-gray-200">{opt.label}</option>
				{/each}
			</select>

			<!-- Customize Buckets (Order & Visibility) -->
			{#if $groupBy === 'department'}
				<div class="relative">
					<button
						type="button"
						on:click={() => (bucketMenuOpen = !bucketMenuOpen)}
						class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition sm:text-sm {bucketMenuOpen || $hiddenBucketsCount > 0
							? 'border-lime-500/50 bg-lime-500/10 text-lime-400'
							: 'border-[#262a30] bg-[#141619] text-gray-200 hover:border-[#333842] hover:text-white'}"
						title="Customize bucket order and visibility"
					>
						<svg class="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
							/>
						</svg>
						<span>Buckets</span>
						{#if $hiddenBucketsCount > 0}
							<span class="inline-flex items-center rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
								{$hiddenBucketsCount} hidden
							</span>
						{/if}
					</button>

					{#if bucketMenuOpen}
						<!-- Backdrop -->
						<div
							class="fixed inset-0 z-30"
							on:click={() => (bucketMenuOpen = false)}
						></div>

						<!-- Popover Panel -->
						<div
							class="absolute right-0 top-full z-40 mt-2 w-72 rounded-xl border border-[#262a30] bg-[#141619] p-3 shadow-2xl"
						>
							<div class="mb-2 flex items-center justify-between border-b border-[#262a30] pb-2">
								<div>
									<h4 class="text-xs font-bold uppercase tracking-wider text-white">
										Customize Buckets
									</h4>
									<p class="text-[11px] text-gray-400">
										Show, hide, or reorder for your view
									</p>
								</div>
								{#if isBucketCustomized}
									<button
										type="button"
										on:click={() => resetBucketPreferences()}
										class="text-[11px] font-semibold text-lime-400 transition hover:text-lime-300"
									>
										Reset
									</button>
								{/if}
							</div>

							<div class="max-h-64 space-y-1 overflow-y-auto pr-0.5">
								{#each $orderedDepartments as dept, idx (dept)}
									{@const hidden = isBucketHidden(dept, $bucketPreferences.hidden)}
									{@const dotClass = $departmentColors[dept] || getDepartmentDotColor(dept)}
									{@const count = getDeptTaskCount(dept, $filteredTasks)}
									<div
										class="flex items-center justify-between gap-2 rounded-lg border border-transparent px-2 py-1.5 transition hover:border-[#262a30] hover:bg-[#1a1d23] {hidden ? 'opacity-55' : ''}"
									>
										<!-- Visibility Toggle Button -->
										<button
											type="button"
											on:click={() => toggleBucketVisibility(dept)}
											class="flex flex-1 items-center gap-2 text-left text-xs font-medium {hidden ? 'text-gray-500 line-through' : 'text-gray-200'} focus:outline-none"
											title={hidden ? `Show ${dept}` : `Hide ${dept}`}
										>
											{#if hidden}
												<svg class="h-4 w-4 flex-shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
													/>
												</svg>
											{:else}
												<svg class="h-4 w-4 flex-shrink-0 text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
													/>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
													/>
												</svg>
											{/if}
											<span class="h-2 w-2 flex-shrink-0 rounded-full {dotClass}"></span>
											<span class="truncate">{dept}</span>
											<span class="ml-auto rounded-full bg-[#20242b] px-1.5 py-0.2 text-[10px] font-semibold text-gray-400">
												{count}
											</span>
										</button>

										<!-- Move Up / Move Down Buttons -->
										<div class="flex items-center gap-0.5">
											<button
												type="button"
												disabled={idx === 0}
												on:click={() => moveBucket(dept, 'left', false)}
												class="rounded p-1 text-gray-400 transition hover:bg-[#262a30] hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"
												title="Move earlier"
											>
												<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
												</svg>
											</button>
											<button
												type="button"
												disabled={idx === $orderedDepartments.length - 1}
												on:click={() => moveBucket(dept, 'right', false)}
												class="rounded p-1 text-gray-400 transition hover:bg-[#262a30] hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"
												title="Move later"
											>
												<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
												</svg>
											</button>
										</div>
									</div>
								{/each}
							</div>

							{#if $hiddenBucketsCount > 0}
								<div class="mt-2 border-t border-[#262a30] pt-2">
									<button
										type="button"
										on:click={() => showAllBuckets()}
										class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#262a30] bg-[#181b20] py-1.5 text-xs font-semibold text-gray-200 transition hover:border-lime-500/40 hover:text-lime-400"
									>
										<span>Show all buckets ({$hiddenBucketsCount} hidden)</span>
									</button>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/if}

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
