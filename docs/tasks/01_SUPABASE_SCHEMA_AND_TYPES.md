# Subphase 1: Supabase Schema & TypeScript Contracts

## Goal for the Model
Create the Supabase SQL tables (`tasks`, `task_steps`, `task_attachments`, `task_comments`) with initial seed data matching the Tasks Board screenshot, and implement the TypeScript interfaces and UI helper functions in `src/routes/(protected)/tasks/types.ts`.

## Context Files to Read First
1. [`docs/THEME_GUIDE.md`](../THEME_GUIDE.md) — RapidTools dark theme tokens
2. [`src/lib/userProfile.ts`](../../src/lib/userProfile.ts) — `UserProfile` structure (`uid`, `firstName`, `lastName`, `email`)

## Files to Create in This Subphase
- `src/routes/(protected)/tasks/types.ts`

---

## Step 1.1: Supabase SQL Schema & Seed Script

Run the following SQL script in the **Supabase SQL Editor** to create the tables, storage bucket, indexes, and initial seed rows matching the reference design:

```sql
-- 1. Main Tasks Table
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    department TEXT NOT NULL DEFAULT 'Operations',
    status TEXT NOT NULL DEFAULT 'To do',
    priority TEXT NOT NULL DEFAULT 'Normal',
    assignee_uid TEXT,
    assignee_name TEXT NOT NULL,
    assignee_email TEXT,
    assigned_by_email TEXT,
    due_date DATE NOT NULL,
    latest_note TEXT,
    latest_note_at TIMESTAMPTZ,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- 2. Checklist Steps Table
CREATE TABLE IF NOT EXISTS public.task_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    step_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Task Attachments Table
CREATE TABLE IF NOT EXISTS public.task_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    content_type TEXT,
    byte_size BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Task Comments Table
CREATE TABLE IF NOT EXISTS public.task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    author_email TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON public.tasks(deleted_at);
CREATE INDEX IF NOT EXISTS idx_tasks_department ON public.tasks(department);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_task_steps_task_id ON public.task_steps(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON public.task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON public.task_attachments(task_id);

-- Enable permissive access for anon/authenticated client (matching existing RapidTools tables)
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'Allow all tasks access') THEN
        CREATE POLICY "Allow all tasks access" ON public.tasks FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'task_steps' AND policyname = 'Allow all task_steps access') THEN
        CREATE POLICY "Allow all task_steps access" ON public.task_steps FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'task_attachments' AND policyname = 'Allow all task_attachments access') THEN
        CREATE POLICY "Allow all task_attachments access" ON public.task_attachments FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'task_comments' AND policyname = 'Allow all task_comments access') THEN
        CREATE POLICY "Allow all task_comments access" ON public.task_comments FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Optional: Create storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', true)
ON CONFLICT (id) DO NOTHING;
```

### Seed Script (Matches the 6 Tasks in the Design Screenshot)

