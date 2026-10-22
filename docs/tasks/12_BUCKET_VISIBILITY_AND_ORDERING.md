# Subphase 12: User Bucket Visibility (Hide/Show) & Custom Ordering

## Goal for the Model
Allow each user to customize their own Tasks view by:
1. **Hiding and un-hiding buckets (departments)** from their personal Board and List views without deleting the bucket for other team members.
2. **Reordering buckets** (moving columns/groups left/right or up/down, and dragging columns in Board view) so their most important buckets appear first.
3. **Managing buckets via a "Buckets" popover in the toolbar** where users can quickly toggle visibility, reorder buckets, or reset to default view.
4. **Persisting preferences per user** (keyed by user email/UID in `localStorage`) so each user's custom bucket layout and hidden buckets are remembered automatically across sessions.

This specification is broken down into **3 sequential implementation phases (steps)** so smaller models can execute one step at a time with zero ambiguity.

---

## Context Files to Read First
1. [`src/routes/(protected)/tasks/types.ts`](../../src/routes/%28protected%29/tasks/types.ts)
2. [`src/routes/(protected)/tasks/stores.ts`](../../src/routes/%28protected%29/tasks/stores.ts)
3. [`src/routes/(protected)/tasks/components/TasksToolbar.svelte`](../../src/routes/%28protected%29/tasks/components/TasksToolbar.svelte)
4. [`src/routes/(protected)/tasks/components/TaskBoardColumn.svelte`](../../src/routes/%28protected%29/tasks/components/TaskBoardColumn.svelte)
5. [`src/routes/(protected)/tasks/components/TasksBoardView.svelte`](../../src/routes/%28protected%29/tasks/components/TasksBoardView.svelte)
6. [`src/routes/(protected)/tasks/components/TasksListView.svelte`](../../src/routes/%28protected%29/tasks/components/TasksListView.svelte)

---

## Execution Overview (Phased Breakdown)

| Phase / Step | Target Files | Scope Summary |
| :--- | :--- | :--- |
| **Phase 12.1** | `types.ts`, `stores.ts` | Add `UserBucketPreferences` type, per-user persistent store (`bucketPreferences`), `orderedDepartments` and `visibleDepartments` derived stores, action helpers (`toggleBucketVisibility`, `moveBucket`, `reorderBuckets`, `resetBucketPreferences`), and wire into `groupedTasks`. |
| **Phase 12.2** | `TasksToolbar.svelte` | Add the **"Buckets" Customize Popover** in Row 3 of the toolbar with a badge showing hidden bucket count, checkboxes/eye toggles to show/hide any bucket, `↑`/`↓` reorder buttons, and a "Reset to default" action. |
| **Phase 12.3** | `TaskBoardColumn.svelte`, `TasksBoardView.svelte`, `TasksListView.svelte` | Add `Move left`, `Move right`, and `Hide bucket` actions to `TaskBoardColumn.svelte` (plus column drag-and-drop reordering in `TasksBoardView.svelte`) and `↑`/`↓`/`Hide` controls on department headers in `TasksListView.svelte`. |

---

## Phase 12.1: Per-User Bucket Preferences & Reactive Stores (`types.ts` & `stores.ts`)

### Step 12.1A — Update `src/routes/(protected)/tasks/types.ts`

Add the `UserBucketPreferences` interface to [`src/routes/(protected)/tasks/types.ts`](../../src/routes/%28protected%29/tasks/types.ts) right after `export interface TaskColumnGroup` (around line 148):

```typescript
export interface UserBucketPreferences {
	/** Ordered list of department/bucket names for the current user's view */
	order: string[];
	/** List of department/bucket names hidden in the current user's view */
	hidden: string[];
}
```

---

### Step 12.1B — Update `src/routes/(protected)/tasks/stores.ts`

1. Import `get` from `'svelte/store'` at line 1 of [`src/routes/(protected)/tasks/stores.ts`](../../src/routes/%28protected%29/tasks/stores.ts), and import `type UserBucketPreferences` from `./types`:

```typescript
import { writable, derived, get } from 'svelte/store';
```

And in the `./types` import block:
```typescript
	type TaskColumnGroup,
	type UserBucketPreferences,
```

