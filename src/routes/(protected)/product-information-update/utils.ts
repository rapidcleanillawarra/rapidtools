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

// Global cache for category tree to avoid rebuilding on every render
let categoryTreeCache: CategoryTreeNode[] | null = null;
let categoryIdToPathMap: Map<string, string> | null = null;

export function getCellContent(product: ProductInfo, column: ColumnConfig, categories?: CategoryFlat[]): string {
  const value = product[column.key];

  if (column.renderType === 'text') {
    if (column.key === 'category_1') {
      // If we have categories data, try to resolve the full path
      if (categories && categories.length > 0) {
        if (!categoryTreeCache) {
          categoryTreeCache = buildCategoryHierarchy(categories);
        }
        if (!categoryIdToPathMap) {
          categoryIdToPathMap = new Map();
          flattenCategoryTree(categoryTreeCache).forEach(cat => {
            categoryIdToPathMap!.set(cat.id, cat.path);
          });
        }
        const categoryId = value as string;
        return categoryIdToPathMap.get(categoryId) || value || '-';
      }
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
