# Subphase 13: Dynamic Subtasks, Parent/Child Interchange & Reparenting

## Goal for the Model
Upgrade the **Tasks** module (`/tasks`) to support **full-featured dynamic subtasks** (parent-child task relationships) where any task can have subtasks, subtasks can be promoted to standalone tasks, standalone tasks can be moved under any parent task, subtasks can be moved to another parent task, and a parent task can be swapped (interchanged) with one of its child subtasks—all dynamically with Supabase persistence and `localStorage` fallback.

This specification is split into **4 sequential implementation phases (steps)** so smaller models can execute one phase at a time with minimal context window usage and zero ambiguity.

---

## Context Files to Read First
1. [`src/routes/(protected)/tasks/types.ts`](../../src/routes/%28protected%29/tasks/types.ts)
2. [`src/routes/(protected)/tasks/tasksService.ts`](../../src/routes/%28protected%29/tasks/tasksService.ts)
3. [`src/routes/(protected)/tasks/stores.ts`](../../src/routes/%28protected%29/tasks/stores.ts)
4. [`src/routes/(protected)/tasks/components/TaskCard.svelte`](../../src/routes/%28protected%29/tasks/components/TaskCard.svelte)
5. [`src/routes/(protected)/tasks/components/TaskBoardColumn.svelte`](../../src/routes/%28protected%29/tasks/components/TaskBoardColumn.svelte)
6. [`src/routes/(protected)/tasks/components/TasksListView.svelte`](../../src/routes/%28protected%29/tasks/components/TasksListView.svelte)
7. [`src/routes/(protected)/tasks/components/CreateTaskModal.svelte`](../../src/routes/%28protected%29/tasks/components/CreateTaskModal.svelte)
8. [`src/routes/(protected)/tasks/components/TaskDetailModal.svelte`](../../src/routes/%28protected%29/tasks/components/TaskDetailModal.svelte)
9. [`src/routes/(protected)/tasks/+page.svelte`](../../src/routes/%28protected%29/tasks/+page.svelte)

---

## Execution Overview (Phased Breakdown for Lower Models)

| Phase / Step | Target Files | Scope Summary |
| :--- | :--- | :--- |
| **Phase 13.1** | Supabase SQL + `types.ts` + `tasksService.ts` | Add `parent_task_id` self-referencing column to `public.tasks`, update `TaskItem` & `CreateTaskPayload` types, add subtask progress/cycle helpers in `types.ts`, and implement reparenting, promotion, and parent-child swap/interchange functions in `tasksService.ts` (with automatic `localStorage` fallback if the DB column is not yet migrated). |
| **Phase 13.2** | `stores.ts` | Add reactive subtask tree stores (`subtasksByParentId`, `rootTasks`), update `groupedTasks` so top-level cards/rows represent parent/standalone tasks (preventing duplicate clutter while keeping orphan/filtered subtasks visible), and export store action helpers (`assignTaskParent`, `promoteSubtaskToParent`, `swapParentAndSubtask`). |
| **Phase 13.3** | `TaskCard.svelte`, `TaskBoardColumn.svelte`, `TasksListView.svelte` | Render collapsible inline subtasks on Kanban cards (`TaskCard.svelte`) and indented expandable subtask rows in `TasksListView.svelte`, plus quick action menu items (`Add subtask`, `Move to parent...`, `Make standalone task`, `Swap with parent`) and drag-and-drop onto cards/rows to reparent or interchange. |
| **Phase 13.4** | `CreateTaskModal.svelte`, `TaskDetailModal.svelte`, `+page.svelte` | Add optional `Parent task` selector in `CreateTaskModal.svelte`; add a full **Hierarchy & Subtasks Manager** section in `TaskDetailModal.svelte` (parent breadcrumb, change/remove parent dropdown, one-click **Swap with Parent**, inline quick-create subtask, attach existing task as subtask, and per-subtask actions: open, move to another parent, promote to standalone, or make parent); wire events in `+page.svelte`. |

---

## Phase 13.1: Database Schema, Types & Service Layer (`types.ts` & `tasksService.ts`)

### Step 13.1A — Supabase SQL Migration (Run in Supabase SQL Editor)

Run the following idempotent SQL migration in Supabase to add `parent_task_id` to `public.tasks`:

```sql
-- Add self-referencing parent_task_id to public.tasks
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON public.tasks(parent_task_id);
```

> [!NOTE]
> Even if this SQL migration has not been executed yet, `tasksService.ts` in Step 13.1C includes an automatic `localStorage` fallback (`rapidtools_task_parent_map`) so parent/subtask relationships work immediately without errors.

---

### Step 13.1B — Update `src/routes/(protected)/tasks/types.ts`

