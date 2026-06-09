/**
 * One-time migration: Firestore `stt` + `stt_events` → Supabase machine_inspection_* tables.
 *
 * Prerequisites:
 *   1. Apply supabase/migrations/20260609120000_machine_inspection.sql
 *   2. Set env vars (see .env.example entries below)
 *
 * Usage:
 *   node scripts/migrate-machine-inspection-from-firestore.mjs
 *
 * Required env:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY)
 *   VITE_FIREBASE_API_KEY
 *   VITE_FIREBASE_AUTH_DOMAIN
 *   VITE_FIREBASE_PROJECT_ID
 *   VITE_FIREBASE_STORAGE_BUCKET
 *   VITE_FIREBASE_MESSAGING_SENDER_ID
 *   VITE_FIREBASE_APP_ID
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp } from 'firebase/app';
import { collection, getDocs, getFirestore, orderBy, query } from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile(path) {
	if (!existsSync(path)) return;
	const content = readFileSync(path, 'utf8');
	for (const line of content.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const separator = trimmed.indexOf('=');
		if (separator === -1) continue;
		const key = trimmed.slice(0, separator).trim();
		let value = trimmed.slice(separator + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		if (!process.env[key]) {
			process.env[key] = value;
		}
	}
}

loadEnvFile(resolve(process.cwd(), '.env'));
loadEnvFile(resolve(process.cwd(), '.env.local'));

function requireEnv(name) {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return value;
}

const supabaseUrl = requireEnv('VITE_SUPABASE_URL');
const supabaseKey =
	process.env.SUPABASE_SERVICE_ROLE_KEY ?? requireEnv('VITE_SUPABASE_ANON_KEY');

const firebaseConfig = {
	apiKey: requireEnv('VITE_FIREBASE_API_KEY'),
	authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN'),
	projectId: requireEnv('VITE_FIREBASE_PROJECT_ID'),
	storageBucket: requireEnv('VITE_FIREBASE_STORAGE_BUCKET'),
	messagingSenderId: requireEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
	appId: requireEnv('VITE_FIREBASE_APP_ID')
};

const supabase = createClient(supabaseUrl, supabaseKey);
const db = getFirestore(initializeApp(firebaseConfig));

function firestoreTimestampToIso(value) {
	if (!value) return null;
	if (typeof value === 'string') return value;
	if (value.toDate) return value.toDate().toISOString();
	if (value.seconds != null) return new Date(value.seconds * 1000).toISOString();
	return null;
}

async function migrateSchedules() {
	const snapshot = await getDocs(
		query(collection(db, 'stt'), orderBy('createdAt', 'desc'))
	);

	const scheduleIdMap = new Map();
	let migrated = 0;
	let skipped = 0;

	for (const docSnap of snapshot.docs) {
		const data = docSnap.data();
		if (data.isDeleted === true) {
			skipped++;
			continue;
		}

		const legacyId = data.id || docSnap.id;

		const { data: existing } = await supabase
			.from('machine_inspection_schedules')
			.select('id')
			.eq('legacy_firestore_id', legacyId)
			.maybeSingle();

		if (existing) {
			scheduleIdMap.set(String(legacyId), existing.id);
			scheduleIdMap.set(docSnap.id, existing.id);
			skipped++;
			continue;
		}

		const { data: schedule, error } = await supabase
			.from('machine_inspection_schedules')
			.insert({
				company: data.company,
				start_month: data.start_month,
				occurence: data.occurence,
				color: data.color || '#3b82f6',
				created_at: firestoreTimestampToIso(data.createdAt) ?? new Date().toISOString(),
				updated_at: firestoreTimestampToIso(data.updatedAt) ?? new Date().toISOString(),
				deleted_at: firestoreTimestampToIso(data.deletedAt),
				legacy_firestore_id: legacyId
			})
			.select('id')
			.single();

		if (error || !schedule) {
			throw new Error(`Failed to migrate schedule ${legacyId}: ${error?.message}`);
		}

		scheduleIdMap.set(String(legacyId), schedule.id);
		scheduleIdMap.set(docSnap.id, schedule.id);

		const information = data.information ?? [];
		for (let index = 0; index < information.length; index++) {
			const info = information[index];
			const { data: location, error: locationError } = await supabase
				.from('machine_inspection_locations')
				.insert({
					schedule_id: schedule.id,
					information_id: info.information_id || crypto.randomUUID(),
					sub_company_name: info.sub_company_name ?? '',
					location: info.location ?? '',
					sort_order: index
				})
				.select('id')
				.single();

			if (locationError || !location) {
				throw new Error(
					`Failed to migrate location for schedule ${legacyId}: ${locationError?.message}`
				);
			}

			const contacts = info.contacts ?? [];
			if (contacts.length > 0) {
				const { error: contactsError } = await supabase
					.from('machine_inspection_contacts')
					.insert(
						contacts.map((contact, contactIndex) => ({
							location_id: location.id,
							name: contact.name ?? '',
							phone: contact.phone ?? '',
							email: contact.email ?? '',
							sort_order: contactIndex
						}))
					);

				if (contactsError) {
					throw new Error(
						`Failed to migrate contacts for schedule ${legacyId}: ${contactsError.message}`
					);
				}
			}
		}

		const notes = data.notes ?? [];
		if (notes.length > 0) {
			const { error: notesError } = await supabase.from('machine_inspection_notes').insert(
				notes.map((note, noteIndex) => ({
					schedule_id: schedule.id,
					title: note.title ?? '',
					content: note.content ?? '',
					sort_order: noteIndex
				}))
			);

			if (notesError) {
				throw new Error(`Failed to migrate notes for schedule ${legacyId}: ${notesError.message}`);
			}
		}

		migrated++;
	}

	return { scheduleIdMap, migrated, skipped };
}

async function migrateEvents(scheduleIdMap) {
	const snapshot = await getDocs(collection(db, 'stt_events'));
	let migrated = 0;
	let skipped = 0;
	let unresolved = 0;

	for (const docSnap of snapshot.docs) {
		const data = docSnap.data();
		if (data.is_deleted === true) {
			skipped++;
			continue;
		}

		const { data: existing } = await supabase
			.from('machine_inspection_events')
			.select('id')
			.eq('legacy_firestore_id', docSnap.id)
			.maybeSingle();

		if (existing) {
			skipped++;
			continue;
		}

		const rawScheduleId = String(data.schedule_id ?? '');
		const scheduleId =
			scheduleIdMap.get(rawScheduleId) ??
			scheduleIdMap.get(String(Number.parseInt(rawScheduleId, 10)));

		if (!scheduleId) {
			console.warn(`Skipping event ${docSnap.id}: unknown schedule_id ${rawScheduleId}`);
			unresolved++;
			continue;
		}

		const { error } = await supabase.from('machine_inspection_events').insert({
			schedule_id: scheduleId,
			information_id: data.information_id,
			company: data.company,
			sub_company_name: data.sub_company_name,
			location: data.location,
			start_date: data.start_date,
			end_date: data.end_date,
			title: data.title,
			background_color: data.backgroundColor ?? data.background_color ?? '#3b82f6',
			created_by_uid: data.created_by_uid ?? null,
			created_by_email: data.created_by_email ?? null,
			created_at: firestoreTimestampToIso(data.created_at) ?? new Date().toISOString(),
			updated_at: firestoreTimestampToIso(data.updated_at) ?? new Date().toISOString(),
			deleted_at: firestoreTimestampToIso(data.deleted_at),
			legacy_firestore_id: docSnap.id
		});

		if (error) {
			throw new Error(`Failed to migrate event ${docSnap.id}: ${error.message}`);
		}

		migrated++;
	}

	return { migrated, skipped, unresolved };
}

async function main() {
	console.log('Starting machine inspection migration from Firestore to Supabase...');

	const scheduleResult = await migrateSchedules();
	console.log(
		`Schedules migrated: ${scheduleResult.migrated}, skipped: ${scheduleResult.skipped}`
	);

	const eventResult = await migrateEvents(scheduleResult.scheduleIdMap);
	console.log(
		`Events migrated: ${eventResult.migrated}, skipped: ${eventResult.skipped}, unresolved: ${eventResult.unresolved}`
	);

	console.log('Migration complete.');
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