2. Right below `export const allDepartments = derived(...)` (around line 70 of `stores.ts`), add the per-user bucket preferences store, persistence logic, derived stores (`orderedDepartments`, `visibleDepartments`, `hiddenBucketsCount`), and helper actions:

```typescript
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

// Initialize / sync bucketPreferences when currentUser changes
currentUser.subscribe(($user) => {
	if (typeof window === 'undefined') return;
	try {
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
```

3. Update `groupedTasks` in [`src/routes/(protected)/tasks/stores.ts`](../../src/routes/%28protected%29/tasks/stores.ts) so that when `$groupBy === 'department'`, it uses `visibleDepartments` instead of `allDepartments`:

```typescript
/**
 * Grouped columns for the Kanban Board and List views.
 * Respects per-user bucket order and hidden buckets when grouped by department.
 */
export const groupedTasks = derived(
	[filteredTasks, groupBy, sortBy, availableAssignees, visibleDepartments, departmentColors],
	([$filteredTasks, $groupBy, $sortBy, $availableAssignees, $visibleDepartments, $departmentColors]): TaskColumnGroup[] => {
		const sortList = (list: TaskItem[]) => [...list].sort((a, b) => compareTasks(a, b, $sortBy));

		if ($groupBy === 'department') {
			return $visibleDepartments.map((dept) => ({
				key: dept,
				label: dept,
				dotColorClass: $departmentColors[dept] || getDepartmentDotColor(dept),
				tasks: sortList(
					$filteredTasks.filter((t) => (t.department || '').toLowerCase() === dept.toLowerCase())
				)
			}));
		}
```
*(Keep the remaining `$groupBy === 'status'`, `'priority'`, and `'assignee'` branches unchanged.)*

### Definition of Done (Phase 12.1)
- [ ] `UserBucketPreferences` is exported from `types.ts`.
- [ ] `bucketPreferences`, `orderedDepartments`, `visibleDepartments`, `hiddenBucketsCount`, `toggleBucketVisibility`, `hideBucket`, `showAllBuckets`, `moveBucket`, `reorderBuckets`, and `resetBucketPreferences` are exported from `stores.ts`.
- [ ] `groupedTasks` uses `visibleDepartments` so hidden buckets are filtered out and visible buckets follow the user's custom order.
- [ ] `allDepartments` remains untouched so `CreateTaskModal` and `TaskDetailModal` still allow assigning tasks to any department.

---

## Phase 12.2: Toolbar "Buckets" Manager Popover (`TasksToolbar.svelte`)

### Goal for the Model
Add a **"Buckets"** button and popover menu in Row 3 of [`src/routes/(protected)/tasks/components/TasksToolbar.svelte`](../../src/routes/%28protected%29/tasks/components/TasksToolbar.svelte) (right next to the `Group by` selector) so users can:
- See all buckets in their current order with color dots and task counts.
- Toggle any bucket's visibility (eye icon / checkbox).
- Move any bucket up (`↑`) or down (`↓`) in the order.
- Quickly click **"Show all"** or **"Reset"** to restore default order and visibility.
- See a subtle badge on the button when 1 or more buckets are hidden (e.g. `1 hidden`).

### Step 12.2A — Update Imports & State in `TasksToolbar.svelte`

1. Update imports from `../stores` in [`src/routes/(protected)/tasks/components/TasksToolbar.svelte`](../../src/routes/%28protected%29/tasks/components/TasksToolbar.svelte):

```typescript
	import {
		activeTab,
		taskFilters,
		groupBy,
		sortBy,
		viewMode,
		taskSummaryStats,
		availableAssignees,
		filteredTasks,
		orderedDepartments,
		bucketPreferences,
		hiddenBucketsCount,
		departmentColors,
		toggleBucketVisibility,
		moveBucket,
		showAllBuckets,
		resetBucketPreferences
	} from '../stores';
```

2. Update imports from `../types` to include `getDepartmentDotColor`:

```typescript
	import {
		TASK_STATUSES,
		TASK_SORT_OPTIONS,
		getDepartmentDotColor,
		type TaskTab,
		type TaskGroupBy,
		type DueDateFilter
	} from '../types';
```

3. Add local state and helpers in `<script lang="ts">` of `TasksToolbar.svelte`:

```typescript
	let bucketMenuOpen = false;

	$: isBucketCustomized =
		$bucketPreferences.order.length > 0 || $bucketPreferences.hidden.length > 0;

	function isBucketHidden(dept: string, hiddenList: string[]): boolean {
		const lower = dept.toLowerCase();
		return hiddenList.some((h) => h.toLowerCase() === lower);
	}

	function getDeptTaskCount(dept: string, tasksList: typeof $filteredTasks): number {
		const lower = dept.toLowerCase();
		return tasksList.filter((t) => (t.department || '').toLowerCase() === lower).length;
	}
```

### Step 12.2B — Add the "Buckets" Popover Control in Row 3 of `TasksToolbar.svelte`

Inside `<!-- Right: Sort By + Group By Dropdown + Board / List View Toggle -->` (right after the `<!-- Group By -->` `<select>` element in `TasksToolbar.svelte`), insert the Buckets Customize Popover:

```svelte
			<!-- Customize Buckets (Order & Visibility) -->
			{#if $groupBy === 'department'}
				<div class="relative">
					<button
						type="button"
						on:click={() => (bucketMenuOpen = !bucketMenuOpen)}
						class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition sm:text-sm {bucketMenuOpen || $hiddenBucketsCount > 0
							? 'border-lime-500/50 bg-lime-500/10 text-lime-400'
							: 'border-[#262a30] bg-[#141619] text-gray-200 hover:border-[#333842] hover:text-white'}"
						title="Customize bucket order and visibility"
					>
						<svg class="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
							/>
						</svg>
						<span>Buckets</span>
						{#if $hiddenBucketsCount > 0}
							<span class="inline-flex items-center rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
								{$hiddenBucketsCount} hidden
							</span>
						{/if}
					</button>

					{#if bucketMenuOpen}
						<!-- Backdrop -->
						<div
							class="fixed inset-0 z-30"
							on:click={() => (bucketMenuOpen = false)}
						></div>

						<!-- Popover Panel -->
						<div
							class="absolute right-0 top-full z-40 mt-2 w-72 rounded-xl border border-[#262a30] bg-[#141619] p-3 shadow-2xl"
						>
							<div class="mb-2 flex items-center justify-between border-b border-[#262a30] pb-2">
								<div>
									<h4 class="text-xs font-bold uppercase tracking-wider text-white">
										Customize Buckets
									</h4>
									<p class="text-[11px] text-gray-400">
										Show, hide, or reorder for your view
									</p>
								</div>
								{#if isBucketCustomized}
									<button
										type="button"
										on:click={() => resetBucketPreferences()}
										class="text-[11px] font-semibold text-lime-400 transition hover:text-lime-300"
									>
										Reset
									</button>
								{/if}
							</div>

							<div class="max-h-64 space-y-1 overflow-y-auto pr-0.5">
								{#each $orderedDepartments as dept, idx (dept)}
									{@const hidden = isBucketHidden(dept, $bucketPreferences.hidden)}
									{@const dotClass = $departmentColors[dept] || getDepartmentDotColor(dept)}
									{@const count = getDeptTaskCount(dept, $filteredTasks)}
									<div
										class="flex items-center justify-between gap-2 rounded-lg border border-transparent px-2 py-1.5 transition hover:border-[#262a30] hover:bg-[#1a1d23] {hidden ? 'opacity-55' : ''}"
									>
										<!-- Visibility Toggle Button -->
										<button
											type="button"
											on:click={() => toggleBucketVisibility(dept)}
											class="flex flex-1 items-center gap-2 text-left text-xs font-medium {hidden ? 'text-gray-500 line-through' : 'text-gray-200'} focus:outline-none"
											title={hidden ? `Show ${dept}` : `Hide ${dept}`}
										>
											{#if hidden}
												<svg class="h-4 w-4 flex-shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
													/>
												</svg>
											{:else}
												<svg class="h-4 w-4 flex-shrink-0 text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
													/>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
													/>
												</svg>
											{/if}
											<span class="h-2 w-2 flex-shrink-0 rounded-full {dotClass}"></span>
											<span class="truncate">{dept}</span>
											<span class="ml-auto rounded-full bg-[#20242b] px-1.5 py-0.2 text-[10px] font-semibold text-gray-400">
												{count}
											</span>
										</button>

										<!-- Move Up / Move Down Buttons -->
										<div class="flex items-center gap-0.5">
											<button
												type="button"
												disabled={idx === 0}
												on:click={() => moveBucket(dept, 'left', false)}
												class="rounded p-1 text-gray-400 transition hover:bg-[#262a30] hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"
												title="Move earlier"
											>
												<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
												</svg>
											</button>
											<button
												type="button"
												disabled={idx === $orderedDepartments.length - 1}
												on:click={() => moveBucket(dept, 'right', false)}
												class="rounded p-1 text-gray-400 transition hover:bg-[#262a30] hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"
												title="Move later"
											>
												<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
												</svg>
											</button>
										</div>
									</div>
								{/each}
							</div>

							{#if $hiddenBucketsCount > 0}
								<div class="mt-2 border-t border-[#262a30] pt-2">
									<button
										type="button"
										on:click={() => showAllBuckets()}
										class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#262a30] bg-[#181b20] py-1.5 text-xs font-semibold text-gray-200 transition hover:border-lime-500/40 hover:text-lime-400"
									>
										<span>Show all buckets ({$hiddenBucketsCount} hidden)</span>
									</button>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
```