1. Add `parent_task_id?: string | null;` to `TaskItem` (around line 93 of `types.ts`):

```typescript
export interface TaskItem {
	id: string;
	parent_task_id?: string | null;
	title: string;
	description: string | null;
```

2. Add `parent_task_id?: string | null;` to `CreateTaskPayload` (around line 127 of `types.ts`):

```typescript
export interface CreateTaskPayload {
	parent_task_id?: string | null;
	title: string;
	description?: string;
```

3. Append the following subtask hierarchy and progress helper functions at the bottom of [`src/routes/(protected)/tasks/types.ts`](../../src/routes/%28protected%29/tasks/types.ts):

```typescript
/**
 * Calculate subtask completion summary for a given parent task.
 */
export function getSubtaskProgress(subtasks: TaskItem[] = []): {
	completed: number;
	total: number;
	percent: number;
} {
	const total = subtasks.length;
	if (total === 0) {
		return { completed: 0, total: 0, percent: 0 };
	}
	const completed = subtasks.filter((t) => t.status === 'Completed').length;
	const percent = Math.round((completed / total) * 100);
	return { completed, total, percent };
}

/**
 * Returns true if setting `candidateParentId` as the parent of `taskId`
 * would create a circular reference (a task cannot be its own ancestor).
 */
export function wouldCreateSubtaskCycle(
	allTasks: TaskItem[],
	taskId: string,
	candidateParentId: string | null | undefined
): boolean {
	if (!candidateParentId) return false;
	if (taskId === candidateParentId) return true;

	const map = new Map<string, TaskItem>();
	for (const t of allTasks) {
		map.set(t.id, t);
	}

	let currentId: string | null | undefined = candidateParentId;
	const visited = new Set<string>();

	while (currentId) {
		if (currentId === taskId) return true;
		if (visited.has(currentId)) break;
		visited.add(currentId);
		const node = map.get(currentId);
		currentId = node?.parent_task_id || null;
	}

	return false;
}

/**
 * Returns all tasks that are valid parent candidates for `taskId`
 * (excludes `taskId` itself and any of its descendants).
 */
export function getValidParentTasks(allTasks: TaskItem[], taskId?: string | null): TaskItem[] {
	if (!taskId) return allTasks;
	return allTasks.filter((t) => t.id !== taskId && !wouldCreateSubtaskCycle(allTasks, taskId, t.id));
}
```

---

### Step 13.1C — Update `src/routes/(protected)/tasks/tasksService.ts`

1. Right below `export const TASK_ATTACHMENTS_BUCKET = 'task-attachments';` (around line 18 of `tasksService.ts`), add the local parent-map fallback helpers so parent-child links persist even if the Supabase `parent_task_id` column is missing:

```typescript
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
```

2. In `fetchAllTasks()` inside `tasksService.ts`:
- Read `const localParentMap = getLocalParentMap();` before `.map((row: any) => ...)`
- Inside the returned object for each row (around line 69), include `parent_task_id`:

```typescript
		return {
			id: row.id,
			parent_task_id:
				row.parent_task_id !== undefined
					? row.parent_task_id
					: (localParentMap[row.id] ?? null),
			title: row.title,
```

3. In `createTaskRecord(payload: CreateTaskPayload)` inside `tasksService.ts`:
- Add `parent_task_id: payload.parent_task_id || null` to `insertRow`:

```typescript
	const insertRow: Record<string, any> = {
		parent_task_id: payload.parent_task_id || null,
		title: payload.title.trim(),
```

- In the fallback retry check (around line 136), also handle if `parent_task_id` is not yet in the Supabase schema:

```typescript
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
```

- After `createdTask = data;`, persist `parent_task_id` in `setLocalParentId`:

```typescript
	const resolvedParentId = payload.parent_task_id || null;
	setLocalParentId(createdTask.id, resolvedParentId);
	createdTask.parent_task_id = resolvedParentId;
```

4. In `updateTaskFields(taskId, updates)` inside `tasksService.ts`:
- Add `parent_task_id: string | null;` to the `updates` parameter type.
- If `'parent_task_id' in updates`, call `setLocalParentId(taskId, updates.parent_task_id ?? null);`.
- In the error fallback block (around line 247), also strip `parent_task_id` if Supabase reports a missing column error so the rest of the update succeeds.

5. Append the dedicated subtask relationship operations at the bottom of [`src/routes/(protected)/tasks/tasksService.ts`](../../src/routes/%28protected%29/tasks/tasksService.ts):

```typescript
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
```

