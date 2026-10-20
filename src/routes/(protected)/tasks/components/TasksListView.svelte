<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { groupedTasks, groupBy } from '../stores';
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
		isImageAttachment
	} from '../types';

	const dispatch = createEventDispatcher<{
		addTask: string;
		selectTask: TaskItem;
		statusChange: { task: TaskItem; status: TaskStatus };
		deleteTask: TaskItem;
		addBucket: void;
		openPhotos: { task: TaskItem; initialIndex: number };
	}>();
</script>

<div class="space-y-6">
	{#each $groupedTasks as group (group.key)}
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
								<th class="px-4 py-2.5 text-left">Priority</th>
								<th class="px-4 py-2.5 text-left">Due date</th>
								<th class="px-4 py-2.5 text-left">Latest note</th>
								<th class="px-4 py-2.5 text-right">Actions</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-[#262a30] bg-[#141619]">
							{#each group.tasks as task (task.id)}
								{@const progress = getTaskProgress(task.steps)}
								{@const dueDisplay = getDueDateDisplay(task.due_date, task.status)}
								{@const taskPhotos = (task.attachments || []).filter(isImageAttachment)}
								<tr
									on:click={() => dispatch('selectTask', task)}
									class="cursor-pointer transition-colors hover:bg-[#1b1f25]"
								>
									<!-- Task Title & Department -->
									<td class="px-4 py-3 font-semibold text-white">
										<div class="flex items-center gap-2">
											<span>{task.title}</span>
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
										<div class="flex items-center gap-2">
											<span
												class="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-extrabold {getAvatarColorClasses(task.assignee_name)}"
											>
												{getInitials(task.assignee_name)}
											</span>
											<span class="text-xs font-medium text-gray-200">{task.assignee_name}</span>
										</div>
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

									<!-- Latest Note -->
									<td class="px-4 py-3 text-xs text-gray-400">
										{formatShortDate(task.latest_note_at || task.updated_at)}
									</td>

									<!-- Actions -->
									<td class="px-4 py-3 text-right" on:click|stopPropagation>
										<button
											type="button"
											on:click={() => dispatch('deleteTask', task)}
											class="rounded-lg border border-red-500/30 bg-red-950/20 px-2.5 py-1 text-xs font-semibold text-red-400 transition hover:bg-red-900/40"
										>
											Delete
										</button>
									</td>
								</tr>
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
