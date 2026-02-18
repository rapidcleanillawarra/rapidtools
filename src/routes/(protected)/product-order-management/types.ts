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

export const emptyProductDisableForm: ProductDisableFormData = {
  sku: '',
  replacementProductSku: '',
  reason: ''
};

export const emptyOrderDeleteForm: OrderDeleteFormData = {
  orderId: '',
  reason: ''
};
