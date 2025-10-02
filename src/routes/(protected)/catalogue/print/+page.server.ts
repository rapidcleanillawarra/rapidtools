import type { Actions } from './$types';
import type { CatalogueData } from './types';

export const actions: Actions = {
	default: async ({ request }) => {
		const data = await request.formData();
		const catalogueDataString = data.get('catalogueData') as string;

		if (catalogueDataString) {
			try {
				const parsedData = JSON.parse(catalogueDataString);

				// Ensure the data has the required structure
				const catalogueData: CatalogueData = {
					productRanges: parsedData.productRanges || [],
					printSettings: {
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
	}
};
