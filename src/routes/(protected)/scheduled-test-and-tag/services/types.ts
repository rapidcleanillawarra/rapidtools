import type { Contact, LocationInfo, Note, Schedule } from '../stores';

export type { Schedule, Contact, LocationInfo, Note };

export type ScheduleRow = {
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
	schedule_id: string;
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
	schedule_id: string;
	title: string;
	content: string;
	sort_order: number;
	created_at: string;
	updated_at: string;
};

export type LocationWithContacts = LocationRow & {
	machine_inspection_contacts: ContactRow[];
};

export type ScheduleWithRelations = ScheduleRow & {
	machine_inspection_locations: LocationWithContacts[];
	machine_inspection_notes: NoteRow[];
};

export type MachineInspectionEventRow = {
	id: string;
	schedule_id: string;
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

export function mapScheduleRow(row: ScheduleWithRelations): Schedule {
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
