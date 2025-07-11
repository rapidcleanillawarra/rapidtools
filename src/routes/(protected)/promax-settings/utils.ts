import type { ProMaxProduct } from './types';

/**
 * Gets a visual indicator for the current sort status of a column.
 */
export function getSortIcon(field: keyof ProMaxProduct, currentSortField: string, direction: 'asc' | 'desc'): string {
  if (currentSortField !== field) return '↕️';
  return direction === 'asc' ? '↑' : '↓';
}

/**
 * Sorts an array of data based on a specified field and direction.
 */
export function sortData(
  data: ProMaxProduct[],
  field: keyof ProMaxProduct,
  direction: 'asc' | 'desc'
): ProMaxProduct[] {
  return [...data].sort((a, b) => {
    const valueA = a[field];
    const valueB = b[field];
    
    // Default to string comparison
    const strA = String(valueA).toLowerCase();
    const strB = String(valueB).toLowerCase();
    return direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
  });
} 