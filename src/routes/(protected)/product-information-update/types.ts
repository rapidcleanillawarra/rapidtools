export interface ProductInfo {
  id: string;
  image?: string;
  images?: ProductImage[];
  sku: string;
  name: string;
  subtitle?: string;
  brand: string;
  description?: string;
  short_description?: string;
  specifications?: string;
  features?: string;
  categories?: string[];
  category_1?: string;
  search_keywords?: string | string[];
  seo_page_title?: string;
  seo_meta_description?: string;
  seo_page_heading?: string;
  // Category management
  categoryOperations?: CategoryOperation[];
  // Image management
  imageOperations?: ImageOperation[];
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

export interface CategoryOperation {
  CategoryID: string;
  Delete?: boolean;
}

export interface ProductCategories {
  Category: CategoryOperation[];
}

export interface ProductImage {
  Name: string;
  URL: string;
  Timestamp?: string;
  ThumbURL?: string;
  MediumThumbURL?: string;
}

export interface ImageOperation {
  Name: string;
  URL?: string;
  Delete?: boolean;
  // For new uploads (not yet saved to server)
  file?: File;
  localPreviewUrl?: string;
}