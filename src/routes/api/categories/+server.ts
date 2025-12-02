import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface PowerAutomateCategory {
  CategoryID: string;
  CategoryName: string;
  ParentCategoryID: string;
}

interface PowerAutomateResponse {
  Category?: PowerAutomateCategory[];
  [key: string]: any;
}

interface CategoryFlat {
  id: string;
  name: string;
  parentId: string;
  value: string;
  label: string;
  categoryId: string;
  parentCategoryId: string;
}

export const GET: RequestHandler = async () => {
  try {
    const payload = {
      "Filter": {
        "Active": true,
        "OutputSelector": [
          "ParentCategoryID",
          "CategoryName",
          "CategoryID"
        ]
      },
      "action": "GetCategory"
    };

    console.log('Making API call with payload:', JSON.stringify(payload, null, 2));

    const url = 'https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=pPhk80gODQOi843ixLjZtPPWqTeXIbIt9ifWZP6CJfY';
    console.log('API URL:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Response error text:', errorText);
      throw error(response.status, `HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const powerAutomateData: PowerAutomateResponse = await response.json();
    console.log('Response data received successfully:', powerAutomateData);

    // Transform Power Automate response to expected format
    if (!powerAutomateData.Category || !Array.isArray(powerAutomateData.Category)) {
      console.error('Invalid response structure:', powerAutomateData);
      throw error(500, 'Invalid response structure from Power Automate API');
    }

    const categories: CategoryFlat[] = powerAutomateData.Category.map((cat: PowerAutomateCategory) => ({
      id: cat.CategoryID,
      name: cat.CategoryName,
      parentId: cat.ParentCategoryID || '0',
      value: cat.CategoryID,
      label: cat.CategoryName,
      categoryId: cat.CategoryID,
      parentCategoryId: cat.ParentCategoryID || '0'
    }));

    console.log('Transformed categories:', categories.length, 'categories');

    return json({
      success: true,
      data: categories
    });
  } catch (err) {
    console.error('Error fetching categories:', err);
    if (err instanceof Error) {
      console.error('Error message:', err.message);
      console.error('Error stack:', err.stack);
    }
    throw error(500, `Failed to fetch categories: ${err instanceof Error ? err.message : String(err)}`);
  }
};