import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '$lib/supabase';

export const ASSET_FILES_BUCKET = 'assets';

export type AssetFileRow = {
	id: string;
	asset_id: string;
	storage_path: string;
	file_name: string;
	content_type: string | null;
	byte_size: number | null;
	sort_order: number;
	created_at: string;
};

function sanitizeBaseName(name: string) {
	const base = name.replace(/^.*[\\/]/, '');
	const noExt = base.includes('.') ? base.slice(0, base.lastIndexOf('.')) : base;
	return (noExt.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'file') as string;
}

export function publicUrlForPath(storagePath: string): string {
	const { data } = supabase.storage.from(ASSET_FILES_BUCKET).getPublicUrl(storagePath);
	return data.publicUrl;
}

export function buildObjectPath(assetId: string, file: File) {
	const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
	return `${assetId}/${crypto.randomUUID()}_${sanitizeBaseName(file.name)}${ext}` as const;
}

export async function listAssetFileRows(
	client: SupabaseClient,
	assetId: string
): Promise<{ data: AssetFileRow[]; error: Error | null }> {
	const { data, error } = await client
		.from('asset_files')
		.select('*')
		.eq('asset_id', assetId)
		.order('sort_order', { ascending: true });

	if (error) {
		return { data: [], error: new Error(error.message) };
	}
	return { data: (data as AssetFileRow[]) ?? [], error: null };
}

export async function uploadFilesForAsset(
	assetId: string,
	files: File[]
): Promise<{ error: string | null }> {
	if (files.length === 0) {
		return { error: null };
	}

	const { data: maxRow, error: countError } = await supabase
		.from('asset_files')
		.select('sort_order')
		.eq('asset_id', assetId)
		.order('sort_order', { ascending: false })
		.limit(1)
		.maybeSingle();

	if (countError) {
		return { error: countError.message };
	}
	let startOrder = (maxRow as { sort_order: number } | null)?.sort_order ?? -1;

	for (const file of files) {
		const storagePath = buildObjectPath(assetId, file);
		const { error: upErr } = await supabase.storage.from(ASSET_FILES_BUCKET).upload(storagePath, file, {
			upsert: false,
			contentType: file.type || 'application/octet-stream'
		});
		if (upErr) {
			return { error: upErr.message };
		}
		startOrder += 1;
		const { error: insErr } = await supabase.from('asset_files').insert({
			asset_id: assetId,
			storage_path: storagePath,
			file_name: file.name,
			content_type: file.type || null,
			byte_size: file.size,
			sort_order: startOrder
		});
		if (insErr) {
			// best-effort cleanup of the orphan object
			void supabase.storage.from(ASSET_FILES_BUCKET).remove([storagePath]);
			return { error: insErr.message };
		}
	}
	return { error: null };
}

/**
 * Remove object from storage and the asset_files row.
 */
export async function deleteAssetFile(
	row: Pick<AssetFileRow, 'id' | 'storage_path'>
): Promise<{ error: string | null }> {
	const { error: rmError } = await supabase.storage.from(ASSET_FILES_BUCKET).remove([row.storage_path]);
	if (rmError) {
		return { error: rmError.message };
	}
	const { error: delError } = await supabase.from('asset_files').delete().eq('id', row.id);
	if (delError) {
		return { error: delError.message };
	}
	return { error: null };
}

export function isImageType(contentType: string | null) {
	if (!contentType) return false;
	return contentType.startsWith('image/');
}

export function revokeStagedPreviews(files: { preview: string }[]) {
	for (const s of files) {
		if (s.preview) {
			URL.revokeObjectURL(s.preview);
		}
	}
}
