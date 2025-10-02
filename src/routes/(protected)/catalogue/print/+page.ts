import type { CatalogueData } from './types.ts';

interface PageData {
	catalogueData: CatalogueData;
}

export const load = async ({ url, data }: { url: URL; data?: PageData }) => {
	// Check if data was provided via POST action
	if (data?.catalogueData) {
		return data;
	}

	// Check URL params for GET requests (backward compatibility)
	const urlData = url.searchParams.get('data');

	if (urlData) {
		try {
			const parsedData = JSON.parse(decodeURIComponent(urlData));
			// Ensure the data has the required structure
			const catalogueData: CatalogueData = {
				productRanges: parsedData.productRanges || [],
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
		productRanges: [
			{
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
