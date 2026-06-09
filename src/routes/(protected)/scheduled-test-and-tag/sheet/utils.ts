import {
	PASTEABLE_COLUMNS,
	type PasteableColumnKey,
	type TextPasteColumnKey
} from './types';
import { FREQUENCY_OPTIONS, type SheetFrequency, type SheetHeader, type SheetRow } from './types';
import type { Schedule } from '../stores';

/** Active is checked unless explicitly set to false. */
export function normalizeSheetRow(row: SheetRow): SheetRow {
	return { ...row, active: row.active !== false };
}

export function createEmptyRow(): SheetRow {
	const id = crypto.randomUUID();
	return normalizeSheetRow({
		id,
		rciTag: id,
		tag: '',
		machines: '',
		typeOfMachine: '',
		serialNumber: '',
		sku: '',
		size: '',
		active: true,
		location: '',
		results: '',
		workshopId: '',
		service: '',
		parts: '',
		notes: ''
	});
}

export function createEmptyHeader(): SheetHeader {
	return {
		companyId: '',
		company: '',
		location: '',
		serviceDate: new Date().toISOString().split('T')[0],
		frequency: ''
	};
}

export function occurrenceToFrequency(occurence: number): SheetFrequency | '' {
	const match = FREQUENCY_OPTIONS.find((option) => option.startsWith(`${occurence} `));
	return match ?? '';
}

export function frequencyToMonths(frequency: SheetFrequency | ''): number | null {
	if (!frequency) return null;
	const months = Number.parseInt(frequency.split(' ')[0], 10);
	return Number.isNaN(months) ? null : months;
}

export function monthsToFrequency(months: number): SheetFrequency | '' {
	return occurrenceToFrequency(months);
}

export function applyCompanyToHeader(header: SheetHeader, company: Schedule): SheetHeader {
	return {
		...header,
		companyId: company.id,
		company: company.company,
		location: '',
		frequency: occurrenceToFrequency(company.occurence)
	};
}

export function applyCompanyNameToHeader(
	header: SheetHeader,
	companies: Schedule[],
	companyName: string
): SheetHeader {
	const company = companies.find((c) => c.company === companyName);

	return {
		...header,
		companyId: company?.id ?? '',
		company: companyName,
		location: '',
		frequency: company ? occurrenceToFrequency(company.occurence) : ''
	};
}

/** @deprecated Use applyCompanyToHeader */
export const applyScheduleToHeader = applyCompanyToHeader;

/** e.g. "July 07, 2026" */
export function formatServiceDate(isoDate: string): string {
	if (!isoDate) return 'Select date…';

	const [year, month, day] = isoDate.split('-').map(Number);
	if (!year || !month || !day) return isoDate;

	const date = new Date(year, month - 1, day);
	if (Number.isNaN(date.getTime())) return isoDate;

	return new Intl.DateTimeFormat('en-US', {
		month: 'long',
		day: '2-digit',
		year: 'numeric'
	}).format(date);
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

export async function getClipboardText(event: ClipboardEvent): Promise<string> {
	let text = event.clipboardData?.getData('text/plain') || event.clipboardData?.getData('text') || '';

	if (!text && typeof navigator !== 'undefined' && navigator.clipboard) {
		try {
			text = await navigator.clipboard.readText();
		} catch {
			// Clipboard API may be blocked; event data is the primary source.
		}
	}

	return text;
}

function setTextField(row: SheetRow, column: TextPasteColumnKey, value: string): SheetRow {
	return normalizeSheetRow({ ...row, [column]: value.trim() });
}

/** Paste a single value into one cell; creates a row when the table is empty. */
export function applySingleCellPaste(
	rows: SheetRow[],
	rowId: string | null,
	column: TextPasteColumnKey,
	value: string
): SheetRow[] {
	const trimmed = value.trim();

	if (rows.length === 0 || rowId === null) {
		return [setTextField(createEmptyRow(), column, trimmed)];
	}

	const startRowIndex = rows.findIndex((row) => row.id === rowId);
	if (startRowIndex === -1) return rows;

	return rows.map((row, index) =>
		index === startRowIndex ? setTextField(row, column, trimmed) : normalizeSheetRow(row)
	);
}

/** Paste values down a single column, creating rows as needed (Excel column paste). */
export function applyColumnPaste(
	rows: SheetRow[],
	rowId: string | null,
	column: TextPasteColumnKey,
	values: string[]
): SheetRow[] {
	if (values.length === 0) return rows;

	if (rows.length === 0 || rowId === null) {
		return values.map((value) => setTextField(createEmptyRow(), column, value));
	}

	const result = rows.map((row) => normalizeSheetRow({ ...row }));
	const startRowIndex = result.findIndex((row) => row.id === rowId);
	if (startRowIndex === -1) return rows;

	values.forEach((value, offset) => {
		const targetIndex = startRowIndex + offset;
		if (targetIndex >= result.length) {
			result.push(createEmptyRow());
		}
		result[targetIndex] = setTextField(result[targetIndex], column, value);
	});

	return result;
}

export type SheetPasteResult = {
	rows: SheetRow[];
	pastedCount: number;
	mode: 'cell' | 'column' | 'grid';
};

/** Route clipboard grid data to single-cell, column, or multi-column grid paste. */
export function processSheetPaste(
	rows: SheetRow[],
	rowId: string | null,
	column: TextPasteColumnKey,
	grid: string[][]
): SheetPasteResult | null {
	if (grid.length === 0) return null;

	const trimmedGrid = grid.map((row) => row.map((cell) => cell.trim()));

	if (trimmedGrid.length === 1 && trimmedGrid[0].length === 1) {
		return {
			rows: applySingleCellPaste(rows, rowId, column, trimmedGrid[0][0]),
			pastedCount: 1,
			mode: 'cell'
		};
	}

	const gridStartIndex = PASTEABLE_COLUMNS.indexOf(column as PasteableColumnKey);
	const canSpreadGrid = gridStartIndex !== -1 && isMultiCellPaste(trimmedGrid);

	if (canSpreadGrid) {
		return {
			rows: applyPasteToRows(rows, rowId, column as PasteableColumnKey, trimmedGrid),
			pastedCount: trimmedGrid.length,
			mode: 'grid'
		};
	}

	const values = trimmedGrid.map((row) => row[0] ?? '');
	return {
		rows: applyColumnPaste(rows, rowId, column, values),
		pastedCount: values.length,
		mode: 'column'
	};
}

export function getPasteToastMessage(
	column: TextPasteColumnKey,
	pastedCount: number,
	mode: SheetPasteResult['mode']
): string {
	if (mode === 'grid') {
		return `Pasted ${pastedCount} machine${pastedCount === 1 ? '' : 's'} into the table`;
	}

	if (mode === 'column') {
		return `Pasted ${pastedCount} value${pastedCount === 1 ? '' : 's'} into ${column} column`;
	}

	return `Pasted value into ${column}`;
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
