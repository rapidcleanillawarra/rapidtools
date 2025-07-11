import { writable, derived } from 'svelte/store';
import type { ProMaxProduct } from './types';

// Core Data Stores
export const originalData = writable<ProMaxProduct[]>([]);
export const tableData = writable<ProMaxProduct[]>([]);

// UI State Stores
export const isLoading = writable<boolean>(true);
export const error = writable<string | null>(null);
export const isModalOpen = writable<boolean>(false);

// Pagination Stores
export const currentPage = writable<number>(1);
export const itemsPerPage = writable<number>(10);

// Sorting Stores
export const sortField = writable<keyof ProMaxProduct | ''>('');
export const sortDirection = writable<'asc' | 'desc'>('asc');

// Search Stores
export const searchFilters = writable<Partial<Record<keyof ProMaxProduct, string>>>({});

// Derived Store for Paginated Data
export const paginatedData = derived(
  [tableData, currentPage, itemsPerPage],
  ([$tableData, $currentPage, $itemsPerPage]) => {
    const startIndex = ($currentPage - 1) * $itemsPerPage;
    const endIndex = startIndex + $itemsPerPage;
    return $tableData.slice(startIndex, endIndex);
  }
); 