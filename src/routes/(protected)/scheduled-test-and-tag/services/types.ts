import type { Contact, LocationInfo, Note, Schedule } from '../stores';

export type { Schedule, Contact, LocationInfo, Note };

/** @deprecated Use CompanyRow */
export type ScheduleRow = CompanyRow;

export type CompanyRow = {
	id: string;
	company: string;
	start_month: number;
	occurence: number;
	color: string;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
	legacy_firestore_id: string | null;
};

export type LocationRow = {
	id: string;
	company_id: string;
	information_id: string;
	sub_company_name: string;
	location: string;
	sort_order: number;
	created_at: string;
	updated_at: string;
};

export type ContactRow = {
	id: string;
	location_id: string;
	name: string;
	phone: string;
	email: string;
	sort_order: number;
	created_at: string;
	updated_at: string;
};

export type NoteRow = {
	id: string;
	company_id: string;
	title: string;
	content: string;
	sort_order: number;
	created_at: string;
	updated_at: string;
};

export type LocationWithContacts = LocationRow & {
	machine_inspection_contacts: ContactRow[];
};

/** @deprecated Use CompanyWithRelations */
export type ScheduleWithRelations = CompanyWithRelations;

export type CompanyWithRelations = CompanyRow & {
	machine_inspection_locations: LocationWithContacts[];
	machine_inspection_notes: NoteRow[];
};

export type MachineInspectionEventRow = {
	id: string;
	company_id: string;
	information_id: string;
	company: string;
	sub_company_name: string;
	location: string;
	start_date: string;
	end_date: string;
	title: string;
	background_color: string;
	created_by_uid: string | null;
	created_by_email: string | null;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
	legacy_firestore_id: string | null;
};

export type EquipmentRow = {
	id: string;
	company_id: string;
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
	created_at: string;
	updated_at: string;
};

export type EquipmentPlacementRow = {
	id: string;
	company_id: string;
	rci_tag: string;
	location_id: string;
	created_at: string;
	updated_at: string;
};

export type SheetRow = {
	id: string;
	company_id: string;
	service_date: string;
	created_by_uid: string | null;
	created_by_email: string | null;
	created_at: string;
	updated_at: string;
};

export type SheetRowPartRow = {
	id: string;
	sheet_row_id: string;
	sort_order: number;
	sku: string;
	name: string;
	created_at: string;
	updated_at: string;
};

export type SheetLineRow = {
	id: string;
	sheet_id: string;
	equipment_id: string;
	sort_order: number;
	result: string;
	workshop_id: string;
	service: string;
	notes: string;
	created_at: string;
	updated_at: string;
	machine_inspection_sheet_row_parts?: SheetRowPartRow[];
};

export type EquipmentWithPlacement = EquipmentRow & {
	machine_inspection_equipment_placements: EquipmentPlacementRow[];
};

/** @deprecated Use mapCompanyRow */
export const mapScheduleRow = mapCompanyRow;

export function mapCompanyRow(row: CompanyWithRelations): Schedule {
	const locations = [...(row.machine_inspection_locations ?? [])].sort(
		(a, b) => a.sort_order - b.sort_order
	);
	const notes = [...(row.machine_inspection_notes ?? [])].sort((a, b) => a.sort_order - b.sort_order);

	return {
		id: row.id,
		company: row.company,
		start_month: row.start_month,
		occurence: row.occurence,
		color: row.color,
		information: locations.map((location) => ({
			information_id: location.information_id,
			sub_company_name: location.sub_company_name,
			location: location.location,
			contacts: [...(location.machine_inspection_contacts ?? [])]
				.sort((a, b) => a.sort_order - b.sort_order)
				.map((contact) => ({
					name: contact.name,
					phone: contact.phone,
					email: contact.email
				}))
		})),
		notes: notes.map((note) => ({
			title: note.title,
			content: note.content
		})),
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		deletedAt: row.deleted_at ?? undefined,
		isDeleted: row.deleted_at != null
	};
}
