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
	previewUrl: string;
	file?: File;
	saved?: ProductRequestImage;
};

export type UploadProductRequestImagesOptions = {
	requestId?: string;
	startIndex?: number;
};

function sanitizeKey(value: string) {
	return value.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 60) || 'image';
}

function fileExtension(file: File) {
	if (file.name.includes('.')) return file.name.slice(file.name.lastIndexOf('.'));
	const fromType = file.type.split('/')[1];
	return fromType ? `.${fromType}` : '';
}

function imageKey(image: ProductRequestImage) {
	return image.storage_path || image.URL;
}

export function productImageName(index: number): string {
	return index === 0 ? 'Main' : `Alt ${index}`;
}

export function toMaropostImages(images: ProductRequestImage[]) {
	return images.map((image, index) => ({
		Name: productImageName(index),
		URL: image.URL
	}));
}

export function savedImageToDraft(image: ProductRequestImage): ProductImageDraft {
	return {
		id: crypto.randomUUID(),
		previewUrl: image.URL,
		saved: image
	};
}

export function revokeProductImagePreviews(images: ProductImageDraft[]) {
	for (const image of images) {
		if (image.file && image.previewUrl.startsWith('blob:')) {
			URL.revokeObjectURL(image.previewUrl);
		}
	}
}

export async function uploadProductRequestImages(
	sku: string,
	files: File[],
	options?: UploadProductRequestImagesOptions
): Promise<{ images: ProductRequestImage[]; error: string | null }> {
	const images: ProductRequestImage[] = [];
	const startIndex = options?.startIndex ?? 0;

	for (let i = 0; i < files.length; i++) {
		const file = files[i];
		const sortOrder = startIndex + i;
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
			Name: productImageName(sortOrder),
			URL: data.publicUrl,
			storage_path: storagePath
		};

		const { error: insertError } = await supabase.from(PRODUCT_REQUEST_IMAGES_TABLE).insert({
			sku,
			request_id: options?.requestId || null,
			image_name: image.Name,
			url: image.URL,
			storage_path: storagePath,
			file_name: file.name,
			content_type: file.type || null,
			byte_size: file.size,
			sort_order: sortOrder
		});

		if (insertError) {
			void supabase.storage.from(PRODUCT_REQUEST_IMAGES_BUCKET).remove([storagePath]);
			return { images, error: insertError.message };
		}

		images.push(image);
	}

	return { images, error: null };
}

export async function deleteProductRequestImages(
	images: ProductRequestImage[]
): Promise<{ error: string | null }> {
	const storagePaths = images
		.map((image) => image.storage_path)
		.filter((path): path is string => Boolean(path));

	if (storagePaths.length > 0) {
		const { error: storageError } = await supabase.storage
			.from(PRODUCT_REQUEST_IMAGES_BUCKET)
			.remove(storagePaths);
		if (storageError) {
			return { error: storageError.message };
		}

		const { error: deleteError } = await supabase
			.from(PRODUCT_REQUEST_IMAGES_TABLE)
			.delete()
			.in('storage_path', storagePaths);
		if (deleteError) {
			return { error: deleteError.message };
		}
	}

	const urlsWithoutPath = images.filter((image) => !image.storage_path).map((image) => image.URL);
	if (urlsWithoutPath.length > 0) {
		const { error: deleteByUrlError } = await supabase
			.from(PRODUCT_REQUEST_IMAGES_TABLE)
			.delete()
			.in('url', urlsWithoutPath);
		if (deleteByUrlError) {
			return { error: deleteByUrlError.message };
		}
	}

	return { error: null };
}

export async function persistProductRequestImageDrafts(
	sku: string,
	drafts: ProductImageDraft[],
	originalSaved: ProductRequestImage[],
	options?: { requestId?: string }
): Promise<{ images: ProductRequestImage[]; error: string | null }> {
	const currentSaved = drafts
		.map((draft) => draft.saved)
		.filter((image): image is ProductRequestImage => Boolean(image));
	const currentKeys = new Set(currentSaved.map(imageKey));
	const removed = originalSaved.filter((image) => !currentKeys.has(imageKey(image)));

	if (removed.length > 0) {
		const deleted = await deleteProductRequestImages(removed);
		if (deleted.error) return { images: [], error: deleted.error };
	}

	const newFiles = drafts
		.map((draft) => draft.file)
		.filter((file): file is File => Boolean(file));
	let uploaded: ProductRequestImage[] = [];
	if (newFiles.length > 0) {
		const result = await uploadProductRequestImages(sku, newFiles, {
			requestId: options?.requestId,
			startIndex: currentSaved.length
		});
		if (result.error) return { images: currentSaved, error: result.error };
		uploaded = result.images;
	}

	const uploadedQueue = [...uploaded];
	const images: ProductRequestImage[] = [];
	for (const draft of drafts) {
		if (draft.saved) {
			images.push(draft.saved);
		} else if (draft.file) {
			const next = uploadedQueue.shift();
			if (next) images.push(next);
		}
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
