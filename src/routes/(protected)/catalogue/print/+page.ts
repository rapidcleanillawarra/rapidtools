import type { CatalogueData } from './types.ts';
import { supabase } from '$lib/supabase';
import { error } from '@sveltejs/kit';

interface PageData {
	catalogueData: CatalogueData;
}

export const load = async ({ url }: { url: URL }) => {
	// Check for session ID in URL params
	const sessionId = url.searchParams.get('sessionId');

	if (sessionId) {
		try {
			// Load session data from database
			const { data: sessionData, error: sessionError } = await supabase
				.from('catalogue_sessions')
				.select('catalogue_data, session_name')
				.eq('id', sessionId)
				.single();

			if (sessionError || !sessionData) {
				console.error('Error loading session:', sessionError);
				throw error(404, 'Session not found');
			}

			// Extract catalogue data from session
			const catalogueData: CatalogueData = {
				hierarchy: sessionData.catalogue_data?.hierarchy || sessionData.catalogue_data?.productRanges || [],
				printSettings: sessionData.catalogue_data?.printSettings || {
					pageSize: "A4",
					margin: "1cm",
					productsPerPage: 3,
					repeatHeaderOnNewPage: true
				}
			};

			return {
				catalogueData,
				sessionName: sessionData.session_name
			};
		} catch (err) {
			console.error('Error loading session data:', err);
			throw error(500, 'Failed to load session data');
		}
	}

	// Check URL params for backward compatibility with old data format
	const urlData = url.searchParams.get('data');

	if (urlData) {
		try {
			const parsedData = JSON.parse(decodeURIComponent(urlData));
			// Ensure the data has the required structure
			const catalogueData: CatalogueData = {
				hierarchy: parsedData.hierarchy || parsedData.productRanges || [],
				printSettings: parsedData.printSettings || {
					pageSize: "A4",
					margin: "1cm",
					productsPerPage: 3,
					repeatHeaderOnNewPage: true
				}
			};
			return {
				catalogueData
			};
		} catch (error) {
			console.error('Error parsing catalogue data:', error);
		}
	}

	// Fallback to default static data
	const defaultCatalogueData: CatalogueData = {
		hierarchy: [
			{
				type: 'productRange',
				title: "CLEANING AND LAUNDRY SOLUTIONS",
				categories: [
					{
						name: "Washroom Cleaner",
						products: [
							{
								sku: "hi-genic-h4",
								name: "HI-GENIC H4",
								price: "$29.99",
								image: "https://www.rapidsupplies.com.au/assets/full/140370.jpg?20240719121930&1759111621806",
								description: "Hi-Genic is formulated using safe acids and anionic surfactants: a combination that has proven to be the least corrosive to all metals yet gives excellent performance.",
								certifications: ["environmentally_friendly", "food_safe", "recognized"]
							}
						]
					}
				]
			}
		],
		printSettings: {
			pageSize: "A4",
			margin: "1cm",
			productsPerPage: 3,
			repeatHeaderOnNewPage: true
		}
	};

	return {
		catalogueData: defaultCatalogueData
	};
};
