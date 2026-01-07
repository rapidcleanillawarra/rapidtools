import type { PageLoad } from './$types';
import { supabase } from '$lib/supabase';

type PriceListItem = {
	id: string;
	sku: string;
	kind: 'sku' | 'static';
	price?: string;
	rrp?: string;
	model?: string;
	imageUrl?: string;
	hasDescription?: boolean;
	shortDescription?: string;
	staticType?: 'page_break' | 'range' | 'category';
	value?: string;
};

type PriceListData = {
	id: string | null;
	filename: string;
	items: PriceListItem[];
	mode?: 'thumb' | 'list';
	includeRrp?: boolean;
	error?: string;
};

const skuCheckUrl =
	'https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=pPhk80gODQOi843ixLjZtPPWqTeXIbIt9ifWZP6CJfY';

const getMainImage = (images: any[] = []) => {
	if (!Array.isArray(images)) return '';
	const main = images.find((img) => img?.Name === 'Main' && img?.URL);
	if (main?.URL) return main.URL;
	const first = images.find((img) => img?.URL);
	return first?.URL ?? '';
};

const fetchSkuDetails = async (
	skus: string[]
): Promise<
	Record<string, { model?: string; rrp?: string; imageUrl?: string; shortDescription?: string }>
> => {
	if (!skus.length) return {};

	try {
		const payload = {
			Filter: {
				SKU: skus,
				OutputSelector: ['SKU', 'Model', 'Images', 'RRP', 'ShortDescription']
			},
			action: 'GetItem'
		};

		const response = await fetch(skuCheckUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});

		const data = await response.json();

		if (data?.Ack !== 'Success') {
			console.error('SKU detail fetch failed:', data);
			return {};
		}

		const map: Record<
			string,
			{ model?: string; rrp?: string; imageUrl?: string; shortDescription?: string }
		> = {};

		(data.Item ?? []).forEach((item: any) => {
			const sku = item?.SKU;
			if (!sku) return;
			map[sku] = {
				model: item?.Model ?? '',
				rrp: item?.RRP?.toString?.() ?? '',
				imageUrl: getMainImage(item?.Images),
				shortDescription: item?.ShortDescription ?? ''
			};
		});

		return map;
	} catch (err) {
		console.error('Failed to fetch SKU details:', err);
		return {};
	}
};

export const load: PageLoad = async ({ url }) => {
	const id = url.searchParams.get('id');
	const mode = (url.searchParams.get('mode') || 'thumb') as 'thumb' | 'list';
	const includeRrp = url.searchParams.get('includeRrp') === 'true';

	if (!id) {
		return {
			id: null,
			filename: '',
			items: [],
			mode,
			includeRrp,
			error: 'No price list ID provided'
		} satisfies PriceListData;
	}

	try {
		const { data, error } = await supabase
			.from('price_lists')
			.select('id, filename, price_list_data')
			.eq('id', id)
			.single();

		if (error) {
			console.error('Supabase error:', error);
		return {
			id,
			filename: '',
			items: [],
			mode,
			includeRrp,
			error: 'Price list not found'
		} satisfies PriceListData;
		}

		let items: PriceListItem[] = [];
		if (data?.price_list_data) {
			if (typeof data.price_list_data === 'string') {
				try {
					items = JSON.parse(data.price_list_data);
				} catch (parseErr) {
					console.error('Failed to parse price_list_data', parseErr);
				}
			} else if (Array.isArray(data.price_list_data)) {
				items = data.price_list_data;
			}
		}

		// Extract all SKUs for enrichment
		const skus = items.filter((item) => item.kind === 'sku' && item.sku).map((item) => item.sku);

		// Fetch product details from Power Automate
		const detailMap = await fetchSkuDetails(skus);

		// Merge details into items
		items = items.map((item) => {
			if (item.kind !== 'sku' || !item.sku) return item;
			const detail = detailMap[item.sku];
			if (!detail) return item;
			return {
				...item,
				model: detail.model || item.model,
				rrp: detail.rrp || item.rrp,
				imageUrl: detail.imageUrl || item.imageUrl,
				shortDescription: detail.shortDescription || item.shortDescription
			};
		});

		return {
			id: data.id,
			filename: data.filename || 'Price List',
			items,
			mode,
			includeRrp
		} satisfies PriceListData;
	} catch (err) {
		console.error('Unexpected error:', err);
		return {
			id,
			filename: '',
			items: [],
			mode,
			includeRrp,
			error: 'Failed to load price list'
		} satisfies PriceListData;
	}
};
