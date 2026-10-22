import { writable, derived, get } from 'svelte/store';
import { currentUser } from '$lib/firebase';
import { userProfile, type UserProfile } from '$lib/userProfile';
import {
	type TaskItem,
	type TaskTab,
	type TaskFilters,
	type TaskGroupBy,
	type TaskSortKey,
	type TaskViewMode,
	type TaskColumnGroup,
	type UserBucketPreferences,
	DEFAULT_TASK_DEPARTMENTS,
	TASK_DEPARTMENTS,
	TASK_STATUSES,
	TASK_PRIORITIES,
	DEPARTMENT_DOT_COLORS,
	STATUS_DOT_COLORS,
	getDepartmentDotColor,
	getDueDateDisplay,
	getTaskAssignees,
	compareTasks,
	isTaskAssignedToUser,
	wouldCreateSubtaskCycle
} from './types';
import {
	saveCustomDepartment,
	deleteCustomDepartment,
	updateTaskParentId,
	swapParentAndChildTaskInDb
} from './tasksService';

export const tasks = writable<TaskItem[]>([]);
export const teamMembers = writable<UserProfile[]>([]);
export const isLoadingTasks = writable<boolean>(true);

export const activeTab = writable<TaskTab>('all');
export const groupBy = writable<TaskGroupBy>('department');
export const sortBy = writable<TaskSortKey>('created_at_desc');
export const viewMode = writable<TaskViewMode>('board');

// Persist & sync viewMode per user in localStorage
const VIEW_MODE_STORAGE_PREFIX = 'rapidtools_tasks_view_mode_';

function getViewModeStorageKey(userEmail?: string | null): string {
	const sanitized = (userEmail || 'anonymous')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]/g, '_');
	return `${VIEW_MODE_STORAGE_PREFIX}${sanitized}`;
}

let isSyncingViewMode = false;

viewMode.subscribe((val) => {
	if (typeof window === 'undefined' || isSyncingViewMode) return;
	try {
		const user = get(currentUser);
		const key = getViewModeStorageKey(user?.email);
		localStorage.setItem(key, val);
	} catch (err) {
		console.error('Failed to persist view mode:', err);
	}
});

export const customDepartments = writable<string[]>([]);
export const departmentColors = writable<Record<string, string>>({});

/**
 * Complete, deduplicated list of all departments/buckets.
 * Combines:
 * 1. Built-in default departments (Accounts, Workshop, IT, Operations, Purchasing)
 * 2. Any user-added custom departments
 * 3. Any department present on loaded tasks
 */
export const allDepartments = derived(
	[customDepartments, tasks],
	([$customDepartments, $tasks]) => {
		const list: string[] = [...DEFAULT_TASK_DEPARTMENTS];
		const set = new Set<string>(DEFAULT_TASK_DEPARTMENTS.map((d) => d.toLowerCase()));

		for (const dept of $customDepartments) {
			const trimmed = (dept || '').trim();
			if (trimmed && !set.has(trimmed.toLowerCase())) {
				set.add(trimmed.toLowerCase());
				list.push(trimmed);
			}
		}

		for (const t of $tasks) {
			const trimmed = (t.department || '').trim();
			if (trimmed && !set.has(trimmed.toLowerCase())) {
				set.add(trimmed.toLowerCase());
				list.push(trimmed);
			}
		}

		return list;
	}
);

// --- User Bucket Preferences (Order & Visibility per user) ---
const BUCKET_PREFS_STORAGE_PREFIX = 'rapidtools_tasks_bucket_prefs_';

function getBucketPrefsStorageKey(userEmail?: string | null): string {
	const sanitized = (userEmail || 'anonymous')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]/g, '_');
	return `${BUCKET_PREFS_STORAGE_PREFIX}${sanitized}`;
}

export const bucketPreferences = writable<UserBucketPreferences>({
	order: [],
	hidden: []
});

