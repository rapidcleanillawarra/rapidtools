import { writable, derived } from 'svelte/store';
import type { CustomerGroup, PriceGroupProduct } from './types';

// Raw data stores
export const customerGroups = writable<CustomerGroup[]>([]);
export const products = writable<PriceGroupProduct[]>([]);

// Filter/selection stores
export const selectedCustomerGroupId = writable<number | null>(null);

// Loading states
export const isLoadingCustomerGroups = writable(false);
export const isLoadingProducts = writable(false);

// Derived stores
export const selectedCustomerGroup = derived(
	[customerGroups, selectedCustomerGroupId],
	([$customerGroups, $selectedCustomerGroupId]) => {
		if (!$selectedCustomerGroupId) return null;
		return $customerGroups.find((cg) => cg.id === $selectedCustomerGroupId) ?? null;
	}
);

// Derived store for filtered products (can add filtering logic here later)
export const filteredProducts = derived(products, $products => $products);

// --- Core Data Stores ---
// This will hold the data for the CURRENT page fetched from the server
export const tableData = writable<PriceGroupProduct[]>([]); // Holds the data currently being displayed (after search/filters)
export const totalItems = writable<number>(0);

// --- UI State Stores ---
export const error = writable<string | null>(null);

// --- Pagination Stores ---
export const currentPage = writable<number>(1);
export const itemsPerPage = writable<number>(10);

// --- Sorting Stores ---
export const sortField = writable<keyof PriceGroupProduct | ''>('sku');
export const sortDirection = writable<'asc' | 'desc'>('asc');

// --- Search Stores ---
export const searchFilters = writable<Partial<Record<keyof PriceGroupProduct, string>>>({});

// --- Derived Store for Paginated Data ---
// This automatically calculates the data for the current page
export const paginatedData = derived(
	[tableData, currentPage, itemsPerPage],
	([$tableData, $currentPage, $itemsPerPage]) => {
		const startIndex = ($currentPage - 1) * $itemsPerPage;
		const endIndex = startIndex + $itemsPerPage;
		return $tableData.slice(startIndex, endIndex);
	}
); 