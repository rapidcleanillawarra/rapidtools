import {
	deleteEquipment,
	loadEquipmentsByCompany,
	upsertEquipment
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
	const equipments = await loadEquipmentsByCompany(company.id);
	return equipments.map(dbRowToTableRow);
}

export async function persistEquipments(
	company: Schedule,
	rows: EquipmentTableRow[]
): Promise<void> {
	const existing = await loadEquipmentsByCompany(company.id);
	const currentRciTags = new Set(rows.map((row) => row.rciTag.trim() || row.id));

	for (let index = 0; index < rows.length; index++) {
		const row = rows[index];
		await upsertEquipment(company.id, {
			rci_tag: row.rciTag.trim() || row.id,
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
	}

	for (const equipment of existing) {
		if (!currentRciTags.has(equipment.rci_tag)) {
			await deleteEquipment(company.id, equipment.rci_tag);
		}
	}
}
