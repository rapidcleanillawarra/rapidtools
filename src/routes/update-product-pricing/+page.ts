import type { PageLoad } from './$types';

export const load: PageLoad = async ({ data }) => {
  console.log('\n========== CLIENT LOAD START ==========');
  console.log('🕒 Client-side load function called at:', new Date().toISOString());
  console.log('📥 Received data from server:', {
    hasData: !!data,
    productsCount: data?.products?.length || 0,
    sampleProduct: data?.products?.[0] ? JSON.stringify(data.products[0], null, 2) : 'No products'
  });
  
  const result = {
    products: data.products || []
  };
  
  console.log('📤 Returning data:', {
    productsCount: result.products.length,
    sampleProduct: result.products[0] ? JSON.stringify(result.products[0], null, 2) : 'No products'
  });
  console.log('========== CLIENT LOAD END ==========\n');
  
  return result;
}; 