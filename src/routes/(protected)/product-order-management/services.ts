/**
 * Product & Order Management API service functions
 */

import { cancelOrder } from '$lib/services/maropost';

const PRODUCTS_API_URL = 'https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=pPhk80gODQOi843ixLjZtPPWqTeXIbIt9ifWZP6CJfY';

export async function disableProduct(sku: string, reason: string): Promise<any> {
  if (!sku) {
    throw new Error('SKU is required for product disable operation');
  }

  if (!reason) {
    throw new Error('Reason is required for product disable operation');
  }

  try {
    const payload = {
      "Item": [
        {
          "SKU": sku,
          "IsActive": false,
          "Notes": `Disabled: ${reason}`
        }
      ],
      "action": "UpdateItem"
    };

    console.log('Disabling product with payload:', payload);

    const response = await fetch(PRODUCTS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`DisableProduct API call failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Product disabled successfully:', data);
    return data;
  } catch (error) {
    console.error('Error disabling product:', error);
    throw error;
  }
}

export async function deleteOrder(orderId: string, reason: string): Promise<any> {
  if (!orderId) {
    throw new Error('Order ID is required for order deletion');
  }

  if (!reason) {
    throw new Error('Reason is required for order deletion');
  }

  try {
    console.log(`Deleting order ${orderId} with reason: ${reason}`);

    // Use the existing cancelOrder function from maropost service
    // Note: This actually sets the order status to "Cancelled" rather than completely deleting it
    // Complete deletion might require a different API endpoint
    const result = await cancelOrder(orderId);

    console.log('Order deletion completed:', result);
    return result;
  } catch (error) {
    console.error('Error deleting order:', error);
    throw error;
  }
}
