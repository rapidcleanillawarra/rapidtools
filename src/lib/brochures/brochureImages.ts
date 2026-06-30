import { supabase } from '$lib/supabase';

/** Storage bucket used for brochure image uploads. */
export const RAPIDTOOLS_BUCKET = 'rapidtools';
/** Folder (prefix) within the bucket where brochure images live. */
export const BROCHURES_FOLDER = 'brochures';

export type BrochureImageSlot = {
	key: string;
	label: string;
	defaultUrl: string;
	/** Optional helper text shown in the editor. */
	hint?: string;
};

function sanitizeKey(value: string) {
	return value.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 60) || 'image';
}

function fileExtension(file: File) {
	if (file.name.includes('.')) return file.name.slice(file.name.lastIndexOf('.'));
	const fromType = file.type.split('/')[1];
	return fromType ? `.${fromType}` : '';
}

function buildObjectPath(slug: string, key: string, file: File) {
	const ext = fileExtension(file);
	return `${BROCHURES_FOLDER}/${sanitizeKey(slug)}/${sanitizeKey(key)}_${crypto.randomUUID()}${ext}`;
}

/** Load saved image overrides for a brochure as a `{ image_key: url }` map. */
export async function loadBrochureImages(slug: string): Promise<Record<string, string>> {
	const { data, error } = await supabase
		.from('brochure_images')
		.select('image_key, url')
		.eq('brochure_slug', slug);

	if (error || !data) {
		return {};
	}

	const map: Record<string, string> = {};
	for (const row of data as { image_key: string; url: string }[]) {
		map[row.image_key] = row.url;
	}
	return map;
}

async function upsertOverride(
	slug: string,
	key: string,
	url: string,
	storagePath: string | null
): Promise<string | null> {
	const { error } = await supabase.from('brochure_images').upsert(
		{
			brochure_slug: slug,
			image_key: key,
			url,
			storage_path: storagePath,
			updated_at: new Date().toISOString()
		},
		{ onConflict: 'brochure_slug,image_key' }
	);
	return error?.message ?? null;
}

/** Upload a file to the rapidtools bucket and persist the resulting public URL. */
export async function uploadBrochureImage(
	slug: string,
	key: string,
	file: File
): Promise<{ url: string | null; error: string | null }> {
	const storagePath = buildObjectPath(slug, key, file);

	const { error: uploadError } = await supabase.storage
		.from(RAPIDTOOLS_BUCKET)
		.upload(storagePath, file, {
			upsert: false,
			contentType: file.type || 'application/octet-stream'
		});

	if (uploadError) {
		return { url: null, error: uploadError.message };
	}

	const { data } = supabase.storage.from(RAPIDTOOLS_BUCKET).getPublicUrl(storagePath);
	const url = data.publicUrl;

	const dbError = await upsertOverride(slug, key, url, storagePath);
	if (dbError) {
		// best-effort cleanup of the orphaned object
		void supabase.storage.from(RAPIDTOOLS_BUCKET).remove([storagePath]);
		return { url: null, error: dbError };
	}

	return { url, error: null };
}

/** Persist an external image link as the override for a brochure image slot. */
export async function setBrochureImageUrl(
	slug: string,
	key: string,
	url: string
): Promise<{ error: string | null }> {
	const error = await upsertOverride(slug, key, url, null);
	return { error };
}

/** Remove any saved override so the slot falls back to its default image. */
export async function resetBrochureImage(
	slug: string,
	key: string
): Promise<{ error: string | null }> {
	const { error } = await supabase
		.from('brochure_images')
		.delete()
		.eq('brochure_slug', slug)
		.eq('image_key', key);
	return { error: error?.message ?? null };
}
