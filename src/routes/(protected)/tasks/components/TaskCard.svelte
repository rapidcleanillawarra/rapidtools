<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { currentUser } from '$lib/firebase';
	import { userProfile } from '$lib/userProfile';
	import { seenTaskIds } from '../stores';
	import {
		type TaskItem,
		type TaskStatus,
		TASK_STATUSES,
		STATUS_DOT_COLORS,
		getTaskProgress,
		getProgressBarColor,
		getInitials,
		getAvatarColorClasses,
		getDueDateDisplay,
		formatShortDate,
		isImageAttachment,
		getTaskAssignees,
		isTaskAssignedToUser
	} from '../types';

	export let task: TaskItem;

	const dispatch = createEventDispatcher<{
		select: TaskItem;
		statusChange: { task: TaskItem; status: TaskStatus };
		delete: TaskItem;
		openPhotos: { task: TaskItem; initialIndex: number };
	}>();

	let statusMenuOpen = false;
	let actionMenuOpen = false;

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
	class="group relative cursor-pointer rounded-xl border border-[#262a30] bg-[#181b20] p-3.5 shadow-md transition-all duration-150 hover:border-[#333842] hover:bg-[#1b1f25]"
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
