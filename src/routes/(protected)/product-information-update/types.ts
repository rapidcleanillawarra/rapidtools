export interface ProductInfo {
  id: string;
  image?: string;
  sku: string;
  name: string;
  subtitle?: string;
  brand: string;
  description?: string;
  short_description?: string;
  specifications?: string;
  features?: string;
  category_1?: string;
  search_keywords?: string;
  seo_page_title?: string;
  seo_meta_description?: string;
  seo_page_heading?: string;
}

export interface Brand {
  id: string;
  name: string;
  value: string;
  label: string;
  contentId: string;
}

export interface CategoryTreeNode {
  id: string;
  name: string;
  label: string;
  value: string;
  categoryId: string;
  parentCategoryId: string;
  children?: CategoryTreeNode[];
  level: number;
  path: string;
}