### Definition of Done (Phase 12.2)
- [ ] The `Buckets` button appears in `TasksToolbar.svelte` whenever `Group by: Department` is active.
- [ ] Clicking `Buckets` opens the popover showing all buckets in their current order, with eye icon toggles to hide/show and `↑`/`↓` buttons to reorder.
- [ ] When one or more buckets are hidden, the button displays an amber `X hidden` badge and a `Show all buckets` footer button inside the popover.

---

## Phase 12.3: Direct Column & Group Controls (`TaskBoardColumn.svelte`, `TasksBoardView.svelte`, `TasksListView.svelte`)

### Goal for the Model
Allow users to hide or move buckets directly from the Board columns and List group headers, including drag-and-drop column reordering in Board view:
1. In [`TaskBoardColumn.svelte`](../../src/routes/%28protected%29/tasks/components/TaskBoardColumn.svelte): Add **Move left**, **Move right**, and **Hide bucket** options in the column `...` dropdown menu (when `$groupBy === 'department'`).
2. In [`TasksBoardView.svelte`](../../src/routes/%28protected%29/tasks/components/TasksBoardView.svelte): Support HTML5 drag-and-drop on department columns to reorder them directly by dragging column headers, and show a helpful banner/empty state if all buckets are hidden.
3. In [`TasksListView.svelte`](../../src/routes/%28protected%29/tasks/components/TasksListView.svelte): Add quick **Move up (`↑`)**, **Move down (`↓`)**, and **Hide bucket** icon buttons in each department group header bar.

---

### Step 12.3A — Update `src/routes/(protected)/tasks/components/TaskBoardColumn.svelte`

1. Import `hideBucket`, `moveBucket`, and `visibleDepartments` from `../stores` in [`src/routes/(protected)/tasks/components/TaskBoardColumn.svelte`](../../src/routes/%28protected%29/tasks/components/TaskBoardColumn.svelte):

```typescript
	import {
		groupBy,
		removeDepartment,
		hideBucket,
		moveBucket,
		visibleDepartments
	} from '../stores';
```

2. Add reactive index checks in `<script lang="ts">` of `TaskBoardColumn.svelte`:

```typescript
	$: isDepartmentGroup = $groupBy === 'department';

	$: columnIndex = $visibleDepartments.findIndex(
		(d) => d.toLowerCase() === column.key.toLowerCase()
	);
	$: canMoveLeft = isDepartmentGroup && columnIndex > 0;
	$: canMoveRight =
		isDepartmentGroup &&
		columnIndex !== -1 &&
		columnIndex < $visibleDepartments.length - 1;

	function handleHideBucket() {
		menuOpen = false;
		hideBucket(column.key);
		toastSuccess(`Hidden "${column.label}" from your view`);
	}

	function handleMoveLeft() {
		menuOpen = false;
		moveBucket(column.key, 'left', true);
	}

	function handleMoveRight() {
		menuOpen = false;
		moveBucket(column.key, 'right', true);
	}
```

3. Inside the `<!-- Dropdown Menu -->` in `TaskBoardColumn.svelte` (right after the `Add task` button and before `{#if isCustomBucket}`), add the **Move left**, **Move right**, and **Hide bucket** menu items:

