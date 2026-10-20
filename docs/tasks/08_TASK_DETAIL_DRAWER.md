# Subphase 8: Task Detail Modal / Drawer (`TaskDetailModal.svelte`)

## Goal for the Model
Create `src/routes/(protected)/tasks/components/TaskDetailModal.svelte` so clicking any task card on the Kanban board or row in the List view opens an interactive detail drawer/modal where users can:
1. Edit task metadata (`Title`, `Description`, `Status`, `Department`, `Priority`, `Assignee`, `Due date`).
2. Check/uncheck **Checklist steps** with live progress bar recalculation (`X% · Y of Z steps`), add new steps, and delete steps.
3. Update the **Latest note** (which automatically updates `Latest note · DD MMM` on the card).
4. View/upload **Attachments**.
5. View and post **Comments** (which automatically updates the comment count bubble on the card).

## Context Files to Read First
1. [`src/routes/(protected)/tasks/types.ts`](../../src/routes/%28protected%29/tasks/types.ts)
2. [`src/routes/(protected)/tasks/tasksService.ts`](../../src/routes/%28protected%29/tasks/tasksService.ts)
3. [`src/routes/(protected)/tasks/+page.svelte`](../../src/routes/%28protected%29/tasks/+page.svelte)

## Files to Create / Modify in This Subphase
- **Create**: `src/routes/(protected)/tasks/components/TaskDetailModal.svelte`
- **Modify**: `src/routes/(protected)/tasks/+page.svelte`

---

## Step 8.1: Create `src/routes/(protected)/tasks/components/TaskDetailModal.svelte`

Create [`src/routes/(protected)/tasks/components/TaskDetailModal.svelte`](../../src/routes/%28protected%29/tasks/components/TaskDetailModal.svelte):

