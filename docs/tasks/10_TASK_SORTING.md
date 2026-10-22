# Subphase 10: Task Sorting (Date Added, Priority & Due Date)

## Goal for the Model
Implement task sorting across the Tasks module (`Board` and `List` views) by **Date time added (`created_at`)**, **Priority (`priority`)**, and **Due date (`due_date`)** in both ascending and descending directions.

This specification is broken down into **3 sequential implementation phases (steps)** so smaller models can execute one step at a time with zero ambiguity.

---

## Context Files to Read First
1. [`src/routes/(protected)/tasks/types.ts`](../../src/routes/%28protected%29/tasks/types.ts)
2. [`src/routes/(protected)/tasks/stores.ts`](../../src/routes/%28protected%29/tasks/stores.ts)
3. [`src/routes/(protected)/tasks/components/TasksToolbar.svelte`](../../src/routes/%28protected%29/tasks/components/TasksToolbar.svelte)
4. [`src/routes/(protected)/tasks/components/TasksListView.svelte`](../../src/routes/%28protected%29/tasks/components/TasksListView.svelte)

---

## Execution Overview (Phased Breakdown)

| Phase / Step | Target Files | Scope Summary |
| :--- | :--- | :--- |
| **Phase 10.1** | `types.ts`, `stores.ts` | Add `TaskSortField`, `TaskSortDirection`, `TaskSortOption`, priority weight map, `compareTasks()` comparator helper, `sortBy` store, and wire sorting into `groupedTasks`. |
| **Phase 10.2** | `TasksToolbar.svelte` | Add the `Sort by` dropdown control next to `Group by` in the toolbar (`Newest first`, `Oldest first`, `Priority: High → Normal`, `Priority: Normal → High`, `Due date: Soonest`, `Due date: Latest`). |
| **Phase 10.3** | `TasksListView.svelte` | Add interactive sortable column headers (`Priority`, `Due date`, and `Added`) in the List view table with active sort direction indicators (`↑` / `↓`). |

---

## Phase 10.1: Types, Comparator & Reactive Store (`types.ts` & `stores.ts`)

### Step 10.1A — Update `src/routes/(protected)/tasks/types.ts`

Add the sorting types, options constant, and comparator helper to [`src/routes/(protected)/tasks/types.ts`](../../src/routes/%28protected%29/tasks/types.ts):

1. Right after `export type DueDateFilter = ...` (around line 27), add:

```typescript
export type TaskSortField = 'created_at' | 'priority' | 'due_date';

export type TaskSortDirection = 'asc' | 'desc';

export type TaskSortKey =
	| 'created_at_desc'
	| 'created_at_asc'
	| 'priority_desc'
	| 'priority_asc'
	| 'due_date_asc'
	| 'due_date_desc';

export interface TaskSortOption {
	key: TaskSortKey;
	field: TaskSortField;
	direction: TaskSortDirection;
	label: string;
}
```

2. Right after `export const TASK_PRIORITIES: TaskPriority[] = ...` (around line 151), add the priority weight map, sort options list, and `compareTasks` helper:

```typescript
export const TASK_PRIORITY_WEIGHT: Record<TaskPriority, number> = {
	Urgent: 3,
	High: 2,
	Normal: 1
};

export const TASK_SORT_OPTIONS: TaskSortOption[] = [
	{
		key: 'created_at_desc',
		field: 'created_at',
		direction: 'desc',
		label: 'Sort: Added (Newest)'
	},
	{
		key: 'created_at_asc',
		field: 'created_at',
		direction: 'asc',
		label: 'Sort: Added (Oldest)'
	},
	{
		key: 'priority_desc',
		field: 'priority',
		direction: 'desc',
		label: 'Sort: Priority (High → Normal)'
	},
	{
		key: 'priority_asc',
		field: 'priority',
		direction: 'asc',
		label: 'Sort: Priority (Normal → High)'
	},
	{
		key: 'due_date_asc',
		field: 'due_date',
		direction: 'asc',
		label: 'Sort: Due date (Soonest)'
	},
	{
		key: 'due_date_desc',
		field: 'due_date',
		direction: 'desc',
		label: 'Sort: Due date (Latest)'
	}
];

/**
 * Compare two tasks according to the selected TaskSortKey.
 * Uses created_at (newest first) as a deterministic tie-breaker.
 */
export function compareTasks(a: TaskItem, b: TaskItem, sortKey: TaskSortKey): number {
	const timeA = new Date(a.created_at || 0).getTime();
	const timeB = new Date(b.created_at || 0).getTime();

	if (sortKey === 'created_at_desc') {
		return timeB - timeA;
	}
	if (sortKey === 'created_at_asc') {
		return timeA - timeB;
	}

	if (sortKey === 'priority_desc' || sortKey === 'priority_asc') {
		const weightA = TASK_PRIORITY_WEIGHT[a.priority] ?? 0;
		const weightB = TASK_PRIORITY_WEIGHT[b.priority] ?? 0;
		if (weightA !== weightB) {
			return sortKey === 'priority_desc' ? weightB - weightA : weightA - weightB;
		}
		// Tie-breaker: soonest due date, then newest created_at
		const dueA = parseLocalDate(a.due_date).getTime();
		const dueB = parseLocalDate(b.due_date).getTime();
		if (dueA !== dueB) return dueA - dueB;
		return timeB - timeA;
	}

	if (sortKey === 'due_date_asc' || sortKey === 'due_date_desc') {
		const dueA = a.due_date ? parseLocalDate(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
		const dueB = b.due_date ? parseLocalDate(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
		if (dueA !== dueB) {
			return sortKey === 'due_date_asc' ? dueA - dueB : dueB - dueA;
		}
		// Tie-breaker: highest priority first, then newest created_at
		const weightA = TASK_PRIORITY_WEIGHT[a.priority] ?? 0;
		const weightB = TASK_PRIORITY_WEIGHT[b.priority] ?? 0;
		if (weightA !== weightB) return weightB - weightA;
		return timeB - timeA;
	}

	return 0;
}
```

3. Also add a helper in `types.ts` (near `formatShortDate` around line 314) to format date-time added for display when needed:

```typescript
/** Format date + time (e.g. "22 Oct, 9:45 am") for created_at timestamps */
export function formatDateTimeShort(dateStr: string | null | undefined): string {
	if (!dateStr) return '';
	const date = new Date(dateStr);
	if (isNaN(date.getTime())) return '';
	return date.toLocaleString('en-AU', {
		day: 'numeric',
		month: 'short',
		hour: 'numeric',
		minute: '2-digit'
	});
}
```

---

### Step 10.1B — Update `src/routes/(protected)/tasks/stores.ts`

1. Import `type TaskSortKey` and `compareTasks` from `./types` in [`src/routes/(protected)/tasks/stores.ts`](../../src/routes/%28protected%29/tasks/stores.ts):

```typescript
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
	compareTasks
} from './types';
```

2. Right below `export const groupBy = writable<TaskGroupBy>('department');` (around line 28), add the `sortBy` store:

```typescript
export const sortBy = writable<TaskSortKey>('created_at_desc');
```

3. Update `groupedTasks` in `stores.ts` to include `sortBy` in its dependencies and sort each group's `tasks` array using `compareTasks`:

```typescript
/**
 * Grouped and sorted columns for the Kanban Board and List views.
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
```

### Definition of Done (Phase 10.1)
- [ ] `TaskSortKey`, `TASK_SORT_OPTIONS`, `compareTasks`, and `formatDateTimeShort` are exported from `types.ts`.
- [ ] `sortBy` store is exported from `stores.ts` and `groupedTasks` sorts tasks inside each group reactively.

---

## Phase 10.2: Toolbar Sort Selector (`TasksToolbar.svelte`)

### Goal for the Model
Add a `Sort by` dropdown control in [`src/routes/(protected)/tasks/components/TasksToolbar.svelte`](../../src/routes/%28protected%29/tasks/components/TasksToolbar.svelte) right next to the `Group by` selector so users can sort both the **Kanban Board** and **List** views by Date time added, Priority, or Due date.