### Definition of Done (Phase 13.1)
- [ ] `TaskItem` and `CreateTaskPayload` include `parent_task_id?: string | null`.
- [ ] `getSubtaskProgress`, `wouldCreateSubtaskCycle`, and `getValidParentTasks` are exported from `types.ts`.
- [ ] `fetchAllTasks`, `createTaskRecord`, `updateTaskFields`, `updateTaskParentId`, and `swapParentAndChildTaskInDb` in `tasksService.ts` handle `parent_task_id` with full `localStorage` fallback.

---

## Phase 13.2: Reactive Subtask Hierarchy & Action Helpers (`stores.ts`)

### Goal for the Model
Update [`src/routes/(protected)/tasks/stores.ts`](../../src/routes/%28protected%29/tasks/stores.ts) so the UI has reactive maps of every parent task's subtasks, prevents subtasks from duplicating as top-level cards when their parent is already displayed in the same view, and provides clean store actions to reparent, promote, or interchange tasks.

### Step 13.2A — Add Derived Subtask Stores in `stores.ts`

1. Import `wouldCreateSubtaskCycle` from `./types` and `updateTaskParentId`, `swapParentAndChildTaskInDb` from `./tasksService` at the top of `src/routes/(protected)/tasks/stores.ts`.

2. Add `subtasksByParentId` derived store right above `filteredTasks` in `stores.ts`:

```typescript
/**
 * Map of parent_task_id -> sorted array of child TaskItems.
 */
export const subtasksByParentId = derived(
	[tasks, sortBy],
	([$tasks, $sortBy]): Record<string, TaskItem[]> => {
		const map: Record<string, TaskItem[]> = {};
		for (const t of $tasks) {
			if (t.parent_task_id) {
				if (!map[t.parent_task_id]) {
					map[t.parent_task_id] = [];
				}
				map[t.parent_task_id].push(t);
			}
		}
		for (const parentId of Object.keys(map)) {
			map[parentId].sort((a, b) => compareTasks(a, b, $sortBy));
		}
		return map;
	}
);
```

3. Update `filteredTasks` in `stores.ts` so that if a parent task's subtask matches the active search query, the parent task is also included in `filteredTasks` (so the user can see the parent with its matching subtask):

```typescript
			// 2. Search filter (matches task itself OR any of its child subtasks)
			if ($filters.search.trim()) {
				const q = $filters.search.trim().toLowerCase();
				const matchesTask = (item: TaskItem) => {
					const inTitle = item.title.toLowerCase().includes(q);
					const inDesc = (item.description || '').toLowerCase().includes(q);
					const inAssignee =
						item.assignee_name.toLowerCase().includes(q) ||
						getTaskAssignees(item).some((a) => a.name.toLowerCase().includes(q));
					const inDept = item.department.toLowerCase().includes(q);
					return inTitle || inDesc || inAssignee || inDept;
				};

				const selfMatch = matchesTask(task);
				const childMatch = $tasks.some(
					(child) => child.parent_task_id === task.id && matchesTask(child)
				);
				if (!selfMatch && !childMatch) return false;
			}
```

