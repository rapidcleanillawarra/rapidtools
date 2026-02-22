import type { DisabledProduct } from './types';
import type { SortField } from './stores';

export function getSortIcon(
  field: SortField,
  currentSortField: SortField,
  direction: 'asc' | 'desc'
): string {
  if (currentSortField !== field) return '↕';
  return direction === 'asc' ? '↑' : '↓';
}

export function sortData(
  data: DisabledProduct[],
  field: keyof DisabledProduct,
  direction: 'asc' | 'desc'
): DisabledProduct[] {
  return [...data].sort((a, b) => {
    const valueA = a[field];
    const valueB = b[field];

    if (typeof valueA === 'number' && typeof valueB === 'number') {
      return direction === 'asc' ? valueA - valueB : valueB - valueA;
    }
    if (valueA instanceof Date && valueB instanceof Date) {
      return direction === 'asc'
        ? valueA.getTime() - valueB.getTime()
        : valueB.getTime() - valueA.getTime();
    }

    const strA = String(valueA ?? '').toLowerCase();
    const strB = String(valueB ?? '').toLowerCase();
    return direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
  });
}

export function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return iso;
  }
}
