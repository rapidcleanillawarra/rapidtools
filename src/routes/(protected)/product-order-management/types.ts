/**
 * Types for Product & Order Management
 */

export interface ProductDisableFormData {
  sku: string;
  replacementProductSku: string;
}

export interface OrderDeleteFormData {
  orderId: string;
  reason: string;
}

export const emptyProductDisableForm: ProductDisableFormData = {
  sku: '',
  replacementProductSku: ''
};

export const emptyOrderDeleteForm: OrderDeleteFormData = {
  orderId: '',
  reason: ''
};
