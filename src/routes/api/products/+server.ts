import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchProducts, extractCategories } from '$lib/services/products';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const brand = url.searchParams.get('brand');

    const productData = await fetchProducts(brand);

    // Transform the API response to match the expected format
    const products = productData.Item?.map(product => {
      const categories = extractCategories(product.Categories);
      const imageUrl = product.Images?.[0]?.URL || null;

      return {
        id: product.SKU,
        sku: product.SKU,
        name: product.Model || '',
        brand: brand || '',
        image: imageUrl,
        subtitle: product.Subtitle || false,
        description: product.Description || false,
        short_description: product.ShortDescription || false,
        specifications: product.Specifications || false,
        features: product.Features || false,
        category_1: categories[0] || '',
        seo_page_title: product.SEOPageTitle || false,
        seo_meta_description: product.SEOMetaDescription || false,
        seo_page_heading: product.SEOPageHeading || false
      };
    }) || [];

    return json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return json({
      success: false,
      error: 'Failed to fetch products'
    }, { status: 500 });
  }
};