```sql
DO $$
DECLARE
    t_accounts UUID := gen_random_uuid();
    t_workshop UUID := gen_random_uuid();
    t_it UUID := gen_random_uuid();
    t_ops1 UUID := gen_random_uuid();
    t_ops2 UUID := gen_random_uuid();
    t_purchasing UUID := gen_random_uuid();
BEGIN
    -- 1. Accounts: Review unmatched payments (50%, 3 of 6 steps, AJ, High, Today, 2 comments)
    INSERT INTO public.tasks (id, title, department, status, priority, assignee_name, assigned_by_email, due_date, latest_note, latest_note_at, position)
    VALUES (t_accounts, 'Review unmatched payments', 'Accounts', 'In progress', 'High', 'AJ', 'marketing@rapidcleanillawarra.com.au', CURRENT_DATE, 'Checked Xero bank feed reconciliation.', now(), 1);

    INSERT INTO public.task_steps (task_id, label, is_completed, step_order) VALUES
        (t_accounts, 'Export unmatched Xero payments', true, 1),
        (t_accounts, 'Cross-check Maropost order numbers', true, 2),
        (t_accounts, 'Verify remittance emails', true, 3),
        (t_accounts, 'Allocate customer overpayments', false, 4),
        (t_accounts, 'Flag missing invoice references', false, 5),
        (t_accounts, 'Sign off daily batch', false, 6);

    INSERT INTO public.task_comments (task_id, author_name, content) VALUES
        (t_accounts, 'AJ', 'First 3 batches matched against Maropost.'),
        (t_accounts, 'Joeven', 'Thanks AJ, let me know if any need manual credit notes.');

    -- 2. Workshop: Confirm repair booking with customer (75%, 3 of 4 steps, Windy, High, Overdue, 3 comments)
    INSERT INTO public.tasks (id, title, department, status, priority, assignee_name, assigned_by_email, due_date, latest_note, latest_note_at, position)
    VALUES (t_workshop, 'Confirm repair booking with customer', 'Workshop', 'In progress', 'High', 'Windy', 'marketing@rapidcleanillawarra.com.au', CURRENT_DATE - INTERVAL '1 day', 'Awaiting callback from site manager.', now() - INTERVAL '1 day', 1);

    INSERT INTO public.task_steps (task_id, label, is_completed, step_order) VALUES
        (t_workshop, 'Check technician availability', true, 1),
        (t_workshop, 'Prepare quote estimate', true, 2),
        (t_workshop, 'Send SMS & email notification', true, 3),
        (t_workshop, 'Lock in drop-off window', false, 4);

    INSERT INTO public.task_comments (task_id, author_name, content) VALUES
        (t_workshop, 'Windy', 'Parts are in stock at the workshop.'),
        (t_workshop, 'Windy', 'Left voicemail with customer.'),
        (t_workshop, 'Joeven', 'Follow up tomorrow morning if no reply.');

    -- 3. IT: Build team responsibilities dashboard (40%, 2 of 5 steps, Joeven, Normal, +3 days, 1 comment)
    INSERT INTO public.tasks (id, title, department, status, priority, assignee_name, assigned_by_email, due_date, latest_note, latest_note_at, position)
    VALUES (t_it, 'Build team responsibilities dashboard', 'IT', 'In progress', 'Normal', 'Joeven', 'marketing@rapidcleanillawarra.com.au', CURRENT_DATE + INTERVAL '3 days', 'Initial Kanban board layout ready.', now(), 1);

    INSERT INTO public.task_steps (task_id, label, is_completed, step_order) VALUES
        (t_it, 'Design dark theme UI layout', true, 1),
        (t_it, 'Configure Supabase schema', true, 2),
        (t_it, 'Implement Kanban & List views', false, 3),
        (t_it, 'Wire New Task modal & checklist', false, 4),
        (t_it, 'Deploy to RapidTools', false, 5);

    INSERT INTO public.task_comments (task_id, author_name, content) VALUES
        (t_it, 'Joeven', 'Connecting Supabase tables and user profiles.');

    -- 4. Operations #1: Confirm Thursday stand-up agenda (0%, 0 of 3 steps, Shaira, Normal, +2 days, 1 comment)
    INSERT INTO public.tasks (id, title, department, status, priority, assignee_name, assigned_by_email, due_date, latest_note, latest_note_at, position)
    VALUES (t_ops1, 'Confirm Thursday stand-up agenda', 'Operations', 'To do', 'Normal', 'Shaira', 'marketing@rapidcleanillawarra.com.au', CURRENT_DATE + INTERVAL '2 days', 'Drafting talking points for department leads.', now(), 1);

    INSERT INTO public.task_steps (task_id, label, is_completed, step_order) VALUES
        (t_ops1, 'Collect updates from Workshop & Purchasing', false, 1),
        (t_ops1, 'Review open high-priority tasks', false, 2),
        (t_ops1, 'Circulate agenda link to team', false, 3);

    INSERT INTO public.task_comments (task_id, author_name, content) VALUES
        (t_ops1, 'Shaira', 'Will finalize Wednesday afternoon.');

    -- 5. Operations #2: Update delivery instructions (100%, 3 of 3 steps, Shaira, Completed, Today, 2 comments)
    INSERT INTO public.tasks (id, title, department, status, priority, assignee_name, assigned_by_email, due_date, latest_note, latest_note_at, position)
    VALUES (t_ops2, 'Update delivery instructions', 'Operations', 'Completed', 'Normal', 'Shaira', 'marketing@rapidcleanillawarra.com.au', CURRENT_DATE, 'All run sheets updated for drivers.', now() - INTERVAL '1 day', 2);

    INSERT INTO public.task_steps (task_id, label, is_completed, step_order) VALUES
        (t_ops2, 'Verify loading dock access hours', true, 1),
        (t_ops2, 'Update customer notes in Maropost', true, 2),
        (t_ops2, 'Notify delivery driver', true, 3);

    INSERT INTO public.task_comments (task_id, author_name, content) VALUES
        (t_ops2, 'Shaira', 'Customer confirmed gate code.'),
        (t_ops2, 'Shaira', 'Completed and verified.');

    -- 6. Purchasing: Follow up supplier backorder (50%, 1 of 2 steps, Zsarmaine, Waiting, Tomorrow, 0 comments)
    INSERT INTO public.tasks (id, title, department, status, priority, assignee_name, assigned_by_email, due_date, latest_note, latest_note_at, position)
    VALUES (t_purchasing, 'Follow up supplier backorder', 'Purchasing', 'Waiting', 'Normal', 'Zsarmaine', 'marketing@rapidcleanillawarra.com.au', CURRENT_DATE + INTERVAL '1 day', 'Waiting on ETA confirmation from supplier.', now() - INTERVAL '1 day', 1);

    INSERT INTO public.task_steps (task_id, label, is_completed, step_order) VALUES
        (t_purchasing, 'Send PO follow-up email to supplier', true, 1),
        (t_purchasing, 'Update expected arrival date on order', false, 2);
END $$;
```

