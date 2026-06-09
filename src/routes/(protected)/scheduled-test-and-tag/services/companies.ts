import { supabase } from '$lib/supabase';
import { schedulesStore } from '../stores';
import type { ScheduleFormData } from '../companies/types';
import type { Schedule } from '../stores';
import { mapCompanyRow, type CompanyWithRelations } from './types';

const COMPANIES_TABLE = 'machine_inspection_companies';
const LOCATIONS_TABLE = 'machine_inspection_locations';
const CONTACTS_TABLE = 'machine_inspection_contacts';
const NOTES_TABLE = 'machine_inspection_notes';
const EVENTS_TABLE = 'machine_inspection_events';

const COMPANY_SELECT = `
  *,
  machine_inspection_locations (
    *,
    machine_inspection_contacts (*)
  ),
  machine_inspection_notes (*)
`;

async function insertNestedCompanyData(
	companyId: string,
	companyData: ScheduleFormData
): Promise<void> {
	const information = companyData.information ?? [];
	for (let index = 0; index < information.length; index++) {
		const info = information[index];
		const informationId = info.information_id?.trim() || crypto.randomUUID();

		const { data: location, error: locationError } = await supabase
			.from(LOCATIONS_TABLE)
			.insert({
				company_id: companyId,
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

	const notes = companyData.notes ?? [];
	if (notes.length > 0) {
		const { error: notesError } = await supabase.from(NOTES_TABLE).insert(
			notes.map((note, noteIndex) => ({
				company_id: companyId,
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

async function replaceNestedCompanyData(
	companyId: string,
	companyData: ScheduleFormData
): Promise<void> {
	const { error: deleteLocationsError } = await supabase
		.from(LOCATIONS_TABLE)
		.delete()
		.eq('company_id', companyId);

	if (deleteLocationsError) {
		throw new Error(`Failed to clear locations: ${deleteLocationsError.message}`);
	}

	const { error: deleteNotesError } = await supabase
		.from(NOTES_TABLE)
		.delete()
		.eq('company_id', companyId);

	if (deleteNotesError) {
		throw new Error(`Failed to clear notes: ${deleteNotesError.message}`);
	}

	await insertNestedCompanyData(companyId, companyData);
}

export async function loadCompanies(): Promise<void> {
	const { data, error } = await supabase
		.from(COMPANIES_TABLE)
		.select(COMPANY_SELECT)
		.is('deleted_at', null)
		.order('created_at', { ascending: false });

	if (error) {
		console.error('Error loading machine inspection companies:', error);
		throw new Error('Failed to load companies from database.');
	}

	const companies = (data as CompanyWithRelations[]).map(mapCompanyRow);
	schedulesStore.set(companies);
}

/** @deprecated Use loadCompanies */
export const loadSchedules = loadCompanies;

export async function createCompany(companyData: ScheduleFormData): Promise<Schedule> {
	const { data, error } = await supabase
		.from(COMPANIES_TABLE)
		.insert({
			company: companyData.company,
			start_month: companyData.start_month,
			occurence: companyData.occurence,
			color: companyData.color
		})
		.select('id')
		.single();

	if (error || !data) {
		console.error('Error creating company:', error);
		throw new Error(`Failed to create company: ${error?.message ?? 'Unknown error'}`);
	}

	try {
		await insertNestedCompanyData(data.id, companyData);
	} catch (nestedError) {
		await supabase.from(COMPANIES_TABLE).delete().eq('id', data.id);
		throw nestedError;
	}

	const { data: fullCompany, error: loadError } = await supabase
		.from(COMPANIES_TABLE)
		.select(COMPANY_SELECT)
		.eq('id', data.id)
		.single();

	if (loadError || !fullCompany) {
		throw new Error(`Failed to load created company: ${loadError?.message ?? 'Unknown error'}`);
	}

	const newCompany = mapCompanyRow(fullCompany as CompanyWithRelations);
	schedulesStore.update((companies) => [...companies, newCompany]);
	return newCompany;
}

/** @deprecated Use createCompany */
export const createSchedule = createCompany;

export async function updateCompany(id: string, companyData: ScheduleFormData): Promise<Schedule> {
	const { error: updateError } = await supabase
		.from(COMPANIES_TABLE)
		.update({
			company: companyData.company,
			start_month: companyData.start_month,
			occurence: companyData.occurence,
			color: companyData.color
		})
		.eq('id', id)
		.is('deleted_at', null);

	if (updateError) {
		console.error('Error updating company:', updateError);
		throw new Error(`Failed to update company: ${updateError.message}`);
	}

	await replaceNestedCompanyData(id, companyData);

	const { data: fullCompany, error: loadError } = await supabase
		.from(COMPANIES_TABLE)
		.select(COMPANY_SELECT)
		.eq('id', id)
		.single();

	if (loadError || !fullCompany) {
		throw new Error(`Failed to load updated company: ${loadError?.message ?? 'Unknown error'}`);
	}

	const updatedCompany = mapCompanyRow(fullCompany as CompanyWithRelations);
	schedulesStore.update((companies) =>
		companies.map((company) => (company.id === id ? updatedCompany : company))
	);
	return updatedCompany;
}

/** @deprecated Use updateCompany */
export const updateSchedule = updateCompany;

export async function deleteCompany(id: string): Promise<void> {
	const deletedAt = new Date().toISOString();

	const { error: eventsError } = await supabase
		.from(EVENTS_TABLE)
		.update({ deleted_at: deletedAt })
		.eq('company_id', id)
		.is('deleted_at', null);

	if (eventsError) {
		console.error('Error soft deleting machine inspection events:', eventsError);
		throw new Error(`Failed to delete company events: ${eventsError.message}`);
	}

	const { error: companyError } = await supabase
		.from(COMPANIES_TABLE)
		.update({ deleted_at: deletedAt })
		.eq('id', id)
		.is('deleted_at', null);

	if (companyError) {
		console.error('Error soft deleting company:', companyError);
		throw new Error(`Failed to delete company: ${companyError.message}`);
	}

	schedulesStore.update((companies) => companies.filter((company) => company.id !== id));
}

/** @deprecated Use deleteCompany */
export const deleteSchedule = deleteCompany;

export async function getCompanyById(id: string): Promise<Schedule | undefined> {
	const { data, error } = await supabase
		.from(COMPANIES_TABLE)
		.select(COMPANY_SELECT)
		.eq('id', id)
		.is('deleted_at', null)
		.maybeSingle();

	if (error) {
		console.error('Error loading company by id:', error);
		throw new Error(`Failed to load company: ${error.message}`);
	}

	return data ? mapCompanyRow(data as CompanyWithRelations) : undefined;
}

/** @deprecated Use getCompanyById */
export const getScheduleById = getCompanyById;

export async function loadLocationNameMap(companyId: string): Promise<Map<string, string>> {
	const { data, error } = await supabase
		.from(LOCATIONS_TABLE)
		.select('id, location')
		.eq('company_id', companyId);

	if (error) {
		throw new Error(`Failed to load locations: ${error.message}`);
	}

	return new Map((data ?? []).map((row) => [row.id, row.location]));
}

export async function loadLocationNameToIdMap(companyId: string): Promise<Map<string, string>> {
	const { data, error } = await supabase
		.from(LOCATIONS_TABLE)
		.select('id, location')
		.eq('company_id', companyId);

	if (error) {
		throw new Error(`Failed to load locations: ${error.message}`);
	}

	const map = new Map<string, string>();
	for (const row of data ?? []) {
		if (row.location && !map.has(row.location)) {
			map.set(row.location, row.id);
		}
	}
	return map;
}

export async function getLocationIdByName(
	companyId: string,
	locationName: string
): Promise<string | undefined> {
	const { data, error } = await supabase
		.from(LOCATIONS_TABLE)
		.select('id')
		.eq('company_id', companyId)
		.eq('location', locationName)
		.maybeSingle();

	if (error) {
		throw new Error(`Failed to find location: ${error.message}`);
	}

	return data?.id;
}
