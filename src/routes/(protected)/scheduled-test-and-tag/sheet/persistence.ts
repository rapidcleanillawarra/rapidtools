import { getLocationIdByName } from '../services/companies';
import {
	loadEquipmentsByCompany,
	loadPlacementsByCompany,
	upsertEquipment,
	upsertPlacement
} from '../services/equipments';
import { getSheetById, saveSheet } from '../services/sheets';
import type { EquipmentPlacementRow, EquipmentRow, SheetLineRow } from '../services/types';
import type { Schedule } from '../stores';
import type { SheetHeader, SheetRow } from './types';
import { frequencyToMonths, occurrenceToFrequency } from './utils';

export function equipmentToSheetRow(equipment: EquipmentRow, line?: SheetLineRow): SheetRow {
	return {
		id: equipment.id,
		rciTag: equipment.rci_tag,
		tag: equipment.customer_tag,
		machines: equipment.equipment_name,
		typeOfMachine: equipment.equipment_type,
		serialNumber: equipment.serial_number,
		sku: equipment.sku,
		size: equipment.size,
		active: equipment.active,
		results: line?.result ?? '',
		workshopId: line?.workshop_id ?? '',
		service: line?.service ?? '',
		parts: line?.parts ?? '',
		notes: line?.notes ?? ''
	};
}

export async function filterEquipmentsByLocation(
	equipments: EquipmentRow[],
	placements: EquipmentPlacementRow[],
	companyId: string,
	locationName: string
): Promise<EquipmentRow[]> {
	if (!locationName) return equipments;

	const locationId = await getLocationIdByName(companyId, locationName);
	if (!locationId) return equipments;

	const placementTags = new Set(
		placements.filter((placement) => placement.location_id === locationId).map((p) => p.rci_tag)
	);

	if (placementTags.size === 0) return [];
	return equipments.filter((equipment) => placementTags.has(equipment.rci_tag));
}

export async function loadSheetRowsForCompany(
	company: Schedule,
	locationFilter: string,
	sheetId?: string
): Promise<{ header: Partial<SheetHeader>; rows: SheetRow[] }> {
	const [equipments, placements] = await Promise.all([
		loadEquipmentsByCompany(company.id),
		loadPlacementsByCompany(company.id)
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
				serviceDate: sheetData.sheet.service_date
			};
			linesByEquipmentId = new Map(
				sheetData.lines.map((line) => [line.equipment_id, line])
			);
		}
	}

	const filtered = locationFilter
		? await filterEquipmentsByLocation(equipments, placements, company.id, locationFilter)
		: equipments;

	const rows = filtered.map((equipment) =>
		equipmentToSheetRow(equipment, linesByEquipmentId.get(equipment.id))
	);

	return { header: sheetHeader, rows };
}

export type SaveSheetContext = {
	header: SheetHeader;
	rows: SheetRow[];
	company: Schedule;
	userUid?: string;
	userEmail?: string;
};

export async function persistSheet(context: SaveSheetContext): Promise<string> {
	const { header, rows, company, userUid, userEmail } = context;

	if (!header.companyId) {
		throw new Error('Company is required before saving.');
	}

	const defaultFrequency = company.occurence;
	const defaultStartMonth = company.start_month;
	const equipmentIds: { equipmentId: string; row: SheetRow; sortOrder: number }[] = [];

	for (let index = 0; index < rows.length; index++) {
		const row = rows[index];
		const rciTag = row.rciTag?.trim() || row.id;
		const frequency = frequencyToMonths(header.frequency) ?? defaultFrequency;

		const equipment = await upsertEquipment(header.companyId, {
			rci_tag: rciTag,
			start_month: defaultStartMonth,
			frequency,
			sort_order: index,
			customer_tag: row.tag,
			equipment_name: row.machines,
			equipment_type: row.typeOfMachine,
			serial_number: row.serialNumber,
			sku: row.sku,
			size: row.size,
			active: row.active !== false
		});

		if (header.location) {
			const locationId = await getLocationIdByName(header.companyId, header.location);
			if (locationId) {
				await upsertPlacement(header.companyId, rciTag, locationId);
			}
		}

		equipmentIds.push({ equipmentId: equipment.id, row, sortOrder: index });
	}

	return saveSheet(
		{
			company_id: header.companyId,
			service_date: header.serviceDate,
			created_by_uid: userUid,
			created_by_email: userEmail,
			lines: equipmentIds.map(({ equipmentId, row, sortOrder }) => ({
				equipment_id: equipmentId,
				sort_order: sortOrder,
				result: row.results,
				workshop_id: row.workshopId,
				service: row.service,
				parts: row.parts,
				notes: row.notes
			}))
		},
		header.sheetId
	);
}
