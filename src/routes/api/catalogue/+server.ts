import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const catalogueData = await request.json();

		// Validate the structure
		if (!catalogueData.productRanges || !Array.isArray(catalogueData.productRanges)) {
			return json({ error: 'Invalid data structure. Expected productRanges array.' }, { status: 400 });
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
