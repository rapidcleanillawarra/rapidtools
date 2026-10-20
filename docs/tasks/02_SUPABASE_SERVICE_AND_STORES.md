# Subphase 2: Supabase CRUD Service & Reactive Stores

## Goal for the Model
Create the Supabase data access layer (`tasksService.ts`) and the reactive Svelte store module (`stores.ts`) that power filtering, tab switching, summary counters (`open`, `due today`, `overdue`), and dynamic column grouping.

## Context Files to Read First
1. [`src/routes/(protected)/tasks/types.ts`](../../src/routes/%28protected%29/tasks/types.ts) — Created in Subphase 1
2. [`src/lib/supabase.ts`](../../src/lib/supabase.ts) — Supabase client export
3. [`src/lib/firebase.ts`](../../src/lib/firebase.ts) — `currentUser` store

## Files to Create in This Subphase
- `src/routes/(protected)/tasks/tasksService.ts`
- `src/routes/(protected)/tasks/stores.ts`

---

## Step 2.1: Create `src/routes/(protected)/tasks/tasksService.ts`

Create [`src/routes/(protected)/tasks/tasksService.ts`](../../src/routes/%28protected%29/tasks/tasksService.ts):

```typescript
import { supabase } from '$lib/supabase';
import { currentUser } from '$lib/firebase';
import { get } from 'svelte/store';
import type {
	TaskItem,
	TaskStep,
	TaskAttachment,
	TaskComment,
	CreateTaskPayload,
	TaskStatus,
	TaskPriority,
	TaskDepartment
} from './types';

export const TASK_ATTACHMENTS_BUCKET = 'task-attachments';

function sanitizeFileName(name: string): string {
	const base = name.replace(/^.*[\\/]/, '');
	const noExt = base.includes('.') ? base.slice(0, base.lastIndexOf('.')) : base;
	return (noExt.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'file');
}

export function getAttachmentPublicUrl(storagePath: string): string {
	const { data } = supabase.storage.from(TASK_ATTACHMENTS_BUCKET).getPublicUrl(storagePath);
	return data.publicUrl;
}

/**
 * Fetch all active tasks along with their ordered steps, attachments, and comment count.
 */
export async function fetchAllTasks(): Promise<TaskItem[]> {
	const { data, error } = await supabase
		.from('tasks')
		.select(`
			*,
			task_steps (*),
			task_attachments (*),
			task_comments (id)
		`)
		.is('deleted_at', null)
		.order('position', { ascending: true })
		.order('created_at', { ascending: false });

	if (error) {
		console.error('Error fetching tasks:', error);
		throw error;
	}

	return (data || []).map((row: any) => {
		const steps: TaskStep[] = (row.task_steps || []).sort(
			(a: TaskStep, b: TaskStep) => a.step_order - b.step_order
		);
		const attachments: TaskAttachment[] = (row.task_attachments || []).map((att: TaskAttachment) => ({
			...att,
			public_url: getAttachmentPublicUrl(att.storage_path)
		}));
		const commentCount = Array.isArray(row.task_comments) ? row.task_comments.length : 0;

		return {
			id: row.id,
			title: row.title,
			description: row.description,
			department: row.department as TaskDepartment,
			status: row.status as TaskStatus,
			priority: row.priority as TaskPriority,
			assignee_uid: row.assignee_uid,
			assignee_name: row.assignee_name,
			assignee_email: row.assignee_email,
			assigned_by_email: row.assigned_by_email,
			due_date: row.due_date,
			latest_note: row.latest_note,
			latest_note_at: row.latest_note_at,
			position: row.position ?? 0,
			created_at: row.created_at,
			updated_at: row.updated_at,
			steps,
			attachments,
			comment_count: commentCount
		};
	});
}

/**
 * Create a new task, its checklist steps, and optional file attachments.
 */
export async function createTaskRecord(payload: CreateTaskPayload): Promise<TaskItem> {
	const user = get(currentUser);
	const nowIso = new Date().toISOString();

	const insertRow = {
		title: payload.title.trim(),
		description: payload.description?.trim() || null,
		department: payload.department,
		status: payload.status,
		priority: payload.priority,
		assignee_uid: payload.assignee_uid || null,
		assignee_name: payload.assignee_name.trim(),
		assignee_email: payload.assignee_email || null,
		assigned_by_email: user?.email || null,
		due_date: payload.due_date,
		latest_note: payload.latest_note?.trim() || 'Task created',
		latest_note_at: nowIso
	};

	const { data: createdTask, error: taskError } = await supabase
		.from('tasks')
		.insert(insertRow)
		.select('*')
		.single();

	if (taskError || !createdTask) {
		console.error('Error creating task:', taskError);
		throw taskError || new Error('Failed to create task');
	}

	// Insert non-empty checklist steps
	const validSteps = (payload.steps || [])
		.map((s) => ({ label: s.label.trim(), is_completed: !!s.is_completed }))
		.filter((s) => s.label.length > 0);

	let insertedSteps: TaskStep[] = [];
	if (validSteps.length > 0) {
		const stepRows = validSteps.map((s, idx) => ({
			task_id: createdTask.id,
			label: s.label,
			is_completed: s.is_completed,
			step_order: idx + 1
		}));

		const { data: stepData, error: stepError } = await supabase
			.from('task_steps')
			.insert(stepRows)
			.select('*');

		if (stepError) {
			console.error('Error inserting task steps:', stepError);
		} else {
			insertedSteps = (stepData || []).sort((a, b) => a.step_order - b.step_order);
		}
	}

	// Upload optional attachments
	let insertedAttachments: TaskAttachment[] = [];
	if (payload.files && payload.files.length > 0) {
		insertedAttachments = await uploadTaskAttachments(createdTask.id, payload.files);
	}

	return {
		...createdTask,
		steps: insertedSteps,
		attachments: insertedAttachments,
		comment_count: 0
	};
}

/**
 * Update core task fields (status, title, priority, department, due_date, assignee, latest_note).
 */
export async function updateTaskFields(
	taskId: string,
	updates: Partial<{
		title: string;
		description: string | null;
		department: TaskDepartment;
		status: TaskStatus;
		priority: TaskPriority;
		assignee_uid: string | null;
		assignee_name: string;
		assignee_email: string | null;
		due_date: string;
		latest_note: string | null;
		latest_note_at: string | null;
	}>
): Promise<void> {
	const { error } = await supabase
		.from('tasks')
		.update({
			...updates,
			updated_at: new Date().toISOString()
		})
		.eq('id', taskId);

	if (error) {
		console.error('Error updating task:', error);
		throw error;
	}
}

/**
 * Soft-delete a task.
 */
export async function softDeleteTask(taskId: string): Promise<void> {
	const { error } = await supabase
		.from('tasks')
		.update({
			deleted_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		})
		.eq('id', taskId);

	if (error) {
		console.error('Error deleting task:', error);
		throw error;
	}
}

/**
 * Toggle a checklist step's completion state.
 */
export async function toggleStepCompletion(stepId: string, isCompleted: boolean): Promise<void> {
	const { error } = await supabase
		.from('task_steps')
		.update({ is_completed: isCompleted })
		.eq('id', stepId);

	if (error) {
		console.error('Error toggling task step:', error);
		throw error;
	}
}

/**
 * Add a new step to an existing task.
 */
export async function addStepToTask(
	taskId: string,
	label: string,
	stepOrder: number
): Promise<TaskStep> {
	const { data, error } = await supabase
		.from('task_steps')
		.insert({
			task_id: taskId,
			label: label.trim(),
			is_completed: false,
			step_order: stepOrder
		})
		.select('*')
		.single();

	if (error || !data) {
		console.error('Error adding step:', error);
		throw error || new Error('Failed to add step');
	}
	return data;
}

/**
 * Delete a checklist step.
 */
export async function deleteStepFromTask(stepId: string): Promise<void> {
	const { error } = await supabase.from('task_steps').delete().eq('id', stepId);
	if (error) {
		console.error('Error deleting step:', error);
		throw error;
	}
}

/**
 * Upload files to Supabase Storage and create task_attachments rows.
 */
export async function uploadTaskAttachments(
	taskId: string,
	files: File[]
): Promise<TaskAttachment[]> {
	const uploaded: TaskAttachment[] = [];

	for (const file of files) {
		const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
		const storagePath = `${taskId}/${crypto.randomUUID()}_${sanitizeFileName(file.name)}${ext}`;

		const { error: uploadErr } = await supabase.storage
			.from(TASK_ATTACHMENTS_BUCKET)
			.upload(storagePath, file, {
				upsert: false,
				contentType: file.type || 'application/octet-stream'
			});

		if (uploadErr) {
			console.error('Error uploading attachment to storage:', uploadErr);
			continue;
		}

		const { data: row, error: dbErr } = await supabase
			.from('task_attachments')
			.insert({
				task_id: taskId,
				storage_path: storagePath,
				file_name: file.name,
				content_type: file.type || null,
				byte_size: file.size
			})
			.select('*')
			.single();

		if (!dbErr && row) {
			uploaded.push({
				...row,
				public_url: getAttachmentPublicUrl(row.storage_path)
			});
		}
	}

	return uploaded;
}

/**
 * Fetch comments for a task in chronological order.
 */
export async function fetchCommentsForTask(taskId: string): Promise<TaskComment[]> {
	const { data, error } = await supabase
		.from('task_comments')
		.select('*')
		.eq('task_id', taskId)
		.order('created_at', { ascending: true });

	if (error) {
		console.error('Error fetching comments:', error);
		throw error;
	}
	return data || [];
}

/**
 * Add a comment to a task and also update latest_note_at on the task.
 */
export async function addCommentToTask(
	taskId: string,
	authorName: string,
	authorEmail: string | null,
	content: string
): Promise<TaskComment> {
	const { data, error } = await supabase
		.from('task_comments')
		.insert({
			task_id: taskId,
			author_name: authorName,
			author_email: authorEmail,
			content: content.trim()
		})
		.select('*')
		.single();

	if (error || !data) {
		console.error('Error adding comment:', error);
		throw error || new Error('Failed to add comment');
	}

	return data;
}
```

