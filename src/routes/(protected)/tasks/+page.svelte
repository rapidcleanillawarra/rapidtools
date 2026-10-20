<script lang="ts">
	import { onMount } from 'svelte';
	import TasksToolbar from './components/TasksToolbar.svelte';
	import TasksBoardView from './components/TasksBoardView.svelte';
	import TasksListView from './components/TasksListView.svelte';
	import CreateTaskModal from './components/CreateTaskModal.svelte';
	import TaskDetailModal from './components/TaskDetailModal.svelte';
	import AddBucketModal from './components/AddBucketModal.svelte';
	import TaskPhotoViewer from './components/TaskPhotoViewer.svelte';
	import {
		tasks,
		teamMembers,
		isLoadingTasks,
		viewMode,
		allDepartments,
		customDepartments,
		departmentColors
	} from './stores';
	import {
		fetchAllTasks,
		fetchCustomDepartments,
		updateTaskFields,
		softDeleteTask
	} from './tasksService';
	import { fetchAllUserProfiles } from '$lib/userProfile';
	import { toastSuccess, toastError } from '$lib/utils/toast';
	import type { TaskItem, TaskDepartment, TaskStatus, TaskPhoto } from './types';
	import { isImageAttachment } from './types';

	let showCreateModal = false;
	let showAddBucketModal = false;
	let createModalDefaultDepartment: TaskDepartment = 'Operations';
	let selectedTask: TaskItem | null = null;

	let pagePhotoViewerOpen = false;
	let pagePhotoViewerPhotos: TaskPhoto[] = [];
	let pagePhotoViewerIndex = 0;
	let pagePhotoViewerTitle = '';

	onMount(async () => {
		await loadInitialData();
	});

	async function loadInitialData() {
		isLoadingTasks.set(true);
		try {
			const [loadedTasks, profiles, customDepts] = await Promise.all([
				fetchAllTasks(),
				fetchAllUserProfiles().catch(() => []),
				fetchCustomDepartments().catch(() => [])
			]);
			tasks.set(loadedTasks);
			teamMembers.set(profiles);

			if (customDepts && customDepts.length > 0) {
				customDepartments.set(customDepts.map((d) => d.name));
				const colors: Record<string, string> = {};
				for (const d of customDepts) {
					if (d.color_class) colors[d.name] = d.color_class;
				}
				departmentColors.set(colors);
			}
		} catch (err) {
			console.error('Failed to load tasks:', err);
			toastError('Failed to load tasks');
		} finally {
			isLoadingTasks.set(false);
		}
	}

	function openNewTaskModal(defaultDepartment: TaskDepartment = 'Operations') {
		createModalDefaultDepartment = defaultDepartment;
		showCreateModal = true;
	}

	function handleColumnAddTask(groupKey: string) {
		const matchedDept = $allDepartments.find(
			(d) => d.toLowerCase() === groupKey.toLowerCase()
		);
		const dept = matchedDept || 'Operations';
		openNewTaskModal(dept);
	}

	function openTaskDetail(task: TaskItem) {
		selectedTask = task;
	}

	function handleTaskCreated(event: CustomEvent<TaskItem>) {
		const created = event.detail;
		tasks.update((list) => [created, ...list]);
		showCreateModal = false;
	}

	function handleTaskUpdated(event: CustomEvent<TaskItem>) {
		const updated = event.detail;
		selectedTask = updated;
		tasks.update((list) => list.map((t) => (t.id === updated.id ? updated : t)));
	}

	async function handleStatusChange(task: TaskItem, newStatus: TaskStatus) {
		const previousStatus = task.status;
		tasks.update((list) =>
			list.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
		);

		try {
			await updateTaskFields(task.id, { status: newStatus });
			toastSuccess(`Status updated to ${newStatus}`);
		} catch (err) {
			tasks.update((list) =>
				list.map((t) => (t.id === task.id ? { ...t, status: previousStatus } : t))
			);
			toastError('Failed to update task status');
		}
	}

	async function handleDeleteTask(task: TaskItem) {
		if (!confirm(`Delete task "${task.title}"?`)) return;
		try {
			await softDeleteTask(task.id);
			tasks.update((list) => list.filter((t) => t.id !== task.id));
			if (selectedTask?.id === task.id) {
				selectedTask = null;
			}
			toastSuccess('Task deleted');
		} catch (err) {
			toastError('Failed to delete task');
		}
	}

	function handleOpenPhotos(event: CustomEvent<{ task: TaskItem; initialIndex: number }>) {
		const { task, initialIndex } = event.detail;
		const imgAtts = (task.attachments || []).filter(isImageAttachment);
		if (imgAtts.length === 0) return;

		pagePhotoViewerPhotos = imgAtts.map((att) => ({
			id: att.id,
			url: att.public_url || '',
			name: att.file_name,
			byte_size: att.byte_size,
			created_at: att.created_at
		}));
		pagePhotoViewerIndex = Math.max(0, Math.min(initialIndex, pagePhotoViewerPhotos.length - 1));
		pagePhotoViewerTitle = task.title;
		pagePhotoViewerOpen = true;
	}
