import { writable, derived } from 'svelte/store';
import type { DisabledProduct } from './types';

export const originalData = writable<DisabledProduct[]>([]);
export const tableData = writable<DisabledProduct[]>([]);
export const isLoading = writable<boolean>(true);
export const tableError = writable<string | null>(null);

export const currentPage = writable<number>(1);
export const itemsPerPage = writable<number>(10);

export type SortField = keyof DisabledProduct | '';
export const sortField = writable<SortField>('created_at');
export const sortDirection = writable<'asc' | 'desc'>('desc');

/** Single global search term; filters across sku, replacement_product_sku, reason */
export const searchQuery = writable<string>('');

export const paginatedData = derived(
  [tableData, currentPage, itemsPerPage],
  ([$tableData, $currentPage, $itemsPerPage]) => {
    const start = ($currentPage - 1) * $itemsPerPage;
    return $tableData.slice(start, start + $itemsPerPage);
  }
);

export const totalPages = derived(
  [tableData, itemsPerPage],
  ([$tableData, $itemsPerPage]) =>
    Math.max(1, Math.ceil($tableData.length / $itemsPerPage))
);
