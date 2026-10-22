# Subphase 11: New Task Indicator (Red Dot) & Assigned Summary

## Goal for the Model
Implement an unread / new task indicator feature for tasks assigned to the current user:
1. **Red Dot Indicator**: A simple, subtle red dot (`bg-rose-500` / `bg-red-500`) located on the top-right corner of task cards (and list view rows) to signify that it's a new task assigned to the user that they have not opened or checked yet.
2. **Auto-Dismiss on Open**: Opening the task in the detail modal marks it as seen/read for the user, clearing the red dot.
3. **Summary Badge / Stat**: Add a counter in the summary stats toolbar (e.g., `X new assigned · Y open · Z due today · W overdue`) or dedicated quick indicator so the user can see how many unread/new tasks are waiting for their review.
4. **Resilient Tracking**: Store read/seen state per user (using local storage keyed by user UID/email with helper fallback, and optionally task read timestamps) without requiring breaking schema migrations, keeping execution simple, safe, and lightning fast.

This specification is broken down into **3 sequential implementation phases (steps)** so smaller models can execute one step at a time with zero ambiguity.

---

## Context Files to Read First
1. [`src/routes/(protected)/tasks/types.ts`](../../src/routes/%28protected%29/tasks/types.ts)
2. [`src/routes/(protected)/tasks/stores.ts`](../../src/routes/%28protected%29/tasks/stores.ts)
3. [`src/routes/(protected)/tasks/components/TasksToolbar.svelte`](../../src/routes/%28protected%29/tasks/components/TasksToolbar.svelte)
4. [`src/routes/(protected)/tasks/components/TaskCard.svelte`](../../src/routes/%28protected%29/tasks/components/TaskCard.svelte)
5. [`src/routes/(protected)/tasks/components/TasksListView.svelte`](../../src/routes/%28protected%29/tasks/components/TasksListView.svelte)
6. [`src/routes/(protected)/tasks/+page.svelte`](../../src/routes/%28protected%29/tasks/+page.svelte)

---

## Execution Overview (Phased Breakdown)

| Phase / Step | Target Files | Scope Summary |
| :--- | :--- | :--- |
| **Phase 11.1** | `types.ts`, `stores.ts` | Define `isTaskAssignedToUser` helper, task seen state management (`seenTaskIds` store persisted in `localStorage`), and `newAssignedCount` summary stat in `taskSummaryStats`. |
| **Phase 11.2** | `TaskCard.svelte`, `TasksListView.svelte` | Render the red indicator dot on unread cards assigned to the current user (top-right corner of card, and before task title in list view). |
| **Phase 11.3** | `TasksToolbar.svelte`, `+page.svelte` | Add the "X new" counter in the toolbar summary section, and wire `markTaskAsSeen(task.id)` when opening a task. |

---

## Phase 11.1: State Tracking & Stores (`types.ts` & `stores.ts`)

### Step 11.1A — Update `src/routes/(protected)/tasks/types.ts`

Add helper functions to determine if a task is assigned to a user and whether it is considered "new/unread":

```typescript
/**
 * Helper to check if a task is assigned to a given user by email or name.
 */
export function isTaskAssignedToUser(
	task: TaskItem,
	userEmail?: string | null,
	userName?: string | null
): boolean {
	const email = (userEmail || '').trim().toLowerCase();
	const name = (userName || '').trim().toLowerCase();

	if (!email && !name) return false;

	const assignees = getTaskAssignees(task);
	if (assignees.length > 0) {
		return assignees.some((a) => {
			const emailMatch = email && (a.email || '').trim().toLowerCase() === email;
			const nameMatch = name && (a.name || '').trim().toLowerCase() === name;
			return Boolean(emailMatch || nameMatch);
		});
	}

	const singleEmailMatch = email && (task.assignee_email || '').trim().toLowerCase() === email;
	const singleNameMatch = name && (task.assignee_name || '').trim().toLowerCase() === name;
	return Boolean(singleEmailMatch || singleNameMatch);
}
```

### Step 11.1B — Update `src/routes/(protected)/tasks/stores.ts`

1. Import `isTaskAssignedToUser` from `./types`.
2. Add a persistent store for seen task IDs per user in browser `localStorage`.
3. Provide `markTaskAsSeen(taskId: string)` and `isTaskNewForCurrentUser(task: TaskItem)` helpers.
4. Update `taskSummaryStats` derived store to calculate `newAssignedCount`.

