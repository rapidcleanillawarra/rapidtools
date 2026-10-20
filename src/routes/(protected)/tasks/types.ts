export type StandardDepartment =
	| 'Accounts'
	| 'Workshop'
	| 'IT'
	| 'Operations'
	| 'Purchasing';

export type TaskDepartment = StandardDepartment | (string & {});

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

export const DEFAULT_TASK_DEPARTMENTS: string[] = [
	'Accounts',
	'Workshop',
	'IT',
	'Operations',
	'Purchasing'
];

export const TASK_DEPARTMENTS: string[] = [...DEFAULT_TASK_DEPARTMENTS];

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

/** Dot color for default Department column headers */
export const DEPARTMENT_DOT_COLORS: Record<string, string> = {
	Accounts: 'bg-blue-500',
	Workshop: 'bg-purple-500',
	IT: 'bg-cyan-400',
	Operations: 'bg-emerald-500',
	Purchasing: 'bg-amber-500'
};

export interface BucketColorOption {
	label: string;
	class: string;
}

/** Palette of vibrant dot colors for custom buckets/departments */
export const BUCKET_COLOR_PALETTE: BucketColorOption[] = [
	{ label: 'Blue', class: 'bg-blue-500' },
	{ label: 'Purple', class: 'bg-purple-500' },
	{ label: 'Cyan', class: 'bg-cyan-400' },
	{ label: 'Emerald', class: 'bg-emerald-500' },
	{ label: 'Amber', class: 'bg-amber-500' },
	{ label: 'Pink', class: 'bg-pink-500' },
	{ label: 'Rose', class: 'bg-rose-500' },
	{ label: 'Indigo', class: 'bg-indigo-500' },
	{ label: 'Teal', class: 'bg-teal-400' },
	{ label: 'Orange', class: 'bg-orange-500' },
	{ label: 'Fuchsia', class: 'bg-fuchsia-500' },
	{ label: 'Lime', class: 'bg-lime-400' }
];

/** Get dot color class for a department, respecting custom color or deterministic hash */
export function getDepartmentDotColor(dept: string, customColorClass?: string): string {
	if (customColorClass) return customColorClass;
	if (DEPARTMENT_DOT_COLORS[dept]) return DEPARTMENT_DOT_COLORS[dept];
	let hash = 0;
	for (let i = 0; i < dept.length; i++) {
		hash = dept.charCodeAt(i) + ((hash << 5) - hash);
	}
	const palette = BUCKET_COLOR_PALETTE.map((c) => c.class);
	return palette[Math.abs(hash) % palette.length];
}

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
