import { writable, derived } from 'svelte/store';
import type { ProductInfo } from './types';

// Data stores
export const originalData = writable<ProductInfo[]>([]);
export const tableData = writable<ProductInfo[]>([]);
export const isLoading = writable(false);

// Pagination stores
export const currentPage = writable(1);
export const itemsPerPage = writable(10);

// Sorting stores
export const sortField = writable<keyof ProductInfo>('name');
export const sortDirection = writable<'asc' | 'desc'>('asc');

// Search/filter stores
export const searchFilters = writable<Record<string, string>>({});

// Selected brand
export const selectedBrand = writable<string>('');

// Column visibility stores with localStorage persistence
const defaultVisibleColumns: Record<keyof ProductInfo, boolean> = {
  id: false, // Hidden by default as it's internal
  image: true,
  sku: true,
  name: true,
  subtitle: false,
  brand: true,
  description: false,
  short_description: false,
  specifications: false,
  features: false,
  category_1: false,
  seo_page_title: false,
  seo_meta_description: false,
  seo_page_heading: false,
};

// Load from localStorage or use defaults
const storedVisibility = typeof window !== 'undefined' ? localStorage.getItem('product-info-visible-columns') : null;
const initialVisibility = storedVisibility ? JSON.parse(storedVisibility) : defaultVisibleColumns;

export const visibleColumns = writable<Record<keyof ProductInfo, boolean>>(initialVisibility);

// Save to localStorage when visibility changes
visibleColumns.subscribe(value => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('product-info-visible-columns', JSON.stringify(value));
  }
});

// Computed: paginated data using derived store (optimized)
export const paginatedData = derived(
  [tableData, currentPage, itemsPerPage],
  ([$tableData, $currentPage, $itemsPerPage]) => {
    const startIndex = ($currentPage - 1) * $itemsPerPage;
    const endIndex = startIndex + $itemsPerPage;
    return $tableData.slice(startIndex, endIndex);
  }
);
