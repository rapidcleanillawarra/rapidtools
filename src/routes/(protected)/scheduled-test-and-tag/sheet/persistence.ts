import { getLocationIdByName, loadLocationNameMap } from '../services/companies';
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
import {
	defaultSheetName,
	formatParts,
	frequencyToMonths,
	normalizeServiceValue,
	occurrenceToFrequency,
	parseParts
} from './utils';

export function equipmentToSheetRow(
	equipment: EquipmentRow,
	line?: SheetLineRow,
	locationName = ''
): SheetRow {
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
		location: locationName,
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
): Promise<{ header: Partial<SheetHeader>; rows: SheetRow[] }> {
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

	const rows = equipments
		.filter((equipment) => equipment.active !== false)
		.map((equipment) => {
			const placement = placementByRciTag.get(equipment.rci_tag);
			const locationName = placement
				? (locationNameMap.get(placement.location_id) ?? '')
				: '';
			return equipmentToSheetRow(
				equipment,
				linesByEquipmentId.get(equipment.id),
				locationName
			);
		});

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

		if (row.location) {
			const locationId = await getLocationIdByName(header.companyId, row.location);
			if (locationId) {
				await upsertPlacement(header.companyId, rciTag, locationId);
			}
		}

		equipmentIds.push({ equipmentId: equipment.id, row, sortOrder: index });
	}

	const activeEquipmentIds = equipmentIds.filter(({ row }) => row.active !== false);

	return saveSheet(
		{
			company_id: header.companyId,
			name: header.sheetName.trim() || defaultSheetName(),
			service_date: header.serviceDate,
			created_by_uid: userUid,
			created_by_email: userEmail,
			lines: activeEquipmentIds.map(({ equipmentId, row }, index) => ({
				equipment_id: equipmentId,
				sort_order: index,
				result: row.results,
				workshop_id: row.workshopId,
				service: normalizeServiceValue(row.service),
				parts: parseParts(row.parts),
				notes: row.notes
			}))
		},
		header.sheetId
	);
}
