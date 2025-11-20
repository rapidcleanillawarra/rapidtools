import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ params, request }) => {
  try {
    const { id } = params;
    const updateData = await request.json();

    // Validate required fields
    if (!id) {
      return json({
        success: false,
        error: 'Product ID is required'
      }, { status: 400 });
    }

    // Here you would call the actual API to update the product
    // Since the current API service only has fetch functionality,
    // this is a placeholder for the actual update implementation

    // For now, return a mock successful response
    // In a real implementation, you would:
    // 1. Call the Power Automate API with an "UpdateItem" action
    // 2. Transform the updateData to match the API's expected format
    // 3. Handle the response and return the updated product

    console.log(`Updating product ${id} with data:`, updateData);

    // Mock response - replace with actual API call
    const updatedProduct = {
      id,
      ...updateData
    };

    return json({
      success: true,
      data: updatedProduct,
      message: 'Product updated successfully'
    });

  } catch (error) {
    console.error('Error updating product:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update product'
    }, { status: 500 });
  }
};
