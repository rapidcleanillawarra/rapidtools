import { loadLocationNameMap, loadLocationNameToIdMap } from '../services/companies';
import { getNextRciTag } from '../rciTags';
import {
	bulkDeleteEquipments,
	bulkUpsertEquipments,
	bulkUpsertPlacements,
	loadAllRciTags,
	loadEquipmentsByCompany,
	loadPlacementsByCompany,
	type EquipmentInput
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

type ResolvedRow = {
	row: EquipmentTableRow;
	rciTag: string;
	index: number;
};

function buildEquipmentInput(
	row: EquipmentTableRow,
	index: number,
	rciTag: string,
	company: Schedule
): EquipmentInput {
	return {
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
	};
}

function resolveRciTags(rows: EquipmentTableRow[], occupiedRciTags: Set<string>): ResolvedRow[] {
	const resolved: ResolvedRow[] = [];

	for (let index = 0; index < rows.length; index++) {
		const row = rows[index];
		let rciTag = row.rciTag.trim();

		if (!rciTag) {
			rciTag = getNextRciTag(occupiedRciTags);
		}

		occupiedRciTags.add(rciTag);
		resolved.push({ row, rciTag, index });
	}

	return resolved;
}

export async function persistEquipments(
	company: Schedule,
	rows: EquipmentTableRow[],
	original?: EquipmentTableRow[] | null
): Promise<void> {
	const needsGlobalTags = rows.some((row) => !row.rciTag.trim());
	const occupiedRciTags = new Set(
		needsGlobalTags
			? await loadAllRciTags()
			: rows.map((row) => row.rciTag.trim()).filter(Boolean)
	);

	const resolvedRows = resolveRciTags(rows, occupiedRciTags);
	const currentRciTags = new Set(resolvedRows.map(({ rciTag }) => rciTag));

	const originalById = new Map<string, { row: EquipmentTableRow; index: number }>();
	original?.forEach((row, index) => originalById.set(row.id, { row, index }));

	const equipmentsToUpsert: EquipmentInput[] = [];
	const placementsToUpsert: { rci_tag: string; row: EquipmentTableRow }[] = [];

	for (const { row, rciTag, index } of resolvedRows) {
		const input = buildEquipmentInput(row, index, rciTag, company);
		const snapshot = originalById.get(row.id);

		const equipmentUnchanged =
			snapshot &&
			JSON.stringify(input) ===
				JSON.stringify(
					buildEquipmentInput(
						snapshot.row,
						snapshot.index,
						snapshot.row.rciTag.trim(),
						company
					)
				);

		if (!equipmentUnchanged) {
			equipmentsToUpsert.push(input);
		}

		const locationChanged = !snapshot || snapshot.row.location !== row.location;
		if (row.location && locationChanged) {
			placementsToUpsert.push({ rci_tag: rciTag, row });
		}
	}

	let rciTagsToDelete: string[];
	if (original) {
		rciTagsToDelete = original
			.map((row) => row.rciTag.trim())
			.filter((rciTag) => rciTag && !currentRciTags.has(rciTag));
	} else {
		const existing = await loadEquipmentsByCompany(company.id);
		rciTagsToDelete = existing
			.map((equipment) => equipment.rci_tag)
			.filter((rciTag) => !currentRciTags.has(rciTag));
	}

	const upsertEquipmentsTask = async () => {
		if (equipmentsToUpsert.length === 0) return;
		await bulkUpsertEquipments(company.id, equipmentsToUpsert);
	};

	const upsertPlacementsTask = async () => {
		if (placementsToUpsert.length === 0) return;
		const nameToId = await loadLocationNameToIdMap(company.id);
		const placements = placementsToUpsert
			.map(({ rci_tag, row }) => {
				const locationId = nameToId.get(row.location);
				return locationId ? { rci_tag, location_id: locationId } : null;
			})
			.filter((placement): placement is { rci_tag: string; location_id: string } =>
				placement !== null
			);
		await bulkUpsertPlacements(company.id, placements);
	};

	const deleteEquipmentsTask = async () => {
		await bulkDeleteEquipments(company.id, rciTagsToDelete);
	};

	await Promise.all([upsertEquipmentsTask(), upsertPlacementsTask(), deleteEquipmentsTask()]);
}
