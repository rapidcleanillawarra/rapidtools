/**
 * Product & Order Management API service functions
 */

import { supabase } from '$lib/supabase';
import type { DisabledProduct } from './types';

const PRODUCTS_API_URL = 'https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=pPhk80gODQOi843ixLjZtPPWqTeXIbIt9ifWZP6CJfY';

const DISABLED_PRODUCTS_TABLE = 'disabled_products';

export async function disableProduct(sku: string, replacementProductSku: string, reason: string = ''): Promise<any> {
  if (!sku) {
    throw new Error('SKU is required for product disable operation');
  }

  if (!replacementProductSku) {
    throw new Error('Replacement product SKU is required for product disable operation');
  }

  try {
    const payload = {
      "Item": [
        {
          "SKU": sku,
          "Approved": false,
          "Active": false,
          "IsActive": false,
          "ApprovedForMobileStore": false,
          "ApprovedForPOS": true
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
    console.log('API Response:', data);

    // Check API response status
    if (data.Ack === 'Success') {
      console.log('Product disabled successfully:', data);
      // Save to Supabase for audit/log
      const { error: insertError } = await supabase.from(DISABLED_PRODUCTS_TABLE).insert({
        sku: sku.trim(),
        replacement_product_sku: replacementProductSku.trim(),
        reason: reason?.trim() || null
      });
      if (insertError) {
        console.error('Failed to save disabled product to Supabase:', insertError);
        // Don't throw - API succeeded; log only
      }
      return data;
    } else if (data.Ack === 'Warning' && data.Messages?.Warning?.Message) {
      throw new Error(data.Messages.Warning.Message);
    } else {
      throw new Error('Unknown API response format');
    }
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
    const payload = {
      "Order": [
        {
          "OrderID": orderId,
          "OrderStatus": "Cancelled"
        }
      ],
      "action": "UpdateOrder"
    };

    console.log('Cancelling order with payload:', payload);

    const response = await fetch(PRODUCTS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`DeleteOrder API call failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('API Response:', data);

    // Check API response status
    if (data.Ack === 'Success') {
      console.log('Order cancelled successfully:', data);
      return data;
    } else if (data.Ack === 'Warning' && data.Messages?.Warning?.Message) {
      throw new Error(data.Messages.Warning.Message);
    } else {
      throw new Error('Unknown API response format');
    }
  } catch (error) {
    console.error('Error cancelling order:', error);
    throw error;
  }
}

export async function fetchDisabledProducts(): Promise<DisabledProduct[]> {
  const { data, error } = await supabase
    .from(DISABLED_PRODUCTS_TABLE)
    .select('id, sku, replacement_product_sku, reason, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching disabled products:', error);
    throw error;
  }
  return (data ?? []) as DisabledProduct[];
}

export async function updateDisabledProductReason(id: string, reason: string | null): Promise<void> {
  const { error } = await supabase
    .from(DISABLED_PRODUCTS_TABLE)
    .update({ reason: reason?.trim() || null })
    .eq('id', id);

  if (error) {
    console.error('Error updating disabled product reason:', error);
    throw error;
  }
}
