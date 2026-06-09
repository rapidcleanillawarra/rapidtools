import { getLocationIdByName, loadLocationNameMap } from '../services/companies';
import { getNextRciTag } from '../rciTags';
import {
	deleteEquipment,
	loadAllRciTags,
	loadEquipmentsByCompany,
	loadPlacementsByCompany,
	upsertEquipment,
	upsertPlacement
} from '../services/equipments';
import type { EquipmentRow } from '../services/types';
import type { Schedule } from '../stores';
import type { EquipmentTableRow } from './types';

export function dbRowToTableRow(row: EquipmentRow): EquipmentTableRow {
	return {
		id: row.id,
		rciTag: row.rci_tag,
		tag: row.customer_tag,
		name: row.equipment_name,
		typeOfMachine: row.equipment_type,
		serialNumber: row.serial_number,
		sku: row.sku,
		size: row.size,
		active: row.active,
		startMonth: row.start_month,
		frequency: row.frequency
	};
}

export async function loadEquipmentsForCompany(company: Schedule): Promise<EquipmentTableRow[]> {
	const [equipments, placements, locationNameMap] = await Promise.all([
		loadEquipmentsByCompany(company.id),
		loadPlacementsByCompany(company.id),
		loadLocationNameMap(company.id)
	]);

	const placementByRciTag = new Map(
		placements.map((placement) => [placement.rci_tag, placement])
	);

	return equipments.map((equipment) => {
		const placement = placementByRciTag.get(equipment.rci_tag);
		const location = placement
			? (locationNameMap.get(placement.location_id) ?? '')
			: '';

		return { ...dbRowToTableRow(equipment), location };
	});
}

export async function persistEquipments(
	company: Schedule,
	rows: EquipmentTableRow[]
): Promise<void> {
	const [existing, globalRciTags] = await Promise.all([
		loadEquipmentsByCompany(company.id),
		loadAllRciTags()
	]);
	const occupiedRciTags = new Set(globalRciTags);
	const currentRciTags = new Set<string>();

	for (let index = 0; index < rows.length; index++) {
		const row = rows[index];
		let rciTag = row.rciTag.trim();

		if (!rciTag) {
			rciTag = getNextRciTag(occupiedRciTags);
		}

		occupiedRciTags.add(rciTag);
		currentRciTags.add(rciTag);

		await upsertEquipment(company.id, {
			rci_tag: rciTag,
			start_month: row.startMonth || company.start_month,
			frequency: row.frequency || company.occurence,
			sort_order: index,
			customer_tag: row.tag,
			equipment_name: row.name,
			equipment_type: row.typeOfMachine,
			serial_number: row.serialNumber,
			sku: row.sku,
			size: row.size,
			active: row.active !== false
		});

		if (row.location) {
			const locationId = await getLocationIdByName(company.id, row.location);
			if (locationId) {
				await upsertPlacement(company.id, rciTag, locationId);
			}
		}
	}

	for (const equipment of existing) {
		if (!currentRciTags.has(equipment.rci_tag)) {
			await deleteEquipment(company.id, equipment.rci_tag);
		}
	}
}