function persistBucketPreferences(prefs: UserBucketPreferences): void {
	if (typeof window === 'undefined') return;
	try {
		const user = get(currentUser);
		const key = getBucketPrefsStorageKey(user?.email);
		localStorage.setItem(key, JSON.stringify(prefs));
	} catch (err) {
		console.error('Failed to persist bucket preferences:', err);
	}
}

// Initialize / sync bucketPreferences and viewMode when currentUser changes
currentUser.subscribe(($user) => {
	if (typeof window === 'undefined') return;
	try {
		// Sync View Mode
		const viewModeKey = getViewModeStorageKey($user?.email);
		const savedViewMode = localStorage.getItem(viewModeKey);
		if (savedViewMode === 'board' || savedViewMode === 'list') {
			isSyncingViewMode = true;
			viewMode.set(savedViewMode);
			isSyncingViewMode = false;
		}

		// Sync Bucket Preferences
		const key = getBucketPrefsStorageKey($user?.email);
		const raw = localStorage.getItem(key);
		if (raw) {
			const parsed = JSON.parse(raw);
			bucketPreferences.set({
				order: Array.isArray(parsed?.order) ? parsed.order : [],
				hidden: Array.isArray(parsed?.hidden) ? parsed.hidden : []
			});
			return;
		}
		bucketPreferences.set({ order: [], hidden: [] });
	} catch {
		bucketPreferences.set({ order: [], hidden: [] });
	}
});

/**
 * All departments sorted according to the current user's custom bucket order.
 * Any bucket not yet in `prefs.order` is appended at the end in its default order.
 */
export const orderedDepartments = derived(
	[allDepartments, bucketPreferences],
	([$allDepartments, $prefs]): string[] => {
		const orderMap = new Map<string, number>();
		$prefs.order.forEach((name, idx) => {
			orderMap.set(name.toLowerCase(), idx);
		});

		return [...$allDepartments].sort((a, b) => {
			const idxA = orderMap.get(a.toLowerCase());
			const idxB = orderMap.get(b.toLowerCase());
			if (idxA !== undefined && idxB !== undefined) return idxA - idxB;
			if (idxA !== undefined) return -1;
			if (idxB !== undefined) return 1;
			return 0;
		});
	}
);

/**
 * Ordered departments excluding buckets hidden by the current user.
 */
export const visibleDepartments = derived(
	[orderedDepartments, bucketPreferences],
	([$orderedDepartments, $prefs]): string[] => {
		const hiddenSet = new Set($prefs.hidden.map((h) => h.toLowerCase()));
		return $orderedDepartments.filter((dept) => !hiddenSet.has(dept.toLowerCase()));
	}
);

/**
 * Count of currently hidden buckets that exist in allDepartments.
 */
export const hiddenBucketsCount = derived(
	[allDepartments, bucketPreferences],
	([$allDepartments, $prefs]): number => {
		const hiddenSet = new Set($prefs.hidden.map((h) => h.toLowerCase()));
		return $allDepartments.filter((d) => hiddenSet.has(d.toLowerCase())).length;
	}
);

/**
 * Toggle whether a bucket is hidden or visible for the current user.
 */
export function toggleBucketVisibility(bucketName: string): void {
	const trimmed = (bucketName || '').trim();
	if (!trimmed) return;
	const lower = trimmed.toLowerCase();

	bucketPreferences.update((prefs) => {
		const exists = prefs.hidden.some((h) => h.toLowerCase() === lower);
		const nextHidden = exists
			? prefs.hidden.filter((h) => h.toLowerCase() !== lower)
			: [...prefs.hidden, trimmed];
		const next: UserBucketPreferences = {
			...prefs,
			hidden: nextHidden
		};
		persistBucketPreferences(next);
		return next;
	});
}

/**
 * Explicitly hide a bucket for the current user.
 */
