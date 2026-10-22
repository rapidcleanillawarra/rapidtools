<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { currentUser } from '$lib/firebase';
	import { userProfile } from '$lib/userProfile';
	import {
		tasks,
		availableAssignees,
		allDepartments,
		addDepartment,
		subtasksByParentId,
		assignTaskParent,
		promoteSubtaskToParent,
		swapParentAndSubtask
	} from '../stores';
	import TaskPhotoViewer from './TaskPhotoViewer.svelte';
	import AssigneeSelect from './AssigneeSelect.svelte';
	import {
		createTaskRecord,
		updateTaskFields,
		toggleStepCompletion,
		addStepToTask,
		deleteStepFromTask,
		fetchCommentsForTask,
		addCommentToTask,
		fetchNotesForTask,
		addNoteToTask,
		deleteNoteFromTask,
		uploadTaskAttachments,
		deleteTaskAttachment
	} from '../tasksService';
	import { toastSuccess, toastError } from '$lib/utils/toast';
	import {
		type TaskItem,
		type TaskComment,
		type TaskNote,
		type TaskStep,
		type TaskAttachment,
		type TaskPhoto,
		type TaskStatus,
		type TaskDepartment,
		type TaskPriority,
		type TaskAssignee,
		TASK_DEPARTMENTS,
		TASK_STATUSES,
		TASK_PRIORITIES,
		STATUS_DOT_COLORS,
		getTaskProgress,
		getSubtaskProgress,
		getValidParentTasks,
		getProgressBarColor,
		formatShortDate,
		isImageAttachment,
		formatByteSize,
		getTaskAssignees
	} from '../types';

	export let task: TaskItem | null = null;

	const dispatch = createEventDispatcher<{
		close: void;
		updated: TaskItem;
		delete: TaskItem;
		selectTask: TaskItem;
	}>();

	let newSubtaskTitle = '';
	let isCreatingSubtask = false;
	let existingTaskToAttachId = '';
	let movingSubtaskId: string | null = null;

	$: subtasks = task ? $subtasksByParentId[task.id] || [] : [];
	$: subtaskProgress = getSubtaskProgress(subtasks);
	$: parentTask =
		task?.parent_task_id ? $tasks.find((t) => t.id === task?.parent_task_id) || null : null;
	$: validParentOptions = task ? getValidParentTasks($tasks, task.id) : [];
	$: attachableTasks = task
		? $tasks.filter(
				(t) =>
					t.id !== task!.id &&
					t.parent_task_id !== task!.id &&
					t.id !== task!.parent_task_id
			)
		: [];

	async function handleParentSelectChange(newParentId: string) {
		if (!task) return;
		const resolved = newParentId || null;
		try {
			await assignTaskParent(task.id, resolved);
			task = { ...task, parent_task_id: resolved };
			dispatch('updated', task);
			toastSuccess(resolved ? 'Moved task to new parent' : 'Promoted to standalone task');
		} catch (err: any) {
			toastError(err?.message || 'Failed to change parent task');
		}
	}

	async function handleInterchangeWithParent() {
		if (!task || !task.parent_task_id) return;
		const oldParentId = task.parent_task_id;
		try {
			await swapParentAndSubtask(oldParentId, task.id);
			const refreshed = $tasks.find((t) => t.id === task!.id);
			if (refreshed) {
				task = refreshed;
				dispatch('updated', refreshed);
			}
			toastSuccess('Interchanged parent and child task');
		} catch (err: any) {
			toastError(err?.message || 'Failed to swap with parent');
		}
	}

	async function handleInterchangeWithChild(child: TaskItem) {
		if (!task) return;
		try {
			await swapParentAndSubtask(task.id, child.id);
			const refreshed = $tasks.find((t) => t.id === task!.id);
			if (refreshed) {
				task = refreshed;
				dispatch('updated', refreshed);
			}
			toastSuccess(`"${child.title}" is now the parent task`);
		} catch (err: any) {
			toastError(err?.message || 'Failed to swap with subtask');
		}
	}

	async function handleQuickAddSubtask() {
		if (!task || !newSubtaskTitle.trim()) return;
		isCreatingSubtask = true;
		try {
			const created = await createTaskRecord({
				parent_task_id: task.id,
				title: newSubtaskTitle.trim(),
				department: task.department,
				status: 'To do',
				priority: task.priority,
				assignees: currentAssignees,
				assignee_uid: task.assignee_uid,
				assignee_name: task.assignee_name,
				assignee_email: task.assignee_email,
				due_date: task.due_date,
				steps: []
			});
			tasks.update((list) => [created, ...list]);
			newSubtaskTitle = '';
			toastSuccess('Subtask created');
		} catch (err) {
			toastError('Failed to create subtask');
		} finally {
			isCreatingSubtask = false;
		}
	}

	async function handleAttachExistingSubtask() {
		if (!task || !existingTaskToAttachId) return;
		try {
			await assignTaskParent(existingTaskToAttachId, task.id);
			existingTaskToAttachId = '';
			toastSuccess('Task attached as subtask');
		} catch (err: any) {
			toastError(err?.message || 'Failed to attach task');
		}
	}

	let comments: TaskComment[] = [];
	let isLoadingComments = false;
	let newCommentText = '';
	let notes: TaskNote[] = [];
	let isLoadingNotes = false;
	let newNoteText = '';
	let isPostingNote = false;
	let newStepLabel = '';
	let fileInputEl: HTMLInputElement;
	let lastLoadedTaskId: string | null = null;
	let isCreatingDept = false;
	let newDeptInput = '';
	let photoViewerOpen = false;
	let photoViewerIndex = 0;
	let isDeletingAttachmentId: string | null = null;

	$: imageAttachments = (task?.attachments || []).filter(isImageAttachment);
	$: otherAttachments = (task?.attachments || []).filter((att) => !isImageAttachment(att));
	$: currentAssignees = task ? getTaskAssignees(task) : [];
	$: viewerPhotos = imageAttachments.map((att) => ({
		id: att.id,
		url: att.public_url || '',
		name: att.file_name,
		byte_size: att.byte_size,
		created_at: att.created_at
	}));

	function openPhotoViewerAtIndex(idx: number) {
		photoViewerIndex = Math.max(0, Math.min(idx, viewerPhotos.length - 1));
		photoViewerOpen = true;
	}

	async function handleDeleteAttachment(att: TaskAttachment) {
		if (!task) return;
		if (!confirm(`Delete "${att.file_name}"?`)) return;

		isDeletingAttachmentId = att.id;
		try {
			await deleteTaskAttachment(att.id, att.storage_path);
			const nextAttachments = (task.attachments || []).filter((a) => a.id !== att.id);
			task = { ...task, attachments: nextAttachments };
			dispatch('updated', task);
			toastSuccess('Attachment deleted');
			if (photoViewerOpen && viewerPhotos.length === 0) {
				photoViewerOpen = false;
			}
		} catch (err) {
			console.error('Failed to delete attachment:', err);
			toastError('Failed to delete attachment');
		} finally {
			isDeletingAttachmentId = null;
		}
	}

	function handlePhotoViewerDelete(e: CustomEvent<{ photo: TaskPhoto; index: number }>) {
		const targetPhoto = e.detail.photo;
		const matchedAtt = task?.attachments?.find((a) => a.id === targetPhoto.id);
		if (matchedAtt) {
			handleDeleteAttachment(matchedAtt);
		}
	}

	$: if (task && task.id !== lastLoadedTaskId) {
		lastLoadedTaskId = task.id;
		isCreatingDept = false;
		newDeptInput = '';
		newNoteText = '';
		loadComments(task.id);
		loadNotes(task.id);
	}

	$: if (!task) {
		lastLoadedTaskId = null;
		isCreatingDept = false;
		newDeptInput = '';
		newNoteText = '';
		notes = [];
		comments = [];
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

	async function loadNotes(taskId: string) {
		isLoadingNotes = true;
		try {
			const fetched = await fetchNotesForTask(taskId);
			if (fetched.length === 0 && task?.latest_note) {
				notes = [
					{
						id: 'legacy-latest-note',
						task_id: taskId,
						author_name: task.assigned_by_email?.split('@')[0] || 'Note',
						author_email: task.assigned_by_email || null,
						content: task.latest_note,
						created_at: task.latest_note_at || task.created_at
					}
				];
			} else {
				notes = fetched;
			}
		} catch (err) {
			console.error('Error loading notes:', err);
			if (task?.latest_note) {
				notes = [
					{
						id: 'legacy-latest-note',
						task_id: taskId,
						author_name: task.assigned_by_email?.split('@')[0] || 'Note',
						author_email: task.assigned_by_email || null,
						content: task.latest_note,
						created_at: task.latest_note_at || task.created_at
					}
				];
			}
		} finally {
			isLoadingNotes = false;
		}
	}

	async function handlePostNote() {
		if (!task || !newNoteText.trim()) return;
		isPostingNote = true;
		const authorName =
			$userProfile?.firstName ||
			$currentUser?.email?.split('@')[0] ||
			'Team Member';
		const authorEmail = $currentUser?.email || null;

		try {
			const created = await addNoteToTask(
				task.id,
				authorName,
				authorEmail,
				newNoteText.trim()
			);
			notes = [...notes, created];
			newNoteText = '';
			task = {
				...task,
				latest_note: created.content,
				latest_note_at: created.created_at
			};
			dispatch('updated', task);
			toastSuccess('Note added');
		} catch (err) {
			console.error('Failed to post note:', err);
			toastError('Failed to add note');
		} finally {
			isPostingNote = false;
		}
	}

	async function handleDeleteNote(noteId: string) {
		if (!task) return;
		if (!confirm('Delete this note?')) return;
		try {
			await deleteNoteFromTask(noteId, task.id);
			notes = notes.filter((n) => n.id !== noteId);
			const nextLatest = notes[notes.length - 1];
			task = {
				...task,
				latest_note: nextLatest ? nextLatest.content : null,
				latest_note_at: nextLatest ? nextLatest.created_at : null
			};
			dispatch('updated', task);
			toastSuccess('Note deleted');
		} catch (err) {
			toastError('Failed to delete note');
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

	async function handleAssigneesChange(newAssignees: TaskAssignee[]) {
		if (!task) return;
		if (newAssignees.length === 0) {
			toastError('At least one assignee is required');
			return;
		}
		const assigneeNames = newAssignees.map((a) => a.name).join(', ');
		const primary = newAssignees[0] || null;
		await handleFieldUpdate({
			assignees: newAssignees,
			assignee_name: assigneeNames,
			assignee_uid: primary?.uid || null,
			assignee_email: primary?.email || null
		});
	}

	async function handleCreateNewDept() {
		if (!task) return;
		const trimmed = newDeptInput.trim();
		if (!trimmed) {
			toastError('Bucket or department name cannot be empty');
			return;
		}
		try {
			await addDepartment(trimmed);
			newDeptInput = '';
			isCreatingDept = false;
			await handleFieldUpdate({ department: trimmed as TaskDepartment });
			toastSuccess(`Bucket "${trimmed}" created`);
		} catch (err: any) {
			toastError(err?.message || 'Failed to create bucket');
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
						<label for="detail-task-status" class="mb-1 block text-xs font-medium text-gray-400">Status</label>
						<label
							class="flex cursor-pointer items-center rounded-lg border border-[#2a2f37] bg-[#181b20] pl-3 transition hover:border-[#3a424e] focus-within:border-lime-500"
						>
							<span
								class="pointer-events-none h-2 w-2 flex-shrink-0 rounded-full {STATUS_DOT_COLORS[task.status]}"
							></span>
							<select
								id="detail-task-status"
								value={task.status}
								on:change={(e) =>
									handleFieldUpdate({ status: e.currentTarget.value as TaskStatus })}
								class="w-full cursor-pointer border-0 bg-transparent py-2 pl-2 pr-7 text-xs font-medium text-gray-100 focus:ring-0 focus:outline-none"
							>
								{#each TASK_STATUSES as st}
									<option value={st} class="bg-[#141619] text-gray-100">{st}</option>
								{/each}
							</select>
						</label>
					</div>

					<!-- Department -->
					<div>
						<div class="mb-1 flex items-center justify-between">
							<label class="block text-xs font-medium text-gray-400">Department / Bucket</label>
							<button
								type="button"
								on:click={() => (isCreatingDept = !isCreatingDept)}
								class="text-[11px] font-semibold text-lime-400 transition hover:text-lime-300"
							>
								{isCreatingDept ? 'Choose' : '+ New bucket'}
							</button>
						</div>

						{#if isCreatingDept}
							<div class="flex items-center gap-1.5">
								<input
									type="text"
									bind:value={newDeptInput}
									placeholder="New bucket name"
									class="w-full rounded-lg border border-[#2a2f37] bg-[#181b20] px-2.5 py-1.5 text-xs text-gray-100 placeholder-gray-500 focus:border-lime-500 focus:outline-none"
									on:keydown={(e) => {
										if (e.key === 'Enter') {
											e.preventDefault();
											handleCreateNewDept();
										}
									}}
								/>
								<button
									type="button"
									on:click={handleCreateNewDept}
									disabled={!newDeptInput.trim()}
									class="rounded-lg bg-lime-400 px-2.5 py-1.5 text-xs font-semibold text-gray-950 transition hover:bg-lime-300 disabled:opacity-50"
								>
									Add
								</button>
							</div>
						{:else}
							<select
								value={task.department}
								on:change={(e) => {
									if (e.currentTarget.value === '__NEW__') {
										isCreatingDept = true;
									} else {
										handleFieldUpdate({ department: e.currentTarget.value as TaskDepartment });
									}
								}}
								class="w-full rounded-lg border border-[#2a2f37] bg-[#181b20] px-3 py-2 text-xs font-medium text-gray-100 focus:border-lime-500 focus:outline-none"
							>
								{#each $allDepartments as dept}
									<option value={dept}>{dept}</option>
								{/each}
								<option value="__NEW__" class="font-medium text-lime-400">+ Add new bucket / department...</option>
							</select>
						{/if}
					</div>

					<!-- Priority -->
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

					<!-- Due date -->
					<div>
						<label class="mb-1 block text-xs font-medium text-gray-400">Due date</label>
						<input
							type="date"
							value={task.due_date}
							on:change={(e) => handleFieldUpdate({ due_date: e.currentTarget.value })}
							class="w-full rounded-lg border border-[#2a2f37] bg-[#181b20] px-2 py-2 text-xs text-gray-100 focus:border-lime-500 focus:outline-none [color-scheme:dark]"
						/>
					</div>

					<!-- Assignees (Full Width) -->
					<div class="col-span-2">
						<label class="mb-1 block text-xs font-medium text-gray-400">Assignee(s)</label>
						<AssigneeSelect
							selected={currentAssignees}
							size="sm"
							on:change={(e) => handleAssigneesChange(e.detail)}
						/>
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

				<!-- Task Hierarchy: Parent Relationship & Subtasks -->
				<div class="rounded-xl border border-[#262a30] bg-[#181b20] p-4 space-y-4">
					<!-- 1. Parent Task Control (Move to another parent / Promote / Swap) -->
					<div>
						<div class="mb-1.5 flex items-center justify-between">
							<span class="text-xs font-semibold uppercase tracking-wider text-gray-400">
								Parent Task
							</span>
							{#if parentTask}
								<div class="flex items-center gap-2">
									<button
										type="button"
										on:click={() => parentTask && dispatch('selectTask', parentTask)}
										class="text-xs font-semibold text-lime-400 hover:underline"
									>
										Open parent ↗
									</button>
									<button
										type="button"
										on:click={handleInterchangeWithParent}
										class="rounded-md border border-cyan-500/30 bg-cyan-950/30 px-2 py-0.5 text-[11px] font-semibold text-cyan-300 transition hover:bg-cyan-900/40"
										title="Make this subtask the parent, and make the current parent a subtask"
									>
										⇄ Swap with parent
									</button>
									<button
										type="button"
										on:click={() => handleParentSelectChange('')}
										class="rounded-md border border-amber-500/30 bg-amber-950/30 px-2 py-0.5 text-[11px] font-semibold text-amber-300 transition hover:bg-amber-900/40"
									>
										↑ Make standalone
									</button>
								</div>
							{/if}
						</div>

						<select
							value={task.parent_task_id || ''}
							on:change={(e) => handleParentSelectChange(e.currentTarget.value)}
							class="w-full rounded-lg border border-[#2a2f37] bg-[#141619] px-3 py-2 text-xs text-gray-100 focus:border-lime-500 focus:outline-none"
						>
							<option value="">None (Standalone / Top-Level Parent Task)</option>
							{#each validParentOptions as pOpt (pOpt.id)}
								<option value={pOpt.id}>
									[{pOpt.department}] {pOpt.title}
								</option>
							{/each}
						</select>
					</div>

					<!-- 2. Subtasks List & Controls -->
					<div class="border-t border-[#262a30] pt-3">
						<div class="mb-2 flex items-center justify-between">
							<span class="text-sm font-bold text-white">
								Subtasks ({subtasks.length})
							</span>
							{#if subtasks.length > 0}
								<span class="text-xs font-semibold text-gray-300">
									{subtaskProgress.percent}% &middot; {subtaskProgress.completed} of {subtaskProgress.total} completed
								</span>
							{/if}
						</div>

						{#if subtasks.length > 0}
							<div class="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-[#262a30]">
								<div
									class="h-full rounded-full bg-lime-500 transition-all duration-300"
									style="width: {subtaskProgress.percent}%;"
								></div>
							</div>

							<div class="space-y-2 mb-3">
								{#each subtasks as sub (sub.id)}
									<div class="rounded-lg border border-[#262a30] bg-[#141619] p-2.5">
										<div class="flex items-center justify-between gap-2">
											<div class="flex min-w-0 flex-1 items-center gap-2">
												<input
													type="checkbox"
													checked={sub.status === 'Completed'}
													on:change={async () => {
														const nextStatus =
															sub.status === 'Completed' ? 'To do' : 'Completed';
														tasks.update((list) =>
															list.map((t) =>
																t.id === sub.id ? { ...t, status: nextStatus } : t
															)
														);
														await updateTaskFields(sub.id, { status: nextStatus });
													}}
													class="h-4 w-4 rounded border-[#333842] bg-[#0e1012] text-lime-500 focus:ring-lime-500"
												/>
												<button
													type="button"
													on:click={() => dispatch('selectTask', sub)}
													class="truncate text-left text-xs font-semibold {sub.status === 'Completed'
														? 'line-through text-gray-500'
														: 'text-gray-100 hover:text-lime-400'}"
												>
													{sub.title}
												</button>
											</div>

											<div class="flex items-center gap-1">
												<button
													type="button"
													on:click={() => handleInterchangeWithChild(sub)}
													class="rounded border border-[#2a2f37] bg-[#181b20] px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300 hover:border-cyan-500/40"
													title="Make this subtask the parent task and demote current task"
												>
													⇄ Make parent
												</button>
												<button
													type="button"
													on:click={() =>
														(movingSubtaskId = movingSubtaskId === sub.id ? null : sub.id)}
													class="rounded border border-[#2a2f37] bg-[#181b20] px-1.5 py-0.5 text-[10px] font-semibold text-gray-300 hover:text-white"
													title="Move subtask to another parent"
												>
													Move
												</button>
												<button
													type="button"
													on:click={async () => {
														await promoteSubtaskToParent(sub.id);
														toastSuccess(`"${sub.title}" promoted to standalone task`);
													}}
													class="rounded border border-[#2a2f37] bg-[#181b20] px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 hover:border-amber-500/40"
													title="Promote to standalone task"
												>
													↑ Detach
												</button>
											</div>
										</div>

										{#if movingSubtaskId === sub.id}
											<div class="mt-2 flex items-center gap-2 border-t border-[#262a30] pt-2">
												<span class="text-[11px] text-gray-400">Move to parent:</span>
												<select
													value={sub.parent_task_id || ''}
													on:change={async (e) => {
														const targetParentId = e.currentTarget.value || null;
														movingSubtaskId = null;
														await assignTaskParent(sub.id, targetParentId);
														toastSuccess('Subtask moved');
													}}
													class="flex-1 rounded border border-[#2a2f37] bg-[#181b20] px-2 py-1 text-xs text-gray-200"
												>
													<option value="">None (Standalone task)</option>
													{#each getValidParentTasks($tasks, sub.id) as candidate (candidate.id)}
														<option value={candidate.id}>
															[{candidate.department}] {candidate.title}
														</option>
													{/each}
												</select>
											</div>
										{/if}
									</div>
								{/each}
							</div>
						{/if}

						<!-- Quick Create New Subtask -->
						<div class="flex gap-2">
							<input
								type="text"
								bind:value={newSubtaskTitle}
								on:keydown={(e) => e.key === 'Enter' && handleQuickAddSubtask()}
								placeholder="Add a new subtask..."
								class="flex-1 rounded-lg border border-[#2a2f37] bg-[#141619] px-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:border-lime-500 focus:outline-none"
							/>
							<button
								type="button"
								on:click={handleQuickAddSubtask}
								disabled={isCreatingSubtask || !newSubtaskTitle.trim()}
								class="rounded-lg bg-lime-400 px-3 py-1.5 text-xs font-semibold text-gray-950 hover:bg-lime-300 disabled:opacity-50"
							>
								{isCreatingSubtask ? 'Adding...' : '+ Add subtask'}
							</button>
						</div>

						<!-- Attach Existing Task as Subtask -->
						{#if attachableTasks.length > 0}
							<div class="mt-2 flex gap-2">
								<select
									bind:value={existingTaskToAttachId}
									class="flex-1 rounded-lg border border-[#2a2f37] bg-[#141619] px-3 py-1.5 text-xs text-gray-300 focus:border-lime-500 focus:outline-none"
								>
									<option value="">Or attach an existing task as subtask...</option>
									{#each attachableTasks as existing (existing.id)}
										<option value={existing.id}>
											[{existing.department}] {existing.title}
										</option>
									{/each}
								</select>
								<button
									type="button"
									on:click={handleAttachExistingSubtask}
									disabled={!existingTaskToAttachId}
									class="rounded-lg border border-[#2a2f37] bg-[#141619] px-3 py-1.5 text-xs font-semibold text-lime-400 hover:border-lime-500/40 disabled:opacity-40"
								>
									Attach
								</button>
							</div>
						{/if}
					</div>
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

				<!-- Notes Thread -->
				<div class="rounded-xl border border-[#262a30] bg-[#181b20] p-4">
					<div class="mb-3 flex items-center justify-between">
						<div class="flex items-center gap-2">
							<h4 class="text-sm font-bold text-white">
								Notes ({notes.length})
							</h4>
							{#if task.latest_note_at}
								<span class="text-xs text-gray-400">
									&middot; Latest {formatShortDate(task.latest_note_at)}
								</span>
							{/if}
						</div>
					</div>

					{#if isLoadingNotes}
						<p class="text-xs text-gray-500">Loading notes...</p>
					{:else if notes.length === 0}
						<p class="mb-3 text-xs text-gray-500">No notes yet.</p>
					{:else}
						<div class="mb-4 space-y-2.5 max-h-60 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-[#262a30]">
							{#each notes as note (note.id)}
								<div class="group/note rounded-lg bg-[#141619] p-3 transition hover:bg-[#16191e]">
									<div class="mb-1 flex items-center justify-between text-[11px]">
										<span class="font-bold text-lime-400">{note.author_name}</span>
										<div class="flex items-center gap-2">
											<span class="text-gray-500">{formatShortDate(note.created_at)}</span>
											{#if note.id !== 'legacy-latest-note'}
												<button
													type="button"
													on:click={() => handleDeleteNote(note.id)}
													class="opacity-0 group-hover/note:opacity-100 text-gray-500 hover:text-red-400 transition"
													title="Delete note"
												>
													&times;
												</button>
											{/if}
										</div>
									</div>
									<p class="text-xs text-gray-200 whitespace-pre-wrap">{note.content}</p>
								</div>
							{/each}
						</div>
					{/if}

					<div class="flex gap-2">
						<input
							type="text"
							bind:value={newNoteText}
							on:keydown={(e) => e.key === 'Enter' && handlePostNote()}
							placeholder="Write a status note..."
							class="flex-1 rounded-lg border border-[#2a2f37] bg-[#141619] px-3 py-2 text-xs text-gray-200 placeholder-gray-500 focus:border-lime-500 focus:outline-none"
						/>
						<button
							type="button"
							on:click={handlePostNote}
							disabled={isPostingNote || !newNoteText.trim()}
							class="rounded-lg bg-lime-400 px-3.5 py-2 text-xs font-semibold text-gray-950 hover:bg-lime-300 disabled:opacity-50 transition"
						>
							{isPostingNote ? 'Adding...' : 'Add note'}
						</button>
					</div>
				</div>

				<!-- Attachments -->
				<div class="rounded-xl border border-[#262a30] bg-[#181b20] p-4">
					<div class="mb-3 flex items-center justify-between">
						<div class="flex items-center gap-2">
							<span class="text-sm font-bold text-white">
								Attachments ({task.attachments?.length || 0})
							</span>
							{#if imageAttachments.length > 0}
								<span
									class="rounded-md border border-lime-500/30 bg-lime-500/10 px-2 py-0.5 text-[11px] font-semibold text-lime-400"
								>
									{imageAttachments.length} {imageAttachments.length === 1 ? 'photo' : 'photos'}
								</span>
							{/if}
						</div>
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
							class="inline-flex items-center gap-1 rounded-lg border border-lime-500/30 bg-lime-500/10 px-2.5 py-1 text-xs font-semibold text-lime-400 hover:bg-lime-500/20 transition"
						>
							<svg class="h-3.5 w-3.5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
							</svg>
							<span>Upload file</span>
						</button>
					</div>

					{#if imageAttachments.length > 0}
						<!-- Photo Gallery Grid -->
						<div class="mb-3">
							<div class="mb-2 flex items-center justify-between">
								<span class="text-xs font-semibold text-gray-300">
									Photos ({imageAttachments.length})
								</span>
								<button
									type="button"
									on:click={() => openPhotoViewerAtIndex(0)}
									class="inline-flex items-center gap-1 text-[11px] font-medium text-lime-400 hover:text-lime-300 hover:underline"
								>
									<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
										/>
									</svg>
									<span>Open viewer</span>
								</button>
							</div>

							<div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
								{#each imageAttachments as att, idx (att.id)}
									<div
										class="group relative aspect-video overflow-hidden rounded-lg border border-[#2a2f37] bg-[#141619] shadow transition hover:border-lime-500/50"
									>
										<!-- Thumbnail Image -->
										<button
											type="button"
											on:click={() => openPhotoViewerAtIndex(idx)}
											class="h-full w-full block focus:outline-none"
											title={`View ${att.file_name}`}
										>
											<img
												src={att.public_url}
												alt={att.file_name}
												class="h-full w-full object-cover transition duration-200 group-hover:scale-105"
												loading="lazy"
											/>
										</button>

										<!-- Bottom caption overlay -->
										<div
											class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-1.5 pt-4 pointer-events-none"
										>
											<div class="truncate text-[10px] font-medium text-white">{att.file_name}</div>
											{#if att.byte_size}
												<div class="text-[9px] text-gray-300">{formatByteSize(att.byte_size)}</div>
											{/if}
										</div>

										<!-- Hover action buttons -->
										<div
											class="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
										>
											<button
												type="button"
												on:click|stopPropagation={() => openPhotoViewerAtIndex(idx)}
												class="rounded-md bg-[#141619]/90 p-1 text-gray-200 hover:text-lime-400 hover:bg-[#1f2329] shadow"
												title="Open in photo viewer"
											>
												<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
											</button>
											<a
												href={att.public_url}
												target="_blank"
												rel="noopener noreferrer"
												class="rounded-md bg-[#141619]/90 p-1 text-gray-200 hover:text-lime-400 hover:bg-[#1f2329] shadow"
												title="Open in new tab"
											>
												<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
													/>
												</svg>
											</a>
											<button
												type="button"
												on:click|stopPropagation={() => handleDeleteAttachment(att)}
												disabled={isDeletingAttachmentId === att.id}
												class="rounded-md bg-[#141619]/90 p-1 text-red-400 hover:text-red-300 hover:bg-red-950/40 shadow disabled:opacity-40"
												title="Delete photo"
											>
												<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
													/>
												</svg>
											</button>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					{#if otherAttachments.length > 0}
						<!-- Documents and Other Files -->
						<div class="space-y-1.5 {imageAttachments.length > 0 ? 'border-t border-[#262a30]/60 pt-2.5' : ''}">
							{#if imageAttachments.length > 0}
								<div class="mb-1.5 text-xs font-semibold text-gray-300">
									Documents ({otherAttachments.length})
								</div>
							{/if}
							{#each otherAttachments as att (att.id)}
								<div
									class="flex items-center justify-between rounded-lg border border-[#262a30] bg-[#141619] px-3 py-2 text-xs transition hover:border-[#333842]"
								>
									<a
										href={att.public_url}
										target="_blank"
										rel="noopener noreferrer"
										class="flex min-w-0 items-center gap-2 truncate text-gray-200 hover:text-lime-400"
									>
										<svg
											class="h-4 w-4 flex-shrink-0 text-lime-400"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
											/>
										</svg>
										<span class="truncate">{att.file_name}</span>
										{#if att.byte_size}
											<span class="text-[11px] text-gray-400">({formatByteSize(att.byte_size)})</span>
										{/if}
									</a>

									<div class="ml-2 flex flex-shrink-0 items-center gap-2">
										<a
											href={att.public_url}
											target="_blank"
											rel="noopener noreferrer"
											class="text-xs font-medium text-lime-400 hover:text-lime-300"
										>
											Download
										</a>
										<button
											type="button"
											on:click={() => handleDeleteAttachment(att)}
											disabled={isDeletingAttachmentId === att.id}
											class="text-gray-400 transition hover:text-red-400 disabled:opacity-40"
											title="Delete file"
										>
											<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
												/>
											</svg>
										</button>
									</div>
								</div>
							{/each}
						</div>
					{/if}

					{#if (!task.attachments || task.attachments.length === 0)}
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

	<TaskPhotoViewer
		open={photoViewerOpen}
		photos={viewerPhotos}
		index={photoViewerIndex}
		taskTitle={task?.title || ''}
		canDelete={true}
		on:close={() => (photoViewerOpen = false)}
		on:indexChange={(e) => (photoViewerIndex = e.detail.index)}
		on:delete={handlePhotoViewerDelete}
	/>
{/if}