---

## Step 1.2: Create `src/routes/(protected)/tasks/types.ts`

Create [`src/routes/(protected)/tasks/types.ts`](../../src/routes/%28protected%29/tasks/types.ts) with the complete data contracts and formatting utilities:

```typescript
export type TaskDepartment =
	| 'Accounts'
	| 'Workshop'
	| 'IT'
	| 'Operations'
	| 'Purchasing';

export type TaskStatus =
	| 'To do'
	| 'In progress'
	| 'Waiting'
	| 'Completed';

export type TaskPriority =
	| 'Normal'
	| 'High'
	| 'Urgent';

export type TaskTab = 'all' | 'my_tasks' | 'assigned_by_me';

export type TaskGroupBy = 'department' | 'status' | 'priority' | 'assignee';

export type TaskViewMode = 'board' | 'list';

export type DueDateFilter = 'all' | 'overdue' | 'today' | 'tomorrow' | 'upcoming';

export interface TaskStep {
	id: string;
	task_id: string;
	label: string;
	is_completed: boolean;
	step_order: number;
	created_at?: string;
}

export interface TaskAttachment {
	id: string;
	task_id: string;
	storage_path: string;
	file_name: string;
	content_type: string | null;
	byte_size: number | null;
	created_at: string;
	public_url?: string;
}

export interface TaskComment {
	id: string;
	task_id: string;
	author_name: string;
	author_email: string | null;
	content: string;
	created_at: string;
}

export interface TaskItem {
	id: string;
	title: string;
	description: string | null;
	department: TaskDepartment;
	status: TaskStatus;
	priority: TaskPriority;
	assignee_uid: string | null;
	assignee_name: string;
	assignee_email: string | null;
	assigned_by_email: string | null;
	due_date: string; // YYYY-MM-DD
	latest_note: string | null;
	latest_note_at: string | null;
	position: number;
	created_at: string;
	updated_at: string;
	deleted_at?: string | null;

	// Joined relations
	steps: TaskStep[];
	attachments: TaskAttachment[];
	comment_count: number;
}

export interface TaskFilters {
	search: string;
	assignee: string; // 'all' or assignee_name
	status: string;   // 'all' or TaskStatus
	dueDate: DueDateFilter;
}

export interface CreateTaskPayload {
	title: string;
	description?: string;
	department: TaskDepartment;
	status: TaskStatus;
	priority: TaskPriority;
	assignee_uid?: string | null;
	assignee_name: string;
	assignee_email?: string | null;
	due_date: string;
	latest_note?: string;
	steps: { label: string; is_completed: boolean }[];
	files?: File[];
}

export interface TaskColumnGroup {
	key: string;
	label: string;
	dotColorClass: string;
	tasks: TaskItem[];
}

export const TASK_DEPARTMENTS: TaskDepartment[] = [
	'Accounts',
	'Workshop',
	'IT',
	'Operations',
	'Purchasing'
];

export const TASK_STATUSES: TaskStatus[] = [
	'To do',
	'In progress',
	'Waiting',
	'Completed'
];

export const TASK_PRIORITIES: TaskPriority[] = [
	'Normal',
	'High',
	'Urgent'
];

/** Dot color for each Department column header */
export const DEPARTMENT_DOT_COLORS: Record<string, string> = {
	Accounts: 'bg-blue-500',
	Workshop: 'bg-purple-500',
	IT: 'bg-cyan-400',
	Operations: 'bg-emerald-500',
	Purchasing: 'bg-amber-500'
};

/** Dot color for each Task Status pill */
export const STATUS_DOT_COLORS: Record<TaskStatus, string> = {
	'To do': 'bg-gray-400',
	'In progress': 'bg-blue-400',
	Waiting: 'bg-amber-400',
	Completed: 'bg-emerald-400'
};

/** Progress bar fill color based on Task Status */
export function getProgressBarColor(status: TaskStatus): string {
	if (status === 'Waiting') return 'bg-amber-400';
	return 'bg-lime-500';
}

/** Calculate checklist progress percentage and counts */
export function getTaskProgress(steps: TaskStep[] = []): {
	completed: number;
	total: number;
	percent: number;
} {
	const total = steps.length;
	if (total === 0) {
		return { completed: 0, total: 0, percent: 0 };
	}
	const completed = steps.filter((s) => s.is_completed).length;
	const percent = Math.round((completed / total) * 100);
	return { completed, total, percent };
}

/** Get 2-letter initials from an assignee name */
export function getInitials(name: string): string {
	const cleaned = (name || '').trim();
	if (!cleaned) return '??';
	const parts = cleaned.split(/\s+/);
	if (parts.length >= 2) {
		return (parts[0][0] + parts[1][0]).toUpperCase();
	}
	return cleaned.slice(0, 2).toUpperCase();
}

/** Deterministic avatar badge color matching the screenshot (AJ pink, WI/JC lime, SH purple, ZS blue) */
export function getAvatarColorClasses(name: string): string {
	const normalized = (name || '').trim().toLowerCase();
	if (normalized.startsWith('aj')) return 'bg-pink-500 text-white';
	if (normalized.startsWith('windy') || normalized.startsWith('wi')) return 'bg-lime-400 text-gray-950';
	if (normalized.startsWith('joeven') || normalized.startsWith('jc')) return 'bg-lime-400 text-gray-950';
	if (normalized.startsWith('shaira') || normalized.startsWith('sh')) return 'bg-purple-500 text-white';
	if (normalized.startsWith('zsarmaine') || normalized.startsWith('zs')) return 'bg-sky-500 text-white';

	const palette = [
		'bg-lime-400 text-gray-950',
		'bg-sky-500 text-white',
		'bg-purple-500 text-white',
		'bg-pink-500 text-white',
		'bg-amber-500 text-gray-950',
		'bg-emerald-500 text-gray-950'
	];
	let hash = 0;
	for (let i = 0; i < normalized.length; i++) {
		hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
	}
	return palette[Math.abs(hash) % palette.length];
}

/** Parse YYYY-MM-DD in local time without timezone shift */
export function parseLocalDate(dateStr: string): Date {
	const [y, m, d] = (dateStr || '').split('-').map(Number);
	if (!y || !m || !d) return new Date();
	return new Date(y, m - 1, d);
}

/** Format short day + month (e.g. "19 Oct", "23 Oct") */
export function formatShortDate(dateStr: string | null | undefined): string {
	if (!dateStr) return '';
	const date = dateStr.includes('T') ? new Date(dateStr) : parseLocalDate(dateStr);
	if (isNaN(date.getTime())) return '';
	return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

/** Classify due date relative to today and return display text + color class */
export function getDueDateDisplay(dueDateStr: string, status?: TaskStatus): {
	label: string;
	bucket: 'overdue' | 'today' | 'tomorrow' | 'upcoming';
	textClass: string;
	iconClass: string;
	borderClass: string;
} {
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const due = parseLocalDate(dueDateStr);
	due.setHours(0, 0, 0, 0);

	const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
	const shortDate = formatShortDate(dueDateStr);

	if (diffDays < 0 && status !== 'Completed') {
		return {
			label: `Overdue · ${shortDate}`,
			bucket: 'overdue',
			textClass: 'text-red-400',
			iconClass: 'text-red-400',
			borderClass: 'border-red-500/30 bg-red-950/20'
		};
	}

	if (diffDays === 0) {
		return {
			label: 'Today',
			bucket: 'today',
			textClass: 'text-amber-400',
			iconClass: 'text-amber-400',
			borderClass: 'border-amber-500/30 bg-amber-950/20'
		};
	}

	if (diffDays === 1) {
		return {
			label: 'Tomorrow',
			bucket: 'tomorrow',
			textClass: 'text-gray-300',
			iconClass: 'text-gray-400',
			borderClass: 'border-[#333842] bg-[#141619]'
		};
	}

	return {
		label: shortDate,
		bucket: 'upcoming',
		textClass: 'text-gray-300',
		iconClass: 'text-gray-400',
		borderClass: 'border-[#333842] bg-[#141619]'
	};
}
```

---

## Definition of Done (Subphase 1)
- [ ] SQL tables (`tasks`, `task_steps`, `task_attachments`, `task_comments`) and seed data script are documented and ready in Supabase.
- [ ] `src/routes/(protected)/tasks/types.ts` is created with zero TypeScript errors.
