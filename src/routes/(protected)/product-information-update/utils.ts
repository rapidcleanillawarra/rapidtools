import type { ProductInfo } from './types';
import type { ColumnConfig } from './config';

export function getSortIcon(field: keyof ProductInfo, currentField: keyof ProductInfo, direction: 'asc' | 'desc'): string {
  if (field !== currentField) {
    return '↕️';
  }
  return direction === 'asc' ? '↑' : '↓';
}

export function sortData<T extends Record<string, any>>(
  data: T[],
  field: keyof T,
  direction: 'asc' | 'desc'
): T[] {
  return [...data].sort((a, b) => {
    const aValue = a[field];
    const bValue = b[field];

    // Handle null/undefined values
    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return direction === 'asc' ? 1 : -1;
    if (bValue == null) return direction === 'asc' ? -1 : 1;

    // Handle string comparison
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      const comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase());
      return direction === 'asc' ? comparison : -comparison;
    }

    // Handle number comparison
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return direction === 'asc' ? aValue - bValue : bValue - aValue;
    }

    // Default string comparison
    const aStr = String(aValue).toLowerCase();
    const bStr = String(bValue).toLowerCase();
    const comparison = aStr.localeCompare(bStr);
    return direction === 'asc' ? comparison : -comparison;
  });
}

export function getCellContent(product: ProductInfo, column: ColumnConfig): string {
  const value = product[column.key];
  
  if (column.renderType === 'text') {
    if (column.key === 'category_1') {
      return value || '-';
    }
    return value as string;
  }
  
  return value as string;
}

export function exportToCSV(
  data: ProductInfo[],
  columns: ColumnConfig[],
  visibleColumns: Record<keyof ProductInfo, boolean>,
  includeAllColumns: boolean,
  selectedBrand: string
): { success: boolean; message?: string } {
  if (data.length === 0) {
    return { success: false, message: 'No data to export' };
  }

  const columnsToExport = includeAllColumns
    ? columns
    : columns.filter(col => visibleColumns[col.key]);

  const headers = columnsToExport.map(col => `"${col.displayName}"`);
  const rows = data.map(product => 
    columnsToExport.map(col => {
      const value = product[col.key];
      const stringValue = value == null ? '' : String(value);
      return `"${stringValue.replace(/"/g, '""')}"`;
    })
  );

  const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  const filenameSuffix = includeAllColumns ? 'all-columns' : 'visible-columns';
  const date = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `product-information-${selectedBrand || 'all'}-${filenameSuffix}-${date}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  const columnType = includeAllColumns ? 'all columns' : 'visible columns only';
  return { success: true, message: `Exported ${data.length} products (${columnType}) to CSV` };
}

export function filterProducts(
  products: ProductInfo[],
  searchFilters: Record<string, string>
): ProductInfo[] {
  let filtered = products;
  
  for (const [key, value] of Object.entries(searchFilters)) {
    if (value) {
      filtered = filtered.filter(item =>
        String(item[key as keyof ProductInfo]).toLowerCase().includes(value.toLowerCase())
      );
    }
  }
  
  return filtered;
}