export function hideBucket(bucketName: string): void {
	const trimmed = (bucketName || '').trim();
	if (!trimmed) return;
	const lower = trimmed.toLowerCase();

	bucketPreferences.update((prefs) => {
		if (prefs.hidden.some((h) => h.toLowerCase() === lower)) return prefs;
		const next: UserBucketPreferences = {
			...prefs,
			hidden: [...prefs.hidden, trimmed]
		};
		persistBucketPreferences(next);
		return next;
	});
}

/**
 * Show all buckets for the current user (clears hidden list).
 */
export function showAllBuckets(): void {
	bucketPreferences.update((prefs) => {
		const next: UserBucketPreferences = { ...prefs, hidden: [] };
		persistBucketPreferences(next);
		return next;
	});
}

/**
 * Move a bucket left/up ('left') or right/down ('right') within the user's visible or full ordered list.
 */
export function moveBucket(
	bucketName: string,
	direction: 'left' | 'right',
	onlyAmongVisible = false
): void {
	const currentFullOrder = [...get(orderedDepartments)];
	const listToUse = onlyAmongVisible ? [...get(visibleDepartments)] : currentFullOrder;

	const idx = listToUse.findIndex((d) => d.toLowerCase() === bucketName.toLowerCase());
	if (idx === -1) return;

	const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
	if (targetIdx < 0 || targetIdx >= listToUse.length) return;

	const neighborName = listToUse[targetIdx];

	// Swap bucketName and neighborName in currentFullOrder
	const fullIdxA = currentFullOrder.findIndex(
		(d) => d.toLowerCase() === bucketName.toLowerCase()
	);
	const fullIdxB = currentFullOrder.findIndex(
		(d) => d.toLowerCase() === neighborName.toLowerCase()
	);
	if (fullIdxA === -1 || fullIdxB === -1) return;

	const swapped = [...currentFullOrder];
	[swapped[fullIdxA], swapped[fullIdxB]] = [swapped[fullIdxB], swapped[fullIdxA]];

	bucketPreferences.update((prefs) => {
		const next: UserBucketPreferences = {
			...prefs,
			order: swapped
		};
		persistBucketPreferences(next);
		return next;
	});
}

/**
 * Move `sourceBucket` to the position of `targetBucket` (used for drag-and-drop reordering).
 */
export function reorderBuckets(sourceBucket: string, targetBucket: string): void {
	if (!sourceBucket || !targetBucket) return;
	if (sourceBucket.toLowerCase() === targetBucket.toLowerCase()) return;

	const currentOrder = [...get(orderedDepartments)];
	const fromIdx = currentOrder.findIndex(
		(d) => d.toLowerCase() === sourceBucket.toLowerCase()
	);
	const toIdx = currentOrder.findIndex(
		(d) => d.toLowerCase() === targetBucket.toLowerCase()
	);
	if (fromIdx === -1 || toIdx === -1) return;

	const [moved] = currentOrder.splice(fromIdx, 1);
	currentOrder.splice(toIdx, 0, moved);

	bucketPreferences.update((prefs) => {
		const next: UserBucketPreferences = {
			...prefs,
			order: currentOrder
		};
		persistBucketPreferences(next);
		return next;
	});
}

/**
 * Reset both bucket order and hidden buckets back to defaults for the current user.
 */
export function resetBucketPreferences(): void {
	const next: UserBucketPreferences = { order: [], hidden: [] };
	bucketPreferences.set(next);
	persistBucketPreferences(next);
}

/**
 * Add a new bucket or department, persist it, and update reactive stores.
 */
export async function addDepartment(name: string, colorClass?: string): Promise<string> {
	const trimmed = name.trim();
	if (!trimmed) throw new Error('Bucket/Department name cannot be empty');

	customDepartments.update((list) => {
		if (!list.some((d) => d.toLowerCase() === trimmed.toLowerCase())) {
			return [...list, trimmed];
		}
		return list;
	});

	if (colorClass) {
		departmentColors.update((map) => ({ ...map, [trimmed]: colorClass }));
	}

	await saveCustomDepartment(trimmed, colorClass);
	return trimmed;
}

/**
 * Remove a custom bucket/department and clean up persisted storage.
 */
