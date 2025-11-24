import type { ProductInfo, CategoryTreeNode } from './types';
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

/**
 * Optimized category cache with proper invalidation
 * Prevents unnecessary rebuilds while maintaining data freshness
 */
class CategoryCache {
  private treeCache: CategoryTreeNode[] | null = null;
  private pathMap: Map<string, string> | null = null;
  private sourceData: CategoryFlat[] | null = null;

  build(categories: CategoryFlat[]): void {
    // Only rebuild if data changed (reference equality check)
    if (this.sourceData === categories) return;
    
    this.sourceData = categories;
    this.treeCache = buildCategoryHierarchy(categories);
    this.pathMap = new Map();
    
    flattenCategoryTree(this.treeCache).forEach(cat => {
      this.pathMap!.set(cat.id, cat.path);
    });
  }

  getPath(categoryId: string): string | undefined {
    return this.pathMap?.get(categoryId);
  }

  clear(): void {
    this.treeCache = null;
    this.pathMap = null;
    this.sourceData = null;
  }

  getTree(): CategoryTreeNode[] | null {
    return this.treeCache;
  }
}

// Global category cache instance
const categoryCache = new CategoryCache();

export function getCellContent(product: ProductInfo, column: ColumnConfig, categories?: CategoryFlat[]): string {
  const value = product[column.key];

  if (column.renderType === 'text') {
    if (column.key === 'category_1') {
      // If we have categories data, try to resolve the full path
      if (categories && categories.length > 0) {
        categoryCache.build(categories);
        const categoryId = value as string;
        return categoryCache.getPath(categoryId) || (value as string) || '-';
      }
      return (value as string) || '-';
    }

    // Handle array properties that should display as text
    if (column.key === 'categories' || column.key === 'search_keywords') {
      const arrayValue = value as string[] | undefined;
      return arrayValue ? arrayValue.join(', ') : '-';
    }

    // Handle properties that shouldn't be displayed in table
    if (column.key === 'images' || column.key === 'categoryOperations' || column.key === 'imageOperations') {
      return '-';
    }

    return (value as string) || '';
  }

  return (value as string) || '';
}

/**
 * Clear the category cache (useful for testing or when data source changes)
 */
export function clearCategoryCache(): void {
  categoryCache.clear();
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

export interface CategoryFlat {
  id: string;
  name: string;
  parentId: string;
  value: string;
  label: string;
  categoryId: string;
  parentCategoryId: string;
}

export function buildCategoryHierarchy(categories: CategoryFlat[]): CategoryTreeNode[] {
  // Create a map for quick lookup
  const categoryMap = new Map<string, CategoryTreeNode>();
  const rootCategories: CategoryTreeNode[] = [];

  // First pass: create all nodes
  categories.forEach(cat => {
    const node: CategoryTreeNode = {
      id: cat.id,
      name: cat.name,
      label: cat.label,
      value: cat.value,
      categoryId: cat.categoryId,
      parentCategoryId: cat.parentCategoryId,
      children: [],
      level: 0,
      path: cat.name
    };
    categoryMap.set(cat.id, node);
  });

  // Second pass: build hierarchy
  categories.forEach(cat => {
    const node = categoryMap.get(cat.id)!;

    if (cat.parentId === '0') {
      // Root category
      rootCategories.push(node);
    } else {
      // Child category
      const parent = categoryMap.get(cat.parentId);
      if (parent) {
        parent.children!.push(node);
        node.level = parent.level + 1;
        node.path = `${parent.path} > ${node.name}`;
      }
    }
  });

  // Sort categories by name at each level
  const sortCategories = (nodes: CategoryTreeNode[]): void => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    nodes.forEach(node => {
      if (node.children && node.children.length > 0) {
        sortCategories(node.children);
      }
    });
  };

  sortCategories(rootCategories);

  return rootCategories;
}

export function flattenCategoryTree(nodes: CategoryTreeNode[], result: CategoryTreeNode[] = []): CategoryTreeNode[] {
  nodes.forEach(node => {
    result.push(node);
    if (node.children && node.children.length > 0) {
      flattenCategoryTree(node.children, result);
    }
  });
  return result;
}

export function findCategoryById(nodes: CategoryTreeNode[], id: string): CategoryTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    if (node.children && node.children.length > 0) {
      const found = findCategoryById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Convert UTC timestamp to Australian timezone and format as YYYYMMDDHHMMSS
 * Used for generating cache-busting query parameters for product images
 */
export function formatTimestampForImageUrl(timestamp: string): string {
  if (!timestamp) return '';

  // Parse UTC timestamp (format: "2025-11-24 12:47:51")
  const utcDate = new Date(timestamp + ' UTC');

  // Convert to Australian/Sydney timezone (handles daylight savings)
  const sydneyTime = utcDate.toLocaleString('en-AU', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  // Extract components and format as YYYYMMDDHHMMSS
  const match = sydneyTime.match(/(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})/);
  if (!match) return '';

  const [, day, month, year, hour, minute, second] = match;
  return `${year}${month}${day}${hour}${minute}${second}`;
}