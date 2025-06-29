import type { PriceGroupProduct } from '../types';

/**
 * Gets a visual indicator for the current sort status of a column.
 */
export function getSortIcon(
	field: keyof PriceGroupProduct,
	currentSortField: string,
	direction: 'asc' | 'desc'
): string {
	if (currentSortField !== field) return '↕️';
	return direction === 'asc' ? '↑' : '↓';
}

/**
 * Sorts an array of data based on a specified field and direction.
 */
export function sortData(
	data: PriceGroupProduct[],
	field: keyof PriceGroupProduct,
	direction: 'asc' | 'desc'
): PriceGroupProduct[] {
	return [...data].sort((a, b) => {
		const valueA = a[field];
		const valueB = b[field];

		// Handle nulls and different data types
		if (valueA === null) return direction === 'asc' ? 1 : -1;
		if (valueB === null) return direction === 'asc' ? -1 : 1;

		if (typeof valueA === 'number' && typeof valueB === 'number') {
			return direction === 'asc' ? valueA - valueB : valueB - valueA;
		}

		// Default to string comparison
		const strA = String(valueA).toLowerCase();
		const strB = String(valueB).toLowerCase();
		return direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
	});
} 