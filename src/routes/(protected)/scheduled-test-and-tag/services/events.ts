import { supabase } from '$lib/supabase';
import type { MachineInspectionEventRow } from './types';

const EVENTS_TABLE = 'machine_inspection_events';

export interface MachineInspectionEvent {
	id?: string;
	information_id: string;
	schedule_id: string;
	company: string;
	sub_company_name: string;
	location: string;
	start_date: string;
	end_date: string;
	title: string;
	backgroundColor: string;
	created_at?: string;
	updated_at?: string;
	created_by_uid?: string;
	created_by_email?: string;
	deleted_at?: string | null;
}

/** @deprecated Use MachineInspectionEvent */
export type STTEvent = MachineInspectionEvent;

function mapEventRow(row: MachineInspectionEventRow): MachineInspectionEvent {
	return {
		id: row.id,
		information_id: row.information_id,
		schedule_id: row.schedule_id,
		company: row.company,
		sub_company_name: row.sub_company_name,
		location: row.location,
		start_date: row.start_date,
		end_date: row.end_date,
		title: row.title,
		backgroundColor: row.background_color,
		created_at: row.created_at,
		updated_at: row.updated_at,
		created_by_uid: row.created_by_uid ?? undefined,
		created_by_email: row.created_by_email ?? undefined,
		deleted_at: row.deleted_at
	};
}

function toEndOfDayIso(date: string): string {
	if (date.includes('T')) return date;
	return `${date}T23:59:59.999Z`;
}

export async function loadMachineInspectionEvents(
	startDate?: string,
	endDate?: string
): Promise<MachineInspectionEvent[]> {
	let query = supabase
		.from(EVENTS_TABLE)
		.select('*')
		.is('deleted_at', null)
		.order('start_date', { ascending: true });

	if (startDate) {
		query = query.gte('start_date', startDate);
	}

	if (endDate) {
		query = query.lte('start_date', toEndOfDayIso(endDate));
	}

	const { data, error } = await query;

	if (error) {
		console.error('Error loading machine inspection events:', error);
		throw error;
	}

	return (data as MachineInspectionEventRow[]).map(mapEventRow);
}

export async function saveMachineInspectionEvent(
	event: Omit<MachineInspectionEvent, 'id' | 'created_at' | 'updated_at'>
): Promise<string> {
	const { data, error } = await supabase
		.from(EVENTS_TABLE)
		.insert({
			schedule_id: event.schedule_id,
			information_id: event.information_id,
			company: event.company,
			sub_company_name: event.sub_company_name,
			location: event.location,
			start_date: event.start_date,
			end_date: event.end_date,
			title: event.title,
			background_color: event.backgroundColor,
			created_by_uid: event.created_by_uid ?? null,
			created_by_email: event.created_by_email ?? null
		})
		.select('id')
		.single();

	if (error || !data) {
		console.error('Error saving machine inspection event:', error);
		throw error;
	}

	return data.id;
}

export async function updateMachineInspectionEvent(
	eventId: string,
	updates: Partial<MachineInspectionEvent>
): Promise<void> {
	const payload: Record<string, unknown> = {};

	if (updates.start_date !== undefined) payload.start_date = updates.start_date;
	if (updates.end_date !== undefined) payload.end_date = updates.end_date;
	if (updates.title !== undefined) payload.title = updates.title;
	if (updates.backgroundColor !== undefined) payload.background_color = updates.backgroundColor;
	if (updates.company !== undefined) payload.company = updates.company;
	if (updates.sub_company_name !== undefined) payload.sub_company_name = updates.sub_company_name;
	if (updates.location !== undefined) payload.location = updates.location;
	if (updates.information_id !== undefined) payload.information_id = updates.information_id;
	if (updates.schedule_id !== undefined) payload.schedule_id = updates.schedule_id;

	const { error } = await supabase.from(EVENTS_TABLE).update(payload).eq('id', eventId);

	if (error) {
		console.error('Error updating machine inspection event:', error);
		throw error;
	}
}

export async function deleteMachineInspectionEvent(eventId: string): Promise<void> {
	const { error } = await supabase
		.from(EVENTS_TABLE)
		.update({ deleted_at: new Date().toISOString() })
		.eq('id', eventId)
		.is('deleted_at', null);

	if (error) {
		console.error('Error soft deleting machine inspection event:', error);
		throw error;
	}
}

export async function findEventByInfoAndSchedule(
	information_id: string,
	schedule_id: string
): Promise<MachineInspectionEvent | null> {
	const { data, error } = await supabase
		.from(EVENTS_TABLE)
		.select('*')
		.eq('information_id', information_id)
		.eq('schedule_id', schedule_id)
		.is('deleted_at', null)
		.maybeSingle();

	if (error) {
		console.error('Error finding machine inspection event:', error);
		throw error;
	}

	return data ? mapEventRow(data as MachineInspectionEventRow) : null;
}

export function calendarEventToMachineInspectionEvent(
	calendarEvent: {
		title: string;
		start: string;
		end?: string;
		backgroundColor: string;
	},
	locationInfo: {
		information_id: string;
		sub_company_name: string;
		location: string;
	},
	schedule: {
		id: string;
		company: string;
	},
	userUid?: string,
	userEmail?: string
): Omit<MachineInspectionEvent, 'id' | 'created_at' | 'updated_at'> {
	return {
		information_id: locationInfo.information_id,
		schedule_id: schedule.id,
		company: schedule.company,
		sub_company_name: locationInfo.sub_company_name,
		location: locationInfo.location,
		start_date: calendarEvent.start,
		end_date: calendarEvent.end || calendarEvent.start,
		title: calendarEvent.title,
		backgroundColor: calendarEvent.backgroundColor,
		created_by_uid: userUid,
		created_by_email: userEmail
	};
}

export function machineInspectionEventToCalendarEvent(event: MachineInspectionEvent): {
	id: string | undefined;
	title: string;
	start: string;
	end: string;
	backgroundColor: string;
	extendedProps: {
		location: string;
		company: string;
		scheduleId: string;
		infoIndex: number;
		occurrenceIndex: number;
	};
} {
	return {
		id: event.id,
		title: event.title,
		start: event.start_date,
		end: event.end_date,
		backgroundColor: event.backgroundColor,
		extendedProps: {
			location: event.location,
			company: event.company,
			scheduleId: event.schedule_id,
			infoIndex: 0,
			occurrenceIndex: 0
		}
	};
}
