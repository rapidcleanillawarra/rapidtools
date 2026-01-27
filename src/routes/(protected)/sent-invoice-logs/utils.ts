import type { InvoiceSendLog } from './types';

export function getSortIcon(
	field: string,
	currentSortField: string,
	sortDirection: 'asc' | 'desc'
): string {
	if (!currentSortField || currentSortField !== field) return '↕';
	return sortDirection === 'asc' ? '↑' : '↓';
}

export function sortData(
	data: InvoiceSendLog[],
	field: keyof InvoiceSendLog,
	direction: 'asc' | 'desc'
): InvoiceSendLog[] {
	return [...data].sort((a, b) => {
		const valueA = a[field];
		const valueB = b[field];

		if (typeof valueA === 'boolean' && typeof valueB === 'boolean') {
			const na = valueA ? 1 : 0;
			const nb = valueB ? 1 : 0;
			return direction === 'asc' ? na - nb : nb - na;
		}
		if (field === 'created_at' && valueA != null && valueB != null) {
			const dateA = new Date(valueA as string).getTime();
			const dateB = new Date(valueB as string).getTime();
			return direction === 'asc' ? dateA - dateB : dateB - dateA;
		}

		const strA = String(valueA ?? '').toLowerCase();
		const strB = String(valueB ?? '').toLowerCase();
		return direction === 'asc'
			? strA.localeCompare(strB)
			: strB.localeCompare(strA);
	});
}

export function getPaginated(
	logs: InvoiceSendLog[],
	page: number,
	perPage: number
): InvoiceSendLog[] {
	const start = (page - 1) * perPage;
	return logs.slice(start, start + perPage);
}

export function formatCreatedAt(iso: string): string {
	try {
		const d = new Date(iso);
		return d.toLocaleString(undefined, {
			dateStyle: 'short',
			timeStyle: 'short'
		});
	} catch {
		return iso;
	}
}
