/**
 * Types for Product & Order Management
 */

export interface ProductDisableFormData {
  sku: string;
  replacementProductSku: string;
  reason: string;
}

export interface OrderDeleteFormData {
  orderId: string;
  reason: string;
}

/** Row from disabled_products table (Supabase) */
export interface DisabledProduct {
  id: string;
  sku: string;
  replacement_product_sku: string;
  reason: string | null;
  created_at: string;
}

export const emptyProductDisableForm: ProductDisableFormData = {
  sku: '',
  replacementProductSku: '',
  reason: ''
};

export const emptyOrderDeleteForm: OrderDeleteFormData = {
  orderId: '',
  reason: ''
};
