import { supabase } from '$lib/supabase';
import { schedulesStore } from '../stores';
import type { Schedule, ScheduleFormData } from '../companies/types';
import { mapScheduleRow, type ScheduleWithRelations } from './types';

const SCHEDULES_TABLE = 'machine_inspection_schedules';
const LOCATIONS_TABLE = 'machine_inspection_locations';
const CONTACTS_TABLE = 'machine_inspection_contacts';
const NOTES_TABLE = 'machine_inspection_notes';
const EVENTS_TABLE = 'machine_inspection_events';

const SCHEDULE_SELECT = `
  *,
  machine_inspection_locations (
    *,
    machine_inspection_contacts (*)
  ),
  machine_inspection_notes (*)
`;

async function insertNestedScheduleData(
	scheduleId: string,
	scheduleData: ScheduleFormData
): Promise<void> {
	const information = scheduleData.information ?? [];
	for (let index = 0; index < information.length; index++) {
		const info = information[index];
		const informationId = info.information_id?.trim() || crypto.randomUUID();

		const { data: location, error: locationError } = await supabase
			.from(LOCATIONS_TABLE)
			.insert({
				schedule_id: scheduleId,
				information_id: informationId,
				sub_company_name: info.sub_company_name,
				location: info.location,
				sort_order: index
			})
			.select('id')
			.single();

		if (locationError) {
			throw new Error(`Failed to create location: ${locationError.message}`);
		}

		const contacts = info.contacts ?? [];
		if (contacts.length > 0) {
			const { error: contactsError } = await supabase.from(CONTACTS_TABLE).insert(
				contacts.map((contact, contactIndex) => ({
					location_id: location.id,
					name: contact.name ?? '',
					phone: contact.phone ?? '',
					email: contact.email ?? '',
					sort_order: contactIndex
				}))
			);

			if (contactsError) {
				throw new Error(`Failed to create contacts: ${contactsError.message}`);
			}
		}
	}

	const notes = scheduleData.notes ?? [];
	if (notes.length > 0) {
		const { error: notesError } = await supabase.from(NOTES_TABLE).insert(
			notes.map((note, noteIndex) => ({
				schedule_id: scheduleId,
				title: note.title ?? '',
				content: note.content ?? '',
				sort_order: noteIndex
			}))
		);

		if (notesError) {
			throw new Error(`Failed to create notes: ${notesError.message}`);
		}
	}
}

async function replaceNestedScheduleData(
	scheduleId: string,
	scheduleData: ScheduleFormData
): Promise<void> {
	const { error: deleteLocationsError } = await supabase
		.from(LOCATIONS_TABLE)
		.delete()
		.eq('schedule_id', scheduleId);

	if (deleteLocationsError) {
		throw new Error(`Failed to clear locations: ${deleteLocationsError.message}`);
	}

	const { error: deleteNotesError } = await supabase
		.from(NOTES_TABLE)
		.delete()
		.eq('schedule_id', scheduleId);

	if (deleteNotesError) {
		throw new Error(`Failed to clear notes: ${deleteNotesError.message}`);
	}

	await insertNestedScheduleData(scheduleId, scheduleData);
}

export async function loadSchedules(): Promise<void> {
	const { data, error } = await supabase
		.from(SCHEDULES_TABLE)
		.select(SCHEDULE_SELECT)
		.is('deleted_at', null)
		.order('created_at', { ascending: false });

	if (error) {
		console.error('Error loading machine inspection schedules:', error);
		throw new Error('Failed to load schedules from database.');
	}

	const schedules = (data as ScheduleWithRelations[]).map(mapScheduleRow);
	schedulesStore.set(schedules);
}

export async function createSchedule(scheduleData: ScheduleFormData): Promise<Schedule> {
	const { data, error } = await supabase
		.from(SCHEDULES_TABLE)
		.insert({
			company: scheduleData.company,
			start_month: scheduleData.start_month,
			occurence: scheduleData.occurence,
			color: scheduleData.color
		})
		.select('id')
		.single();

	if (error || !data) {
		console.error('Error creating schedule:', error);
		throw new Error(`Failed to create schedule: ${error?.message ?? 'Unknown error'}`);
	}

	try {
		await insertNestedScheduleData(data.id, scheduleData);
	} catch (nestedError) {
		await supabase.from(SCHEDULES_TABLE).delete().eq('id', data.id);
		throw nestedError;
	}

	const { data: fullSchedule, error: loadError } = await supabase
		.from(SCHEDULES_TABLE)
		.select(SCHEDULE_SELECT)
		.eq('id', data.id)
		.single();

	if (loadError || !fullSchedule) {
		throw new Error(`Failed to load created schedule: ${loadError?.message ?? 'Unknown error'}`);
	}

	const newSchedule = mapScheduleRow(fullSchedule as ScheduleWithRelations);
	schedulesStore.update((schedules) => [...schedules, newSchedule]);
	return newSchedule;
}

export async function updateSchedule(id: string, scheduleData: ScheduleFormData): Promise<Schedule> {
	const { error: updateError } = await supabase
		.from(SCHEDULES_TABLE)
		.update({
			company: scheduleData.company,
			start_month: scheduleData.start_month,
			occurence: scheduleData.occurence,
			color: scheduleData.color
		})
		.eq('id', id)
		.is('deleted_at', null);

	if (updateError) {
		console.error('Error updating schedule:', updateError);
		throw new Error(`Failed to update schedule: ${updateError.message}`);
	}

	await replaceNestedScheduleData(id, scheduleData);

	const { data: fullSchedule, error: loadError } = await supabase
		.from(SCHEDULES_TABLE)
		.select(SCHEDULE_SELECT)
		.eq('id', id)
		.single();

	if (loadError || !fullSchedule) {
		throw new Error(`Failed to load updated schedule: ${loadError?.message ?? 'Unknown error'}`);
	}

	const updatedSchedule = mapScheduleRow(fullSchedule as ScheduleWithRelations);
	schedulesStore.update((schedules) =>
		schedules.map((schedule) => (schedule.id === id ? updatedSchedule : schedule))
	);
	return updatedSchedule;
}

export async function deleteSchedule(id: string): Promise<void> {
	const deletedAt = new Date().toISOString();

	const { error: eventsError } = await supabase
		.from(EVENTS_TABLE)
		.update({ deleted_at: deletedAt })
		.eq('schedule_id', id)
		.is('deleted_at', null);

	if (eventsError) {
		console.error('Error soft deleting machine inspection events:', eventsError);
		throw new Error(`Failed to delete schedule events: ${eventsError.message}`);
	}

	const { error: scheduleError } = await supabase
		.from(SCHEDULES_TABLE)
		.update({ deleted_at: deletedAt })
		.eq('id', id)
		.is('deleted_at', null);

	if (scheduleError) {
		console.error('Error soft deleting schedule:', scheduleError);
		throw new Error(`Failed to delete schedule: ${scheduleError.message}`);
	}

	schedulesStore.update((schedules) => schedules.filter((schedule) => schedule.id !== id));
}

export async function getScheduleById(id: string): Promise<Schedule | undefined> {
	const { data, error } = await supabase
		.from(SCHEDULES_TABLE)
		.select(SCHEDULE_SELECT)
		.eq('id', id)
		.is('deleted_at', null)
		.maybeSingle();

	if (error) {
		console.error('Error loading schedule by id:', error);
		throw new Error(`Failed to load schedule: ${error.message}`);
	}

	return data ? mapScheduleRow(data as ScheduleWithRelations) : undefined;
}
