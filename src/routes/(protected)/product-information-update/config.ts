import type { ProductInfo } from './types';

export type ColumnConfig = {
  key: keyof ProductInfo;
  displayName: string;
  pillName: string;
  hasSearch: boolean;
  renderType: 'text' | 'image' | 'boolean-icon';
};

export const columns: ColumnConfig[] = [
  { key: 'image', displayName: 'Img', pillName: 'Image', hasSearch: false, renderType: 'image' },
  { key: 'sku', displayName: 'SKU', pillName: 'SKU', hasSearch: true, renderType: 'text' },
  { key: 'name', displayName: 'Name', pillName: 'Name', hasSearch: true, renderType: 'text' },
  { key: 'brand', displayName: 'Brand', pillName: 'Brand', hasSearch: true, renderType: 'text' },
  { key: 'category_1', displayName: 'Categories', pillName: 'Categories', hasSearch: true, renderType: 'text' },
  { key: 'subtitle', displayName: 'Sub', pillName: 'Subtitle', hasSearch: false, renderType: 'boolean-icon' },
  { key: 'search_keywords', displayName: 'Keys', pillName: 'Keywords', hasSearch: false, renderType: 'boolean-icon' },
  { key: 'description', displayName: 'Desc', pillName: 'Description', hasSearch: false, renderType: 'boolean-icon' },
  { key: 'short_description', displayName: 'SD', pillName: 'Short Description', hasSearch: false, renderType: 'boolean-icon' },
  { key: 'specifications', displayName: 'Specs', pillName: 'Specifications', hasSearch: false, renderType: 'boolean-icon' },
  { key: 'features', displayName: 'Feat', pillName: 'Features', hasSearch: false, renderType: 'boolean-icon' },
  { key: 'seo_page_title', displayName: 'SEO Title', pillName: 'SEO Page Title', hasSearch: false, renderType: 'boolean-icon' },
  { key: 'seo_meta_description', displayName: 'SEO Desc', pillName: 'SEO Meta Description', hasSearch: false, renderType: 'boolean-icon' },
  { key: 'seo_page_heading', displayName: 'SEO Head', pillName: 'SEO Page Heading', hasSearch: false, renderType: 'boolean-icon' },
];

export const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100];
export const PRODUCTS_PER_API_PAGE = 100;

