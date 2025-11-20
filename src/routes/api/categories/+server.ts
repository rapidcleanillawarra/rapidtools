import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchCategories } from '$lib/services/categories';

export const GET: RequestHandler = async () => {
  try {
    const categoryData = await fetchCategories();

    // Transform the API response to match the expected format
    const categories = categoryData.Category?.map(category => ({
      id: category.CategoryID,
      name: category.CategoryName,
      parentId: category.ParentCategoryID,
      value: category.CategoryName,
      label: category.CategoryName,
      categoryId: category.CategoryID,
      parentCategoryId: category.ParentCategoryID
    })) || [];

    return json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return json({
      success: false,
      error: 'Failed to fetch categories'
    }, { status: 500 });
  }
}; 