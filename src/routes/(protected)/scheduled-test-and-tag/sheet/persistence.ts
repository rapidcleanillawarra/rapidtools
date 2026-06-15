import { loadLocationNameMap, loadLocationNameToIdMap } from '../services/companies';
import {
	bulkUpsertEquipments,
	bulkUpsertPlacements,
	loadEquipmentsByCompany,
	loadPlacementsByCompany,
	type EquipmentInput
} from '../services/equipments';
import { getSheetById, saveSheet } from '../services/sheets';
import type {
	EquipmentPlacementRow,
	EquipmentRow,
	SheetEquipmentInfo,
	SheetLineRow
} from '../services/types';
import type { Schedule } from '../stores';
import type { SheetHeader, SheetRow } from './types';
import {
	defaultSheetName,
	formatParts,
	frequencyToMonths,
	normalizeServiceValue,
	occurrenceToFrequency,
	parseParts
} from './utils';

export function sheetRowToEquipmentInfo(row: SheetRow): SheetEquipmentInfo {
	return {
		tag: row.tag,
		machines: row.machines,
		typeOfMachine: row.typeOfMachine,
		serialNumber: row.serialNumber,
		sku: row.sku,
		size: row.size,
		location: row.location
	};
}

function equipmentInfoFromLine(
	line: SheetLineRow | undefined,
	equipment: EquipmentRow,
	locationName: string
): Pick<SheetRow, 'tag' | 'machines' | 'typeOfMachine' | 'serialNumber' | 'sku' | 'size' | 'location'> {
	const info = line?.equipment_info;
	if (!info || Object.keys(info).length === 0) {
		return {
			tag: equipment.customer_tag,
			machines: equipment.equipment_name,
			typeOfMachine: equipment.equipment_type,
			serialNumber: equipment.serial_number,
			sku: equipment.sku,
			size: equipment.size,
			location: locationName
		};
	}

	return {
		tag: info.tag ?? equipment.customer_tag,
		machines: info.machines ?? equipment.equipment_name,
		typeOfMachine: info.typeOfMachine ?? equipment.equipment_type,
		serialNumber: info.serialNumber ?? equipment.serial_number,
		sku: info.sku ?? equipment.sku,
		size: info.size ?? equipment.size,
		location: info.location ?? locationName
	};
}

export function equipmentToSheetRow(
	equipment: EquipmentRow,
	line?: SheetLineRow,
	locationName = ''
): SheetRow {
	const equipmentInfo = equipmentInfoFromLine(line, equipment, locationName);

	return {
		id: equipment.id,
		rciTag: equipment.rci_tag,
		...equipmentInfo,
		active: equipment.active,
		results: line?.result ?? '',
		workshopId: line?.workshop_id ?? '',
		service: normalizeServiceValue(line?.service ?? ''),
		parts: line?.machine_inspection_sheet_row_parts?.length
			? formatParts(
					line.machine_inspection_sheet_row_parts.map(({ sku, name }) => ({ sku, name }))
				)
			: '',
		notes: line?.notes ?? ''
	};
}

export async function loadSheetRowsForCompany(
	company: Schedule,
	sheetId?: string
): Promise<{ header: Partial<SheetHeader>; rows: SheetRow[]; inactiveRows: SheetRow[] }> {
	const [equipments, placements, locationNameMap] = await Promise.all([
		loadEquipmentsByCompany(company.id),
		loadPlacementsByCompany(company.id),
		loadLocationNameMap(company.id)
	]);

	let linesByEquipmentId = new Map<string, SheetLineRow>();
	let sheetHeader: Partial<SheetHeader> = {
		companyId: company.id,
		company: company.company,
		frequency: occurrenceToFrequency(company.occurence)
	};

	if (sheetId) {
		const sheetData = await getSheetById(sheetId);
		if (sheetData) {
			sheetHeader = {
				...sheetHeader,
				sheetId: sheetData.sheet.id,
				sheetName: sheetData.sheet.name || defaultSheetName(),
				serviceDate: sheetData.sheet.service_date
			};
			linesByEquipmentId = new Map(
				sheetData.lines.map((line) => [line.equipment_id, line])
			);
		}
	}

	const placementByRciTag = new Map<string, EquipmentPlacementRow>(
		placements.map((placement) => [placement.rci_tag, placement])
	);

	const rows: SheetRow[] = [];
	const inactiveRows: SheetRow[] = [];
	const equipmentById = new Map(equipments.map((equipment) => [equipment.id, equipment]));

	for (const equipment of equipments) {
		const placement = placementByRciTag.get(equipment.rci_tag);
		const locationName = placement ? (locationNameMap.get(placement.location_id) ?? '') : '';
		const savedLine = linesByEquipmentId.get(equipment.id);
		const row = equipmentToSheetRow(equipment, savedLine, locationName);
		const onSavedSheet = linesByEquipmentId.has(equipment.id);

		if (equipment.active !== false || onSavedSheet) {
			rows.push(
				equipment.active === false ? { ...row, active: false, onSheet: true } : row
			);
		} else {
			inactiveRows.push({ ...row, active: false });
		}
	}

	// Ensure every saved line is on the table even if the equipment record was missed above.
	for (const [equipmentId, line] of linesByEquipmentId) {
		if (rows.some((row) => row.id === equipmentId)) continue;

		const equipment = equipmentById.get(equipmentId);
		if (!equipment) continue;

		const placement = placementByRciTag.get(equipment.rci_tag);
		const locationName = placement ? (locationNameMap.get(placement.location_id) ?? '') : '';
		const row = equipmentToSheetRow(equipment, line, locationName);

		rows.push(
			equipment.active === false ? { ...row, active: false, onSheet: true } : row
		);
	}

	const rowIds = new Set(rows.map((row) => row.id));
	const sidebarInactiveRows = inactiveRows.filter(
		(row) => !rowIds.has(row.id) && !linesByEquipmentId.has(row.id)
	);

	return { header: sheetHeader, rows, inactiveRows: sidebarInactiveRows };
}

