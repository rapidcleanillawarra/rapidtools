import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const catalogueData = await request.json();

		// Validate the structure - support both old and new formats
		if (!catalogueData.hierarchy && !catalogueData.productRanges) {
			return json({ error: 'Invalid data structure. Expected hierarchy or productRanges array.' }, { status: 400 });
		}

		// Ensure we have a hierarchy array (convert old format if needed)
		if (catalogueData.productRanges && !catalogueData.hierarchy) {
			catalogueData.hierarchy = catalogueData.productRanges.map(range => ({
				type: 'productRange',
				...range
			}));
		}

		if (!Array.isArray(catalogueData.hierarchy)) {
			return json({ error: 'Invalid data structure. Hierarchy must be an array.' }, { status: 400 });
		}

		// Store the data temporarily (in a real app, you might use a database or session)
		// For now, we'll just return success and the data can be passed directly

		return json({
			success: true,
			data: catalogueData,
			message: 'Catalogue data received successfully'
		});
	} catch (error) {
		console.error('Error processing catalogue data:', error);
		return json({ error: 'Failed to process catalogue data' }, { status: 500 });
	}
};
