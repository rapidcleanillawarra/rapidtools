/**
 * Types for Product & Order Management
 */

export interface ProductDisableFormData {
  sku: string;
  reason: string;
}

export interface OrderDeleteFormData {
  orderId: string;
  reason: string;
}

export const emptyProductDisableForm: ProductDisableFormData = {
  sku: '',
  reason: ''
};

export const emptyOrderDeleteForm: OrderDeleteFormData = {
  orderId: '',
  reason: ''
};
