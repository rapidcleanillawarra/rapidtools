import type { ColumnKey } from '../statementAccounts';

const STORAGE_KEYS = {
	currentPage: 'statement-accounts-current-page',
	itemsPerPage: 'statement-accounts-items-per-page',
	visibleColumns: 'statement-accounts-visible-columns',
	sortField: 'statement-accounts-sort-field',
	sortDirection: 'statement-accounts-sort-direction'
} as const;

export interface StatementAccountsPreferences {
	currentPage?: number;
	itemsPerPage?: number;
	visibleColumns?: Record<ColumnKey, boolean>;
	sortField?: ColumnKey | '';
	sortDirection?: 'asc' | 'desc';
}

function parsePositiveInteger(value: string | null): number | undefined {
	if (!value) return undefined;
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 1) return undefined;
	return Math.floor(parsed);
}

function safeParseJson<T>(value: string | null): T | undefined {
	if (!value) return undefined;
	try {
		return JSON.parse(value) as T;
	} catch {
		return undefined;
	}
}

export function loadStatementAccountsPreferences(): StatementAccountsPreferences {
	if (typeof window === 'undefined') return {};

	const currentPage = parsePositiveInteger(localStorage.getItem(STORAGE_KEYS.currentPage));
	const itemsPerPage = parsePositiveInteger(localStorage.getItem(STORAGE_KEYS.itemsPerPage));
	const visibleColumns = safeParseJson<Record<ColumnKey, boolean>>(
		localStorage.getItem(STORAGE_KEYS.visibleColumns)
	);

	const sortFieldRaw = localStorage.getItem(STORAGE_KEYS.sortField);
	const sortField = sortFieldRaw ? (sortFieldRaw as ColumnKey | '') : undefined;

	const sortDirectionRaw = localStorage.getItem(STORAGE_KEYS.sortDirection);
	const sortDirection =
		sortDirectionRaw === 'asc' || sortDirectionRaw === 'desc' ? sortDirectionRaw : undefined;

	return { currentPage, itemsPerPage, visibleColumns, sortField, sortDirection };
}

export function saveStatementAccountsPaginationPreferences(
	currentPage: number,
	itemsPerPage: number
): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEYS.currentPage, String(currentPage));
		localStorage.setItem(STORAGE_KEYS.itemsPerPage, String(itemsPerPage));
	} catch {
		// Ignore storage errors (e.g. quota, privacy mode)
	}
}

export function saveStatementAccountsVisibleColumnsPreferences(
	visibleColumns: Record<ColumnKey, boolean>
): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEYS.visibleColumns, JSON.stringify(visibleColumns));
	} catch {
		// Ignore storage errors (e.g. quota, privacy mode)
	}
}

export function saveStatementAccountsSortingPreferences(
	sortField: string,
	sortDirection: string
): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEYS.sortField, sortField);
		localStorage.setItem(STORAGE_KEYS.sortDirection, sortDirection);
	} catch {
		// Ignore storage errors (e.g. quota, privacy mode)
	}
}
