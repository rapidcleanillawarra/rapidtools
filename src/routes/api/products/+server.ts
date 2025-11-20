import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { ProductInfo } from '../../../(protected)/product-information-update/types';

// Mock data - in a real application, this would come from a database
const mockProducts: ProductInfo[] = [
  {
    id: '1',
    image: 'https://example.com/image1.jpg',
    sku: 'RC-001',
    name: 'Rapid Clean All-Purpose Cleaner',
    subtitle: 'Professional Grade Cleaning Solution',
    brand: 'Rapid Clean',
    description: 'A powerful all-purpose cleaner that effectively removes dirt, grease, and grime from various surfaces.',
    short_description: 'Effective all-purpose cleaner',
    specifications: '500ml bottle, pH neutral, biodegradable',
    features: 'Non-toxic, streak-free, fast-acting',
    category_1: 'Cleaning Products',
    category_2: 'All-Purpose Cleaners',
    seo_page_title: 'Rapid Clean All-Purpose Cleaner - Professional Cleaning Solutions',
    seo_meta_description: 'Discover our professional all-purpose cleaner that delivers powerful cleaning performance.',
    seo_page_heading: 'All-Purpose Cleaner'
  },
  {
    id: '2',
    image: 'https://example.com/image2.jpg',
    sku: 'RC-002',
    name: 'Rapid Clean Glass Cleaner',
    subtitle: 'Crystal Clear Results',
    brand: 'Rapid Clean',
    description: 'Specially formulated glass cleaner that leaves surfaces sparkling clean without streaks.',
    short_description: 'Streak-free glass cleaner',
    specifications: '400ml spray bottle, ammonia-free',
    features: 'Streak-free, quick-drying, safe for tinted windows',
    category_1: 'Cleaning Products',
    category_2: 'Glass Cleaners',
    seo_page_title: 'Rapid Clean Glass Cleaner - Streak-Free Cleaning',
    seo_meta_description: 'Achieve crystal clear results with our professional glass cleaner.',
    seo_page_heading: 'Glass Cleaner'
  },
  {
    id: '3',
    image: 'https://example.com/image3.jpg',
    sku: 'PC-001',
    name: 'ProClean Industrial Degreaser',
    subtitle: 'Heavy Duty Cleaning Power',
    brand: 'ProClean',
    description: 'Industrial strength degreaser designed for tough cleaning applications.',
    short_description: 'Heavy duty degreaser',
    specifications: '5L container, concentrated formula',
    features: 'High concentration, versatile use, effective on oils and greases',
    category_1: 'Industrial Cleaning',
    category_2: 'Degreasers',
    seo_page_title: 'ProClean Industrial Degreaser - Heavy Duty Cleaning',
    seo_meta_description: 'Powerful industrial degreaser for tough cleaning challenges.',
    seo_page_heading: 'Industrial Degreaser'
  }
];

export const GET: RequestHandler = async ({ url }) => {
  try {
    const brand = url.searchParams.get('brand');

    let filteredProducts = mockProducts;

    // Filter by brand if specified
    if (brand) {
      filteredProducts = mockProducts.filter(product =>
        product.brand.toLowerCase().includes(brand.toLowerCase())
      );
    }

    return json({
      success: true,
      data: filteredProducts
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return new Response('Error fetching products', { status: 500 });
  }
};
