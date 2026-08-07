import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Hosts brochure assets are commonly loaded from. */
const ALLOWED_HOST_SUFFIXES = [
	'rapidsupplies.com.au',
	'rapidclean.com.au',
	'supabase.co',
	'images.unsplash.com',
	'kaercher-media.com',
	'madeblue.org',
	'wikimedia.org',
	'kranzle.co.uk',
	'ramcarbatteries.com',
	'ritarpower.com'
];

function isAllowedImageUrl(raw: string): boolean {
	try {
		const parsed = new URL(raw);
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
		const host = parsed.hostname.toLowerCase();
		return ALLOWED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
	} catch {
		return false;
	}
}

export const GET: RequestHandler = async ({ url }) => {
	const imageUrl = url.searchParams.get('url');
	if (!imageUrl) {
		throw error(400, 'Missing image URL parameter');
	}
	if (!isAllowedImageUrl(imageUrl)) {
		throw error(403, 'Image host is not allowed');
	}

	const response = await fetch(imageUrl, {
		headers: { Accept: 'image/*,*/*' }
	});
	if (!response.ok) {
		throw error(response.status, 'Failed to fetch image');
	}

	const imageBlob = await response.blob();
	return new Response(imageBlob, {
		headers: {
			'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
			'Cache-Control': 'private, max-age=3600',
			'Access-Control-Allow-Origin': '*'
		}
	});
};