```svelte
					{#if isDepartmentGroup}
						<div class="my-1 border-t border-[#262a30]"></div>

						<button
							type="button"
							disabled={!canMoveLeft}
							on:click={handleMoveLeft}
							class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-200 transition hover:bg-[#1f2329] disabled:cursor-not-allowed disabled:opacity-35"
						>
							<svg class="h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
							</svg>
							<span>Move left</span>
						</button>

						<button
							type="button"
							disabled={!canMoveRight}
							on:click={handleMoveRight}
							class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-200 transition hover:bg-[#1f2329] disabled:cursor-not-allowed disabled:opacity-35"
						>
							<svg class="h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
							</svg>
							<span>Move right</span>
						</button>

						<button
							type="button"
							on:click={handleHideBucket}
							class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-amber-300 transition hover:bg-[#1f2329]"
						>
							<svg class="h-3.5 w-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
								/>
							</svg>
							<span>Hide bucket</span>
						</button>
					{/if}
```

---

### Step 12.3B — Add Drag-and-Drop Column Reordering & Hidden Banner in `TasksBoardView.svelte`

1. Update imports from `../stores` in [`src/routes/(protected)/tasks/components/TasksBoardView.svelte`](../../src/routes/%28protected%29/tasks/components/TasksBoardView.svelte):

```typescript
	import {
		groupedTasks,
		groupBy,
		allDepartments,
		addDepartment,
		reorderBuckets,
		hiddenBucketsCount,
		showAllBuckets
	} from '../stores';
```

2. Add column drag-and-drop state and handlers inside `<script lang="ts">` of `TasksBoardView.svelte`:

```typescript
	let draggedBucketKey: string | null = null;
	let dragOverBucketKey: string | null = null;

	function handleDragStart(e: DragEvent, key: string) {
		if ($groupBy !== 'department') return;
		draggedBucketKey = key;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', key);
		}
	}

	function handleDragOver(e: DragEvent, key: string) {
		if ($groupBy !== 'department' || !draggedBucketKey) return;
		e.preventDefault();
		if (draggedBucketKey !== key) {
			dragOverBucketKey = key;
		}
	}

	function handleDrop(e: DragEvent, targetKey: string) {
		if ($groupBy !== 'department' || !draggedBucketKey) return;
		e.preventDefault();
		if (draggedBucketKey !== targetKey) {
			reorderBuckets(draggedBucketKey, targetKey);
		}
		draggedBucketKey = null;
		dragOverBucketKey = null;
	}

	function handleDragEnd() {
		draggedBucketKey = null;
		dragOverBucketKey = null;
	}
```

3. Update the `#each $groupedTasks as column (column.key)` wrapper in `TasksBoardView.svelte` to attach the drag-and-drop handlers and visual drop indicator:

```svelte
		{#each $groupedTasks as column (column.key)}
			<div
				class="w-80 flex-shrink-0 transition-transform {dragOverBucketKey === column.key ? 'rounded-xl ring-2 ring-lime-400/70' : ''} {draggedBucketKey === column.key ? 'opacity-50' : ''}"
				draggable={$groupBy === 'department'}
				on:dragstart={(e) => handleDragStart(e, column.key)}
				on:dragover={(e) => handleDragOver(e, column.key)}
				on:drop={(e) => handleDrop(e, column.key)}
				on:dragend={handleDragEnd}
				role="region"
				aria-label="{column.label} column"
			>
				<TaskBoardColumn
					{column}
					on:addTask={(e) => dispatch('addTask', e.detail)}
					on:selectTask={(e) => dispatch('selectTask', e.detail)}
					on:statusChange={(e) => dispatch('statusChange', e.detail)}
					on:deleteTask={(e) => dispatch('deleteTask', e.detail)}
					on:openPhotos={(e) => dispatch('openPhotos', e.detail)}
				/>
			</div>
		{/each}
```

4. If all buckets are hidden (`$groupBy === 'department' && $groupedTasks.length === 0 && $hiddenBucketsCount > 0`), show a clean empty state card right before the `Add bucket` card in `TasksBoardView.svelte`:

