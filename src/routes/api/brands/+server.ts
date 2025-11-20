import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchBrands } from '$lib/services/brands';

export const GET: RequestHandler = async () => {
  try {
    const brandData = await fetchBrands();

    // Transform the API response to match the expected format
    const brands = brandData.Content?.map(brand => ({
      id: brand.ContentID,
      name: brand.ContentName,
      value: brand.ContentName,
      label: brand.ContentName,
      contentId: brand.ContentID
    })) || [];

    return json({
      success: true,
      data: brands
    });
  } catch (error) {
    console.error('Error fetching brands:', error);
    return json({
      success: false,
      error: 'Failed to fetch brands'
    }, { status: 500 });
  }
}; 