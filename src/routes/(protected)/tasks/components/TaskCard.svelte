<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { currentUser } from '$lib/firebase';
	import { userProfile } from '$lib/userProfile';
	import {
		tasks,
		seenTaskIds,
		subtasksByParentId,
		assignTaskParent,
		promoteSubtaskToParent,
		swapParentAndSubtask
	} from '../stores';
	import { toastSuccess, toastError } from '$lib/utils/toast';
	import {
		type TaskItem,
		type TaskStatus,
		TASK_STATUSES,
		STATUS_DOT_COLORS,
		getTaskProgress,
		getSubtaskProgress,
		getProgressBarColor,
		getInitials,
		getAvatarColorClasses,
		getDueDateDisplay,
		formatShortDate,
		isImageAttachment,
		getTaskAssignees,
		isTaskAssignedToUser,
		getValidParentTasks
	} from '../types';

	export let task: TaskItem;

	const dispatch = createEventDispatcher<{
		select: TaskItem;
		statusChange: { task: TaskItem; status: TaskStatus };
		delete: TaskItem;
		openPhotos: { task: TaskItem; initialIndex: number };
		addSubtask: TaskItem;
	}>();

	let statusMenuOpen = false;
	let actionMenuOpen = false;
	let subtasksExpanded = true;
	let moveParentSubmenuOpen = false;
	let isDragOverCard = false;

	$: subtasks = $subtasksByParentId[task.id] || [];
	$: subtaskProgress = getSubtaskProgress(subtasks);
	$: parentTask = task.parent_task_id
		? $tasks.find((t) => t.id === task.parent_task_id) || null
		: null;
	$: validParents = getValidParentTasks($tasks, task.id).filter(
		(t) => !t.parent_task_id && t.id !== task.parent_task_id
	);

	async function handleMoveToParent(newParentId: string | null, e: MouseEvent) {
		e.stopPropagation();
		actionMenuOpen = false;
		moveParentSubmenuOpen = false;
		try {
			await assignTaskParent(task.id, newParentId);
			toastSuccess(newParentId ? 'Moved under parent task' : 'Promoted to standalone task');
		} catch (err: any) {
			toastError(err?.message || 'Failed to update task hierarchy');
		}
	}

	async function handleSwapWithSubtask(sub: TaskItem, e: MouseEvent) {
		e.stopPropagation();
		try {
			await swapParentAndSubtask(task.id, sub.id);
			toastSuccess(`Swapped "${sub.title}" as parent task`);
		} catch (err: any) {
			toastError(err?.message || 'Failed to swap parent and subtask');
		}
	}

	async function handleSwapWithMyParent(e: MouseEvent) {
		e.stopPropagation();
		actionMenuOpen = false;
		if (!task.parent_task_id) return;
		try {
			await swapParentAndSubtask(task.parent_task_id, task.id);
			toastSuccess(`Promoted "${task.title}" and swapped with former parent`);
		} catch (err: any) {
			toastError(err?.message || 'Failed to swap with parent');
		}
	}

	function handleTaskDragStart(e: DragEvent) {
		e.stopPropagation();
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('application/x-rapidtools-task-id', task.id);
		}
	}

	function handleTaskDragOver(e: DragEvent) {
		if (!e.dataTransfer?.types.includes('application/x-rapidtools-task-id')) return;
		e.preventDefault();
		e.stopPropagation();
		isDragOverCard = true;
	}

	function handleTaskDragLeave() {
		isDragOverCard = false;
	}

	async function handleTaskDropOnCard(e: DragEvent) {
		if (!e.dataTransfer?.types.includes('application/x-rapidtools-task-id')) return;
		e.preventDefault();
		e.stopPropagation();
		isDragOverCard = false;

		const draggedTaskId = e.dataTransfer.getData('application/x-rapidtools-task-id');
		if (!draggedTaskId || draggedTaskId === task.id) return;

		try {
			// If dropping a parent onto its own child, interchange them!
			if (task.parent_task_id === draggedTaskId) {
				await swapParentAndSubtask(draggedTaskId, task.id);
				toastSuccess('Interchanged parent and child task');
				return;
			}
			await assignTaskParent(draggedTaskId, task.id);
			toastSuccess(`Attached as subtask of "${task.title}"`);
		} catch (err: any) {
			toastError(err?.message || 'Cannot move task here');
		}
	}

	$: isNewAssigned =
		task.status !== 'Completed' &&
		isTaskAssignedToUser(task, $currentUser?.email, $userProfile?.firstName) &&
		!$seenTaskIds.has(task.id);

	$: progress = getTaskProgress(task.steps);
	$: progressBarColor = getProgressBarColor(task.status);
	$: cardAssignees = getTaskAssignees(task);
	$: initials = getInitials(task.assignee_name);
	$: avatarClasses = getAvatarColorClasses(task.assignee_name);
	$: dueDisplay = getDueDateDisplay(task.due_date, task.status);
	$: noteDateLabel = formatShortDate(task.latest_note_at || task.updated_at || task.created_at);
	$: imageAttachments = (task.attachments || []).filter(isImageAttachment);

	function selectStatus(newStatus: TaskStatus, event: MouseEvent) {
		event.stopPropagation();
		statusMenuOpen = false;
		if (newStatus !== task.status) {
			dispatch('statusChange', { task, status: newStatus });
		}
	}

	function handleCardClick() {
		statusMenuOpen = false;
		actionMenuOpen = false;
		dispatch('select', task);
	}
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
	on:click={handleCardClick}
	draggable="true"
	on:dragstart={handleTaskDragStart}
	on:dragover={handleTaskDragOver}
	on:dragleave={handleTaskDragLeave}
	on:drop={handleTaskDropOnCard}
	class="group relative cursor-pointer rounded-xl border p-3.5 shadow-md transition-all duration-150 {isDragOverCard
		? 'border-lime-400 bg-[#1e2420] ring-2 ring-lime-400/50'
		: 'border-[#262a30] bg-[#181b20] hover:border-[#333842] hover:bg-[#1b1f25]'}"