```svelte
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { currentUser } from '$lib/firebase';
	import { userProfile } from '$lib/userProfile';
	import { availableAssignees } from '../stores';
	import {
		updateTaskFields,
		toggleStepCompletion,
		addStepToTask,
		deleteStepFromTask,
		fetchCommentsForTask,
		addCommentToTask,
		uploadTaskAttachments
	} from '../tasksService';
	import { toastSuccess, toastError } from '$lib/utils/toast';
	import {
		type TaskItem,
		type TaskComment,
		type TaskStep,
		type TaskStatus,
		type TaskDepartment,
		type TaskPriority,
		TASK_DEPARTMENTS,
		TASK_STATUSES,
		TASK_PRIORITIES,
		STATUS_DOT_COLORS,
		getTaskProgress,
		getProgressBarColor,
		formatShortDate
	} from '../types';

	export let task: TaskItem | null = null;

	const dispatch = createEventDispatcher<{
		close: void;
		updated: TaskItem;
		delete: TaskItem;
	}>();

	let comments: TaskComment[] = [];
	let isLoadingComments = false;
	let newCommentText = '';
	let newStepLabel = '';
	let noteDraft = '';
	let isSavingNote = false;
	let fileInputEl: HTMLInputElement;
	let lastLoadedTaskId: string | null = null;

	$: if (task && task.id !== lastLoadedTaskId) {
		lastLoadedTaskId = task.id;
		noteDraft = task.latest_note || '';
		loadComments(task.id);
	}

	$: if (!task) {
		lastLoadedTaskId = null;
	}

	$: progress = getTaskProgress(task?.steps || []);

	async function loadComments(taskId: string) {
		isLoadingComments = true;
		try {
			comments = await fetchCommentsForTask(taskId);
		} catch (err) {
			console.error('Error loading comments:', err);
		} finally {
			isLoadingComments = false;
		}
	}

	async function handleFieldUpdate(updates: Partial<TaskItem>) {
		if (!task) return;
		const updatedTask: TaskItem = { ...task, ...updates };
		task = updatedTask;
		dispatch('updated', updatedTask);

		try {
			await updateTaskFields(task.id, updates);
		} catch (err) {
			toastError('Failed to save changes');
		}
	}

	async function handleSaveNote() {
		if (!task) return;
		isSavingNote = true;
		const nowIso = new Date().toISOString();
		try {
			await updateTaskFields(task.id, {
				latest_note: noteDraft.trim() || null,
				latest_note_at: nowIso
			});
			task = {
				...task,
				latest_note: noteDraft.trim() || null,
				latest_note_at: nowIso
			};
			dispatch('updated', task);
			toastSuccess('Latest note updated');
		} catch (err) {
			toastError('Failed to save note');
		} finally {
			isSavingNote = false;
		}
	}

	async function handleToggleStep(step: TaskStep) {
		if (!task) return;
		const nextState = !step.is_completed;
		const updatedSteps = task.steps.map((s) =>
			s.id === step.id ? { ...s, is_completed: nextState } : s
		);
		task = { ...task, steps: updatedSteps };
		dispatch('updated', task);

		try {
			await toggleStepCompletion(step.id, nextState);
		} catch (err) {
			toastError('Failed to update step');
		}
	}

	async function handleAddStep() {
		if (!task || !newStepLabel.trim()) return;
		try {
			const createdStep = await addStepToTask(
				task.id,
				newStepLabel.trim(),
				task.steps.length + 1
			);
			newStepLabel = '';
			task = { ...task, steps: [...task.steps, createdStep] };
			dispatch('updated', task);
		} catch (err) {
			toastError('Failed to add step');
		}
	}

	async function handleDeleteStep(stepId: string) {
		if (!task) return;
		try {
			await deleteStepFromTask(stepId);
			task = { ...task, steps: task.steps.filter((s) => s.id !== stepId) };
			dispatch('updated', task);
		} catch (err) {
			toastError('Failed to delete step');
		}
	}

	async function handleUploadFiles(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		if (!task || !input.files || input.files.length === 0) return;
		const files = Array.from(input.files);
		input.value = '';
		try {
			const uploaded = await uploadTaskAttachments(task.id, files);
			if (uploaded.length > 0) {
				task = { ...task, attachments: [...task.attachments, ...uploaded] };
				dispatch('updated', task);
				toastSuccess('Attachment uploaded');
			}
		} catch (err) {
			toastError('Failed to upload attachment');
		}
	}

	async function handlePostComment() {
		if (!task || !newCommentText.trim()) return;
		const authorName =
			$userProfile?.firstName ||
			$currentUser?.email?.split('@')[0] ||
			'Team Member';
		const authorEmail = $currentUser?.email || null;

		try {
			const created = await addCommentToTask(
				task.id,
				authorName,
				authorEmail,
				newCommentText.trim()
			);
			comments = [...comments, created];
			newCommentText = '';
			task = { ...task, comment_count: (task.comment_count || 0) + 1 };
			dispatch('updated', task);
		} catch (err) {
			toastError('Failed to post comment');
		}
	}
</script>

{#if task}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		on:click={() => dispatch('close')}
		class="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm"
	>
		<!-- Right Slide-Over Panel -->
		<div
			on:click|stopPropagation
			class="flex h-full w-full max-w-xl flex-col border-l border-[#262a30] bg-[#141619] text-gray-200 shadow-2xl"
		>
			<!-- Header -->
			<div class="flex items-start justify-between border-b border-[#262a30] px-6 py-4">
				<div class="flex-1 pr-4">
					<input
						type="text"
						value={task.title}
						on:change={(e) => handleFieldUpdate({ title: e.currentTarget.value })}
						class="w-full rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-lg font-bold text-white focus:border-lime-500 focus:bg-[#181b20] focus:outline-none"
					/>
					<p class="mt-0.5 px-1 text-xs text-gray-400">
						{task.department} &middot; Created {formatShortDate(task.created_at)}
					</p>
				</div>

				<div class="flex items-center gap-2">
					<button
						type="button"
						on:click={() => task && dispatch('delete', task)}
						class="rounded-lg border border-red-500/30 bg-red-950/20 px-2.5 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-900/40"
					>
						Delete
					</button>
					<button
						type="button"
						on:click={() => dispatch('close')}
						class="rounded-lg p-1.5 text-gray-400 transition hover:bg-[#1f2329] hover:text-gray-200"
						aria-label="Close panel"
					>
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			</div>

			<!-- Scrollable Body -->
			<div class="flex-1 space-y-6 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-[#262a30]">
				<!-- Metadata 2x2 Grid -->
				<div class="grid grid-cols-2 gap-3">
					<!-- Status -->
					<div>
						<label class="mb-1 block text-xs font-medium text-gray-400">Status</label>
						<div class="relative">
							<span
								class="pointer-events-none absolute left-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full {STATUS_DOT_COLORS[task.status]}"
							></span>
							<select
								value={task.status}
								on:change={(e) =>
									handleFieldUpdate({ status: e.currentTarget.value as TaskStatus })}
								class="w-full rounded-lg border border-[#2a2f37] bg-[#181b20] py-2 pl-7 pr-3 text-xs font-medium text-gray-100 focus:border-lime-500 focus:outline-none"
							>
								{#each TASK_STATUSES as st}
									<option value={st}>{st}</option>
								{/each}
							</select>
						</div>
					</div>

					<!-- Department -->
					<div>
						<label class="mb-1 block text-xs font-medium text-gray-400">Department</label>
						<select
							value={task.department}
							on:change={(e) =>
								handleFieldUpdate({ department: e.currentTarget.value as TaskDepartment })}
							class="w-full rounded-lg border border-[#2a2f37] bg-[#181b20] px-3 py-2 text-xs font-medium text-gray-100 focus:border-lime-500 focus:outline-none"
						>
							{#each TASK_DEPARTMENTS as dept}
								<option value={dept}>{dept}</option>
							{/each}
						</select>
					</div>

					<!-- Assignee -->
					<div>
						<label class="mb-1 block text-xs font-medium text-gray-400">Assignee</label>
						<select
							value={task.assignee_name}
							on:change={(e) =>
								handleFieldUpdate({ assignee_name: e.currentTarget.value })}
							class="w-full rounded-lg border border-[#2a2f37] bg-[#181b20] px-3 py-2 text-xs font-medium text-gray-100 focus:border-lime-500 focus:outline-none"
						>
							{#each $availableAssignees as person}
								<option value={person}>{person}</option>
							{/each}
						</select>
					</div>

					<!-- Priority & Due Date -->
					<div class="grid grid-cols-2 gap-2">
						<div>
							<label class="mb-1 block text-xs font-medium text-gray-400">Priority</label>
							<select
								value={task.priority}
								on:change={(e) =>
									handleFieldUpdate({ priority: e.currentTarget.value as TaskPriority })}
								class="w-full rounded-lg border border-[#2a2f37] bg-[#181b20] px-2.5 py-2 text-xs font-medium text-gray-100 focus:border-lime-500 focus:outline-none"
							>
								{#each TASK_PRIORITIES as p}
									<option value={p}>{p}</option>
								{/each}
							</select>
						</div>
						<div>
							<label class="mb-1 block text-xs font-medium text-gray-400">Due date</label>
							<input
								type="date"
								value={task.due_date}
								on:change={(e) => handleFieldUpdate({ due_date: e.currentTarget.value })}
								class="w-full rounded-lg border border-[#2a2f37] bg-[#181b20] px-2 py-2 text-xs text-gray-100 focus:border-lime-500 focus:outline-none [color-scheme:dark]"
							/>
						</div>
					</div>
				</div>

				<!-- Description -->
				<div>
					<label class="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">
						Description
					</label>
					<textarea
						rows="2"
						value={task.description || ''}
						placeholder="Add task description..."
						on:change={(e) =>
							handleFieldUpdate({ description: e.currentTarget.value || null })}
						class="w-full rounded-lg border border-[#2a2f37] bg-[#181b20] px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-lime-500 focus:outline-none"
					></textarea>
				</div>

				<!-- Checklist Steps -->
				<div class="rounded-xl border border-[#262a30] bg-[#181b20] p-4">
					<div class="mb-2 flex items-center justify-between">
						<span class="text-sm font-bold text-white">Checklist</span>
						<span class="text-xs font-semibold text-gray-300">
							{progress.percent}% &middot; {progress.completed} of {progress.total} steps
						</span>
					</div>
					<div class="mb-4 h-2 w-full overflow-hidden rounded-full bg-[#262a30]">
						<div
							class="h-full rounded-full transition-all duration-300 {getProgressBarColor(task.status)}"
							style="width: {progress.percent}%;"
						></div>
					</div>

					<div class="space-y-2">
						{#each task.steps as step (step.id)}
							<div class="flex items-center justify-between gap-2 rounded-lg bg-[#141619] px-3 py-2">
								<label class="flex flex-1 cursor-pointer items-center gap-2.5 text-sm">
									<input
										type="checkbox"
										checked={step.is_completed}
										on:change={() => handleToggleStep(step)}
										class="h-4 w-4 rounded border-[#333842] bg-[#0e1012] text-lime-500 focus:ring-lime-500"
									/>
									<span class={step.is_completed ? 'line-through text-gray-500' : 'text-gray-200'}>
										{step.label}
									</span>
								</label>
								<button
									type="button"
									on:click={() => handleDeleteStep(step.id)}
									class="text-gray-500 hover:text-red-400"
								>
									&times;
								</button>
							</div>
						{/each}
					</div>

					<!-- Add Step Input -->
					<div class="mt-3 flex gap-2">
						<input
							type="text"
							bind:value={newStepLabel}
							on:keydown={(e) => e.key === 'Enter' && handleAddStep()}
							placeholder="Add a step..."
							class="flex-1 rounded-lg border border-[#2a2f37] bg-[#141619] px-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:border-lime-500 focus:outline-none"
						/>
						<button
							type="button"
							on:click={handleAddStep}
							class="rounded-lg bg-lime-400 px-3 py-1.5 text-xs font-semibold text-gray-950 hover:bg-lime-300"
						>
							Add step
						</button>
					</div>
				</div>

				<!-- Latest Note -->
				<div class="rounded-xl border border-[#262a30] bg-[#181b20] p-4">
					<div class="mb-2 flex items-center justify-between">
						<span class="text-sm font-bold text-white">Latest Note</span>
						{#if task.latest_note_at}
							<span class="text-xs text-gray-400">{formatShortDate(task.latest_note_at)}</span>
						{/if}
					</div>
					<textarea
						rows="2"
						bind:value={noteDraft}
						placeholder="Write a status note..."
						class="w-full rounded-lg border border-[#2a2f37] bg-[#141619] px-3 py-2 text-xs text-gray-200 placeholder-gray-500 focus:border-lime-500 focus:outline-none"
					></textarea>
					<div class="mt-2 flex justify-end">
						<button
							type="button"
							on:click={handleSaveNote}
							disabled={isSavingNote}
							class="rounded-lg border border-lime-500/40 bg-lime-500/10 px-3 py-1 text-xs font-semibold text-lime-400 hover:bg-lime-500/20"
						>
							{isSavingNote ? 'Saving...' : 'Update note'}
						</button>
					</div>
				</div>

				<!-- Attachments -->
				<div class="rounded-xl border border-[#262a30] bg-[#181b20] p-4">
					<div class="mb-2 flex items-center justify-between">
						<span class="text-sm font-bold text-white">
							Attachments ({task.attachments?.length || 0})
						</span>
						<input
							bind:this={fileInputEl}
							type="file"
							multiple
							on:change={handleUploadFiles}
							class="hidden"
						/>
						<button
							type="button"
							on:click={() => fileInputEl?.click()}
							class="text-xs font-semibold text-lime-400 hover:text-lime-300"
						>
							+ Upload file
						</button>
					</div>
					{#if task.attachments && task.attachments.length > 0}
						<div class="space-y-1.5">
							{#each task.attachments as att (att.id)}
								<a
									href={att.public_url}
									target="_blank"
									rel="noopener noreferrer"
									class="flex items-center justify-between rounded-lg bg-[#141619] px-3 py-2 text-xs text-lime-400 hover:underline"
								>
									<span class="truncate">{att.file_name}</span>
								</a>
							{/each}
						</div>
					{:else}
						<p class="text-xs text-gray-500">No attachments yet.</p>
					{/if}
				</div>

				<!-- Comments Thread -->
				<div class="rounded-xl border border-[#262a30] bg-[#181b20] p-4">
					<h4 class="mb-3 text-sm font-bold text-white">
						Comments ({comments.length})
					</h4>

					{#if isLoadingComments}
						<p class="text-xs text-gray-500">Loading comments...</p>
					{:else if comments.length === 0}
						<p class="mb-3 text-xs text-gray-500">No comments yet.</p>
					{:else}
						<div class="mb-4 space-y-2.5">
							{#each comments as comment (comment.id)}
								<div class="rounded-lg bg-[#141619] p-3">
									<div class="mb-1 flex items-center justify-between text-[11px]">
										<span class="font-bold text-lime-400">{comment.author_name}</span>
										<span class="text-gray-500">{formatShortDate(comment.created_at)}</span>
									</div>
									<p class="text-xs text-gray-200">{comment.content}</p>
								</div>
							{/each}
						</div>
					{/if}

					<div class="flex gap-2">
						<input
							type="text"
							bind:value={newCommentText}
							on:keydown={(e) => e.key === 'Enter' && handlePostComment()}
							placeholder="Write a comment..."
							class="flex-1 rounded-lg border border-[#2a2f37] bg-[#141619] px-3 py-2 text-xs text-gray-200 placeholder-gray-500 focus:border-lime-500 focus:outline-none"
						/>
						<button
							type="button"
							on:click={handlePostComment}
							class="rounded-lg bg-lime-400 px-3.5 py-2 text-xs font-semibold text-gray-950 hover:bg-lime-300"
						>
							Post
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
```

