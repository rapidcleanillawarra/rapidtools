import { supabase } from '$lib/supabase';
import type { SheetLineRow, SheetRow, SheetRowPartRow } from './types';

const SHEETS_TABLE = 'machine_inspection_sheets';
const SHEET_ROWS_TABLE = 'machine_inspection_sheet_rows';
const SHEET_ROW_PARTS_TABLE = 'machine_inspection_sheet_row_parts';

export type SheetLinePartInput = {
	sku: string;
	name: string;
};

export type SheetLineInput = {
	equipment_id: string;
	sort_order: number;
	result: string;
	workshop_id: string;
	service: string;
	parts: SheetLinePartInput[];
	notes: string;
};

export type SaveSheetInput = {
	company_id: string;
	name: string;
	service_date: string;
	created_by_uid?: string;
	created_by_email?: string;
	lines: SheetLineInput[];
};

const SHEET_LINE_SELECT = `
	*,
	machine_inspection_sheet_row_parts (
		id,
		sheet_row_id,
		sort_order,
		sku,
		name,
		created_at,
		updated_at
	)
`;

function sortSheetRowParts(parts: SheetRowPartRow[] | undefined): SheetRowPartRow[] {
	return [...(parts ?? [])].sort((a, b) => a.sort_order - b.sort_order);
}

export async function getSheetById(sheetId: string): Promise<{
	sheet: SheetRow;
	lines: SheetLineRow[];
} | null> {
	const { data: sheet, error: sheetError } = await supabase
		.from(SHEETS_TABLE)
		.select('*')
		.eq('id', sheetId)
		.maybeSingle();

	if (sheetError) {
		throw new Error(`Failed to load sheet: ${sheetError.message}`);
	}

	if (!sheet) return null;

	const { data: lines, error: linesError } = await supabase
		.from(SHEET_ROWS_TABLE)
		.select(SHEET_LINE_SELECT)
		.eq('sheet_id', sheetId)
		.order('sort_order', { ascending: true })
		.order('sort_order', { ascending: true, foreignTable: 'machine_inspection_sheet_row_parts' });

	if (linesError) {
		throw new Error(`Failed to load sheet rows: ${linesError.message}`);
	}

	return {
		sheet: sheet as SheetRow,
		lines: ((lines ?? []) as SheetLineRow[]).map((line) => ({
			...line,
			machine_inspection_sheet_row_parts: sortSheetRowParts(
				line.machine_inspection_sheet_row_parts
			)
		}))
	};
}

export async function saveSheet(input: SaveSheetInput, existingSheetId?: string): Promise<string> {
	let sheetId = existingSheetId;

	if (sheetId) {
		const { error: updateError } = await supabase
			.from(SHEETS_TABLE)
			.update({
				company_id: input.company_id,
				name: input.name,
				service_date: input.service_date,
				created_by_uid: input.created_by_uid ?? null,
				created_by_email: input.created_by_email ?? null
			})
			.eq('id', sheetId);

		if (updateError) {
			throw new Error(`Failed to update sheet: ${updateError.message}`);
		}

		const { error: deleteError } = await supabase
			.from(SHEET_ROWS_TABLE)
			.delete()
			.eq('sheet_id', sheetId);

		if (deleteError) {
			throw new Error(`Failed to clear sheet rows: ${deleteError.message}`);
		}
	} else {
		const { data, error } = await supabase
			.from(SHEETS_TABLE)
			.insert({
				company_id: input.company_id,
				name: input.name,
				service_date: input.service_date,
				created_by_uid: input.created_by_uid ?? null,
				created_by_email: input.created_by_email ?? null
			})
			.select('id')
			.single();

		if (error || !data) {
			throw new Error(`Failed to create sheet: ${error?.message ?? 'Unknown error'}`);
		}

		sheetId = data.id;
	}

	if (input.lines.length > 0) {
		const { data: insertedRows, error: linesError } = await supabase
			.from(SHEET_ROWS_TABLE)
			.insert(
				input.lines.map((line) => ({
					sheet_id: sheetId,
					equipment_id: line.equipment_id,
					sort_order: line.sort_order,
					result: line.result,
					workshop_id: line.workshop_id,
					service: line.service,
					notes: line.notes
				}))
			)
			.select('id, equipment_id');

		if (linesError) {
			throw new Error(`Failed to save sheet rows: ${linesError.message}`);
		}

		const partRows = (insertedRows ?? []).flatMap((row) => {
			const line = input.lines.find((entry) => entry.equipment_id === row.equipment_id);
			if (!line) return [];

			return line.parts
				.map((part, index) => ({
					sheet_row_id: row.id,
					sort_order: index,
					sku: part.sku.trim(),
					name: part.name.trim()
				}))
				.filter((part) => part.sku || part.name);
		});

		if (partRows.length > 0) {
			const { error: partsError } = await supabase.from(SHEET_ROW_PARTS_TABLE).insert(partRows);

			if (partsError) {
				throw new Error(`Failed to save sheet row parts: ${partsError.message}`);
			}
		}
	}

	return sheetId!;
}
