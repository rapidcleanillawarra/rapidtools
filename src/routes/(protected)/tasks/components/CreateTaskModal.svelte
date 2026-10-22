<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { tasks, teamMembers, availableAssignees, allDepartments, addDepartment } from '../stores';
	import { createTaskRecord } from '../tasksService';
	import { toastSuccess, toastError } from '$lib/utils/toast';
	import {
		type TaskItem,
		type TaskDepartment,
		type TaskPriority,
		type TaskStatus,
		type TaskPhoto,
		type TaskAssignee,
		TASK_PRIORITIES,
		TASK_STATUSES,
		STATUS_DOT_COLORS
	} from '../types';
	import TaskPhotoViewer from './TaskPhotoViewer.svelte';
	import AssigneeSelect from './AssigneeSelect.svelte';

	export let open = false;
	export let defaultDepartment: TaskDepartment = 'Operations';
	export let defaultParentTaskId: string | null = null;

	const dispatch = createEventDispatcher<{
		close: void;
		created: TaskItem;
	}>();

	let title = '';
	let description = '';
	let selectedAssignees: TaskAssignee[] = [];
	let selectedDepartment: string = '';
	let priority: TaskPriority = 'Normal';
	let dueDate = '';
	let status: TaskStatus = 'To do';
	let selectedParentTaskId: string = '';

	let isCreatingDept = false;
	let newDeptInput = '';

	$: if (open && defaultParentTaskId && !selectedParentTaskId) {
		selectedParentTaskId = defaultParentTaskId;
	}
	$: rootTaskOptions = $tasks.filter((t) => !t.parent_task_id);

	// Initialize with 2 blank step rows matching the screenshot
	let steps: { id: string; label: string; is_completed: boolean }[] = [
		{ id: crypto.randomUUID(), label: '', is_completed: false },
		{ id: crypto.randomUUID(), label: '', is_completed: false }
	];

	let selectedFiles: File[] = [];
	let fileInputEl: HTMLInputElement;
	let isSubmitting = false;

	// Sync default department whenever modal opens
	$: if (open && !selectedDepartment && defaultDepartment) {
		selectedDepartment = defaultDepartment;
	}

	function addStepRow() {
		steps = [...steps, { id: crypto.randomUUID(), label: '', is_completed: false }];
	}

	function removeStepRow(id: string) {
		if (steps.length <= 1) {
			steps = [{ id: crypto.randomUUID(), label: '', is_completed: false }];
			return;
		}
		steps = steps.filter((s) => s.id !== id);
	}

	let previewPhotos: TaskPhoto[] = [];
	let previewViewerOpen = false;
	let previewViewerIndex = 0;

	function isImageFile(file: File): boolean {
		if (file.type && file.type.startsWith('image/')) return true;
		const ext = file.name.split('.').pop()?.toLowerCase() || '';
		return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'avif'].includes(ext);
	}

	function openFilePreview(file: File) {
		const imgFiles = selectedFiles.filter(isImageFile);
		if (imgFiles.length === 0) return;
		previewPhotos = imgFiles.map((f) => ({
			url: URL.createObjectURL(f),
			name: f.name,
			byte_size: f.size
		}));
		const targetIdx = imgFiles.findIndex((f) => f === file);
		previewViewerIndex = Math.max(0, targetIdx);
		previewViewerOpen = true;
	}

	function handleFileChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		if (!input.files) return;
		selectedFiles = [...selectedFiles, ...Array.from(input.files)];
		input.value = '';
	}

	function removeSelectedFile(index: number) {
		selectedFiles = selectedFiles.filter((_, idx) => idx !== index);
	}

	function resetForm() {
		title = '';
		description = '';
		selectedAssignees = [];
		selectedDepartment = defaultDepartment;
		priority = 'Normal';
		dueDate = '';
		status = 'To do';
		selectedParentTaskId = defaultParentTaskId || '';
		steps = [
			{ id: crypto.randomUUID(), label: '', is_completed: false },
			{ id: crypto.randomUUID(), label: '', is_completed: false }
		];
		selectedFiles = [];
		previewPhotos = [];
		previewViewerOpen = false;
		isCreatingDept = false;
		newDeptInput = '';
	}

	async function handleCreateNewDept() {
		const trimmed = newDeptInput.trim();
		if (!trimmed) {
			toastError('Bucket or department name cannot be empty');
			return;
		}

		try {
			await addDepartment(trimmed);
			selectedDepartment = trimmed;
			newDeptInput = '';
			isCreatingDept = false;
			toastSuccess(`Bucket "${trimmed}" added`);
		} catch (err: any) {
			toastError(err?.message || 'Failed to add bucket');
		}
	}

	function closeModal() {
		if (isSubmitting) return;
		resetForm();
		dispatch('close');
	}

	async function handleSubmit() {
		if (!title.trim()) {
			toastError('Task title is required');
			return;
		}
		if (!selectedAssignees || selectedAssignees.length === 0) {
			toastError('At least one assignee is required');
			return;
		}
		if (!dueDate) {
			toastError('Due date is required');
			return;
		}

		isSubmitting = true;
		try {
			const dept = (selectedDepartment || defaultDepartment || 'Operations') as TaskDepartment;
			const primaryAssignee = selectedAssignees[0];
			const assigneeNames = selectedAssignees.map((a) => a.name).join(', ');

			const created = await createTaskRecord({
				parent_task_id: selectedParentTaskId || null,
				title: title.trim(),
				description: description.trim() || undefined,
				department: dept,
				status,
				priority,
				assignees: selectedAssignees,
				assignee_uid: primaryAssignee?.uid || null,
				assignee_name: assigneeNames,
				assignee_email: primaryAssignee?.email || null,
				due_date: dueDate,
				steps: steps.map((s) => ({ label: s.label, is_completed: s.is_completed })),
				files: selectedFiles
			});

			toastSuccess('Task created');
			resetForm();
			dispatch('created', created);
		} catch (err) {
			console.error('Failed to create task:', err);
			toastError('Failed to create task');
		} finally {
			isSubmitting = false;
		}
	}