### Step 10.2A — Update Imports in `TasksToolbar.svelte`

1. Import `sortBy` from `../stores`:
```typescript
	import {
		activeTab,
		taskFilters,
		groupBy,
		sortBy,
		viewMode,
		taskSummaryStats,
		availableAssignees
	} from '../stores';
```

2. Import `TASK_SORT_OPTIONS` from `../types`:
```typescript
	import {
		TASK_STATUSES,
		TASK_SORT_OPTIONS,
		type TaskTab,
		type TaskGroupBy,
		type DueDateFilter
	} from '../types';
```

### Step 10.2B — Add the Sort Dropdown in Row 3 of `TasksToolbar.svelte`

Inside `<!-- Right: Group By Dropdown + Board / List View Toggle -->` (around line 212 of `TasksToolbar.svelte`), add the Sort dropdown right before `<!-- Group By -->`:

```svelte
		<!-- Right: Sort By + Group By Dropdown + Board / List View Toggle -->
		<div class="flex flex-wrap items-center gap-2.5">
			<!-- Sort By -->
			<label
				class="flex cursor-pointer items-center rounded-lg border border-[#262a30] bg-[#141619] pl-3 text-xs font-medium text-gray-200 transition hover:border-[#333842] focus-within:border-lime-500 sm:text-sm"
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
						d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
					/>
				</svg>
				<select
					bind:value={$sortBy}
					aria-label="Sort tasks"
					class="cursor-pointer border-0 bg-transparent py-2 pl-2 pr-8 text-xs font-medium text-gray-200 focus:ring-0 focus:outline-none sm:text-sm"
				>
					{#each TASK_SORT_OPTIONS as opt}
						<option value={opt.key} class="bg-[#141619] text-gray-200">{opt.label}</option>
					{/each}
				</select>
			</label>

			<!-- Group By -->
			<select
				bind:value={$groupBy}
				class="cursor-pointer rounded-lg border border-[#262a30] bg-[#141619] py-2 pl-3.5 pr-8 text-xs font-medium text-gray-200 transition hover:border-[#333842] focus:border-lime-500 focus:outline-none sm:text-sm"
			>
				{#each groupOptions as opt}
					<option value={opt.value} class="bg-[#141619] text-gray-200">{opt.label}</option>
				{/each}
			</select>
```

### Definition of Done (Phase 10.2)
- [ ] The `Sort:` dropdown appears in `TasksToolbar.svelte` with all 6 sort options (`Added (Newest)`, `Added (Oldest)`, `Priority (High → Normal)`, `Priority (Normal → High)`, `Due date (Soonest)`, `Due date (Latest)`).
- [ ] Changing the dropdown immediately reorders cards in `TasksBoardView` and rows in `TasksListView`.

---

## Phase 10.3: Interactive Column Header Sorting & Date Added Column in List View (`TasksListView.svelte`)

### Goal for the Model
Enhance [`src/routes/(protected)/tasks/components/TasksListView.svelte`](../../src/routes/%28protected%29/tasks/components/TasksListView.svelte) so users in `List` view can:
1. Click the **Priority**, **Due date**, or **Added** column headers to toggle sorting directly from the table header.
2. See the formatted `created_at` date/time (`formatDateTimeShort(task.created_at)`) in the **Added** column.

### Step 10.3A — Update Imports & Add `toggleColumnSort` Helper in `TasksListView.svelte`

1. Import `sortBy` from `../stores` and `formatDateTimeShort`, `type TaskSortField` from `../types`:

```typescript
	import { groupedTasks, groupBy, sortBy } from '../stores';
	import {
		type TaskItem,
		type TaskStatus,
		type TaskSortField,
		TASK_STATUSES,
		STATUS_DOT_COLORS,
		getTaskProgress,
		getProgressBarColor,
		getInitials,
		getAvatarColorClasses,
		getDueDateDisplay,
		formatShortDate,
		formatDateTimeShort,
		isImageAttachment,
		getTaskAssignees
	} from '../types';
```

2. Add a helper function in `<script lang="ts">` of `TasksListView.svelte` to toggle `sortBy` when a column header is clicked:

```typescript
	function toggleColumnSort(field: TaskSortField) {
		sortBy.update((current) => {
			if (field === 'created_at') {
				return current === 'created_at_desc' ? 'created_at_asc' : 'created_at_desc';
			}
			if (field === 'priority') {
				return current === 'priority_desc' ? 'priority_asc' : 'priority_desc';
			}
			// due_date defaults to soonest (asc) first
			return current === 'due_date_asc' ? 'due_date_desc' : 'due_date_asc';
		});
	}
```

### Step 10.3B — Update Table Headers (`<thead>`) in `TasksListView.svelte`

Replace the `<thead>` block (around lines 63–74 in `TasksListView.svelte`) with interactive sort buttons for **Priority**, **Due date**, and **Added**:

```svelte
						<thead class="bg-[#141619] text-[11px] font-semibold uppercase tracking-wider text-gray-400">
							<tr>
								<th class="px-4 py-2.5 text-left">Task</th>
								<th class="px-4 py-2.5 text-left">Status</th>
								<th class="px-4 py-2.5 text-left">Progress</th>
								<th class="px-4 py-2.5 text-left">Assignee</th>
								<th class="px-4 py-2.5 text-left">
									<button
										type="button"
										on:click={() => toggleColumnSort('priority')}
										class="inline-flex items-center gap-1 uppercase tracking-wider transition hover:text-white {$sortBy.startsWith('priority_') ? 'text-lime-400' : 'text-gray-400'}"
									>
										<span>Priority</span>
										{#if $sortBy === 'priority_desc'}
											<span aria-hidden="true">↓</span>
										{:else if $sortBy === 'priority_asc'}
											<span aria-hidden="true">↑</span>
										{/if}
									</button>
								</th>
								<th class="px-4 py-2.5 text-left">
									<button
										type="button"
										on:click={() => toggleColumnSort('due_date')}
										class="inline-flex items-center gap-1 uppercase tracking-wider transition hover:text-white {$sortBy.startsWith('due_date_') ? 'text-lime-400' : 'text-gray-400'}"
									>
										<span>Due date</span>
										{#if $sortBy === 'due_date_asc'}
											<span aria-hidden="true">↑</span>
										{:else if $sortBy === 'due_date_desc'}
											<span aria-hidden="true">↓</span>
										{/if}
									</button>
								</th>
								<th class="px-4 py-2.5 text-left">
									<button
										type="button"
										on:click={() => toggleColumnSort('created_at')}
										class="inline-flex items-center gap-1 uppercase tracking-wider transition hover:text-white {$sortBy.startsWith('created_at_') ? 'text-lime-400' : 'text-gray-400'}"
									>
										<span>Added</span>
										{#if $sortBy === 'created_at_desc'}
											<span aria-hidden="true">↓</span>
										{:else if $sortBy === 'created_at_asc'}
											<span aria-hidden="true">↑</span>
										{/if}
									</button>
								</th>
								<th class="px-4 py-2.5 text-left">Latest note</th>
								<th class="px-4 py-2.5 text-right">Actions</th>
							</tr>
						</thead>
```

### Step 10.3C — Add the `Added` Cell in Table Body (`<tbody>`) of `TasksListView.svelte`

Right after the `<!-- Due Date -->` `<td>` block and right before `<!-- Latest Note -->` (around line 229 of `TasksListView.svelte`), insert the `Added` cell:

```svelte
									<!-- Added (Date/Time Created) -->
									<td class="whitespace-nowrap px-4 py-3 text-xs text-gray-400">
										{formatDateTimeShort(task.created_at)}
									</td>
```

### Definition of Done (Phase 10.3)
- [ ] Clicking `Priority`, `Due date`, or `Added` in `TasksListView.svelte` toggles ascending/descending sort and highlights the active column header in `text-lime-400` with `↑` or `↓`.
- [ ] The `Added` column displays the task's `created_at` date and time in `TasksListView.svelte`.
- [ ] Toolbar `Sort:` dropdown and List table headers stay in sync via the shared `sortBy` store.