4. Update `groupedTasks` in `stores.ts` so that top-level items in each column/group only include:
- Root/standalone tasks (`!t.parent_task_id`), **OR**
- Subtasks whose parent task is **not** present in `$filteredTasks` (e.g. when filtering by "My tasks" or specific status where only the subtask matches, ensuring subtasks are never hidden from an assignee's filtered view).

```typescript
export const groupedTasks = derived(
	[filteredTasks, groupBy, sortBy, availableAssignees, visibleDepartments, departmentColors],
	([$filteredTasks, $groupBy, $sortBy, $availableAssignees, $visibleDepartments, $departmentColors]): TaskColumnGroup[] => {
		const filteredIds = new Set($filteredTasks.map((t) => t.id));
		// Show root tasks, plus any subtask whose parent is not currently in filteredTasks
		const topLevelTasks = $filteredTasks.filter(
			(t) => !t.parent_task_id || !filteredIds.has(t.parent_task_id)
		);
		const sortList = (list: TaskItem[]) => [...list].sort((a, b) => compareTasks(a, b, $sortBy));
```
*(Then replace `$filteredTasks.filter(...)` with `topLevelTasks.filter(...)` inside the 4 `$groupBy` branches of `groupedTasks`.)*

---

### Step 13.2B — Add Dynamic Reparenting, Promotion & Interchange Store Actions in `stores.ts`

Append these three exported functions at the bottom of [`src/routes/(protected)/tasks/stores.ts`](../../src/routes/%28protected%29/tasks/stores.ts):

```typescript
/**
 * Move a task under a new parent task (or pass `null` to make it a standalone root task).
 * Syncs department with the new parent task when moving under a parent.
 */
export async function assignTaskParent(
	taskId: string,
	newParentId: string | null
): Promise<boolean> {
	const currentList = get(tasks);
	const targetTask = currentList.find((t) => t.id === taskId);
	if (!targetTask) return false;

	if (newParentId && wouldCreateSubtaskCycle(currentList, taskId, newParentId)) {
		throw new Error('Cannot move a parent task inside its own subtask');
	}

	const newParent = newParentId ? currentList.find((t) => t.id === newParentId) : null;
	const nextDepartment = newParent ? newParent.department : targetTask.department;

	// Optimistic update
	tasks.update((list) =>
		list.map((t) =>
			t.id === taskId
				? {
						...t,
						parent_task_id: newParentId,
						department: nextDepartment,
						updated_at: new Date().toISOString()
					}
				: t
		)
	);

	await updateTaskParentId(
		taskId,
		newParentId,
		newParent ? nextDepartment : undefined
	);
	return true;
}

/**
 * Promote a child subtask to a standalone root task (`parent_task_id = null`).
 */
export async function promoteSubtaskToParent(subtaskId: string): Promise<boolean> {
	return assignTaskParent(subtaskId, null);
}

/**
 * Dynamically interchange (swap) a parent task and one of its subtasks:
 * - The subtask becomes the new parent task (inheriting the old parent's `parent_task_id` and `department`).
 * - The old parent becomes a subtask of the newly promoted task.
 * - All other subtasks of the old parent become subtasks of the newly promoted task.
 */
export async function swapParentAndSubtask(
	parentTaskId: string,
	subtaskId: string
): Promise<void> {
	const currentList = get(tasks);
	const parentTask = currentList.find((t) => t.id === parentTaskId);
	const childTask = currentList.find((t) => t.id === subtaskId);

	if (!parentTask || !childTask) {
		throw new Error('Task not found for swap');
	}

	const grandParentId = parentTask.parent_task_id ?? null;
	const siblingIds = currentList
		.filter((t) => t.parent_task_id === parentTaskId && t.id !== subtaskId)
		.map((t) => t.id);

	const nowIso = new Date().toISOString();

	// Optimistic reactive store update
	tasks.update((list) =>
		list.map((t) => {
			if (t.id === subtaskId) {
				return {
					...t,
					parent_task_id: grandParentId,
					department: parentTask.department,
					updated_at: nowIso
				};
			}
			if (t.id === parentTaskId) {
				return {
					...t,
					parent_task_id: subtaskId,
					department: parentTask.department,
					updated_at: nowIso
				};
			}
			if (siblingIds.includes(t.id)) {
				return {
					...t,
					parent_task_id: subtaskId,
					department: parentTask.department,
					updated_at: nowIso
				};
			}
			return t;
		})
	);

	await swapParentAndChildTaskInDb(parentTask, childTask, siblingIds);
}
```

### Definition of Done (Phase 13.2)
- [ ] `subtasksByParentId` is exported from `stores.ts`.
- [ ] `groupedTasks` displays root tasks and only surfaces subtasks at top level if their parent is filtered out.
- [ ] `assignTaskParent`, `promoteSubtaskToParent`, and `swapParentAndSubtask` are exported from `stores.ts`.

---

## Phase 13.3: Subtasks in Kanban Cards & List View (`TaskCard.svelte`, `TaskBoardColumn.svelte`, `TasksListView.svelte`)

### Goal for the Model
Make subtasks visible, interactive, and draggable/interchangeable directly from both **Board view** and **List view**:
1. **`TaskCard.svelte`**:
   - Show a parent breadcrumb badge if a card is a subtask shown in a filtered view.
   - Show a collapsible **Subtasks (`X/Y`)** section on any parent card with quick checkbox toggle, click-to-open subtask, quick `+` button to add a subtask, and quick actions (`Swap with parent`, `Make standalone`, `Move to parent...`).
   - Support dragging a task/subtask card and dropping it onto another `TaskCard` to make it a subtask of that card (or swap if already related).
2. **`TaskBoardColumn.svelte`**:
   - Forward `addSubtask` event and support dropping a dragged subtask onto the column background to promote it to a standalone root task in that bucket.
3. **`TasksListView.svelte`**:
   - Render an expand/collapse chevron on parent rows with a subtask count badge (`2/3 subtasks`).
   - When expanded, render indented child subtask rows underneath the parent row with quick action buttons (`Make standalone`, `Swap with parent`, `Open`).

---

### Step 13.3A — Update `src/routes/(protected)/tasks/components/TaskCard.svelte`

1. Update imports from `../stores` and `../types` in [`TaskCard.svelte`](../../src/routes/%28protected%29/tasks/components/TaskCard.svelte):

```typescript
	import {
		tasks,
		seenTaskIds,
		subtasksByParentId,
		assignTaskParent,
		promoteSubtaskToParent,
		swapParentAndSubtask
	} from '../stores';
	import { toastSuccess, toastError } from '$lib/utils/toast';
	import {
		type TaskItem,
		type TaskStatus,
		TASK_STATUSES,
		STATUS_DOT_COLORS,
		getTaskProgress,
		getSubtaskProgress,
		getProgressBarColor,
		getInitials,
		getAvatarColorClasses,
		getDueDateDisplay,
		formatShortDate,
		isImageAttachment,
		getTaskAssignees,
		isTaskAssignedToUser,
		getValidParentTasks
	} from '../types';
```

2. Add `addSubtask: TaskItem` to `createEventDispatcher` in `TaskCard.svelte`:

```typescript
	const dispatch = createEventDispatcher<{
		select: TaskItem;
		statusChange: { task: TaskItem; status: TaskStatus };
		delete: TaskItem;
		openPhotos: { task: TaskItem; initialIndex: number };
		addSubtask: TaskItem;
	}>();
```

3. Add reactive subtask state and drag/reparent handlers in `<script lang="ts">` of `TaskCard.svelte`:

```typescript
	let subtasksExpanded = true;
	let moveParentSubmenuOpen = false;
	let isDragOverCard = false;

	$: subtasks = $subtasksByParentId[task.id] || [];
	$: subtaskProgress = getSubtaskProgress(subtasks);
	$: parentTask = task.parent_task_id
		? $tasks.find((t) => t.id === task.parent_task_id) || null
		: null;
	$: validParents = getValidParentTasks($tasks, task.id).filter(
		(t) => !t.parent_task_id && t.id !== task.parent_task_id
	);

	async function handleMoveToParent(newParentId: string | null, e: MouseEvent) {
		e.stopPropagation();
		actionMenuOpen = false;
		moveParentSubmenuOpen = false;
		try {
			await assignTaskParent(task.id, newParentId);
			toastSuccess(newParentId ? 'Moved under parent task' : 'Promoted to standalone task');
		} catch (err: any) {
			toastError(err?.message || 'Failed to update task hierarchy');
		}
	}

	async function handleSwapWithSubtask(sub: TaskItem, e: MouseEvent) {
		e.stopPropagation();
		try {
			await swapParentAndSubtask(task.id, sub.id);
			toastSuccess(`Swapped "${sub.title}" as parent task`);
		} catch (err: any) {
			toastError(err?.message || 'Failed to swap parent and subtask');
		}
	}

	async function handleSwapWithMyParent(e: MouseEvent) {
		e.stopPropagation();
		actionMenuOpen = false;
		if (!task.parent_task_id) return;
		try {
			await swapParentAndSubtask(task.parent_task_id, task.id);
			toastSuccess(`Promoted "${task.title}" and swapped with former parent`);
		} catch (err: any) {
			toastError(err?.message || 'Failed to swap with parent');
		}
	}

	function handleTaskDragStart(e: DragEvent) {
		e.stopPropagation();
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('application/x-rapidtools-task-id', task.id);
		}
	}

	function handleTaskDragOver(e: DragEvent) {
		if (!e.dataTransfer?.types.includes('application/x-rapidtools-task-id')) return;
		e.preventDefault();
		e.stopPropagation();
		isDragOverCard = true;
	}

	function handleTaskDragLeave() {
		isDragOverCard = false;
	}

	async function handleTaskDropOnCard(e: DragEvent) {
		if (!e.dataTransfer?.types.includes('application/x-rapidtools-task-id')) return;
		e.preventDefault();
		e.stopPropagation();
		isDragOverCard = false;

		const draggedTaskId = e.dataTransfer.getData('application/x-rapidtools-task-id');
		if (!draggedTaskId || draggedTaskId === task.id) return;

		try {
			// If dropping a parent onto its own child, interchange them!
			if (task.parent_task_id === draggedTaskId) {
				await swapParentAndSubtask(draggedTaskId, task.id);
				toastSuccess('Interchanged parent and child task');
				return;
			}
			await assignTaskParent(draggedTaskId, task.id);
			toastSuccess(`Attached as subtask of "${task.title}"`);
		} catch (err: any) {
			toastError(err?.message || 'Cannot move task here');
		}
	}
```

4. On the root `<div on:click={handleCardClick} ...>` of `TaskCard.svelte`, add `draggable="true"` and the drag handlers:

```svelte
<div
	on:click={handleCardClick}
	draggable="true"
	on:dragstart={handleTaskDragStart}
	on:dragover={handleTaskDragOver}
	on:dragleave={handleTaskDragLeave}
	on:drop={handleTaskDropOnCard}
	class="group relative cursor-pointer rounded-xl border p-3.5 shadow-md transition-all duration-150 {isDragOverCard
		? 'border-lime-400 bg-[#1e2420] ring-2 ring-lime-400/50'
		: 'border-[#262a30] bg-[#181b20] hover:border-[#333842] hover:bg-[#1b1f25]'}"
>
```

5. Inside the Card `...` menu (`{#if actionMenuOpen}` in `TaskCard.svelte`), add hierarchy actions right below `Open details`:

```svelte
					<button
						type="button"
						on:click={() => {
							actionMenuOpen = false;
							dispatch('addSubtask', task);
						}}
						class="block w-full px-3 py-1.5 text-left text-xs text-lime-400 hover:bg-[#1f2329]"
					>
						+ Add subtask
					</button>

					{#if task.parent_task_id}
						<button
							type="button"
							on:click={handleSwapWithMyParent}
							class="block w-full px-3 py-1.5 text-left text-xs text-cyan-400 hover:bg-[#1f2329]"
						>
							⇄ Swap with parent
						</button>
						<button
							type="button"
							on:click={(e) => handleMoveToParent(null, e)}
							class="block w-full px-3 py-1.5 text-left text-xs text-amber-300 hover:bg-[#1f2329]"
						>
							↑ Make standalone
						</button>
					{/if}

					{#if validParents.length > 0}
						<div class="border-t border-[#262a30] pt-1 mt-1">
							<button
								type="button"
								on:click|stopPropagation={() => (moveParentSubmenuOpen = !moveParentSubmenuOpen)}
								class="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-[#1f2329]"
							>
								<span>Move under parent</span>
								<span>{moveParentSubmenuOpen ? '▴' : '▾'}</span>
							</button>
							{#if moveParentSubmenuOpen}
								<div class="max-h-36 overflow-y-auto bg-[#101215] py-1">
									{#each validParents as candidate (candidate.id)}
										<button
											type="button"
											on:click={(e) => handleMoveToParent(candidate.id, e)}
											class="block w-full truncate px-4 py-1 text-left text-[11px] text-gray-300 hover:bg-[#1f2329] hover:text-lime-400"
											title={candidate.title}
										>
											↳ {candidate.title}
										</button>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
```

6. Right above `<!-- 2. Task Title -->` in `TaskCard.svelte`, render a parent badge if `parentTask` exists:

```svelte
	{#if parentTask}
		<div
			on:click|stopPropagation={() => dispatch('select', parentTask)}
			class="mb-1.5 inline-flex max-w-full items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-950/25 px-2 py-0.5 text-[10px] font-medium text-cyan-300 hover:border-cyan-400"
			title="Click to open parent task: {parentTask.title}"
		>
			<span>↳ Subtask of:</span>
			<span class="truncate font-semibold">{parentTask.title}</span>
		</div>
	{/if}
```

7. Right below `<!-- 3. Progress Section -->` in `TaskCard.svelte`, render the collapsible **Subtasks List** whenever `subtasks.length > 0`:

```svelte
	<!-- 3b. Subtasks Section -->
	{#if subtasks.length > 0}
		<div
			on:click|stopPropagation
			class="mb-3.5 rounded-lg border border-[#262a30] bg-[#141619] p-2.5"
		>
			<div class="flex items-center justify-between text-[11px]">
				<button
					type="button"
					on:click={() => (subtasksExpanded = !subtasksExpanded)}
					class="inline-flex items-center gap-1.5 font-semibold text-gray-200 hover:text-lime-400"
				>
					<svg
						class="h-3.5 w-3.5 text-lime-400 transition-transform {subtasksExpanded ? 'rotate-90' : ''}"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
					</svg>
					<span>Subtasks ({subtaskProgress.completed}/{subtaskProgress.total})</span>
				</button>

				<button
					type="button"
					on:click={() => dispatch('addSubtask', task)}
					class="rounded px-1.5 py-0.5 text-[10px] font-semibold text-lime-400 hover:bg-[#1f2329]"
					title="Add subtask"
				>
					+ Add
				</button>
			</div>

			{#if subtasksExpanded}
				<div class="mt-2 space-y-1.5 border-t border-[#262a30]/70 pt-2">
					{#each subtasks as sub (sub.id)}
						<div
							draggable="true"
							on:dragstart={(e) => {
								e.stopPropagation();
								if (e.dataTransfer) {
									e.dataTransfer.effectAllowed = 'move';
									e.dataTransfer.setData('application/x-rapidtools-task-id', sub.id);
								}
							}}
							class="group/sub flex items-center justify-between gap-1.5 rounded-md bg-[#181b20] px-2 py-1.5 text-xs transition hover:bg-[#1f242b]"
						>
							<div class="flex min-w-0 flex-1 items-center gap-2">
								<input
									type="checkbox"
									checked={sub.status === 'Completed'}
									on:change={() =>
										dispatch('statusChange', {
											task: sub,
											status: sub.status === 'Completed' ? 'To do' : 'Completed'
										})}
									class="h-3.5 w-3.5 flex-shrink-0 rounded border-[#3a404a] bg-[#141619] text-lime-500 focus:ring-lime-500"
								/>
								<button
									type="button"
									on:click={() => dispatch('select', sub)}
									class="truncate text-left text-xs {sub.status === 'Completed'
										? 'line-through text-gray-500'
										: 'text-gray-200 hover:text-lime-300'}"
								>
									{sub.title}
								</button>
							</div>

							<div class="flex items-center gap-1 opacity-0 transition group-hover/sub:opacity-100">
								<button
									type="button"
									on:click={(e) => handleSwapWithSubtask(sub, e)}
									class="rounded p-0.5 text-[10px] text-gray-400 hover:bg-[#262a30] hover:text-cyan-400"
									title="Swap with parent (make this the parent task)"
								>
									⇄
								</button>
								<button
									type="button"
									on:click={async (e) => {
										e.stopPropagation();
										await promoteSubtaskToParent(sub.id);
										toastSuccess(`"${sub.title}" is now a standalone task`);
									}}
									class="rounded p-0.5 text-[10px] text-gray-400 hover:bg-[#262a30] hover:text-amber-300"
									title="Promote to standalone task"
								>
									↑
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
```

---

### Step 13.3B — Forward `addSubtask` & Support Column Drop Promotion in `TaskBoardColumn.svelte` and `TasksBoardView.svelte`

1. In [`TaskBoardColumn.svelte`](../../src/routes/%28protected%29/tasks/components/TaskBoardColumn.svelte):
- Add `addSubtask: TaskItem;` to `createEventDispatcher`.
- Pass `on:addSubtask={(e) => dispatch('addSubtask', e.detail)}` on `<TaskCard ... />`.

2. In [`TasksBoardView.svelte`](../../src/routes/%28protected%29/tasks/components/TasksBoardView.svelte):
- Add `addSubtask: TaskItem;` to `createEventDispatcher`.
- Forward `on:addSubtask={(e) => dispatch('addSubtask', e.detail)}` on `<TaskBoardColumn ... />`.

---

### Step 13.3C — Add Expandable Subtask Rows & Interchange Controls in `TasksListView.svelte`

1. In [`TasksListView.svelte`](../../src/routes/%28protected%29/tasks/components/TasksListView.svelte):
- Import `subtasksByParentId`, `promoteSubtaskToParent`, `swapParentAndSubtask` from `../stores`.
- Add `addSubtask: TaskItem;` to `createEventDispatcher`.
- Add a local set `let collapsedParentIds = new Set<string>();` and toggle helper:

```typescript
	let collapsedParentIds = new Set<string>();

	function toggleParentRow(taskId: string, e: MouseEvent) {
		e.stopPropagation();
		const next = new Set(collapsedParentIds);
		if (next.has(taskId)) next.delete(taskId);
		else next.add(taskId);
		collapsedParentIds = next;
	}
```

- Inside `#each group.tasks as task (task.id)`:
  - Compute `{@const subtasks = $subtasksByParentId[task.id] || []}`
  - In the first `<td>` (Task Title), if `subtasks.length > 0`, show a chevron toggle button and a pill badge `{subtasks.filter(s => s.status === 'Completed').length}/{subtasks.length} subtasks`.
  - In the Actions `<td>`, add a `+ Subtask` button next to `Delete` that dispatches `dispatch('addSubtask', task)`.
  - Immediately after the parent `</tr>`, if `subtasks.length > 0 && !collapsedParentIds.has(task.id)`, iterate `#each subtasks as sub (sub.id)` and render a sleek indented child `<tr>` (`bg-[#101216]/90`) with:
    - Indented `↳` icon + subtask title
    - Inline status `<select>`
    - Subtask checklist progress bar
    - Subtask assignee
    - Subtask priority & due date
    - Quick action buttons in the right column:
      - **Swap (`⇄`)**: calls `swapParentAndSubtask(task.id, sub.id)`
      - **Promote (`↑`)**: calls `promoteSubtaskToParent(sub.id)`
      - **Delete**: dispatches `deleteTask` for `sub`

### Definition of Done (Phase 13.3)
- [ ] `TaskCard.svelte` displays collapsible subtasks with checkboxes, `+ Add`, `⇄` swap with parent, `↑` promote to standalone, `Move under parent` menu, and drag-and-drop onto cards.
- [ ] `TasksListView.svelte` displays expandable indented subtask rows with inline status editing, `⇄` swap, and `↑` promote controls.

---

## Phase 13.4: Subtask Creation & Dynamic Hierarchy Manager in Detail Drawer (`CreateTaskModal.svelte`, `TaskDetailModal.svelte`, `+page.svelte`)

### Goal for the Model
1. Allow creating a task directly as a subtask of any parent task in `CreateTaskModal.svelte`.
2. Add a comprehensive **Task Hierarchy & Subtasks** section inside `TaskDetailModal.svelte` where users can:
   - View or change the current task's **Parent Task** (move it to another parent or promote it to a standalone root task).
   - Click **Swap with Parent (`⇄`)** to immediately interchange the child task and its parent task.
   - Add a new subtask inline (with title + inheriting department/due date) or attach an existing standalone task as a subtask.
   - Manage every subtask in the list: toggle completion, click to navigate into the subtask's detail drawer, move a subtask to a different parent, promote a subtask to standalone, or swap a subtask with the current parent task.

---

### Step 13.4A — Add Parent Task Selector to `CreateTaskModal.svelte`

1. In [`CreateTaskModal.svelte`](../../src/routes/%28protected%29/tasks/components/CreateTaskModal.svelte):
- Import `tasks` from `../stores`.
- Export a new optional prop:
  ```typescript
  export let defaultParentTaskId: string | null = null;
  ```
- Add local state `let selectedParentTaskId: string = '';` and reactive sync when the modal opens:
  ```typescript
  $: if (open && defaultParentTaskId && !selectedParentTaskId) {
  	selectedParentTaskId = defaultParentTaskId;
  }
  $: rootTaskOptions = $tasks.filter((t) => !t.parent_task_id);
  ```
- In `resetForm()`, reset `selectedParentTaskId = defaultParentTaskId || '';`.
- In `handleSubmit()`, pass `parent_task_id: selectedParentTaskId || null` to `createTaskRecord(...)`.
- In the form body (right below `Status`), add a **Parent task (Optional)** dropdown:

```svelte
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
```

---

### Step 13.4B — Add Dynamic Hierarchy & Subtasks Section to `TaskDetailModal.svelte`

1. In [`TaskDetailModal.svelte`](../../src/routes/%28protected%29/tasks/components/TaskDetailModal.svelte):
- Update imports from `../stores`:
  ```typescript
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
  ```
- Import `createTaskRecord` from `../tasksService` and `getSubtaskProgress`, `getValidParentTasks` from `../types`.
- Add `selectTask: TaskItem;` to `createEventDispatcher` so clicking a parent or subtask inside the drawer switches the drawer directly to that task.

2. Add reactive state and handlers in `<script lang="ts">` of `TaskDetailModal.svelte`:

```typescript
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
```

3. Inside the scrollable body of `TaskDetailModal.svelte` (right above `<!-- Checklist Steps -->`), insert the **Parent / Subtasks Hierarchy Section**:

```svelte
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
```

---

### Step 13.4C — Wire `addSubtask` and `selectTask` in `+page.svelte`

In [`src/routes/(protected)/tasks/+page.svelte`](../../src/routes/%28protected%29/tasks/+page.svelte):
1. Add state `let createModalDefaultParentId: string | null = null;`.
2. Update `openNewTaskModal`:
   ```typescript
   function openNewTaskModal(
   	defaultDepartment: TaskDepartment = 'Operations',
   	parentTaskId: string | null = null
   ) {
   	createModalDefaultDepartment = defaultDepartment;
   	createModalDefaultParentId = parentTaskId;
   	showCreateModal = true;
   }
   ```
3. Add handler `handleAddSubtask(parentTask: TaskItem)`:
   ```typescript
   function handleAddSubtask(parentTask: TaskItem) {
   	openNewTaskModal(parentTask.department, parentTask.id);
   }
   ```
4. Pass `on:addSubtask={(e) => handleAddSubtask(e.detail)}` to both `<TasksBoardView ... />` and `<TasksListView ... />`.
5. Pass `defaultParentTaskId={createModalDefaultParentId}` to `<CreateTaskModal ... />`.
6. Pass `on:selectTask={(e) => openTaskDetail(e.detail)}` to `<TaskDetailModal ... />` so clicking a parent or subtask inside the drawer navigates smoothly to that task.

### Definition of Done (Phase 13.4)
- [ ] `CreateTaskModal.svelte` supports selecting an optional Parent Task (and pre-fills it when triggered via `+ Add subtask`).
- [ ] `TaskDetailModal.svelte` allows changing/clearing a task's parent, interchanging parent and child with one click (`⇄`), creating new subtasks inline, attaching existing tasks as subtasks, and moving any subtask to another parent.
- [ ] `+page.svelte` connects `on:addSubtask` and `on:selectTask` across Board, List, Create Modal, and Detail Drawer.
