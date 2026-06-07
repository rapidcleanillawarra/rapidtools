import { PASTEABLE_COLUMNS, type PasteableColumnKey } from './types';
import type { SheetHeader, SheetRow } from './types';

/** Active is checked unless explicitly set to false. */
export function normalizeSheetRow(row: SheetRow): SheetRow {
	return { ...row, active: row.active !== false };
}

export function createEmptyRow(): SheetRow {
	return normalizeSheetRow({
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
	});
}

export function createEmptyHeader(): SheetHeader {
	return {
		company: '',
		location: '',
		serviceDate: new Date().toISOString().split('T')[0],
		frequency: ''
	};
}

/** Parse tab/newline clipboard text into a row/column grid (Excel-style). */
export function parsePasteGrid(text: string): string[][] {
	const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
	const lines = normalized.split('\n');
	if (lines.length > 0 && lines[lines.length - 1] === '') {
		lines.pop();
	}
	return lines
		.map((line) => line.split('\t'))
		.filter((cells) => cells.some((cell) => cell.trim() !== ''));
}

export function isMultiCellPaste(grid: string[][]): boolean {
	return grid.length > 1 || (grid[0]?.length ?? 0) > 1;
}

/** Apply a pasted grid starting at the given row and column; creates rows as needed. */
export function applyPasteToRows(
	rows: SheetRow[],
	startRowId: string | null,
	startColumn: PasteableColumnKey,
	grid: string[][]
): SheetRow[] {
	const startColIndex = PASTEABLE_COLUMNS.indexOf(startColumn);

	if (rows.length === 0 || startRowId === null) {
		return grid.map((cells) => {
			const row = createEmptyRow();
			cells.forEach((value, colOffset) => {
				const field = PASTEABLE_COLUMNS[startColIndex + colOffset];
				if (field) row[field] = value.trim();
			});
			return normalizeSheetRow(row);
		});
	}

	const result = rows.map((row) => normalizeSheetRow({ ...row }));
	const startRowIndex = result.findIndex((row) => row.id === startRowId);
	if (startRowIndex === -1) return rows;

	for (let pasteRow = 0; pasteRow < grid.length; pasteRow++) {
		const targetIndex = startRowIndex + pasteRow;
		if (targetIndex >= result.length) {
			result.push(createEmptyRow());
		}

		const row = { ...result[targetIndex] };
		grid[pasteRow].forEach((value, colOffset) => {
			const field = PASTEABLE_COLUMNS[startColIndex + colOffset];
			if (field) row[field] = value.trim();
		});
		result[targetIndex] = normalizeSheetRow(row);
	}

	return result;
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
