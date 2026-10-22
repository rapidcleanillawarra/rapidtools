import { supabase } from '$lib/supabase';
import { currentUser } from '$lib/firebase';
import { get } from 'svelte/store';
import type {
	TaskItem,
	TaskStep,
	TaskAttachment,
	TaskComment,
	TaskNote,
	CreateTaskPayload,
	TaskStatus,
	TaskPriority,
	TaskDepartment,
	TaskAssignee
} from './types';
import { getTaskAssignees, parseAssigneesFromName } from './types';

export const TASK_ATTACHMENTS_BUCKET = 'task-attachments';

const LOCAL_PARENT_MAP_KEY = 'rapidtools_task_parent_map';

export function getLocalParentMap(): Record<string, string | null> {
	if (typeof window === 'undefined' || !window.localStorage) return {};
	try {
		const raw = localStorage.getItem(LOCAL_PARENT_MAP_KEY);
		return raw ? JSON.parse(raw) : {};
	} catch {
		return {};
	}
}

export function setLocalParentId(taskId: string, parentTaskId: string | null): void {
	if (typeof window === 'undefined' || !window.localStorage) return;
	try {
		const map = getLocalParentMap();
		if (parentTaskId) {
			map[taskId] = parentTaskId;
		} else {
			delete map[taskId];
		}
		localStorage.setItem(LOCAL_PARENT_MAP_KEY, JSON.stringify(map));
	} catch {}
}

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

	const localParentMap = getLocalParentMap();

	return (data || []).map((row: any) => {
		const steps: TaskStep[] = (row.task_steps || []).sort(
			(a: TaskStep, b: TaskStep) => a.step_order - b.step_order
		);
		const attachments: TaskAttachment[] = (row.task_attachments || []).map((att: TaskAttachment) => ({
			...att,
			public_url: getAttachmentPublicUrl(att.storage_path)
		}));
		const commentCount = Array.isArray(row.task_comments) ? row.task_comments.length : 0;
		const assignees: TaskAssignee[] = getTaskAssignees({
			assignees: row.assignees,
			assignee_name: row.assignee_name,
			assignee_uid: row.assignee_uid,
			assignee_email: row.assignee_email
		});

		return {
			id: row.id,
			parent_task_id:
				row.parent_task_id !== undefined
					? row.parent_task_id
					: (localParentMap[row.id] ?? null),
			title: row.title,
			description: row.description,
			department: row.department as TaskDepartment,
			status: row.status as TaskStatus,
			priority: row.priority as TaskPriority,
			assignee_uid: row.assignee_uid,
			assignee_name: row.assignee_name,
			assignee_email: row.assignee_email,
			assignees,
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

	const assignees =
		payload.assignees && payload.assignees.length > 0
			? payload.assignees
			: parseAssigneesFromName(
					payload.assignee_name || '',
					payload.assignee_uid,
					payload.assignee_email
				);

	const primaryAssignee = assignees[0] || null;
	const assigneeNames =
		assignees.map((a) => a.name).join(', ') || payload.assignee_name?.trim() || '';

	const insertRow: Record<string, any> = {
		parent_task_id: payload.parent_task_id || null,
		title: payload.title.trim(),
		description: payload.description?.trim() || null,
		department: payload.department,
		status: payload.status,
		priority: payload.priority,
		assignee_uid: primaryAssignee?.uid || payload.assignee_uid || null,
		assignee_name: assigneeNames,
		assignee_email: primaryAssignee?.email || payload.assignee_email || null,
		assignees: assignees,
		assigned_by_email: user?.email || null,
		due_date: payload.due_date,
		latest_note: payload.latest_note?.trim() || 'Task created',
		latest_note_at: nowIso
	};

	let createdTask: any = null;
	let { data, error: taskError } = await supabase
		.from('tasks')
		.insert(insertRow)
		.select('*')
		.single();

	if (
		taskError &&
		(taskError.message?.includes('assignees') ||
			taskError.details?.includes('assignees') ||
			taskError.message?.includes('parent_task_id') ||
			taskError.details?.includes('parent_task_id') ||
			taskError.code === 'PGRST204')
	) {
		console.warn('Retrying task insert without optional schema columns');
		if (taskError.message?.includes('assignees') || taskError.details?.includes('assignees')) {
			delete insertRow.assignees;
		}
		if (
			taskError.message?.includes('parent_task_id') ||
			taskError.details?.includes('parent_task_id') ||
			taskError.code === 'PGRST204'
		) {
			delete insertRow.parent_task_id;
		}
		const retry = await supabase.from('tasks').insert(insertRow).select('*').single();
		data = retry.data;
		taskError = retry.error;
	}

	if (taskError || !data) {
		console.error('Error creating task:', taskError);
		throw taskError || new Error('Failed to create task');
	}
	createdTask = data;
	const resolvedParentId = payload.parent_task_id || null;
	setLocalParentId(createdTask.id, resolvedParentId);
	createdTask.parent_task_id = resolvedParentId;

	if (!createdTask.assignees || createdTask.assignees.length === 0) {
		createdTask.assignees = assignees;
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

	// Insert initial note into task_notes
	const initialNote = payload.latest_note?.trim() || 'Task created';
	try {
		await supabase.from('task_notes').insert({
			task_id: createdTask.id,
			author_name: user?.displayName || user?.email?.split('@')[0] || 'System',
			author_email: user?.email || null,
			content: initialNote
		});
	} catch (e) {}

	return {
		...createdTask,
		steps: insertedSteps,
		attachments: insertedAttachments,
		comment_count: 0
	};
}

/**
 * Update core task fields (status, title, priority, department, due_date, assignee, assignees, latest_note).
 */
export async function updateTaskFields(
	taskId: string,
	updates: Partial<{
		parent_task_id: string | null;
		title: string;
		description: string | null;
		department: TaskDepartment;
		status: TaskStatus;
		priority: TaskPriority;
		assignee_uid: string | null;
		assignee_name: string;
		assignee_email: string | null;
		assignees: TaskAssignee[];
		due_date: string;
		latest_note: string | null;
		latest_note_at: string | null;
	}>
): Promise<void> {
	if ('parent_task_id' in updates) {
		setLocalParentId(taskId, updates.parent_task_id ?? null);
	}

	const fullUpdates: Record<string, any> = { ...updates };
	if (updates.assignees && !updates.assignee_name) {
		fullUpdates.assignee_name = updates.assignees.map((a) => a.name).join(', ');
		const primary = updates.assignees[0];
		if (primary) {
			fullUpdates.assignee_uid = primary.uid || null;
			fullUpdates.assignee_email = primary.email || null;
		}
	}

	const { error } = await supabase
		.from('tasks')
		.update({
			...fullUpdates,
			updated_at: new Date().toISOString()
		})
		.eq('id', taskId);

	if (error) {
		// If assignees or parent_task_id column doesn't exist yet on Supabase, retry without them
		if (
			(fullUpdates.assignees &&
				(error.message?.includes('assignees') ||
					error.details?.includes('assignees') ||
					error.code === 'PGRST204')) ||
			(error.message?.includes('parent_task_id') ||
				error.details?.includes('parent_task_id') ||
				error.code === 'PGRST204')
		) {
			console.warn('Retrying updateTaskFields without optional columns');
			if (error.message?.includes('assignees') || error.details?.includes('assignees')) {
				delete fullUpdates.assignees;
			}
			if (
				error.message?.includes('parent_task_id') ||
				error.details?.includes('parent_task_id') ||
				error.code === 'PGRST204'
			) {
				delete fullUpdates.parent_task_id;
			}
			const { error: retryError } = await supabase
				.from('tasks')
				.update({
					...fullUpdates,
					updated_at: new Date().toISOString()
				})
				.eq('id', taskId);

			if (retryError) {
				console.error('Error updating task fallback:', retryError);
				throw retryError;
			}
			return;
		}

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
 * Delete a task attachment from storage and the database table.
 */
export async function deleteTaskAttachment(
	attachmentId: string,
	storagePath?: string
): Promise<void> {
	if (storagePath) {
		try {
			await supabase.storage.from(TASK_ATTACHMENTS_BUCKET).remove([storagePath]);
		} catch (err) {
			console.warn('Could not remove file from storage:', err);
		}
	}

	const { error } = await supabase
		.from('task_attachments')
		.delete()
		.eq('id', attachmentId);

	if (error) {
		console.error('Error deleting attachment:', error);
		throw error;
	}
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

/**
 * Fetch all notes for a task in chronological order (oldest to newest).
 */
export async function fetchNotesForTask(taskId: string): Promise<TaskNote[]> {
	try {
		const { data, error } = await supabase
			.from('task_notes')
			.select('*')
			.eq('task_id', taskId)
			.order('created_at', { ascending: true });

		if (!error && data) {
			if (typeof window !== 'undefined' && window.localStorage) {
				try {
					localStorage.setItem(`rapidtools_task_notes_${taskId}`, JSON.stringify(data));
				} catch (e) {}
			}
			return data;
		}
	} catch (err) {
		console.warn('task_notes table query error, falling back:', err);
	}

	if (typeof window !== 'undefined' && window.localStorage) {
		try {
			const saved = localStorage.getItem(`rapidtools_task_notes_${taskId}`);
			if (saved) return JSON.parse(saved);
		} catch (e) {}
	}

	return [];
}

/**
 * Add a new note to a task and update latest_note / latest_note_at on the task.
 */
export async function addNoteToTask(
	taskId: string,
	authorName: string,
	authorEmail: string | null,
	content: string
): Promise<TaskNote> {
	const nowIso = new Date().toISOString();
	const trimmed = content.trim();

	// 1. Update latest_note and latest_note_at on tasks table
	try {
		await supabase
			.from('tasks')
			.update({
				latest_note: trimmed,
				latest_note_at: nowIso,
				updated_at: nowIso
			})
			.eq('id', taskId);
	} catch (e) {
		console.error('Error updating task latest_note:', e);
	}

	let createdNote: TaskNote = {
		id: crypto.randomUUID(),
		task_id: taskId,
		author_name: authorName,
		author_email: authorEmail,
		content: trimmed,
		created_at: nowIso
	};

	// 2. Insert into task_notes table
	try {
		const { data, error } = await supabase
			.from('task_notes')
			.insert({
				task_id: taskId,
				author_name: authorName,
				author_email: authorEmail,
				content: trimmed
			})
			.select('*')
			.single();

		if (!error && data) {
			createdNote = data;
		}
	} catch (e) {
		console.warn('Error inserting into task_notes, using local note:', e);
	}

	// 3. Mirror in localStorage
	if (typeof window !== 'undefined' && window.localStorage) {
		try {
			const key = `rapidtools_task_notes_${taskId}`;
			const existing = localStorage.getItem(key);
			const list: TaskNote[] = existing ? JSON.parse(existing) : [];
			list.push(createdNote);
			localStorage.setItem(key, JSON.stringify(list));
		} catch (e) {}
	}

	return createdNote;
}

/**
 * Delete a note from a task.
 */
export async function deleteNoteFromTask(noteId: string, taskId: string): Promise<void> {
	try {
		await supabase.from('task_notes').delete().eq('id', noteId);
	} catch (e) {}

	if (typeof window !== 'undefined' && window.localStorage) {
		try {
			const key = `rapidtools_task_notes_${taskId}`;
			const existing = localStorage.getItem(key);
			if (existing) {
				const list: TaskNote[] = JSON.parse(existing);
				const filtered = list.filter((n) => n.id !== noteId);
				localStorage.setItem(key, JSON.stringify(filtered));
			}
		} catch (e) {}
	}
}

export interface DepartmentRecord {
	id?: string;
	name: string;
	color_class?: string | null;
	created_at?: string;
}

export const LOCAL_STORAGE_DEPARTMENTS_KEY = 'rapidtools_custom_task_departments';

/**
 * Fetch custom departments from Supabase (with localStorage fallback/sync).
 */
export async function fetchCustomDepartments(): Promise<DepartmentRecord[]> {
	let supabaseRecords: DepartmentRecord[] = [];
	try {
		const { data, error } = await supabase
			.from('task_departments')
			.select('*')
			.order('created_at', { ascending: true });

		if (!error && data) {
			supabaseRecords = data.map((d: any) => ({
				id: d.id,
				name: d.name,
				color_class: d.color_class,
				created_at: d.created_at
			}));
		}
	} catch (err) {
		// Table might not exist yet; gracefully fallback
	}

	let localRecords: DepartmentRecord[] = [];
	if (typeof window !== 'undefined' && window.localStorage) {
		try {
			const saved = localStorage.getItem(LOCAL_STORAGE_DEPARTMENTS_KEY);
			if (saved) {
				localRecords = JSON.parse(saved);
			}
		} catch (e) {
			console.error('Error reading departments from localStorage', e);
		}
	}

	const map = new Map<string, DepartmentRecord>();
	for (const rec of localRecords) {
		if (rec && rec.name) map.set(rec.name.toLowerCase(), rec);
	}
	for (const rec of supabaseRecords) {
		if (rec && rec.name) map.set(rec.name.toLowerCase(), rec);
	}

	const merged = Array.from(map.values());

	if (typeof window !== 'undefined' && window.localStorage) {
		try {
			localStorage.setItem(LOCAL_STORAGE_DEPARTMENTS_KEY, JSON.stringify(merged));
		} catch (e) {}
	}

	return merged;
}

/**
 * Save a custom department to Supabase (and localStorage).
 */
export async function saveCustomDepartment(
	name: string,
	colorClass?: string
): Promise<DepartmentRecord> {
	const trimmedName = name.trim();
	const newRecord: DepartmentRecord = {
		name: trimmedName,
		color_class: colorClass || null
	};

	if (typeof window !== 'undefined' && window.localStorage) {
		try {
			const existingRaw = localStorage.getItem(LOCAL_STORAGE_DEPARTMENTS_KEY);
			const list: DepartmentRecord[] = existingRaw ? JSON.parse(existingRaw) : [];
			if (!list.some((d) => d.name.toLowerCase() === trimmedName.toLowerCase())) {
				list.push(newRecord);
				localStorage.setItem(LOCAL_STORAGE_DEPARTMENTS_KEY, JSON.stringify(list));
			}
		} catch (e) {
			console.error('Error saving department to localStorage', e);
		}
	}

	try {
		const { data, error } = await supabase
			.from('task_departments')
			.insert({
				name: trimmedName,
				color_class: colorClass || null
			})
			.select('*')
			.single();

		if (!error && data) {
			return {
				id: data.id,
				name: data.name,
				color_class: data.color_class,
				created_at: data.created_at
			};
		}
	} catch (err) {
		// Ignore if table doesn't exist
	}

	return newRecord;
}

/**
 * Delete a custom department.
 */
export async function deleteCustomDepartment(name: string): Promise<void> {
	const trimmed = name.trim();
	if (typeof window !== 'undefined' && window.localStorage) {
		try {
			const existingRaw = localStorage.getItem(LOCAL_STORAGE_DEPARTMENTS_KEY);
			if (existingRaw) {
				const list: DepartmentRecord[] = JSON.parse(existingRaw);
				const filtered = list.filter((d) => d.name.toLowerCase() !== trimmed.toLowerCase());
				localStorage.setItem(LOCAL_STORAGE_DEPARTMENTS_KEY, JSON.stringify(filtered));
			}
		} catch (e) {}
	}

	try {
		await supabase.from('task_departments').delete().ilike('name', trimmed);
	} catch (err) {}
}

/**
 * Set or clear a task's parent_task_id (move subtask to another parent, or promote to root).
 */
export async function updateTaskParentId(
	taskId: string,
	newParentId: string | null,
	newDepartment?: TaskDepartment
): Promise<void> {
	setLocalParentId(taskId, newParentId);

	const updates: Record<string, any> = {
		parent_task_id: newParentId,
		updated_at: new Date().toISOString()
	};
	if (newDepartment) {
		updates.department = newDepartment;
	}

	const { error } = await supabase.from('tasks').update(updates).eq('id', taskId);

	if (error) {
		if (
			error.message?.includes('parent_task_id') ||
			error.details?.includes('parent_task_id') ||
			error.code === 'PGRST204'
		) {
			if (newDepartment) {
				await supabase
					.from('tasks')
					.update({ department: newDepartment, updated_at: new Date().toISOString() })
					.eq('id', taskId);
			}
			return;
		}
		console.error('Error updating task parent_task_id:', error);
		throw error;
	}
}

/**
 * Interchange (swap) a parent task and one of its subtasks:
 * - The child subtask takes the parent's former parent_task_id (e.g., null if root).
 * - The former parent becomes a child of the promoted subtask.
 * - Any other sibling subtasks of the former parent are re-pointed to the new parent task.
 */
export async function swapParentAndChildTaskInDb(
	parentTask: TaskItem,
	childTask: TaskItem,
	siblingTaskIds: string[] = []
): Promise<void> {
	const grandParentId = parentTask.parent_task_id ?? null;

	// 1. Promote childTask to grandParentId
	await updateTaskParentId(childTask.id, grandParentId, parentTask.department);

	// 2. Demote parentTask to be a child of childTask
	await updateTaskParentId(parentTask.id, childTask.id, parentTask.department);

	// 3. Re-point any other siblings to the new parent (childTask.id)
	for (const sibId of siblingTaskIds) {
		if (sibId !== childTask.id && sibId !== parentTask.id) {
			await updateTaskParentId(sibId, childTask.id);
		}
	}
}

