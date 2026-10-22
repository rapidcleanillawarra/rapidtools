<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { currentUser } from '$lib/firebase';
	import { userProfile } from '$lib/userProfile';
	import {
		groupedTasks,
		groupBy,
		sortBy,
		seenTaskIds,
		visibleDepartments,
		hiddenBucketsCount,
		moveBucket,
		hideBucket,
		showAllBuckets,
		subtasksByParentId,
		promoteSubtaskToParent,
		swapParentAndSubtask
	} from '../stores';
	import { toastSuccess, toastError } from '$lib/utils/toast';
	import {
		type TaskItem,
		type TaskStatus,
		type TaskSortField,
		TASK_STATUSES,
		STATUS_DOT_COLORS,
		getTaskProgress,
		getProgressBarColor,
		getInitials,
		getAvatarColorClasses,
		getDueDateDisplay,
		formatShortDate,
		formatDateTimeShort,
		isImageAttachment,
		getTaskAssignees,
		isTaskAssignedToUser
	} from '../types';

	const dispatch = createEventDispatcher<{
		addTask: string;
		selectTask: TaskItem;
		statusChange: { task: TaskItem; status: TaskStatus };
		deleteTask: TaskItem;
		addBucket: void;
		openPhotos: { task: TaskItem; initialIndex: number };
		addSubtask: TaskItem;
	}>();

	let collapsedParentIds = new Set<string>();

	function toggleParentRow(taskId: string, e: MouseEvent) {
		e.stopPropagation();
		const next = new Set(collapsedParentIds);
		if (next.has(taskId)) next.delete(taskId);
		else next.add(taskId);
		collapsedParentIds = next;
	}

	function toggleColumnSort(field: TaskSortField) {
		sortBy.update((current) => {
			if (field === 'created_at') {
				return current === 'created_at_desc' ? 'created_at_asc' : 'created_at_desc';
			}
			if (field === 'priority') {
				return current === 'priority_desc' ? 'priority_asc' : 'priority_desc';
			}
			// due_date defaults to soonest (asc) first
			return current === 'due_date_asc' ? 'due_date_desc' : 'due_date_asc';
		});
	}
</script>

