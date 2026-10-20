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
