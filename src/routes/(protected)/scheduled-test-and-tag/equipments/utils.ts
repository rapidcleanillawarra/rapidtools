import {
	PASTEABLE_COLUMNS,
	type PasteableColumnKey,
	type TextPasteColumnKey
} from './types';
import type { EquipmentColumnKey, EquipmentHeader, EquipmentTableRow } from './types';
import type { Schedule } from '../stores';

export function normalizeEquipmentRow(row: EquipmentTableRow): EquipmentTableRow {
	return { ...row, active: row.active !== false };
}

export function createEmptyRow(defaults?: {
	startMonth?: number;
	frequency?: number;
}): EquipmentTableRow {
	const id = crypto.randomUUID();
	return normalizeEquipmentRow({
		id,
		rciTag: id,
		tag: '',
		name: '',
		typeOfMachine: '',
		serialNumber: '',
		sku: '',
		size: '',
		active: true,
		startMonth: defaults?.startMonth ?? 1,
		frequency: defaults?.frequency ?? 12
	});
}

export function createEmptyHeader(): EquipmentHeader {
	return {
		companyId: '',
		company: ''
	};
}

export function applyCompanyToHeader(header: EquipmentHeader, company: Schedule): EquipmentHeader {
	return {
		...header,
		companyId: company.id,
		company: company.company
	};
}

export function applyCompanyNameToHeader(
	header: EquipmentHeader,
	companies: Schedule[],
	companyName: string
): EquipmentHeader {
	const company = companies.find((c) => c.company === companyName);

	return {
		...header,
		companyId: company?.id ?? '',
		company: companyName
	};
}

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

function setTextField(
	row: EquipmentTableRow,
	column: TextPasteColumnKey,
	value: string
): EquipmentTableRow {
	return normalizeEquipmentRow({ ...row, [column]: value.trim() });
}

export function applySingleCellPaste(
	rows: EquipmentTableRow[],
	rowId: string | null,
	column: TextPasteColumnKey,
	value: string
): EquipmentTableRow[] {
	const trimmed = value.trim();

	if (rows.length === 0 || rowId === null) {
		return [setTextField(createEmptyRow(), column, trimmed)];
	}

	const startRowIndex = rows.findIndex((row) => row.id === rowId);
	if (startRowIndex === -1) return rows;

	return rows.map((row, index) =>
		index === startRowIndex ? setTextField(row, column, trimmed) : normalizeEquipmentRow(row)
	);
}

export function applyColumnPaste(
	rows: EquipmentTableRow[],
	rowId: string | null,
	column: TextPasteColumnKey,
	values: string[]
): EquipmentTableRow[] {
	if (values.length === 0) return rows;

	if (rows.length === 0 || rowId === null) {
		return values.map((value) => setTextField(createEmptyRow(), column, value));
	}

	const result = rows.map((row) => normalizeEquipmentRow({ ...row }));
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

export type EquipmentPasteResult = {
	rows: EquipmentTableRow[];
	pastedCount: number;
	mode: 'cell' | 'column' | 'grid';
};

export function processEquipmentPaste(
	rows: EquipmentTableRow[],
	rowId: string | null,
	column: TextPasteColumnKey,
	grid: string[][]
): EquipmentPasteResult | null {
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
	mode: EquipmentPasteResult['mode']
): string {
	if (mode === 'grid') {
		return `Pasted ${pastedCount} equipment row${pastedCount === 1 ? '' : 's'} into the table`;
	}

	if (mode === 'column') {
		return `Pasted ${pastedCount} value${pastedCount === 1 ? '' : 's'} into ${column} column`;
	}

	return `Pasted value into ${column}`;
}

export function applyPasteToRows(
	rows: EquipmentTableRow[],
	startRowId: string | null,
	startColumn: PasteableColumnKey,
	grid: string[][]
): EquipmentTableRow[] {
	const startColIndex = PASTEABLE_COLUMNS.indexOf(startColumn);

	if (rows.length === 0 || startRowId === null) {
		return grid.map((cells) => {
			const row = createEmptyRow();
			cells.forEach((value, colOffset) => {
				const field = PASTEABLE_COLUMNS[startColIndex + colOffset];
				if (field) row[field] = value.trim();
			});
			return normalizeEquipmentRow(row);
		});
	}

	const result = rows.map((row) => normalizeEquipmentRow({ ...row }));
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
		result[targetIndex] = normalizeEquipmentRow(row);
	}

	return result;
}

export function getSortIcon(
	field: EquipmentColumnKey,
	currentField: EquipmentColumnKey | '',
	direction: 'asc' | 'desc'
): string {
	if (currentField !== field) return '↕';
	return direction === 'asc' ? '↑' : '↓';
}

export function sortRows(
	rows: EquipmentTableRow[],
	field: EquipmentColumnKey,
	direction: 'asc' | 'desc'
): EquipmentTableRow[] {
	return [...rows].sort((a, b) => {
		const valueA = a[field];
		const valueB = b[field];

		if (typeof valueA === 'boolean' && typeof valueB === 'boolean') {
			const numA = valueA ? 1 : 0;
			const numB = valueB ? 1 : 0;
			return direction === 'asc' ? numA - numB : numB - numA;
		}

		if (typeof valueA === 'number' && typeof valueB === 'number') {
			return direction === 'asc' ? valueA - valueB : valueB - valueA;
		}

		const strA = String(valueA).toLowerCase();
		const strB = String(valueB).toLowerCase();
		return direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
	});
}
