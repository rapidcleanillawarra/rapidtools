<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import TaskCard from './TaskCard.svelte';
	import type { TaskColumnGroup, TaskItem, TaskStatus } from '../types';
	import { DEFAULT_TASK_DEPARTMENTS } from '../types';
	import {
		groupBy,
		removeDepartment,
		hideBucket,
		moveBucket,
		visibleDepartments
	} from '../stores';
	import { toastSuccess } from '$lib/utils/toast';

	export let column: TaskColumnGroup;

	const dispatch = createEventDispatcher<{
		addTask: string;
		selectTask: TaskItem;
		statusChange: { task: TaskItem; status: TaskStatus };
		deleteTask: TaskItem;
		openPhotos: { task: TaskItem; initialIndex: number };
		addSubtask: TaskItem;
	}>();

	let menuOpen = false;

	$: isDepartmentGroup = $groupBy === 'department';

	$: columnIndex = $visibleDepartments.findIndex(
		(d) => d.toLowerCase() === column.key.toLowerCase()
	);
	$: canMoveLeft = isDepartmentGroup && columnIndex > 0;
	$: canMoveRight =
		isDepartmentGroup &&
		columnIndex !== -1 &&
		columnIndex < $visibleDepartments.length - 1;

	function handleHideBucket() {
		menuOpen = false;
		hideBucket(column.key);
		toastSuccess(`Hidden "${column.label}" from your view`);
	}

	function handleMoveLeft() {
		menuOpen = false;
		moveBucket(column.key, 'left', true);
	}

	function handleMoveRight() {
		menuOpen = false;
		moveBucket(column.key, 'right', true);
	}

	$: isCustomBucket =
		$groupBy === 'department' &&
		!DEFAULT_TASK_DEPARTMENTS.some(
			(d) => d.toLowerCase() === column.key.toLowerCase()
		);

	async function handleDeleteBucket() {
		menuOpen = false;
		if (column.tasks.length > 0) {
			if (
				!confirm(
					`Bucket "${column.label}" has ${column.tasks.length} task(s). Delete this bucket anyway?`
				)
			) {
				return;
			}
		} else {
			if (!confirm(`Delete bucket "${column.label}"?`)) return;
		}
		await removeDepartment(column.key);
		toastSuccess(`Bucket "${column.label}" removed`);
	}
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

		<div class="relative">
			<button
				type="button"
				on:click={() => (menuOpen = !menuOpen)}
				class="rounded-md p-1 text-gray-400 transition hover:bg-[#1f2329] hover:text-gray-200"
				title="Column options"
			>
				<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
					<path
						d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0zm4 2a2 2 0 100-4 2 2 0 000 4z"
					/>
				</svg>
			</button>

			{#if menuOpen}
				<!-- Backdrop to close menu -->
				<div
					class="fixed inset-0 z-20"
					on:click={() => (menuOpen = false)}
				></div>

				<!-- Dropdown Menu -->
				<div
					class="absolute right-0 top-full z-30 mt-1 w-40 rounded-lg border border-[#262a30] bg-[#141619] py-1 shadow-xl"
				>
					<button
						type="button"
						on:click={() => {
							menuOpen = false;
							dispatch('addTask', column.key);
						}}
						class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-200 transition hover:bg-[#1f2329]"
					>
						<svg class="h-3.5 w-3.5 text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
						<span>Add task</span>
					</button>

					{#if isDepartmentGroup}
						<div class="my-1 border-t border-[#262a30]"></div>

						<button
							type="button"
							disabled={!canMoveLeft}
							on:click={handleMoveLeft}
							class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-200 transition hover:bg-[#1f2329] disabled:cursor-not-allowed disabled:opacity-35"
						>
							<svg class="h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
							</svg>
							<span>Move left</span>
						</button>

						<button
							type="button"
							disabled={!canMoveRight}
							on:click={handleMoveRight}
							class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-200 transition hover:bg-[#1f2329] disabled:cursor-not-allowed disabled:opacity-35"
						>
							<svg class="h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
							</svg>
							<span>Move right</span>
						</button>

						<button
							type="button"
							on:click={handleHideBucket}
							class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-amber-300 transition hover:bg-[#1f2329]"
						>
							<svg class="h-3.5 w-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
								/>
							</svg>
							<span>Hide bucket</span>
						</button>
					{/if}

					{#if isCustomBucket}
						<button
							type="button"
							on:click={handleDeleteBucket}
							class="flex w-full items-center gap-2 border-t border-[#262a30] px-3 py-1.5 text-left text-xs text-red-400 transition hover:bg-red-950/20"
						>
							<svg class="h-3.5 w-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
								/>
							</svg>
							<span>Delete bucket</span>
						</button>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<!-- Cards List -->
	<div class="flex-1 space-y-3">
		{#each column.tasks as task (task.id)}
			<TaskCard
				{task}
				on:select={(e) => dispatch('selectTask', e.detail)}
				on:statusChange={(e) => dispatch('statusChange', e.detail)}
				on:delete={(e) => dispatch('deleteTask', e.detail)}
				on:openPhotos={(e) => dispatch('openPhotos', e.detail)}
				on:addSubtask={(e) => dispatch('addSubtask', e.detail)}
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
