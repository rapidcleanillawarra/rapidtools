import { writable } from 'svelte/store';
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

// Column visibility stores
export const visibleColumns = writable<Record<keyof ProductInfo, boolean>>({
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
});

// Computed: paginated data
export const paginatedData = writable<ProductInfo[]>([]);

// Update paginatedData when dependencies change
let currentTableData: ProductInfo[] = [];
let currentPageValue = 1;
let currentItemsPerPage = 10;

tableData.subscribe(data => {
  currentTableData = data;
  updatePaginatedData();
});

currentPage.subscribe(page => {
  currentPageValue = page;
  updatePaginatedData();
});

itemsPerPage.subscribe(items => {
  currentItemsPerPage = items;
  updatePaginatedData();
});

function updatePaginatedData() {
  const startIndex = (currentPageValue - 1) * currentItemsPerPage;
  const endIndex = startIndex + currentItemsPerPage;
  paginatedData.set(currentTableData.slice(startIndex, endIndex));
}
