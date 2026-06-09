import { supabase } from '$lib/supabase';
import type { EquipmentPlacementRow, EquipmentRow } from './types';

const EQUIPMENTS_TABLE = 'machine_inspection_equipments';
const PLACEMENTS_TABLE = 'machine_inspection_equipment_placements';

export type EquipmentInput = {
	rci_tag: string;
	start_month: number;
	frequency: number;
	sort_order: number;
	customer_tag: string;
	equipment_name: string;
	equipment_type: string;
	serial_number: string;
	sku: string;
	size: string;
	active: boolean;
};

export async function loadAllRciTags(): Promise<string[]> {
	const { data, error } = await supabase.from(EQUIPMENTS_TABLE).select('rci_tag');

	if (error) {
		throw new Error(`Failed to load RCI tags: ${error.message}`);
	}

	return (data ?? []).map((row) => row.rci_tag);
}

export async function loadEquipmentsByCompany(companyId: string): Promise<EquipmentRow[]> {
	const { data, error } = await supabase
		.from(EQUIPMENTS_TABLE)
		.select('*')
		.eq('company_id', companyId)
		.order('sort_order', { ascending: true });

	if (error) {
		throw new Error(`Failed to load equipments: ${error.message}`);
	}

	return (data ?? []) as EquipmentRow[];
}

export async function loadPlacementsByCompany(
	companyId: string
): Promise<EquipmentPlacementRow[]> {
	const { data, error } = await supabase
		.from(PLACEMENTS_TABLE)
		.select('*')
		.eq('company_id', companyId);

	if (error) {
		throw new Error(`Failed to load equipment placements: ${error.message}`);
	}

	return (data ?? []) as EquipmentPlacementRow[];
}

export async function upsertEquipment(
	companyId: string,
	input: EquipmentInput
): Promise<EquipmentRow> {
	const { data, error } = await supabase
		.from(EQUIPMENTS_TABLE)
		.upsert(
			{
				company_id: companyId,
				rci_tag: input.rci_tag,
				start_month: input.start_month,
				frequency: input.frequency,
				sort_order: input.sort_order,
				customer_tag: input.customer_tag,
				equipment_name: input.equipment_name,
				equipment_type: input.equipment_type,
				serial_number: input.serial_number,
				sku: input.sku,
				size: input.size,
				active: input.active
			},
			{ onConflict: 'company_id,rci_tag' }
		)
		.select('*')
		.single();

	if (error || !data) {
		throw new Error(`Failed to save equipment: ${error?.message ?? 'Unknown error'}`);
	}

	return data as EquipmentRow;
}

export async function bulkUpsertEquipments(
	companyId: string,
	inputs: EquipmentInput[]
): Promise<EquipmentRow[]> {
	if (inputs.length === 0) return [];

	const { data, error } = await supabase
		.from(EQUIPMENTS_TABLE)
		.upsert(
			inputs.map((input) => ({
				company_id: companyId,
				rci_tag: input.rci_tag,
				start_month: input.start_month,
				frequency: input.frequency,
				sort_order: input.sort_order,
				customer_tag: input.customer_tag,
				equipment_name: input.equipment_name,
				equipment_type: input.equipment_type,
				serial_number: input.serial_number,
				sku: input.sku,
				size: input.size,
				active: input.active
			})),
			{ onConflict: 'company_id,rci_tag' }
		)
		.select('*');

	if (error) {
		throw new Error(`Failed to save equipments: ${error.message}`);
	}

	return (data ?? []) as EquipmentRow[];
}

export async function bulkUpsertPlacements(
	companyId: string,
	placements: { rci_tag: string; location_id: string }[]
): Promise<void> {
	if (placements.length === 0) return;

	const { error } = await supabase.from(PLACEMENTS_TABLE).upsert(
		placements.map((placement) => ({
			company_id: companyId,
			rci_tag: placement.rci_tag,
			location_id: placement.location_id
		})),
		{ onConflict: 'company_id,rci_tag' }
	);

	if (error) {
		throw new Error(`Failed to save equipment placements: ${error.message}`);
	}
}

export async function upsertPlacement(
	companyId: string,
	rciTag: string,
	locationId: string
): Promise<void> {
	const { error } = await supabase.from(PLACEMENTS_TABLE).upsert(
		{
			company_id: companyId,
			rci_tag: rciTag,
			location_id: locationId
		},
		{ onConflict: 'company_id,rci_tag' }
	);

	if (error) {
		throw new Error(`Failed to save equipment placement: ${error.message}`);
	}
}

export async function deleteEquipment(companyId: string, rciTag: string): Promise<void> {
	const { error: placementError } = await supabase
		.from(PLACEMENTS_TABLE)
		.delete()
		.eq('company_id', companyId)
		.eq('rci_tag', rciTag);

	if (placementError) {
		throw new Error(`Failed to delete equipment placement: ${placementError.message}`);
	}

	const { error } = await supabase
		.from(EQUIPMENTS_TABLE)
		.delete()
		.eq('company_id', companyId)
		.eq('rci_tag', rciTag);

	if (error) {
		throw new Error(`Failed to delete equipment: ${error.message}`);
	}
}
