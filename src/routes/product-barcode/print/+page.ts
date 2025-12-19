import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url, fetch }) => {
    const skusParam = url.searchParams.get('skus');
    if (!skusParam) {
        return {
            products: [],
            error: 'No SKUs provided'
        };
    }

    const skus = skusParam.split(',').filter(Boolean);

    try {
        // Using the same Power Automate endpoint as update-product-pricing
        const filterProductsUrl = 'https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=pPhk80gODQOi843ixLjZtPPWqTeXIbIt9ifWZP6CJfY';

        const response = await fetch(filterProductsUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                Filter: {
                    SKU: skus,
                    IsActive: true,
                    OutputSelector: ["SKU", "Model", "Brand", "RRP", "Images"]
                },
                action: "GetItem"
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch products: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.Ack !== 'Success' || !data.Item) {
            return {
                products: [],
                error: 'Failed to find products'
            };
        }

        const items = Array.isArray(data.Item) ? data.Item : [data.Item];

        return {
            products: items.map((item: any) => ({
                sku: item.SKU,
                name: item.Model,
                brand: item.Brand,
                rrp: item.RRP,
                image: item.Images?.[0]?.URL || null
            }))
        };
    } catch (error) {
        console.error('Error loading barcode products:', error);
        return {
            products: [],
            error: error instanceof Error ? error.message : 'An unknown error occurred'
        };
    }
};