>
	{#if isNewAssigned}
		<span
			class="absolute -top-1.5 -right-1.5 flex h-4 w-4 z-10"
			title="New task assigned to you"
		>
			<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
			<span class="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-[#181b20] shadow-sm"></span>
		</span>
	{/if}

	<!-- 1. Top Row: Status Dropdown Pill + "..." Menu -->
	<div class="mb-2.5 flex items-center justify-between gap-2">
		<!-- Status Pill Dropdown -->
		<div class="relative" on:click|stopPropagation>
			<button
				type="button"
				on:click={() => {
					statusMenuOpen = !statusMenuOpen;
					actionMenuOpen = false;
				}}
				class="inline-flex items-center gap-1.5 rounded-lg border border-[#2a2f37] bg-[#141619] px-2.5 py-1 text-xs font-medium text-gray-200 transition hover:border-[#3a404a]"
			>
				<span class="h-2 w-2 rounded-full {STATUS_DOT_COLORS[task.status] || 'bg-gray-400'}"></span>
				<span>{task.status}</span>
				<svg class="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
				</svg>
			</button>

			{#if statusMenuOpen}
				<div
					class="absolute left-0 top-full z-30 mt-1 w-36 rounded-lg border border-[#262a30] bg-[#141619] py-1 shadow-xl"
				>
					{#each TASK_STATUSES as st}
						<button
							type="button"
							on:click={(e) => selectStatus(st, e)}
							class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition hover:bg-[#1f2329] {task.status === st
								? 'font-semibold text-lime-400'
								: 'text-gray-300'}"
						>
							<span class="h-2 w-2 rounded-full {STATUS_DOT_COLORS[st]}"></span>
							<span>{st}</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Card "..." Menu -->
		<div class="relative" on:click|stopPropagation>
			<button
				type="button"
				on:click={() => {
					actionMenuOpen = !actionMenuOpen;
					statusMenuOpen = false;
				}}
				class="rounded-md p-1 text-gray-400 transition hover:bg-[#232830] hover:text-gray-200"
				aria-label="Task actions"
			>
				<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
					<path
						d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0zm4 2a2 2 0 100-4 2 2 0 000 4z"
					/>
				</svg>
			</button>

			{#if actionMenuOpen}
				<div
					class="absolute right-0 top-full z-30 mt-1 w-32 rounded-lg border border-[#262a30] bg-[#141619] py-1 shadow-xl"
				>
					<button
						type="button"
						on:click={() => {
							actionMenuOpen = false;
							dispatch('select', task);
						}}
						class="block w-full px-3 py-1.5 text-left text-xs text-gray-200 hover:bg-[#1f2329]"
					>
						Open details
					</button>

					<button
						type="button"
						on:click={() => {
							actionMenuOpen = false;
							dispatch('addSubtask', task);
						}}
						class="block w-full px-3 py-1.5 text-left text-xs text-lime-400 hover:bg-[#1f2329]"
					>
						+ Add subtask
					</button>

					{#if task.parent_task_id}
						<button
							type="button"
							on:click={handleSwapWithMyParent}
							class="block w-full px-3 py-1.5 text-left text-xs text-cyan-400 hover:bg-[#1f2329]"
						>
							⇄ Swap with parent
						</button>
						<button
							type="button"
							on:click={(e) => handleMoveToParent(null, e)}
							class="block w-full px-3 py-1.5 text-left text-xs text-amber-300 hover:bg-[#1f2329]"
						>
							↑ Make standalone
						</button>
					{/if}

					{#if validParents.length > 0}
						<div class="border-t border-[#262a30] pt-1 mt-1">
							<button
								type="button"
								on:click|stopPropagation={() => (moveParentSubmenuOpen = !moveParentSubmenuOpen)}
								class="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-[#1f2329]"
							>
								<span>Move under parent</span>
								<span>{moveParentSubmenuOpen ? '▴' : '▾'}</span>
							</button>
							{#if moveParentSubmenuOpen}
								<div class="max-h-36 overflow-y-auto bg-[#101215] py-1">
									{#each validParents as candidate (candidate.id)}
										<button
											type="button"
											on:click={(e) => handleMoveToParent(candidate.id, e)}
											class="block w-full truncate px-4 py-1 text-left text-[11px] text-gray-300 hover:bg-[#1f2329] hover:text-lime-400"
											title={candidate.title}
										>
											↳ {candidate.title}
										</button>
									{/each}
								</div>
							{/if}
						</div>
					{/if}

					{#if imageAttachments.length > 0}
						<button
							type="button"
							on:click={() => {
								actionMenuOpen = false;
								dispatch('openPhotos', { task, initialIndex: 0 });
							}}
							class="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs text-lime-400 hover:bg-[#1f2329]"
						>
							<span>View photos</span>
							<span class="rounded bg-lime-400/20 px-1 text-[10px] font-bold text-lime-400">
								{imageAttachments.length}
							</span>
						</button>
					{/if}
					<button
						type="button"
						on:click={() => {
							actionMenuOpen = false;
							dispatch('delete', task);
						}}
						class="block w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-red-950/30"
					>
						Delete task
					</button>
				</div>
			{/if}
		</div>
	</div>

	{#if parentTask}
		<div
			on:click|stopPropagation={() => dispatch('select', parentTask)}
			class="mb-1.5 inline-flex max-w-full items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-950/25 px-2 py-0.5 text-[10px] font-medium text-cyan-300 hover:border-cyan-400"
			title="Click to open parent task: {parentTask.title}"
		>
			<span>↳ Subtask of:</span>
			<span class="truncate font-semibold">{parentTask.title}</span>
		</div>
	{/if}

	<!-- 2. Task Title -->
	<h3 class="mb-3 text-sm font-bold leading-snug text-white group-hover:text-lime-300 transition-colors">
		{task.title}
	</h3>

	<!-- 3. Progress Section -->
	<div class="mb-3.5">
		<div class="mb-1.5 flex items-center justify-between text-[11px]">
			<span class="text-gray-400">Progress</span>
			<div class="flex items-center gap-2">
				<span class="font-bold text-gray-200">{progress.percent}%</span>
				<span class="text-gray-400">{progress.completed} of {progress.total} steps</span>
			</div>
		</div>
		<div class="h-2 w-full overflow-hidden rounded-full bg-[#262a30]">
			<div
				class="h-full rounded-full transition-all duration-300 {progressBarColor}"
				style="width: {progress.percent}%;"
			></div>
		</div>
	</div>

	<!-- 3b. Subtasks Section -->
	{#if subtasks.length > 0}
		<div
			on:click|stopPropagation
			class="mb-3.5 rounded-lg border border-[#262a30] bg-[#141619] p-2.5"
		>
			<div class="flex items-center justify-between text-[11px]">
				<button
					type="button"
					on:click={() => (subtasksExpanded = !subtasksExpanded)}
					class="inline-flex items-center gap-1.5 font-semibold text-gray-200 hover:text-lime-400"
				>
					<svg
						class="h-3.5 w-3.5 text-lime-400 transition-transform {subtasksExpanded ? 'rotate-90' : ''}"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
					</svg>
					<span>Subtasks ({subtaskProgress.completed}/{subtaskProgress.total})</span>
				</button>

				<button
					type="button"
					on:click={() => dispatch('addSubtask', task)}
					class="rounded px-1.5 py-0.5 text-[10px] font-semibold text-lime-400 hover:bg-[#1f2329]"
					title="Add subtask"
				>
					+ Add
				</button>
			</div>

			{#if subtasksExpanded}
				<div class="mt-2 space-y-1.5 border-t border-[#262a30]/70 pt-2">
					{#each subtasks as sub (sub.id)}
						<div
							draggable="true"
							on:dragstart={(e) => {
								e.stopPropagation();
								if (e.dataTransfer) {
									e.dataTransfer.effectAllowed = 'move';
									e.dataTransfer.setData('application/x-rapidtools-task-id', sub.id);
								}
							}}
							class="group/sub flex items-center justify-between gap-1.5 rounded-md bg-[#181b20] px-2 py-1.5 text-xs transition hover:bg-[#1f242b]"
						>
							<div class="flex min-w-0 flex-1 items-center gap-2">
								<input
									type="checkbox"
									checked={sub.status === 'Completed'}
									on:change={() =>
										dispatch('statusChange', {
											task: sub,
											status: sub.status === 'Completed' ? 'To do' : 'Completed'
										})}
									class="h-3.5 w-3.5 flex-shrink-0 rounded border-[#3a404a] bg-[#141619] text-lime-500 focus:ring-lime-500"
								/>
								<button
									type="button"
									on:click={() => dispatch('select', sub)}
									class="truncate text-left text-xs {sub.status === 'Completed'
										? 'line-through text-gray-500'
										: 'text-gray-200 hover:text-lime-300'}"
								>
									{sub.title}
								</button>
							</div>

							<div class="flex items-center gap-1 opacity-0 transition group-hover/sub:opacity-100">
								<button
									type="button"
									on:click={(e) => handleSwapWithSubtask(sub, e)}
									class="rounded p-0.5 text-[10px] text-gray-400 hover:bg-[#262a30] hover:text-cyan-400"
									title="Swap with parent (make this the parent task)"
								>
									⇄
								</button>
								<button
									type="button"
									on:click={async (e) => {
										e.stopPropagation();
										await promoteSubtaskToParent(sub.id);
										toastSuccess(`"${sub.title}" is now a standalone task`);
									}}
									class="rounded p-0.5 text-[10px] text-gray-400 hover:bg-[#262a30] hover:text-amber-300"
									title="Promote to standalone task"
								>
									↑
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- 4. Assignee, Priority/Done Badge & Due Date Row -->
	<div class="mb-3 flex flex-wrap items-center justify-between gap-1.5">
		<!-- Assignee Avatar + Name -->
		<div class="flex items-center gap-1.5 min-w-0">
			{#if cardAssignees.length > 1}
				<div class="flex items-center -space-x-1.5 overflow-hidden flex-shrink-0">
					{#each cardAssignees.slice(0, 3) as a (a.name)}
						<span
							class="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-extrabold ring-2 ring-[#181b20] {getAvatarColorClasses(a.name)}"
							title={a.name}
						>
							{getInitials(a.name)}
						</span>
					{/each}
					{#if cardAssignees.length > 3}
						<span
							class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#2a2f37] text-[10px] font-bold text-gray-200 ring-2 ring-[#181b20]"
							title={`+${cardAssignees.length - 3} more`}
						>
							+{cardAssignees.length - 3}
						</span>
					{/if}
				</div>
				<span
					class="truncate text-xs font-medium text-gray-200"
					title={cardAssignees.map((a) => a.name).join(', ')}
				>
					{cardAssignees.map((a) => a.name).join(', ')}
				</span>
			{:else if cardAssignees.length === 1}
				<span
					class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold {getAvatarColorClasses(cardAssignees[0].name)}"
					title={cardAssignees[0].name}
				>
					{getInitials(cardAssignees[0].name)}
				</span>
				<span class="truncate text-xs font-medium text-gray-200">{cardAssignees[0].name}</span>
			{:else}
				<span class="truncate text-xs text-gray-500 italic">Unassigned</span>
			{/if}
		</div>

		<!-- Priority or Done Pill + Due Date -->
		<div class="flex items-center gap-1.5">
			{#if task.status === 'Completed'}
				<span
					class="rounded-md border border-lime-500/40 bg-lime-950/30 px-2 py-0.5 text-[11px] font-semibold text-lime-400"
				>
					Done
				</span>
			{:else if task.priority === 'High' || task.priority === 'Urgent'}
				<span
					class="rounded-md border border-red-500/40 bg-red-950/30 px-2 py-0.5 text-[11px] font-semibold text-red-400"
				>
					{task.priority}
				</span>
			{:else}
				<span
					class="rounded-md border border-[#333842] bg-[#141619] px-2 py-0.5 text-[11px] font-medium text-gray-300"
				>
					{task.priority}
				</span>
			{/if}

			<!-- Due Date Pill -->
			<span
				class="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium {dueDisplay.borderClass} {dueDisplay.textClass}"
			>
				<svg
					class="h-3 w-3 flex-shrink-0 {dueDisplay.iconClass}"
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
				<span class="whitespace-nowrap">{dueDisplay.label}</span>
			</span>
		</div>
	</div>

	<!-- 5. Footer: Latest Note & Comment Count -->
	<div class="flex items-center justify-between border-t border-[#262a30]/80 pt-2.5 text-[11px] text-gray-400">
		<div class="flex items-center gap-1.5 truncate">
			<svg class="h-3.5 w-3.5 flex-shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
				/>
			</svg>
			<span class="truncate">
				Latest note{#if noteDateLabel}&nbsp;&middot; {noteDateLabel}{/if}
			</span>
		</div>

		<div class="flex items-center gap-2.5 text-gray-400">
			{#if imageAttachments.length > 0}
				<button
					type="button"
					on:click|stopPropagation={() => dispatch('openPhotos', { task, initialIndex: 0 })}
					class="inline-flex items-center gap-1 text-lime-400/90 hover:text-lime-300 hover:underline transition"
					title={`View ${imageAttachments.length} photo(s)`}
				>
					<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
						/>
					</svg>
					<span class="font-semibold">{imageAttachments.length}</span>
				</button>
			{/if}

			<div class="flex items-center gap-1 text-gray-400">
				<svg class="h-3.5 w-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
					/>
				</svg>
				<span>{task.comment_count || 0}</span>
			</div>
		</div>
	</div>
</div>