<div class="space-y-6">
	{#each $groupedTasks as group, groupIdx (group.key)}
		<div class="overflow-hidden rounded-xl border border-[#262a30] bg-[#141619] shadow-lg">
			<!-- Group Header Bar -->
			<div class="flex items-center justify-between border-b border-[#262a30] bg-[#181b20] px-4 py-3">
				<div class="flex items-center gap-2.5">
					<span class="h-2.5 w-2.5 rounded-full {group.dotColorClass}"></span>
					<h3 class="text-sm font-bold text-white">{group.label}</h3>
					<span
						class="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#242830] px-1.5 text-[11px] font-semibold text-gray-300"
					>
						{group.tasks.length}
					</span>
				</div>

				<div class="flex items-center gap-1.5">
					{#if $groupBy === 'department'}
						<button
							type="button"
							disabled={groupIdx === 0}
							on:click={() => moveBucket(group.key, 'left', true)}
							class="rounded-lg border border-[#262a30] bg-[#141619] p-1 text-gray-400 transition hover:border-[#333842] hover:text-white disabled:opacity-30"
							title="Move bucket up"
						>
							<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
							</svg>
						</button>
						<button
							type="button"
							disabled={groupIdx === $visibleDepartments.length - 1}
							on:click={() => moveBucket(group.key, 'right', true)}
							class="rounded-lg border border-[#262a30] bg-[#141619] p-1 text-gray-400 transition hover:border-[#333842] hover:text-white disabled:opacity-30"
							title="Move bucket down"
						>
							<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
							</svg>
						</button>
						<button
							type="button"
							on:click={() => {
								hideBucket(group.key);
								toastSuccess(`Hidden "${group.label}" from your view`);
							}}
							class="rounded-lg border border-[#262a30] bg-[#141619] p-1 text-gray-400 transition hover:border-amber-500/40 hover:text-amber-300"
							title="Hide bucket from your view"
						>
							<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
								/>
							</svg>
						</button>
					{/if}

					<button
						type="button"
						on:click={() => dispatch('addTask', group.key)}
						class="inline-flex items-center gap-1 rounded-lg border border-[#262a30] bg-[#141619] px-2.5 py-1 text-xs font-semibold text-lime-400 transition hover:border-lime-500/40 hover:bg-[#1f2329]"
					>
						<svg class="h-3.5 w-3.5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
						</svg>
						<span>Add task</span>
					</button>
				</div>
			</div>

			{#if group.tasks.length === 0}
				<div class="px-4 py-6 text-center text-xs text-gray-500">
					No tasks in {group.label}.
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="min-w-full divide-y divide-[#262a30] text-sm text-gray-200">
						<thead class="bg-[#141619] text-[11px] font-semibold uppercase tracking-wider text-gray-400">
							<tr>
								<th class="px-4 py-2.5 text-left">Task</th>
								<th class="px-4 py-2.5 text-left">Status</th>
								<th class="px-4 py-2.5 text-left">Progress</th>
								<th class="px-4 py-2.5 text-left">Assignee</th>
								<th class="px-4 py-2.5 text-left">
									<button
										type="button"
										on:click={() => toggleColumnSort('priority')}
										class="inline-flex items-center gap-1 uppercase tracking-wider transition hover:text-white {$sortBy.startsWith('priority_') ? 'text-lime-400' : 'text-gray-400'}"
									>
										<span>Priority</span>
										{#if $sortBy === 'priority_desc'}
											<span aria-hidden="true">↓</span>
										{:else if $sortBy === 'priority_asc'}
											<span aria-hidden="true">↑</span>
										{/if}
									</button>
								</th>
								<th class="px-4 py-2.5 text-left">
									<button
										type="button"
										on:click={() => toggleColumnSort('due_date')}
										class="inline-flex items-center gap-1 uppercase tracking-wider transition hover:text-white {$sortBy.startsWith('due_date_') ? 'text-lime-400' : 'text-gray-400'}"
									>
										<span>Due date</span>
										{#if $sortBy === 'due_date_asc'}
											<span aria-hidden="true">↑</span>
										{:else if $sortBy === 'due_date_desc'}
											<span aria-hidden="true">↓</span>
										{/if}
									</button>
								</th>
								<th class="px-4 py-2.5 text-left">
									<button
										type="button"
										on:click={() => toggleColumnSort('created_at')}
										class="inline-flex items-center gap-1 uppercase tracking-wider transition hover:text-white {$sortBy.startsWith('created_at_') ? 'text-lime-400' : 'text-gray-400'}"
									>
										<span>Added</span>
										{#if $sortBy === 'created_at_desc'}
											<span aria-hidden="true">↓</span>
										{:else if $sortBy === 'created_at_asc'}
											<span aria-hidden="true">↑</span>
										{/if}
									</button>
								</th>
								<th class="px-4 py-2.5 text-left">Latest note</th>
								<th class="px-4 py-2.5 text-right">Actions</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-[#262a30] bg-[#141619]">
							{#each group.tasks as task (task.id)}
								{@const subtasks = $subtasksByParentId[task.id] || []}
								{@const isNewAssigned =
									task.status !== 'Completed' &&
									isTaskAssignedToUser(task, $currentUser?.email, $userProfile?.firstName) &&
									!$seenTaskIds.has(task.id)}
								{@const progress = getTaskProgress(task.steps)}
								{@const dueDisplay = getDueDateDisplay(task.due_date, task.status)}
								{@const taskPhotos = (task.attachments || []).filter(isImageAttachment)}
								{@const rowAssignees = getTaskAssignees(task)}
								<tr
									on:click={() => dispatch('selectTask', task)}
									class="cursor-pointer transition-colors hover:bg-[#1b1f25]"
								>
									<!-- Task Title & Department -->
									<td class="px-4 py-3 font-semibold text-white">
										<div class="flex items-center gap-2">
											{#if subtasks.length > 0}
												<button
													type="button"
													on:click={(e) => toggleParentRow(task.id, e)}
													class="rounded p-0.5 text-gray-400 hover:bg-[#262a30] hover:text-white"
													title={collapsedParentIds.has(task.id) ? 'Expand subtasks' : 'Collapse subtasks'}
												>
													<svg
														class="h-4 w-4 transition-transform {!collapsedParentIds.has(task.id)
															? 'rotate-90'
															: ''}"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M9 5l7 7-7 7"
														/>
													</svg>
												</button>
											{/if}
											{#if isNewAssigned}
												<span
													class="relative flex h-2.5 w-2.5 flex-shrink-0 items-center justify-center"
													title="New task assigned to you"
												>
													<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
													<span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-red-500/30"></span>
												</span>
											{/if}
											<span>{task.title}</span>
											{#if subtasks.length > 0}
												<span
													class="inline-flex items-center rounded-full bg-[#20252e] px-2 py-0.5 text-[10px] font-semibold text-cyan-300"
												>
													{subtasks.filter((s) => s.status === 'Completed').length}/{subtasks.length} subtasks
												</span>
											{/if}
											{#if taskPhotos.length > 0}
												<button
													type="button"
													on:click|stopPropagation={() =>
														dispatch('openPhotos', { task, initialIndex: 0 })}
													class="inline-flex items-center gap-1 rounded bg-lime-500/10 px-1.5 py-0.5 text-xs font-semibold text-lime-400 hover:bg-lime-500/20 transition"
													title={`View ${taskPhotos.length} photo(s)`}
												>
													<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
														/>
													</svg>
													<span>{taskPhotos.length}</span>
												</button>
											{/if}
											{#if task.comment_count > 0}
												<span class="inline-flex items-center gap-1 text-xs font-normal text-gray-400">
													<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
														/>
													</svg>
													{task.comment_count}
												</span>
											{/if}
										</div>
									</td>

									<!-- Status Select -->
									<td class="px-4 py-3" on:click|stopPropagation>
										<div class="inline-flex items-center gap-1.5 rounded-lg border border-[#2a2f37] bg-[#181b20] px-2 py-1">
											<span class="h-2 w-2 rounded-full {STATUS_DOT_COLORS[task.status]}"></span>
											<select
												value={task.status}
												on:change={(e) =>
													dispatch('statusChange', {
														task,
														status: e.currentTarget.value as TaskStatus
													})}
												class="bg-transparent text-xs font-medium text-gray-200 focus:outline-none"
											>
												{#each TASK_STATUSES as st}
													<option value={st} class="bg-[#141619] text-gray-200">{st}</option>
												{/each}
											</select>
										</div>
									</td>

									<!-- Progress -->
									<td class="px-4 py-3">
										<div class="w-36">
											<div class="mb-1 flex justify-between text-[11px]">
												<span class="font-bold text-gray-200">{progress.percent}%</span>
												<span class="text-gray-400">{progress.completed}/{progress.total} steps</span>
											</div>
											<div class="h-1.5 w-full overflow-hidden rounded-full bg-[#262a30]">
												<div
													class="h-full rounded-full {getProgressBarColor(task.status)}"
													style="width: {progress.percent}%;"
												></div>
											</div>
										</div>
									</td>

									<!-- Assignee -->
									<td class="px-4 py-3">
										{#if rowAssignees.length > 1}
											<div class="flex items-center gap-2">
												<div class="flex items-center -space-x-1.5 overflow-hidden flex-shrink-0">
													{#each rowAssignees.slice(0, 3) as a (a.name)}
														<span
															class="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-extrabold ring-2 ring-[#141619] {getAvatarColorClasses(a.name)}"
															title={a.name}
														>
															{getInitials(a.name)}
														</span>
													{/each}
													{#if rowAssignees.length > 3}
														<span
															class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#2a2f37] text-[10px] font-bold text-gray-200 ring-2 ring-[#141619]"
															title={`+${rowAssignees.length - 3} more`}
														>
															+{rowAssignees.length - 3}
														</span>
													{/if}
												</div>
												<span
													class="truncate text-xs font-medium text-gray-200"
													title={rowAssignees.map((a) => a.name).join(', ')}
												>
													{rowAssignees.map((a) => a.name).join(', ')}
												</span>
											</div>
										{:else if rowAssignees.length === 1}
											<div class="flex items-center gap-2">
												<span
													class="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-extrabold {getAvatarColorClasses(rowAssignees[0].name)}"
													title={rowAssignees[0].name}
												>
													{getInitials(rowAssignees[0].name)}
												</span>
												<span class="text-xs font-medium text-gray-200">{rowAssignees[0].name}</span>
											</div>
										{:else}
											<span class="text-xs text-gray-500 italic">Unassigned</span>
										{/if}
									</td>

									<!-- Priority / Done -->
									<td class="px-4 py-3">
										{#if task.status === 'Completed'}
											<span class="rounded-md border border-lime-500/40 bg-lime-950/30 px-2 py-0.5 text-[11px] font-semibold text-lime-400">
												Done
											</span>
										{:else if task.priority === 'High' || task.priority === 'Urgent'}
											<span class="rounded-md border border-red-500/40 bg-red-950/30 px-2 py-0.5 text-[11px] font-semibold text-red-400">
												{task.priority}
											</span>
										{:else}
											<span class="rounded-md border border-[#333842] bg-[#181b20] px-2 py-0.5 text-[11px] text-gray-300">
												{task.priority}
											</span>
										{/if}
									</td>

									<!-- Due Date -->
									<td class="px-4 py-3">
										<span
											class="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium {dueDisplay.borderClass} {dueDisplay.textClass}"
										>
											{dueDisplay.label}
										</span>
									</td>

									<!-- Added (Date/Time Created) -->
									<td class="whitespace-nowrap px-4 py-3 text-xs text-gray-400">
										{formatDateTimeShort(task.created_at)}
									</td>

									<!-- Latest Note -->
									<td class="px-4 py-3 text-xs text-gray-400">
										{formatShortDate(task.latest_note_at || task.updated_at)}
									</td>

									<!-- Actions -->
									<td class="px-4 py-3 text-right" on:click|stopPropagation>
										<div class="inline-flex items-center gap-1.5">
											<button
												type="button"
												on:click={() => dispatch('addSubtask', task)}
												class="rounded-lg border border-[#262a30] bg-[#181b20] px-2 py-1 text-xs font-semibold text-lime-400 hover:border-lime-500/40 hover:bg-[#1e2329]"
												title="Add subtask"
											>
												+ Subtask
											</button>
											<button
												type="button"
												on:click={() => dispatch('deleteTask', task)}
												class="rounded-lg border border-red-500/30 bg-red-950/20 px-2.5 py-1 text-xs font-semibold text-red-400 transition hover:bg-red-900/40"
											>
												Delete
											</button>
										</div>
									</td>
								</tr>

								<!-- Expandable Indented Subtask Rows -->
								{#if subtasks.length > 0 && !collapsedParentIds.has(task.id)}
									{#each subtasks as sub (sub.id)}
										{@const subProgress = getTaskProgress(sub.steps)}
										{@const subDueDisplay = getDueDateDisplay(sub.due_date, sub.status)}
										{@const subAssignees = getTaskAssignees(sub)}
										<tr
											on:click={() => dispatch('selectTask', sub)}
											class="cursor-pointer border-t border-[#1e2229] bg-[#101216]/90 transition-colors hover:bg-[#15181e]"
										>
											<!-- Subtask Title Indented -->
											<td class="py-2.5 pl-10 pr-4 font-medium text-gray-200">
												<div class="flex items-center gap-2">
													<span class="text-xs text-gray-500">↳</span>
													<span class="text-xs {sub.status === 'Completed' ? 'line-through text-gray-500' : 'text-gray-100'}">
														{sub.title}
													</span>
												</div>
											</td>

											<!-- Subtask Status -->
											<td class="px-4 py-2.5" on:click|stopPropagation>
												<div class="inline-flex items-center gap-1 rounded border border-[#2a2f37] bg-[#141619] px-2 py-0.5">
													<span class="h-1.5 w-1.5 rounded-full {STATUS_DOT_COLORS[sub.status]}"></span>
													<select
														value={sub.status}
														on:change={(e) =>
															dispatch('statusChange', {
																task: sub,
																status: e.currentTarget.value as TaskStatus
															})}
														class="bg-transparent text-[11px] font-medium text-gray-200 focus:outline-none"
													>
														{#each TASK_STATUSES as st}
															<option value={st} class="bg-[#141619] text-gray-200">{st}</option>
														{/each}
													</select>
												</div>
											</td>

											<!-- Subtask Progress -->
											<td class="px-4 py-2.5">
												<div class="w-28">
													<div class="mb-0.5 flex justify-between text-[10px]">
														<span class="font-bold text-gray-300">{subProgress.percent}%</span>
														<span class="text-gray-500">{subProgress.completed}/{subProgress.total}</span>
													</div>
													<div class="h-1 w-full overflow-hidden rounded-full bg-[#262a30]">
														<div
															class="h-full rounded-full {getProgressBarColor(sub.status)}"
															style="width: {subProgress.percent}%;"
														></div>
													</div>
												</div>
											</td>

											<!-- Subtask Assignee -->
											<td class="px-4 py-2.5">
												{#if subAssignees.length > 0}
													<span class="text-[11px] text-gray-300">
														{subAssignees.map((a) => a.name).join(', ')}
													</span>
												{:else}
													<span class="text-[11px] text-gray-500 italic">Unassigned</span>
												{/if}
											</td>

											<!-- Subtask Priority -->
											<td class="px-4 py-2.5">
												<span class="text-[10px] text-gray-400">
													{sub.priority}
												</span>
											</td>

											<!-- Subtask Due Date -->
											<td class="px-4 py-2.5">
												<span class="text-[10px] {subDueDisplay.textClass}">
													{subDueDisplay.label}
												</span>
											</td>

											<!-- Added -->
											<td class="whitespace-nowrap px-4 py-2.5 text-[11px] text-gray-500">
												{formatDateTimeShort(sub.created_at)}
											</td>

											<!-- Note -->
											<td class="px-4 py-2.5 text-[11px] text-gray-500">
												{formatShortDate(sub.latest_note_at || sub.updated_at)}
											</td>

											<!-- Subtask Actions: Swap, Promote, Delete -->
											<td class="px-4 py-2.5 text-right" on:click|stopPropagation>
												<div class="inline-flex items-center gap-1">
													<button
														type="button"
														on:click={async () => {
															try {
																await swapParentAndSubtask(task.id, sub.id);
																toastSuccess(`Swapped "${sub.title}" as parent task`);
															} catch (err: any) {
																toastError(err?.message || 'Failed to swap');
															}
														}}
														class="rounded border border-[#2a2f37] bg-[#181b20] px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300 hover:border-cyan-500/40"
														title="Swap with parent task"
													>
														⇄ Swap
													</button>
													<button
														type="button"
														on:click={async () => {
															try {
																await promoteSubtaskToParent(sub.id);
																toastSuccess(`"${sub.title}" is now standalone`);
															} catch (err: any) {
																toastError(err?.message || 'Failed to promote');
															}
														}}
														class="rounded border border-[#2a2f37] bg-[#181b20] px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 hover:border-amber-500/40"
														title="Promote to standalone task"
													>
														↑ Detach
													</button>
													<button
														type="button"
														on:click={() => dispatch('deleteTask', sub)}
														class="rounded px-1.5 py-0.5 text-[10px] font-semibold text-red-400 hover:bg-red-950/30"
														title="Delete subtask"
													>
														✕
													</button>
												</div>
											</td>
										</tr>
									{/each}
								{/if}
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/each}

	{#if $groupBy === 'department'}
		<div class="pt-2">
			<button
				type="button"
				on:click={() => dispatch('addBucket')}
				class="inline-flex items-center gap-2 rounded-xl border border-dashed border-[#262a30] bg-[#141619]/40 px-4 py-3 text-xs font-semibold text-gray-300 transition hover:border-lime-500/50 hover:bg-[#141619] hover:text-lime-400"
			>
				<svg class="h-4 w-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
				</svg>
				<span>Add bucket / department</span>
			</button>
		</div>
	{/if}
</div>