</script>

{#if open}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		on:click={closeModal}
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
	>
		<!-- Modal Card -->
		<div
			on:click|stopPropagation
			class="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#262a30] bg-[#141619] text-gray-200 shadow-2xl"
		>
			<!-- 1. Modal Header -->
			<div class="flex items-start justify-between px-6 pt-6 pb-4">
				<div>
					<h2 class="text-2xl font-bold tracking-tight text-white">New task</h2>
					<p class="mt-1 text-sm text-gray-400">
						Assign work and track it through to completion.
					</p>
				</div>
				<button
					type="button"
					on:click={closeModal}
					class="rounded-lg p-1.5 text-gray-400 transition hover:bg-[#1f2329] hover:text-gray-200"
					aria-label="Close modal"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- 2. Scrollable Form Body -->
			<div class="flex-1 space-y-4 overflow-y-auto px-6 pb-5 scrollbar-thin scrollbar-thumb-[#262a30]">
				<!-- Task Title * -->
				<div>
					<label for="new-task-title" class="mb-1.5 block text-sm font-semibold text-white">
						Task title <span class="text-red-400">*</span>
					</label>
					<input
						id="new-task-title"
						type="text"
						bind:value={title}
						placeholder="e.g. Follow up supplier backorder"
						class="w-full rounded-lg border border-[#2a2f37] bg-[#181b20] px-3.5 py-2.5 text-sm text-gray-100 placeholder-gray-500 transition focus:border-lime-500 focus:outline-none"
					/>
				</div>

				<!-- Description -->
				<div>
					<label for="new-task-desc" class="mb-1.5 block text-sm font-semibold text-white">
						Description
					</label>
					<textarea
						id="new-task-desc"
						rows="3"
						bind:value={description}
						placeholder="What needs to be done?"
						class="w-full resize-y rounded-lg border border-[#2a2f37] bg-[#181b20] px-3.5 py-2.5 text-sm text-gray-100 placeholder-gray-500 transition focus:border-lime-500 focus:outline-none"
					></textarea>
				</div>

				<!-- 2x2 Grid: Assignee, Department, Priority, Due date -->
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<!-- Assignees * -->
					<div class="sm:col-span-2">
						<label class="mb-1.5 block text-sm font-semibold text-white">
							Assignee(s) <span class="text-red-400">*</span>
						</label>
						<AssigneeSelect bind:selected={selectedAssignees} size="md" placeholder="Select team member(s)..." />
					</div>

					<!-- Department -->
					<div>
						<div class="mb-1.5 flex items-center justify-between">
							<label for="new-task-dept" class="text-sm font-semibold text-white">
								Department / Bucket
							</label>
							<button
								type="button"
								on:click={() => (isCreatingDept = !isCreatingDept)}
								class="text-xs font-semibold text-lime-400 transition hover:text-lime-300"
							>
								{isCreatingDept ? 'Choose existing' : '+ New bucket'}
							</button>
						</div>

						{#if isCreatingDept}
							<div class="flex items-center gap-1.5">
								<input
									type="text"
									bind:value={newDeptInput}
									placeholder="New bucket name"
									class="w-full rounded-lg border border-[#2a2f37] bg-[#181b20] px-3 py-2 text-sm text-gray-100 placeholder-gray-500 transition focus:border-lime-500 focus:outline-none"
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
									class="rounded-lg bg-lime-400 px-3 py-2 text-xs font-semibold text-gray-950 transition hover:bg-lime-300 disabled:opacity-50"
								>
									Add
								</button>
							</div>
						{:else}
							<label
								class="flex cursor-pointer items-center rounded-lg border border-[#2a2f37] bg-[#181b20] pl-3.5 transition hover:border-[#3a424e] focus-within:border-lime-500"
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
									id="new-task-dept"
									bind:value={selectedDepartment}
									on:change={(e) => {
										if (e.currentTarget.value === '__NEW__') {
											isCreatingDept = true;
											selectedDepartment = '';
										}
									}}
									class="w-full cursor-pointer border-0 bg-transparent py-2.5 pl-2.5 pr-8 text-sm {selectedDepartment
										? 'text-gray-100'
										: 'text-gray-400'} focus:ring-0 focus:outline-none"
								>
									<option value="" disabled class="bg-[#141619] text-gray-400">Select department</option>
									{#each $allDepartments as dept}
										<option value={dept} class="bg-[#141619] text-gray-100">{dept}</option>
									{/each}
									<option value="__NEW__" class="bg-[#141619] font-medium text-lime-400">
										+ Add new bucket / department...
									</option>
								</select>
							</label>
						{/if}
					</div>

					<!-- Priority -->
					<div>
						<label for="new-task-priority" class="mb-1.5 block text-sm font-semibold text-white">
							Priority
						</label>
						<label
							class="flex cursor-pointer items-center rounded-lg border border-[#2a2f37] bg-[#181b20] pl-3.5 transition hover:border-[#3a424e] focus-within:border-lime-500"
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
									d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
								/>
							</svg>
							<select
								id="new-task-priority"
								bind:value={priority}
								class="w-full cursor-pointer border-0 bg-transparent py-2.5 pl-2.5 pr-8 text-sm text-gray-100 focus:ring-0 focus:outline-none"
							>
								{#each TASK_PRIORITIES as p}
									<option value={p} class="bg-[#141619] text-gray-100">{p}</option>
								{/each}
							</select>
						</label>
					</div>

					<!-- Due date * -->
					<div>
						<label for="new-task-due" class="mb-1.5 block text-sm font-semibold text-white">
							Due date <span class="text-red-400">*</span>
						</label>
						<div class="relative">
							<svg
								class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
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
							<input
								id="new-task-due"
								type="date"
								bind:value={dueDate}
								placeholder="Select date"
								class="w-full rounded-lg border border-[#2a2f37] bg-[#181b20] py-2.5 pl-10 pr-3 text-sm {dueDate
									? 'text-gray-100'
									: 'text-gray-400'} transition focus:border-lime-500 focus:outline-none [color-scheme:dark]"
							/>
						</div>
					</div>
				</div>

				<!-- Status (Full Width) -->
				<div>
					<label for="new-task-status" class="mb-1.5 block text-sm font-semibold text-white">
						Status
					</label>
					<label
						class="flex cursor-pointer items-center rounded-lg border border-[#2a2f37] bg-[#181b20] pl-3.5 transition hover:border-[#3a424e] focus-within:border-lime-500"
					>
						<span
							class="pointer-events-none h-2.5 w-2.5 flex-shrink-0 rounded-full {STATUS_DOT_COLORS[status]}"
						></span>
						<select
							id="new-task-status"
							bind:value={status}
							class="w-full cursor-pointer border-0 bg-transparent py-2.5 pl-2.5 pr-8 text-sm text-gray-100 focus:ring-0 focus:outline-none"
						>
							{#each TASK_STATUSES as st}
								<option value={st} class="bg-[#141619] text-gray-100">{st}</option>
							{/each}
						</select>
					</label>
				</div>

				<!-- Parent Task (Optional) -->
				<div>
					<label for="new-task-parent" class="mb-1.5 block text-sm font-semibold text-white">
						Parent task <span class="text-xs font-normal text-gray-400">(Optional — make this a subtask)</span>
					</label>
					<select
						id="new-task-parent"
						bind:value={selectedParentTaskId}
						on:change={() => {
							const found = $tasks.find((t) => t.id === selectedParentTaskId);
							if (found) selectedDepartment = found.department;
						}}
						class="w-full rounded-lg border border-[#2a2f37] bg-[#181b20] px-3.5 py-2.5 text-sm text-gray-100 focus:border-lime-500 focus:outline-none"
					>
						<option value="" class="bg-[#141619] text-gray-400">None (Standalone / Parent Task)</option>
						{#each rootTaskOptions as parentOpt (parentOpt.id)}
							<option value={parentOpt.id} class="bg-[#141619] text-gray-100">
								[{parentOpt.department}] {parentOpt.title}
							</option>
						{/each}
					</select>
				</div>

				<!-- Checklist Section -->
				<div class="border-t border-[#262a30] pt-4">
					<div class="flex items-center justify-between">
						<span class="text-sm font-bold text-white">Checklist</span>
						<span class="text-xs text-gray-400">Optional</span>
					</div>
					<p class="mt-0.5 mb-3 text-xs text-gray-400">
						Progress updates as steps are completed.
					</p>

					<div class="space-y-2.5">
						{#each steps as step (step.id)}
							<div class="flex items-center gap-2.5">
								<input
									type="checkbox"
									bind:checked={step.is_completed}
									class="h-4 w-4 rounded border-[#3a404a] bg-[#141619] text-lime-500 focus:ring-lime-500 focus:ring-offset-[#141619]"
								/>
								<input
									type="text"
									bind:value={step.label}
									placeholder="Add a step..."
									class="flex-1 rounded-lg border border-[#2a2f37] bg-[#181b20] px-3 py-2 text-sm text-gray-100 placeholder-gray-500 transition focus:border-lime-500 focus:outline-none"
								/>
								<button
									type="button"
									on:click={() => removeStepRow(step.id)}
									class="rounded-md p-1.5 text-gray-400 transition hover:bg-[#1f2329] hover:text-gray-200"
									aria-label="Remove step"
								>
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</div>
						{/each}
					</div>

					<button
						type="button"
						on:click={addStepRow}
						class="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-lime-400 transition hover:text-lime-300"
					>
						<svg class="h-4 w-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
						</svg>
						<span>Add step</span>
					</button>
				</div>

				<!-- Add Attachments Section -->
				<div class="border-t border-[#262a30] pt-4">
					<input
						bind:this={fileInputEl}
						type="file"
						multiple
						on:change={handleFileChange}
						class="hidden"
					/>
					<button
						type="button"
						on:click={() => fileInputEl?.click()}
						class="flex w-full items-center gap-3 rounded-xl p-1.5 text-left transition hover:bg-[#1b1f25]"
					>
						<div
							class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-[#2a2f37] bg-[#181b20] text-gray-300"
						>
							<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
								/>
							</svg>
						</div>
						<div>
							<div class="text-xs font-semibold text-white">Add attachments</div>
							<div class="text-[11px] text-gray-400">Images, PDFs or documents</div>
						</div>
					</button>

					{#if selectedFiles.length > 0}
						<div class="mt-2.5 flex flex-wrap gap-2">
							{#each selectedFiles as file, idx}
								{@const isImg = isImageFile(file)}
								<span
									class="inline-flex items-center gap-1.5 rounded-lg border {isImg
										? 'border-lime-500/30 bg-[#161a1f]'
										: 'border-[#2a2f37] bg-[#181b20]'} px-2.5 py-1 text-xs text-gray-200"
								>
									{#if isImg}
										<button
											type="button"
											on:click={() => openFilePreview(file)}
											class="text-lime-400 hover:text-lime-300"
											title="Preview photo"
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
									{/if}
									<span class="max-w-[180px] truncate">{file.name}</span>
									<button
										type="button"
										on:click={() => removeSelectedFile(idx)}
										class="text-gray-400 hover:text-red-400"
									>
										&times;
									</button>
								</span>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<!-- 3. Modal Footer -->
			<div class="flex items-center justify-between border-t border-[#262a30] bg-[#121417] px-6 py-4">
				<span class="text-xs text-gray-400">* Required fields</span>

				<div class="flex items-center gap-3">
					<button
						type="button"
						on:click={closeModal}
						disabled={isSubmitting}
						class="rounded-lg border border-[#333842] bg-[#181b20] px-5 py-2 text-sm font-semibold text-gray-200 transition hover:bg-[#22262e] disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						type="button"
						on:click={handleSubmit}
						disabled={isSubmitting}
						class="rounded-lg bg-lime-400 px-5 py-2 text-sm font-semibold text-gray-950 shadow-md transition hover:bg-lime-300 disabled:opacity-50"
					>
						{isSubmitting ? 'Creating...' : 'Create task'}
					</button>
				</div>
			</div>
		</div>
	</div>

	<TaskPhotoViewer
		open={previewViewerOpen}
		photos={previewPhotos}
		index={previewViewerIndex}
		taskTitle={title || 'New task attachments'}
		on:close={() => (previewViewerOpen = false)}
		on:indexChange={(e) => (previewViewerIndex = e.detail.index)}
	/>
{/if}