```svelte
		{#if $groupBy === 'department' && $groupedTasks.length === 0 && $hiddenBucketsCount > 0}
			<div class="flex h-40 w-80 flex-shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-[#262a30] bg-[#141619] p-4 text-center">
				<p class="text-xs text-gray-400">All {$hiddenBucketsCount} buckets are hidden in your view.</p>
				<button
					type="button"
					on:click={() => showAllBuckets()}
					class="rounded-lg bg-lime-400 px-3 py-1.5 text-xs font-semibold text-gray-950 transition hover:bg-lime-300"
				>
					Show all buckets
				</button>
			</div>
		{/if}
```

---

### Step 12.3C — Add Move & Hide Controls to Group Headers in `TasksListView.svelte`

1. Update imports from `../stores` in [`src/routes/(protected)/tasks/components/TasksListView.svelte`](../../src/routes/%28protected%29/tasks/components/TasksListView.svelte):

```typescript
	import {
		groupedTasks,
		groupBy,
		sortBy,
		seenTaskIds,
		visibleDepartments,
		hiddenBucketsCount,
		moveBucket,
		hideBucket,
		showAllBuckets
	} from '../stores';
	import { toastSuccess } from '$lib/utils/toast';
```

2. In `TasksListView.svelte`, update `#each $groupedTasks as group (group.key)` to `#each $groupedTasks as group, groupIdx (group.key)` and enhance the `<!-- Group Header Bar -->` right side so that when `$groupBy === 'department'`, users have quick `↑`, `↓`, and `Hide` buttons right alongside `+ Add task`:

```svelte
				<div class="flex items-center gap-1.5">
					{#if $groupBy === 'department'}
						<button
							type="button"
							disabled={groupIdx === 0}
							on:click={() => moveBucket(group.key, 'left', true)}
							class="rounded-lg border border-[#262a30] bg-[#141619] p-1 text-gray-400 transition hover:border-[#333842] hover:text-white disabled:opacity-30"
							title="Move bucket up"
						>
							<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
							</svg>
						</button>
						<button
							type="button"
							disabled={groupIdx === $visibleDepartments.length - 1}
							on:click={() => moveBucket(group.key, 'right', true)}
							class="rounded-lg border border-[#262a30] bg-[#141619] p-1 text-gray-400 transition hover:border-[#333842] hover:text-white disabled:opacity-30"
							title="Move bucket down"
						>
							<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
							</svg>
						</button>
						<button
							type="button"
							on:click={() => {
								hideBucket(group.key);
								toastSuccess(`Hidden "${group.label}" from your view`);
							}}
							class="rounded-lg border border-[#262a30] bg-[#141619] p-1 text-gray-400 transition hover:border-amber-500/40 hover:text-amber-300"
							title="Hide bucket from your view"
						>
							<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
								/>
							</svg>
						</button>
					{/if}

					<button
						type="button"
						on:click={() => dispatch('addTask', group.key)}
						class="inline-flex items-center gap-1 rounded-lg border border-[#262a30] bg-[#141619] px-2.5 py-1 text-xs font-semibold text-lime-400 transition hover:border-lime-500/40 hover:bg-[#1f2329]"
					>
						<svg class="h-3.5 w-3.5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
						</svg>
						<span>Add task</span>
					</button>
				</div>
```

### Definition of Done (Phase 12.3)
- [ ] Column `...` menu in `TaskBoardColumn.svelte` includes `Move left`, `Move right`, and `Hide bucket` when grouped by department.
- [ ] Department columns in `TasksBoardView.svelte` can be reordered via drag-and-drop.
- [ ] Department headers in `TasksListView.svelte` have `↑`, `↓`, and `Hide` buttons.
- [ ] All changes immediately update and persist to the current user's `localStorage` preferences.

---

## Verification Checklist (For the Implementing Model)

- [ ] `docs/tasks/00_OVERVIEW.md` index includes Subphase 12.
- [ ] Hiding a bucket hides it only from the current user's view (`Board` and `List`) without deleting it from `allDepartments` or Supabase.
- [ ] Moving a bucket updates the order in both `TasksBoardView` and `TasksListView` immediately.
- [ ] Refreshing the page preserves the user's hidden buckets and custom bucket order.
- [ ] The `Buckets` toolbar button displays `X hidden` when buckets are hidden and allows un-hiding or resetting with one click.