---

## Step 8.2: Wire `TaskDetailModal` into `src/routes/(protected)/tasks/+page.svelte`

Update [`src/routes/(protected)/tasks/+page.svelte`](../../src/routes/%28protected%29/tasks/+page.svelte) to import `TaskDetailModal` and synchronize updates back into the `$tasks` store:

```svelte
<!-- Add import in <script lang="ts">: -->
import TaskDetailModal from './components/TaskDetailModal.svelte';

function handleTaskUpdated(event: CustomEvent<TaskItem>) {
	const updated = event.detail;
	selectedTask = updated;
	tasks.update((list) => list.map((t) => (t.id === updated.id ? updated : t)));
}
```

And at the bottom of `+page.svelte` (right below `<CreateTaskModal ... />`):

```svelte
<TaskDetailModal
	task={selectedTask}
	on:close={() => (selectedTask = null)}
	on:updated={handleTaskUpdated}
	on:delete={(e) => handleDeleteTask(e.detail)}
/>
```

---

## Definition of Done (Subphase 8)
- [ ] Clicking any `TaskCard` or row in `TasksListView` opens `TaskDetailModal.svelte`.
- [ ] Checking/unchecking steps immediately updates the progress bar on both the detail drawer and the underlying Kanban card.
- [ ] Updating the note and posting comments immediately updates `Latest note · DD MMM` and the comment counter on the card.