export type SaveSheetContext = {
	header: SheetHeader;
	rows: SheetRow[];
	company: Schedule;
	userUid?: string;
	userEmail?: string;
	/** Snapshot of the rows/frequency as last loaded, used to skip unchanged writes. */
	original?: { rows: SheetRow[]; frequency: SheetHeader['frequency'] } | null;
};

function getRciTag(row: SheetRow): string {
	return row.rciTag?.trim() || row.id;
}

function buildEquipmentInput(
	row: SheetRow,
	index: number,
	frequency: number,
	startMonth: number
): EquipmentInput {
	return {
		rci_tag: getRciTag(row),
		start_month: startMonth,
		frequency,
		sort_order: index,
		customer_tag: row.tag,
		equipment_name: row.machines,
		equipment_type: row.typeOfMachine,
		serial_number: row.serialNumber,
		sku: row.sku,
		size: row.size,
		active: row.active !== false
	};
}

export async function persistSheet(context: SaveSheetContext): Promise<string> {
	const { header, rows, company, userUid, userEmail, original } = context;

	if (!header.companyId) {
		throw new Error('Company is required before saving.');
	}

	const companyId = header.companyId;
	const startMonth = company.start_month;
	const frequency = frequencyToMonths(header.frequency) ?? company.occurence;
	const originalFrequency = original
		? (frequencyToMonths(original.frequency) ?? company.occurence)
		: frequency;

	const originalById = new Map<string, { row: SheetRow; index: number }>();
	original?.rows.forEach((row, index) => originalById.set(row.id, { row, index }));

	// Resolve each row to its equipment id. Unchanged rows already carry their
	// equipment id as `row.id`, so only changed/new rows need to be upserted.
	const equipmentIdByRowId = new Map<string, string>();
	const equipmentsToUpsert: { row: SheetRow; input: EquipmentInput }[] = [];
	const placementsToUpsert: SheetRow[] = [];

	rows.forEach((row, index) => {
		const input = buildEquipmentInput(row, index, frequency, startMonth);
		const snapshot = originalById.get(row.id);

		const equipmentUnchanged =
			snapshot &&
			JSON.stringify(input) ===
				JSON.stringify(
					buildEquipmentInput(snapshot.row, snapshot.index, originalFrequency, startMonth)
				);

		if (equipmentUnchanged) {
			equipmentIdByRowId.set(row.id, row.id);
		} else {
			equipmentsToUpsert.push({ row, input });
		}

		const locationChanged = !snapshot || snapshot.row.location !== row.location;
		if (row.location && locationChanged) {
			placementsToUpsert.push(row);
		}
	});

	const upsertEquipmentsTask = async () => {
		if (equipmentsToUpsert.length === 0) return;
		const saved = await bulkUpsertEquipments(
			companyId,
			equipmentsToUpsert.map(({ input }) => input)
		);
		const idByRciTag = new Map(saved.map((equipment) => [equipment.rci_tag, equipment.id]));
		for (const { row } of equipmentsToUpsert) {
			const equipmentId = idByRciTag.get(getRciTag(row));
			if (equipmentId) {
				equipmentIdByRowId.set(row.id, equipmentId);
			}
		}
	};

	const upsertPlacementsTask = async () => {
		if (placementsToUpsert.length === 0) return;
		const nameToId = await loadLocationNameToIdMap(companyId);
		const placements = placementsToUpsert
			.map((row) => {
				const locationId = nameToId.get(row.location);
				return locationId ? { rci_tag: getRciTag(row), location_id: locationId } : null;
			})
			.filter((placement): placement is { rci_tag: string; location_id: string } =>
				placement !== null
			);
		await bulkUpsertPlacements(companyId, placements);
	};

	await Promise.all([upsertEquipmentsTask(), upsertPlacementsTask()]);

	return saveSheet(
		{
			company_id: companyId,
			name: header.sheetName.trim() || defaultSheetName(),
			service_date: header.serviceDate,
			created_by_uid: userUid,
			created_by_email: userEmail,
			lines: rows.map((row) => {
				const equipmentId = equipmentIdByRowId.get(row.id);
				if (!equipmentId) {
					throw new Error(`Failed to resolve equipment for row "${row.machines || row.id}".`);
				}
				return {
					equipment_id: equipmentId,
					equipment_info: sheetRowToEquipmentInfo(row),
					result: row.results,
					workshop_id: row.workshopId,
					service: normalizeServiceValue(row.service),
					parts: parseParts(row.parts),
					notes: row.notes
				};
			})
		},
		header.sheetId
	);
}
