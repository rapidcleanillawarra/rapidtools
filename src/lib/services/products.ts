/**
 * Products API service functions
 */

export interface ProductApiData {
  CurrentTime?: string;
  Ack?: string;
  Item?: Array<{
    SKU: string;
    Model?: string;
    Categories?: Array<{
      Category: any; // Can be object or array
    }>;
    Subtitle?: string;
    Description?: string;
    ShortDescription?: string;
    Specifications?: string;
    Features?: string;
    SearchKeywords?: string;
    SEOPageTitle?: string;
    SEOMetaDescription?: string;
    SEOPageHeading?: string;
    Images?: Array<{
      URL: string;
      Timestamp?: string;
      ThumbURL?: string;
      MediumThumbURL?: string;
      Name?: string;
    }>;
    InventoryID?: string;
  }>;
  [key: string]: any;
}

// Helper function to extract category names from the nested structure
export function extractCategories(categories?: Array<{ Category: any }>): string[] {
  if (!categories || !Array.isArray(categories)) return [];

  const categoryNames: string[] = [];

  for (const categoryWrapper of categories) {
    const categoryData = categoryWrapper.Category;

    if (Array.isArray(categoryData)) {
      // Multiple categories: Category is an array
      categoryData.forEach(cat => {
        if (cat.CategoryName) {
          categoryNames.push(cat.CategoryName);
        }
      });
    } else if (categoryData && typeof categoryData === 'object' && categoryData.CategoryName) {
      // Single category: Category is an object
      categoryNames.push(categoryData.CategoryName);
    }
  }

  return categoryNames;
}

const PRODUCTS_API_URL = 'https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=pPhk80gODQOi843ixLjZtPPWqTeXIbIt9ifWZP6CJfY';

export async function fetchProducts(brand?: string | null, page: number = 0): Promise<ProductApiData> {
  try {
    const payload: any = {
      "Filter": {
        "IsActive": true,
        "Page": page,
        "Limit": 100,
        "OutputSelector": [
          "SKU",
          "Model",
          "Categories",
          "Subtitle",
          "Description",
          "ShortDescription",
          "Specifications",
          "Features",
          "SearchKeywords",
          "SEOPageTitle",
          "SEOMetaDescription",
          "SEOPageHeading",
          "Images"
        ]
      },
      "action": "GetItem"
    };

    // Use brand filter if provided, otherwise don't filter by SKU
    if (brand) {
      payload.Filter.Brand = [brand];
    }

    const response = await fetch(PRODUCTS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }

    const data: ProductApiData = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
}

export async function updateProduct(productId: string, updateData: any): Promise<any> {
  try {
    const payload = {
      "Filter": {
        "SKU": productId,
        ...updateData
      },
      "action": "UpdateItem"
    };

    const response = await fetch(PRODUCTS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Product updated successfully:', data);
    return data;
  } catch (error) {
    console.error('Error updating product:', error);
    throw error;
  }
}