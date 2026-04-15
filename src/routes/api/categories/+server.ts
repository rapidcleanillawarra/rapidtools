import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchCategories } from '$lib/services/products';

/** Delegates to the same client-side Power Automate call (keeps one implementation). */
export const GET: RequestHandler = async () => {
	try {
		const data = await fetchCategories();
		return json({ success: true, data });
	} catch (err) {
		console.error('Error fetching categories:', err);
		throw error(
			500,
			`Failed to fetch categories: ${err instanceof Error ? err.message : String(err)}`
		);
	}
};
