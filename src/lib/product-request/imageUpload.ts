import { supabase } from '$lib/supabase';

export const PRODUCT_REQUEST_IMAGES_BUCKET = 'rapidtools';
export const PRODUCT_REQUEST_IMAGES_FOLDER = 'product_requests';
export const PRODUCT_REQUEST_IMAGES_TABLE = 'rapidcleantools_product_request_images';
export const MAX_PRODUCT_IMAGES = 11;
export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;

export type ProductRequestImage = {
	Name: string;
	URL: string;
	storage_path?: string;
};

export type ProductImageDraft = {
	id: string;
	file: File;
	previewUrl: string;
};

function sanitizeKey(value: string) {
	return value.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 60) || 'image';
}

function fileExtension(file: File) {
	if (file.name.includes('.')) return file.name.slice(file.name.lastIndexOf('.'));
	const fromType = file.type.split('/')[1];
	return fromType ? `.${fromType}` : '';
}

export function productImageName(index: number): string {
	return index === 0 ? 'Main' : `Alt ${index}`;
}

export function revokeProductImagePreviews(images: ProductImageDraft[]) {
	for (const image of images) {
		if (image.previewUrl) URL.revokeObjectURL(image.previewUrl);
	}
}

export async function uploadProductRequestImages(
	sku: string,
	files: File[]
): Promise<{ images: ProductRequestImage[]; error: string | null }> {
	const images: ProductRequestImage[] = [];

	for (let i = 0; i < files.length; i++) {
		const file = files[i];
		const ext = fileExtension(file);
		const storagePath = `${PRODUCT_REQUEST_IMAGES_FOLDER}/${sanitizeKey(sku)}/${crypto.randomUUID()}${ext}`;

		const { error: uploadError } = await supabase.storage
			.from(PRODUCT_REQUEST_IMAGES_BUCKET)
			.upload(storagePath, file, {
				upsert: false,
				contentType: file.type || 'application/octet-stream'
			});

		if (uploadError) {
			return { images, error: uploadError.message };
		}

		const { data } = supabase.storage.from(PRODUCT_REQUEST_IMAGES_BUCKET).getPublicUrl(storagePath);
		const image: ProductRequestImage = {
			Name: productImageName(i),
			URL: data.publicUrl,
			storage_path: storagePath
		};

		const { error: insertError } = await supabase.from(PRODUCT_REQUEST_IMAGES_TABLE).insert({
			sku,
			image_name: image.Name,
			url: image.URL,
			storage_path: storagePath,
			file_name: file.name,
			content_type: file.type || null,
			byte_size: file.size,
			sort_order: i
		});

		if (insertError) {
			void supabase.storage.from(PRODUCT_REQUEST_IMAGES_BUCKET).remove([storagePath]);
			return { images, error: insertError.message };
		}

		images.push(image);
	}

	return { images, error: null };
}

export async function loadProductRequestImagesBySku(
	skus: string[]
): Promise<Record<string, ProductRequestImage[]>> {
	const uniqueSkus = [...new Set(skus.filter(Boolean))];
	if (uniqueSkus.length === 0) return {};

	const { data, error } = await supabase
		.from(PRODUCT_REQUEST_IMAGES_TABLE)
		.select('sku, image_name, url, storage_path, sort_order')
		.in('sku', uniqueSkus)
		.order('sort_order', { ascending: true });

	if (error || !data) {
		console.error('Failed to load product request images:', error?.message);
		return {};
	}

	const imagesBySku: Record<string, ProductRequestImage[]> = {};
	for (const row of data as {
		sku: string;
		image_name: string;
		url: string;
		storage_path: string;
		sort_order: number;
	}[]) {
		(imagesBySku[row.sku] ??= []).push({
			Name: row.image_name,
			URL: row.url,
			storage_path: row.storage_path
		});
	}

	return imagesBySku;
}