</script>

<svelte:head>
	<title>Tasks - RapidTools</title>
</svelte:head>

<div class="min-h-screen bg-[#0e1012] px-4 py-6 sm:px-6 lg:px-8">
	<div class="w-full space-y-6">
		<TasksToolbar
			on:newTask={() => openNewTaskModal('Operations')}
			on:addBucket={() => (showAddBucketModal = true)}
		/>

		{#if $isLoadingTasks}
			<div class="overflow-x-auto pb-4">
				<div class="flex items-start gap-4 min-w-max">
					{#each Array(5) as _}
						<div class="h-96 w-80 flex-shrink-0 animate-pulse rounded-xl border border-[#262a30] bg-[#141619] p-4"></div>
					{/each}
				</div>
			</div>
		{:else if $viewMode === 'board'}
			<TasksBoardView
				on:addTask={(e) => handleColumnAddTask(e.detail)}
				on:selectTask={(e) => openTaskDetail(e.detail)}
				on:statusChange={(e) => handleStatusChange(e.detail.task, e.detail.status)}
				on:deleteTask={(e) => handleDeleteTask(e.detail)}
				on:openPhotos={handleOpenPhotos}
				on:addBucket={() => (showAddBucketModal = true)}
			/>
		{:else}
			<TasksListView
				on:addTask={(e) => handleColumnAddTask(e.detail)}
				on:selectTask={(e) => openTaskDetail(e.detail)}
				on:statusChange={(e) => handleStatusChange(e.detail.task, e.detail.status)}
				on:deleteTask={(e) => handleDeleteTask(e.detail)}
				on:openPhotos={handleOpenPhotos}
				on:addBucket={() => (showAddBucketModal = true)}
			/>
		{/if}
	</div>
</div>

<CreateTaskModal
	open={showCreateModal}
	defaultDepartment={createModalDefaultDepartment}
	on:close={() => (showCreateModal = false)}
	on:created={handleTaskCreated}
/>

<TaskDetailModal
	task={selectedTask}
	on:close={() => (selectedTask = null)}
	on:updated={handleTaskUpdated}
	on:delete={(e) => handleDeleteTask(e.detail)}
/>

<AddBucketModal
	open={showAddBucketModal}
	on:close={() => (showAddBucketModal = false)}
/>

<TaskPhotoViewer
	open={pagePhotoViewerOpen}
	photos={pagePhotoViewerPhotos}
	index={pagePhotoViewerIndex}
	taskTitle={pagePhotoViewerTitle}
	on:close={() => (pagePhotoViewerOpen = false)}
	on:indexChange={(e) => (pagePhotoViewerIndex = e.detail.index)}
/>
