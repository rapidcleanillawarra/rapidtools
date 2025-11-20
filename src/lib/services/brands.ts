/**
 * Brands API service functions
 */

export interface BrandApiData {
  CurrentTime?: string;
  Ack?: string;
  Content?: Array<{
    ContentID: string;
    ContentName: string;
  }>;
  [key: string]: any;
}

const BRANDS_API_URL = 'https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=pPhk80gODQOi843ixLjZtPPWqTeXIbIt9ifWZP6CJfY';

export async function fetchBrands(): Promise<BrandApiData> {
  try {
    const response = await fetch(BRANDS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        "Filter": {
          "Active": true,
          "ContentType": 10,
          "OutputSelector": [
            "ContentID",
            "ContentName"
          ]
        },
        "action": "GetContent"
      })
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }

    const data: BrandApiData = await response.json();
    console.log('Brands API data fetched successfully:', data);
    return data;
  } catch (error) {
    console.error('Error fetching brands:', error);
    throw error;
  }
}
