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
