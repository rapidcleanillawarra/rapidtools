import { writable, derived } from 'svelte/store';
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
	isTaskAssignedToUser
} from './types';
import { saveCustomDepartment, deleteCustomDepartment } from './tasksService';

export const tasks = writable<TaskItem[]>([]);
export const teamMembers = writable<UserProfile[]>([]);
export const isLoadingTasks = writable<boolean>(true);

export const activeTab = writable<TaskTab>('all');
export const groupBy = writable<TaskGroupBy>('department');
export const sortBy = writable<TaskSortKey>('created_at_desc');
export const viewMode = writable<TaskViewMode>('board');

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

			// 2. Search filter
			if ($filters.search.trim()) {
				const q = $filters.search.trim().toLowerCase();
				const inTitle = task.title.toLowerCase().includes(q);
				const inDesc = (task.description || '').toLowerCase().includes(q);
				const inAssignee =
					task.assignee_name.toLowerCase().includes(q) ||
					getTaskAssignees(task).some((a) => a.name.toLowerCase().includes(q));
				const inDept = task.department.toLowerCase().includes(q);
				if (!inTitle && !inDesc && !inAssignee && !inDept) return false;
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
 */
export const groupedTasks = derived(
	[filteredTasks, groupBy, sortBy, availableAssignees, allDepartments, departmentColors],
	([$filteredTasks, $groupBy, $sortBy, $availableAssignees, $allDepartments, $departmentColors]): TaskColumnGroup[] => {
		const sortList = (list: TaskItem[]) => [...list].sort((a, b) => compareTasks(a, b, $sortBy));

		if ($groupBy === 'department') {
			return $allDepartments.map((dept) => ({
				key: dept,
				label: dept,
				dotColorClass: $departmentColors[dept] || getDepartmentDotColor(dept),
				tasks: sortList(
					$filteredTasks.filter((t) => (t.department || '').toLowerCase() === dept.toLowerCase())
				)
			}));
		}

		if ($groupBy === 'status') {
			return TASK_STATUSES.map((status) => ({
				key: status,
				label: status,
				dotColorClass: STATUS_DOT_COLORS[status] || 'bg-gray-400',
				tasks: sortList($filteredTasks.filter((t) => t.status === status))
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
				tasks: sortList($filteredTasks.filter((t) => t.priority === priority))
			}));
		}

		// groupBy === 'assignee'
		return $availableAssignees.map((assignee) => ({
			key: assignee,
			label: assignee,
			dotColorClass: 'bg-lime-400',
			tasks: sortList(
				$filteredTasks.filter((t) => {
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
