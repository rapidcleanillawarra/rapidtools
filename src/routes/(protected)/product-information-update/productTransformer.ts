import type { ProductInfo } from './types';
import { extractCategories } from '$lib/services/products';
import { formatTimestampForImageUrl } from './utils';

/**
 * Transform raw API product data to ProductInfo interface
 * Optimized for consistent data transformation across the app
 */
export function transformProductData(product: any, brandName?: string): ProductInfo {
  const categories = extractCategories(product.Categories);

  // Find the main image and format its URL with timestamp
  let mainImageUrl = '';
  const images = product.Images || [];

  // Look for the main image (Name: "Main")
  const mainImage = images.find((img: any) => img.Name === 'Main');
  if (mainImage?.URL && mainImage?.Timestamp) {
    const timestampParam = formatTimestampForImageUrl(mainImage.Timestamp);
    mainImageUrl = timestampParam ? `${mainImage.URL}?${timestampParam}` : mainImage.URL;
  } else if (images.length > 0) {
    // Fallback to first image if no main image found
    mainImageUrl = images[0]?.URL || '';
  }

  return {
    id: product.SKU,
    sku: product.SKU,
    name: product.Model || '',
    brand: brandName || '',
    image: mainImageUrl, // Use the processed main image URL
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

