export interface ProductRequest {
  id: string;
  requestor_firstName: string;
  requestor_lastName: string;
  requestor_email: string;
  sku: string;
  product_name: string;
  brand: string;
  primary_supplier: string;
  category: string;
  purchase_price: number;
  client_mup: number;
  retail_mup: number;
  client_price: number;
  rrp: number;
  status: 'request' | 'approved' | 'rejected' | 'delete' | 'product_created';
  tax_included?: boolean;
  product_creation_date?: string;
}

export interface Brand {
  id: string;
  name: string;
  value: string;
  label: string;
}

export interface Supplier {
  id: string;
  name: string;
  value: string;
  label: string;
}

export interface Category {
  id: string;
  name: string;
  value: string;
  label: string;
}

export interface Markup {
  id: string;
  brand: string;
  main_category: string;
  sub_category: string;
  description: string;
  rrp_markup: number;
} 