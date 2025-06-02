import type { ServerLoad } from '@sveltejs/kit';

interface PriceGroupDetail {
  Multiple: string;
  Price: string;
  MaximumQuantity: string;
  MinimumQuantity: string;
  MultipleStartQuantity: string;
  Group: string;
  GroupID: string;
}

interface ProductItem {
  PrimarySupplier: string;
  Categories: string[];
  RRP: string;
  Model: string;
  InventoryID: string;
  Brand: string;
  Misc09: string;
  DefaultPurchasePrice: string;
  PriceGroups: Array<{
    PriceGroup: PriceGroupDetail[];
  }>;
  SKU: string;
  Misc02: string;
}

interface ApiResponse {
  Item: ProductItem[];
  CurrentTime: string;
  Ack: string;
}

export const load: ServerLoad = async ({ fetch }: { fetch: typeof globalThis.fetch }) => {
  console.log('\n========== SERVER LOAD START ==========');
  console.log('🕒 Server-side load function called at:', new Date().toISOString());
  try {
    const url = 'https://prod-19.australiasoutheast.logic.azure.com:443/workflows/67422be18c5e4af0ad9291110dedb2fd/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=N_VRTyaFEkOUGjtwu8O56_L-qY6xwvHuGWEOvqKsoAk';
    console.log('🌐 API URL:', url);
    
    const requestBody = {
      Filter: {
        SKU: "",
        Active: true,
        OutputSelector: [
          "SKU",
          "Model",
          "Categories",
          "Brand",
          "PrimarySupplier",
          "RRP",
          "DefaultPurchasePrice",
          "PriceGroups",
          "Misc02",
          "Misc09",
          "InventoryID"
        ]
      }
    };
    console.log('📤 Request Body:', JSON.stringify(requestBody, null, 2));
    
    console.log('⏳ Making API request...');
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📥 Response received');
    console.log('Status:', response.status, response.statusText);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Response not OK. Error text:', errorText);
      throw new Error(`Failed to load products: ${response.status} ${response.statusText}. Error: ${errorText}`);
    }

    const responseText = await response.text();
    console.log('📄 Raw response text:', responseText);
    
    const data = JSON.parse(responseText) as ApiResponse;
    console.log('✅ Parsed API response:', {
      status: response.status,
      dataReceived: !!data,
      itemCount: data.Item?.length || 0,
      ack: data.Ack,
      currentTime: data.CurrentTime,
      firstItem: data.Item?.[0] ? JSON.stringify(data.Item[0], null, 2) : 'No items'
    });

    if (!data.Item) {
      console.warn('⚠️ No Item array in response');
      return { products: [] };
    }

    console.log('🔄 Transforming data...');
    const products = (data.Item || []).map((item: ProductItem) => {
      const clientPrice = item.PriceGroups?.[0]?.PriceGroup?.find(
        pg => pg.Group === "Default Client Group" || pg.GroupID === "2"
      )?.Price || '0';

      const transformed = {
        sku: item.SKU || '',
        product_name: item.Model || '',
        brand: item.Brand || '',
        primary_supplier: item.PrimarySupplier || '',
        category: Array.isArray(item.Categories) ? item.Categories[0] || '' : '',
        purchase_price: parseFloat(item.DefaultPurchasePrice || '0'),
        client_mup: parseFloat(item.Misc02 || '0'),
        retail_mup: parseFloat(item.Misc09 || '0'),
        client_price: parseFloat(clientPrice),
        rrp: parseFloat(item.RRP || '0'),
        inventory_id: item.InventoryID || ''
      };
      return transformed;
    });

    console.log('✨ Final products array length:', products.length);
    if (products.length > 0) {
      console.log('📝 Sample product:', JSON.stringify(products[0], null, 2));
    }
    console.log('========== SERVER LOAD END ==========\n');
    
    return {
      products
    };
  } catch (err: unknown) {
    const error = err as Error;
    console.error('❌ ========== SERVER LOAD ERROR ==========');
    console.error('Error loading products:', error);
    console.error('Full error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    console.error('========== SERVER LOAD ERROR END ==========\n');
    return {
      products: []
    };
  }
}; 