export async function removeDepartment(name: string): Promise<void> {
	const trimmed = name.trim();
	customDepartments.update((list) => list.filter((d) => d.toLowerCase() !== trimmed.toLowerCase()));
	departmentColors.update((map) => {
		const next = { ...map };
		delete next[trimmed];
		return next;
	});
	await deleteCustomDepartment(trimmed);
}

export const taskFilters = writable<TaskFilters>({
	search: '',
	assignee: 'all',
	status: 'all',
	dueDate: 'all',
	onlyNew: false
});

/**
 * Derived list of unique assignee names from both loaded tasks and team profiles.
 */
export const availableAssignees = derived(
	[tasks, teamMembers],
	([$tasks, $teamMembers]) => {
		const names = new Set<string>();
		for (const t of $tasks) {
			const taskAssignees = getTaskAssignees(t);
			for (const a of taskAssignees) {
				if (a.name?.trim()) names.add(a.name.trim());
			}
		}
		for (const member of $teamMembers) {
			const first = (member.firstName || '').trim();
			if (first) names.add(first);
		}
		return Array.from(names).sort((a, b) => a.localeCompare(b));
	}
);

// --- Seen Tasks Store (Persistent per user) ---
const STORAGE_PREFIX = 'rapidtools_tasks_seen_';

function getStorageKey(userEmail?: string | null): string {
	const sanitized = (userEmail || 'anonymous').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
	return `${STORAGE_PREFIX}${sanitized}`;
}

export const seenTaskIds = writable<Set<string>>(new Set());

// Initialize / sync seen task IDs when currentUser changes
currentUser.subscribe(($user) => {
	if (typeof window === 'undefined') return;
	try {
		const key = getStorageKey($user?.email);
		const raw = localStorage.getItem(key);
		if (raw) {
			const arr = JSON.parse(raw);
			if (Array.isArray(arr)) {
				seenTaskIds.set(new Set(arr));
				return;
			}
		}
		seenTaskIds.set(new Set());
	} catch {
		seenTaskIds.set(new Set());
	}
});

/**
 * Marks a task as seen by the current user and persists to localStorage.
 */
export function markTaskAsSeen(taskId: string): void {
	if (!taskId) return;
	seenTaskIds.update((set) => {
		if (set.has(taskId)) return set;
		const next = new Set(set);
		next.add(taskId);
		if (typeof window !== 'undefined') {
			try {
				let email: string | null = null;
				currentUser.subscribe((u) => (email = u?.email || null))();
				const key = getStorageKey(email);
				localStorage.setItem(key, JSON.stringify(Array.from(next)));
			} catch (err) {
				console.error('Failed to persist seen tasks:', err);
			}
		}
		return next;
	});
}

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

/**
 * Tasks filtered by activeTab ("All tasks", "My tasks", "Assigned by me") and toolbar filters.
 */
