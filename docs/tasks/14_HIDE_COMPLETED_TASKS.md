# Subphase 14: Hide Completed Tasks Toggle (On by Default)

## Goal for the Model
Implement a toggle button to hide completed tasks, enabled (**ON**) by default:
1. **Hide Completed Button**: A filter pill button located in the toolbar (`TasksToolbar.svelte`) that toggles whether tasks with `status === 'Completed'` are visible or hidden in the board and list views.
2. **On by Default**: When the user first visits the tasks page (or has no saved preference), `hideCompleted` defaults to `true`.
3. **Per-User Persistence**: The user's preference (`hideCompleted: true | false`) is persisted per-user in `localStorage` under `rapidtools_tasks_hide_completed_<email>` so it remembers their chosen setting across refreshes and sessions.
4. **Completed Count Indicator**: When completed tasks exist for the current active tab and filter criteria, display a counter pill badge showing the number of completed tasks.
5. **Smart Status Filter Coordination**: If the user explicitly selects `Status: Completed` from the status dropdown, `hideCompleted` is automatically deactivated (`false`) so the view is not empty. If the user clicks `Hide completed` while `Status: Completed` is selected, the status dropdown resets to `'all'`.

---

## Context Files to Read First
1. [`src/routes/(protected)/tasks/types.ts`](../../src/routes/%28protected%29/tasks/types.ts)
2. [`src/routes/(protected)/tasks/stores.ts`](../../src/routes/%28protected%29/tasks/stores.ts)
3. [`src/routes/(protected)/tasks/components/TasksToolbar.svelte`](../../src/routes/%28protected%29/tasks/components/TasksToolbar.svelte)
4. [`src/routes/(protected)/tasks/+page.svelte`](../../src/routes/%28protected%29/tasks/+page.svelte)

---

## Execution Overview

| Phase / Step | Target Files | Scope Summary |
| :--- | :--- | :--- |
| **Phase 14.1** | `types.ts`, `stores.ts` | Add `hideCompleted?: boolean` to `TaskFilters`, initialize `taskFilters.hideCompleted = true`, add `toggleHideCompleted()` helper, persist to `localStorage`, calculate `completedTasksCount`, and filter out completed tasks in `filteredTasks`. |
| **Phase 14.2** | `TasksToolbar.svelte` | Add the `Hide completed` toggle pill button with dynamic icon (eye-slash when hidden / eye when shown), emerald active state styling, count badge, and status select coordination. |

---

## Implementation Details

### Step 14.1: Update Types (`types.ts`)
Extend `TaskFilters` interface to include `hideCompleted`:

```typescript
export interface TaskFilters {
	search: string;
	assignee: string; // 'all' or assignee_name
	status: string;   // 'all' or TaskStatus
	dueDate: DueDateFilter;
	onlyNew?: boolean;
	hideCompleted?: boolean;
}
```

---

### Step 14.2: Update Reactive Stores (`stores.ts`)

1. **Storage Key & Sync**:
```typescript
const HIDE_COMPLETED_STORAGE_PREFIX = 'rapidtools_tasks_hide_completed_';

function getHideCompletedStorageKey(userEmail?: string | null): string {
	const sanitized = (userEmail || 'anonymous')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]/g, '_');
	return `${HIDE_COMPLETED_STORAGE_PREFIX}${sanitized}`;
}

let isSyncingHideCompleted = false;
```

2. **Sync on User Change**:
```typescript
currentUser.subscribe(($user) => {
	// ...
	const hideCompletedKey = getHideCompletedStorageKey($user?.email);
	const savedHideCompleted = localStorage.getItem(hideCompletedKey);
	isSyncingHideCompleted = true;
	if (savedHideCompleted !== null) {
		taskFilters.update((f) => ({ ...f, hideCompleted: savedHideCompleted === 'true' }));
	} else {
		taskFilters.update((f) => ({ ...f, hideCompleted: true }));
	}
	isSyncingHideCompleted = false;
});
```

3. **Store Initialization & Persistence**:
```typescript
export const taskFilters = writable<TaskFilters>({
	search: '',
	assignee: 'all',
	status: 'all',
	dueDate: 'all',
	onlyNew: false,
	hideCompleted: true
});

taskFilters.subscribe((val) => {
	if (typeof window === 'undefined' || isSyncingHideCompleted) return;
	try {
		const user = get(currentUser);
		const key = getHideCompletedStorageKey(user?.email);
		if (typeof val.hideCompleted === 'boolean') {
			localStorage.setItem(key, String(val.hideCompleted));
		}
	} catch (err) {
		console.error('Failed to persist hide completed preference:', err);
	}
});

export function toggleHideCompleted(): void {
	taskFilters.update((f) => {
		const nextHide = !f.hideCompleted;
		const nextStatus = nextHide && f.status === 'Completed' ? 'all' : f.status;
		return {
			...f,
			hideCompleted: nextHide,
			status: nextStatus
		};
	});
}
```

4. **Filtering in `filteredTasks`**:
```typescript
// 4. Hide completed filter (active by default, bypassed if user specifically selects Completed status)
if (
	$filters.hideCompleted &&
	task.status === 'Completed' &&
	$filters.status !== 'Completed'
) {
	return false;
}
```

5. **Completed Tasks Count**:
```typescript
export const completedTasksCount = derived(
	[tasks, activeTab, taskFilters, currentUser, userProfile],
	([$tasks, $activeTab, $filters, $currentUser, $userProfile]): number => {
		// counts tasks with status === 'Completed' matching active tab, search, and assignee
	}
);
```

---

### Step 14.3: Update Toolbar (`TasksToolbar.svelte`)

Add the "Hide completed" button right after the "New assigned" button:

```svelte
<!-- Hide Completed Filter Pill Button -->
<button
	type="button"
	on:click={toggleHideCompleted}
	class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition sm:text-sm {$taskFilters.hideCompleted
		? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400 shadow-sm'
		: 'border-[#262a30] bg-[#141619] text-gray-300 hover:border-[#333842] hover:text-white'}"
	title={$taskFilters.hideCompleted ? 'Completed tasks are hidden (click to show)' : 'Completed tasks are shown (click to hide)'}
>
	{#if $taskFilters.hideCompleted}
		<svg class="h-4 w-4 flex-shrink-0 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
			/>
		</svg>
	{:else}
		<svg class="h-4 w-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
		</svg>
	{/if}
	<span>Hide completed</span>
	{#if $completedTasksCount > 0}
		<span
			class="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold {$taskFilters.hideCompleted
				? 'bg-emerald-500/25 text-emerald-300'
				: 'bg-[#2a2f37] text-gray-300'}"
		>
			{$completedTasksCount}
		</span>
	{/if}
</button>
```
