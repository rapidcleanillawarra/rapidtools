import type { ProductInfo } from './types';
import { extractCategories } from '$lib/services/products';

/**
 * Transform raw API product data to ProductInfo interface
 * Optimized for consistent data transformation across the app
 */
export function transformProductData(product: any, brandName?: string): ProductInfo {
  const categories = extractCategories(product.Categories);
  
  return {
    id: product.SKU,
    sku: product.SKU,
    name: product.Model || '',
    brand: brandName || '',
    image: product.Images?.[0]?.URL, // Keep for backward compatibility (first image)
    images: product.Images || [], // Store all images
    subtitle: product.Subtitle,
    description: product.Description,
    short_description: product.ShortDescription,
    specifications: product.Specifications,
    features: product.Features,
    categories: categories.length > 0 ? categories : undefined,
    category_1: categories[0],
    search_keywords: product.SearchKeywords,
    seo_page_title: product.SEOPageTitle,
    seo_meta_description: product.SEOMetaDescription,
    seo_page_heading: product.SEOPageHeading
  };
}

/**
 * Transform array of products
 */
export function transformProductsData(products: any[], brandName?: string): ProductInfo[] {
  return products.map(product => transformProductData(product, brandName));
}