---

## Step 2.2: Create `src/routes/(protected)/tasks/stores.ts`

Create [`src/routes/(protected)/tasks/stores.ts`](../../src/routes/%28protected%29/tasks/stores.ts):

```typescript
import { writable, derived } from 'svelte/store';
import { currentUser } from '$lib/firebase';
import { userProfile, type UserProfile } from '$lib/userProfile';
import {
	type TaskItem,
	type TaskTab,
	type TaskFilters,
	type TaskGroupBy,
	type TaskViewMode,
	type TaskColumnGroup,
	TASK_DEPARTMENTS,
	TASK_STATUSES,
	TASK_PRIORITIES,
	DEPARTMENT_DOT_COLORS,
	STATUS_DOT_COLORS,
	getDueDateDisplay
} from './types';

export const tasks = writable<TaskItem[]>([]);
export const teamMembers = writable<UserProfile[]>([]);
export const isLoadingTasks = writable<boolean>(true);

export const activeTab = writable<TaskTab>('all');
export const groupBy = writable<TaskGroupBy>('department');
export const viewMode = writable<TaskViewMode>('board');

export const taskFilters = writable<TaskFilters>({
	search: '',
	assignee: 'all',
	status: 'all',
	dueDate: 'all'
});

/**
 * Derived list of unique assignee names from both loaded tasks and team profiles.
 */
export const availableAssignees = derived(
	[tasks, teamMembers],
	([$tasks, $teamMembers]) => {
		const names = new Set<string>();
		for (const t of $tasks) {
			if (t.assignee_name) names.add(t.assignee_name);
		}
		for (const member of $teamMembers) {
			const first = (member.firstName || '').trim();
			if (first) names.add(first);
		}
		return Array.from(names).sort((a, b) => a.localeCompare(b));
	}
);

/**
 * Tasks filtered by activeTab ("All tasks", "My tasks", "Assigned by me") and toolbar filters.
 */
export const filteredTasks = derived(
	[tasks, activeTab, taskFilters, currentUser, userProfile],
	([$tasks, $activeTab, $filters, $currentUser, $userProfile]) => {
		const myEmail = ($currentUser?.email || '').toLowerCase();
		const myFirstName = ($userProfile?.firstName || '').trim().toLowerCase();

		return $tasks.filter((task) => {
			// 1. Tab filter
			if ($activeTab === 'my_tasks') {
				const matchesEmail =
					myEmail && (task.assignee_email || '').toLowerCase() === myEmail;
				const matchesName =
					myFirstName && task.assignee_name.trim().toLowerCase() === myFirstName;
				if (!matchesEmail && !matchesName) return false;
			} else if ($activeTab === 'assigned_by_me') {
				if (!myEmail || (task.assigned_by_email || '').toLowerCase() !== myEmail) {
					return false;
				}
			}

			// 2. Search filter
			if ($filters.search.trim()) {
				const q = $filters.search.trim().toLowerCase();
				const inTitle = task.title.toLowerCase().includes(q);
				const inDesc = (task.description || '').toLowerCase().includes(q);
				const inAssignee = task.assignee_name.toLowerCase().includes(q);
				const inDept = task.department.toLowerCase().includes(q);
				if (!inTitle && !inDesc && !inAssignee && !inDept) return false;
			}

			// 3. Assignee filter
			if ($filters.assignee !== 'all') {
				if (task.assignee_name.toLowerCase() !== $filters.assignee.toLowerCase()) {
					return false;
				}
			}

			// 4. Status filter
			if ($filters.status !== 'all') {
				if (task.status !== $filters.status) return false;
			}

			// 5. Due date filter
			if ($filters.dueDate !== 'all') {
				const dueInfo = getDueDateDisplay(task.due_date, task.status);
				if (dueInfo.bucket !== $filters.dueDate) return false;
			}

			return true;
		});
	}
);

/**
 * Top-right summary metrics: "5 open · 1 due today · 1 overdue"
 */
export const taskSummaryStats = derived(filteredTasks, ($filteredTasks) => {
	let openCount = 0;
	let dueTodayCount = 0;
	let overdueCount = 0;

	for (const task of $filteredTasks) {
		const isCompleted = task.status === 'Completed';
		if (!isCompleted) {
			openCount += 1;
		}
		const dueInfo = getDueDateDisplay(task.due_date, task.status);
		if (dueInfo.bucket === 'today' && !isCompleted) {
			dueTodayCount += 1;
		} else if (dueInfo.bucket === 'overdue' && !isCompleted) {
			overdueCount += 1;
		}
	}

	return { openCount, dueTodayCount, overdueCount };
});

/**
 * Grouped columns for the Kanban Board and List views.
 */
export const groupedTasks = derived(
	[filteredTasks, groupBy, availableAssignees],
	([$filteredTasks, $groupBy, $availableAssignees]): TaskColumnGroup[] => {
		if ($groupBy === 'department') {
			return TASK_DEPARTMENTS.map((dept) => ({
				key: dept,
				label: dept,
				dotColorClass: DEPARTMENT_DOT_COLORS[dept] || 'bg-lime-400',
				tasks: $filteredTasks.filter((t) => t.department === dept)
			}));
		}

		if ($groupBy === 'status') {
			return TASK_STATUSES.map((status) => ({
				key: status,
				label: status,
				dotColorClass: STATUS_DOT_COLORS[status] || 'bg-gray-400',
				tasks: $filteredTasks.filter((t) => t.status === status)
			}));
		}

		if ($groupBy === 'priority') {
			const priorityDots: Record<string, string> = {
				Urgent: 'bg-red-500',
				High: 'bg-orange-400',
				Normal: 'bg-blue-400'
			};
			return TASK_PRIORITIES.map((priority) => ({
				key: priority,
				label: priority,
				dotColorClass: priorityDots[priority] || 'bg-gray-400',
				tasks: $filteredTasks.filter((t) => t.priority === priority)
			}));
		}

		// groupBy === 'assignee'
		return $availableAssignees.map((assignee) => ({
			key: assignee,
			label: assignee,
			dotColorClass: 'bg-lime-400',
			tasks: $filteredTasks.filter(
				(t) => t.assignee_name.toLowerCase() === assignee.toLowerCase()
			)
		}));
	}
);
```

---

## Definition of Done (Subphase 2)
- [ ] `src/routes/(protected)/tasks/tasksService.ts` implements all CRUD, checklist step, attachment, and comment operations.
- [ ] `src/routes/(protected)/tasks/stores.ts` exports `tasks`, `filteredTasks`, `taskSummaryStats`, and `groupedTasks` with zero TypeScript errors.
