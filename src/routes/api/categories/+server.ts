import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  try {
    const payload = {
      "Filter": {
        "Active": true,
        "OutputSelector": [
          "ParentCategoryID",
          "CategoryName"
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

    const data = await response.json();
    console.log('Response data received successfully');

    return json(data);
  } catch (err) {
    console.error('Error fetching categories:', err);
    if (err instanceof Error) {
      console.error('Error message:', err.message);
      console.error('Error stack:', err.stack);
    }
    throw error(500, `Failed to fetch categories: ${err instanceof Error ? err.message : String(err)}`);
  }
};