```typescript
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
 * Update taskSummaryStats to include newAssignedCount.
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
```

---

## Phase 11.2: Red Dot UI on Cards & List Rows (`TaskCard.svelte` & `TasksListView.svelte`)

### Step 11.2A — Update `src/routes/(protected)/tasks/components/TaskCard.svelte`

1. Import `seenTaskIds` from `../stores`.
2. Import `currentUser` from `$lib/firebase` and `userProfile` from `$lib/userProfile`.
3. Import `isTaskAssignedToUser` from `../types`.
4. Calculate reactive boolean:
```typescript
$: isNewAssigned =
	task.status !== 'Completed' &&
	isTaskAssignedToUser(task, $currentUser?.email, $userProfile?.firstName) &&
	!$seenTaskIds.has(task.id);
```
5. In the card container template (top-right corner), render a red pulsing or solid dot:
```svelte
{#if isNewAssigned}
	<span
		class="absolute -top-1 -right-1 flex h-3 w-3"
		title="New task assigned to you"
	>
		<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
		<span class="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-[#181b20]"></span>
	</span>
{/if}
```

### Step 11.2B — Update `src/routes/(protected)/tasks/components/TasksListView.svelte`

1. Import `seenTaskIds` from `../stores`.
2. Import `currentUser` from `$lib/firebase` and `userProfile` from `$lib/userProfile`.
3. Import `isTaskAssignedToUser` from `../types`.
4. Inside each row iteration in the table body:
```svelte
{@const isNewAssigned =
	task.status !== 'Completed' &&
	isTaskAssignedToUser(task, $currentUser?.email, $userProfile?.firstName) &&
	!$seenTaskIds.has(task.id)}
```
5. Before or adjacent to `<span>{task.title}</span>`:
```svelte
{#if isNewAssigned}
	<span
		class="inline-block h-2 w-2 rounded-full bg-red-500 ring-2 ring-red-500/20 flex-shrink-0"
		title="New task assigned to you"
	></span>
{/if}
```

---

## Phase 11.3: Dismiss on Open & Summary Counter (`TasksToolbar.svelte` & `+page.svelte`)

### Step 11.3A — Dismiss on Open in `src/routes/(protected)/tasks/+page.svelte`

1. Import `markTaskAsSeen` from `./stores`.
2. In `openTaskDetail(task: TaskItem)`:
```typescript
function openTaskDetail(task: TaskItem) {
	markTaskAsSeen(task.id);
	selectedTask = task;
}
```

### Step 11.3B — Update Summary Counters in `src/routes/(protected)/tasks/components/TasksToolbar.svelte`

In `TasksToolbar.svelte`, locate Row 2 where `taskSummaryStats` are displayed:
```svelte
<!-- Summary Stats -->
<div class="flex items-center gap-2 pb-2.5 text-xs sm:pb-3 sm:text-sm">
	{#if $taskSummaryStats.newAssignedCount > 0}
		<span class="inline-flex items-center gap-1.5 font-semibold text-rose-400">
			<span class="h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>
			<span>{$taskSummaryStats.newAssignedCount} new</span>
		</span>
		<span class="text-gray-600">&middot;</span>
	{/if}
	<span class="font-medium text-gray-200">{$taskSummaryStats.openCount} open</span>
	<span class="text-gray-600">&middot;</span>
	<span class="font-medium text-amber-400">{$taskSummaryStats.dueTodayCount} due today</span>
	<span class="text-gray-600">&middot;</span>
	<span class="font-medium text-red-400">{$taskSummaryStats.overdueCount} overdue</span>
</div>
```

---

## Verification Checklist (For the Implementing Model)

- [ ] `docs/tasks/00_OVERVIEW.md` index includes Subphase 11.
- [ ] Red dot appears on task cards for tasks assigned to current user that haven't been opened.
- [ ] Red dot is visible in both Kanban board cards and List view table rows.
- [ ] Clicking on a task card opens the details modal and marks the task as seen.
- [ ] Red dot disappears immediately when the task is opened.
- [ ] The toolbar displays the count of new assigned tasks (e.g. `2 new · 5 open ...`).
- [ ] Completed tasks do not display the red dot.
