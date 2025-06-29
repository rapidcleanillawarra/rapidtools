export interface CustomerGroup {
	id: number;
	name: string;
	code?: string;
}

export interface Product {
	id: string; // Maropost product ID
	sku: string;
	name: string;
	brand: string;
	category: string;
	primary_supplier: string;
	purchase_price: number;
	rrp: number;
	// Potentially other fields from Maropost
}

export interface CustomerGroupProduct {
	customerGroupId: string;
	productId: string;
	// This table would likely contain pricing overrides
	// For now, it just establishes the relationship
}

export interface PriceGroupProduct {
	inventory_id: number;
	sku: string;
	price_group_id: number;
	price: number;
	default_client_group: number | null;
	price_match: boolean;
	promotion_price: number | null;
	multiple: string | null;
	minimum_quantity: number | null;
	maximum_quantity: number | null;
	multiple_start_quantity: number | null;
	multilevel_bands: any | null; // We can make this more specific if you need to work with the JSON structure
	created_at: string;
	updated_at: string;
} 