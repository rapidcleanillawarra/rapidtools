import type { SheetHeader, SheetRow } from './types';

export function createEmptyRow(): SheetRow {
	return {
		id: crypto.randomUUID(),
		machines: '',
		typeOfMachine: '',
		serialNumber: '',
		sku: '',
		size: '',
		active: true,
		results: '',
		workshopId: '',
		service: '',
		parts: '',
		notes: ''
	};
}

export function createEmptyHeader(): SheetHeader {
	return {
		company: '',
		location: '',
		serviceDate: new Date().toISOString().split('T')[0],
		frequency: ''
	};
}

export function getSortIcon(
	field: keyof SheetRow,
	currentField: keyof SheetRow | '',
	direction: 'asc' | 'desc'
): string {
	if (currentField !== field) return '↕';
	return direction === 'asc' ? '↑' : '↓';
}

export function sortRows(
	rows: SheetRow[],
	field: keyof SheetRow,
	direction: 'asc' | 'desc'
): SheetRow[] {
	return [...rows].sort((a, b) => {
		const valueA = a[field];
		const valueB = b[field];

		if (typeof valueA === 'boolean' && typeof valueB === 'boolean') {
			const numA = valueA ? 1 : 0;
			const numB = valueB ? 1 : 0;
			return direction === 'asc' ? numA - numB : numB - numA;
		}

		const strA = String(valueA).toLowerCase();
		const strB = String(valueB).toLowerCase();
		return direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
	});
}