export const filteredTasks = derived(
	[tasks, activeTab, taskFilters, currentUser, userProfile, seenTaskIds],
	([$tasks, $activeTab, $filters, $currentUser, $userProfile, $seenIds]) => {
		const myEmail = ($currentUser?.email || '').toLowerCase();
		const myFirstName = ($userProfile?.firstName || '').trim().toLowerCase();

		return $tasks.filter((task) => {
			// 0. Only new assigned filter
			if ($filters.onlyNew) {
				if (task.status === 'Completed') return false;
				const isAssigned = isTaskAssignedToUser(task, myEmail, myFirstName);
				if (!isAssigned) return false;
				if ($seenIds.has(task.id)) return false;
			}

			// 1. Tab filter
			if ($activeTab === 'my_tasks') {
				const taskAssignees = getTaskAssignees(task);
				const matches = taskAssignees.some((a) => {
					const emailMatch = myEmail && (a.email || '').toLowerCase() === myEmail;
					const nameMatch = myFirstName && a.name.trim().toLowerCase() === myFirstName;
					return emailMatch || nameMatch;
				});
				if (!matches) {
					const rootEmailMatch =
						myEmail && (task.assignee_email || '').toLowerCase() === myEmail;
					const rootNameMatch =
						myFirstName && task.assignee_name.trim().toLowerCase() === myFirstName;
					if (!rootEmailMatch && !rootNameMatch) return false;
				}
			} else if ($activeTab === 'assigned_by_me') {
				if (!myEmail || (task.assigned_by_email || '').toLowerCase() !== myEmail) {
					return false;
				}
			}

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

			// 3. Assignee filter
			if ($filters.assignee !== 'all') {
				const target = $filters.assignee.toLowerCase();
				const hasAssignee = getTaskAssignees(task).some(
					(a) => a.name.toLowerCase() === target
				);
				if (!hasAssignee && !task.assignee_name.toLowerCase().includes(target)) {
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
 * Derived store of new / unread tasks assigned to the current user.
 */
export const newAssignedTasks = derived(
	[tasks, seenTaskIds, currentUser, userProfile],
	([$tasks, $seenIds, $currentUser, $userProfile]) => {
		const email = $currentUser?.email || '';
		const name = $userProfile?.firstName || '';

		return $tasks.filter((task) => {
			if (task.status === 'Completed') return false;
			const isAssigned = isTaskAssignedToUser(task, email, name);
			if (!isAssigned) return false;
			return !$seenIds.has(task.id);
		});
	}
);

/**
 * Top-right summary metrics: "X new · 5 open · 1 due today · 1 overdue"
 */
export const taskSummaryStats = derived(
	[filteredTasks, newAssignedTasks],
	([$filteredTasks, $newAssignedTasks]) => {
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

		return {
			newAssignedCount: $newAssignedTasks.length,
			openCount,
			dueTodayCount,
			overdueCount
		};
	}
);

/**
 * Grouped columns for the Kanban Board and List views.
 * Respects per-user bucket order and hidden buckets when grouped by department.
 */
export const groupedTasks = derived(
	[filteredTasks, groupBy, sortBy, availableAssignees, visibleDepartments, departmentColors],
	([$filteredTasks, $groupBy, $sortBy, $availableAssignees, $visibleDepartments, $departmentColors]): TaskColumnGroup[] => {
		const filteredIds = new Set($filteredTasks.map((t) => t.id));
		// Show root tasks, plus any subtask whose parent is not currently in filteredTasks
		const topLevelTasks = $filteredTasks.filter(
			(t) => !t.parent_task_id || !filteredIds.has(t.parent_task_id)
		);
		const sortList = (list: TaskItem[]) => [...list].sort((a, b) => compareTasks(a, b, $sortBy));

		if ($groupBy === 'department') {
			return $visibleDepartments.map((dept) => ({
				key: dept,
				label: dept,
				dotColorClass: $departmentColors[dept] || getDepartmentDotColor(dept),
				tasks: sortList(
					topLevelTasks.filter((t) => (t.department || '').toLowerCase() === dept.toLowerCase())
				)
			}));
		}

		if ($groupBy === 'status') {
			return TASK_STATUSES.map((status) => ({
				key: status,
				label: status,
				dotColorClass: STATUS_DOT_COLORS[status] || 'bg-gray-400',
				tasks: sortList(topLevelTasks.filter((t) => t.status === status))
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
				tasks: sortList(topLevelTasks.filter((t) => t.priority === priority))
			}));
		}

		// groupBy === 'assignee'
		return $availableAssignees.map((assignee) => ({
			key: assignee,
			label: assignee,
			dotColorClass: 'bg-lime-400',
			tasks: sortList(
				topLevelTasks.filter((t) => {
					const taskAssignees = getTaskAssignees(t);
					if (taskAssignees.length > 0) {
						return taskAssignees.some(
							(a) => a.name.toLowerCase() === assignee.toLowerCase()
						);
					}
					return t.assignee_name.toLowerCase() === assignee.toLowerCase();
				})
			)
		}));
	}
);

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
