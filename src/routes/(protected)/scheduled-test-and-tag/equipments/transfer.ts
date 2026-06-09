import { getLocationIdByName, loadLocationNameMap } from '../services/companies';
import {
	deleteEquipment,
	loadEquipmentsByCompany,
	loadPlacementsByCompany,
	upsertEquipment,
	upsertPlacement
} from '../services/equipments';
import type { Schedule } from '../stores';
import type { EquipmentTableRow } from './types';

export type TransferEquipmentsResult = {
	transferred: number;
	placementWarnings: number;
};

export async function transferEquipmentsToCompany(
	sourceCompany: Schedule,
	targetCompany: Schedule,
	rows: EquipmentTableRow[]
): Promise<TransferEquipmentsResult> {
	if (sourceCompany.id === targetCompany.id) {
		throw new Error('Select a different company to transfer to.');
	}

	if (rows.length === 0) {
		throw new Error('No equipment selected to transfer.');
	}

	const [sourceEquipments, placements, sourceLocationMap] = await Promise.all([
		loadEquipmentsByCompany(sourceCompany.id),
		loadPlacementsByCompany(sourceCompany.id),
		loadLocationNameMap(sourceCompany.id)
	]);

	const sourceById = new Map(sourceEquipments.map((equipment) => [equipment.id, equipment]));
	const sourceByRciTag = new Map(sourceEquipments.map((equipment) => [equipment.rci_tag, equipment]));
	const placementByRciTag = new Map(placements.map((placement) => [placement.rci_tag, placement]));

	const targetEquipments = await loadEquipmentsByCompany(targetCompany.id);
	let sortOrder = targetEquipments.length;
	let placementWarnings = 0;

	for (const row of rows) {
		const rciTag = row.rciTag.trim() || row.id;
		const sourceEquipment = sourceById.get(row.id) ?? sourceByRciTag.get(rciTag);

		await upsertEquipment(targetCompany.id, {
			rci_tag: rciTag,
			start_month: row.startMonth || targetCompany.start_month,
			frequency: row.frequency || targetCompany.occurence,
			sort_order: sortOrder++,
			customer_tag: row.tag,
			equipment_name: row.name,
			equipment_type: row.typeOfMachine,
			serial_number: row.serialNumber,
			sku: row.sku,
			size: row.size,
			active: row.active !== false
		});

		const placement = placementByRciTag.get(rciTag);
		if (placement) {
			const locationName = sourceLocationMap.get(placement.location_id);
			if (locationName) {
				const targetLocationId = await getLocationIdByName(targetCompany.id, locationName);
				if (targetLocationId) {
					await upsertPlacement(targetCompany.id, rciTag, targetLocationId);
				} else {
					placementWarnings++;
				}
			}
		}

		if (sourceEquipment) {
			await deleteEquipment(sourceCompany.id, sourceEquipment.rci_tag);
		}
	}

	return { transferred: rows.length, placementWarnings };
}
