import { writable, get } from 'svelte/store';
import type { SelectOption } from './types';

// API Endpoints
export const brandsUrl = 'https://prod-06.australiasoutheast.logic.azure.com:443/workflows/58215302c1c24203886ccf481adbaac5/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=RFQ4OtbS6cyjB_JzaIsowmww4KBqPQgavWLg18znE5s';
export const suppliersUrl = 'https://prod-06.australiasoutheast.logic.azure.com:443/workflows/da5c5708146642768d63293d2bbb9668/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=-n0W0PxlF1G83xHYHGoEOhv3XmHXWlesbRk5NcgNT9w';
export const categoriesUrl = 'https://prod-47.australiasoutheast.logic.azure.com:443/workflows/0d67bc8f1bb64e78a2495f13a7498081/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=fJJzmNyuARuwEcNCoMuWwMS9kmWZQABw9kJXsUj9Wk8';
export const updatePricingUrl = 'https://prod-06.australiasoutheast.logic.azure.com:443/workflows/a14abba8479c457bafd63fe32fd9fea4/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=Evz4dRmWiP8p-hxjZxofNX1q_o_-ufQK2c_XI4Quxto';
export const filterProductsUrl = 'https://prod-19.australiasoutheast.logic.azure.com:443/workflows/67422be18c5e4af0ad9291110dedb2fd/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=N_VRTyaFEkOUGjtwu8O56_L-qY6xwvHuGWEOvqKsoAk';

// State stores
export const products = writable<any[]>([]);
export const originalProducts = writable<any[]>([]);
export const filteredProducts = writable<any[]>([]);
export const brands = writable<SelectOption[]>([]);
export const suppliers = writable<SelectOption[]>([]);
export const categories = writable<SelectOption[]>([]);
export const loading = writable(false);
export const loadingBrands = writable(false);
export const loadingSuppliers = writable(false);
export const loadingCategories = writable(false);
export const brandError = writable('');
export const supplierError = writable('');
export const categoryError = writable('');
export const selectedRows = writable(new Set<string>());
export const selectAll = writable(false);
export const submitLoading = writable(false);

// Filter state
export const skuFilter = writable('');
export const productNameFilter = writable('');
export const brandFilter = writable<SelectOption | null>(null);
export const supplierFilter = writable<SelectOption | null>(null);
export const categoryFilter = writable<SelectOption | null>(null);

// Pagination and sorting stores
export const currentPage = writable(1);
export const itemsPerPage = writable(10);
export const sortField = writable<string | null>(null);
export const sortDirection = writable<'asc' | 'desc'>('asc');

interface Product {
  sku: string;
  product_name: string;
  brand: string;
  primary_supplier: string;
  category: string;
  purchase_price: number;
  client_price: number;
  rrp: number;
  client_mup: number;
  retail_mup: number;
}

// Function to calculate client price and RRP
export function calculatePrices(product: any, source: 'mup' | 'price' = 'mup') {
  const purchasePrice = parseFloat(product.purchase_price?.toString() || '0');

  if (source === 'mup') {
    const clientMup = parseFloat(product.client_mup?.toString() || '0');
    const retailMup = parseFloat(product.retail_mup?.toString() || '0');

    if (purchasePrice && clientMup) {
      product.client_price = parseFloat((purchasePrice * clientMup * 1.1).toFixed(2));
    }

    if (purchasePrice && retailMup) {
      product.rrp = parseFloat((purchasePrice * retailMup * 1.1).toFixed(2));
    }
  } else {
    const clientPrice = parseFloat(product.client_price?.toString() || '0');
    const rrp = parseFloat(product.rrp?.toString() || '0');

    if (purchasePrice && clientPrice) {
      product.client_mup = parseFloat((clientPrice / (purchasePrice * 1.1)).toFixed(2));
    }

    if (purchasePrice && rrp) {
      product.retail_mup = parseFloat((rrp / (purchasePrice * 1.1)).toFixed(2));
    }
  }

  // Ensure all values are properly formatted
  if (product.client_price) product.client_price = parseFloat(product.client_price.toFixed(2));
  if (product.rrp) product.rrp = parseFloat(product.rrp.toFixed(2));
  if (product.client_mup) product.client_mup = parseFloat(product.client_mup.toFixed(2));
  if (product.retail_mup) product.retail_mup = parseFloat(product.retail_mup.toFixed(2));

  // Update the store
  products.update(p => p);
}

// Function to apply client MUP to all rows
export function applyClientMupToAll() {
  products.update(prods => {
    if (prods.length === 0) return prods;
    
    const firstProduct = prods[0];
    const clientMupVal = firstProduct.client_mup;
    
    return prods.map((prod, idx) => {
      if (idx === 0) return prod;
      prod.client_mup = clientMupVal;
      calculatePrices(prod);
      return prod;
    });
  });
}

// Function to apply retail MUP to all rows
export function applyRetailMupToAll() {
  products.update(prods => {
    if (prods.length === 0) return prods;
    
    const firstProduct = prods[0];
    const retailMupVal = firstProduct.retail_mup;
    
    return prods.map((prod, idx) => {
      if (idx === 0) return prod;
      prod.retail_mup = retailMupVal;
      calculatePrices(prod);
      return prod;
    });
  });
}

// Function to fetch brands
export async function fetchBrands() {
  loadingBrands.set(true);
  brandError.set('');
  try {
    const response = await fetch(brandsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();

    if (data.status === 200 && data.message?.Ack === "Success" && Array.isArray(data.message.Content)) {
      brands.set(
        data.message.Content
          .filter((brand: { ContentID: string; ContentName: string }) => brand.ContentName)
          .map((brand: { ContentID: string; ContentName: string }) => ({
            value: brand.ContentName,
            label: brand.ContentName
          }))
          .sort((a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label))
      );
    } else {
      throw new Error('Failed to load brands: Invalid response format');
    }
  } catch (err: unknown) {
    const error = err as Error;
    brandError.set(error.message || 'Failed to load brands');
    brands.set([]);
  } finally {
    loadingBrands.set(false);
  }
}

// Function to fetch suppliers
export async function fetchSuppliers() {
  loadingSuppliers.set(true);
  supplierError.set('');
  try {
    const response = await fetch(suppliersUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    const data = await response.json();

    if (data.status === 200 && data.message.Ack === "Success") {
      suppliers.set(
        data.message.Supplier
          .filter((supplier: { SupplierID: string }) => supplier.SupplierID !== "0")
          .map((supplier: { SupplierID: string }) => ({
            value: supplier.SupplierID,
            label: supplier.SupplierID
          }))
          .sort((a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label))
      );
    } else {
      throw new Error('Failed to load suppliers: Invalid response format');
    }
  } catch (err: unknown) {
    const error = err as Error;
    supplierError.set(error.message || 'Failed to load suppliers');
  } finally {
    loadingSuppliers.set(false);
  }
}

// Function to fetch categories
export async function fetchCategories() {
  loadingCategories.set(true);
  categoryError.set('');
  try {
    const response = await fetch(categoriesUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const data = await response.json();

    if (data.status === 200 && data.message?.Ack === "Success" && Array.isArray(data.message.Category)) {
      categories.set(
        data.message.Category
          .map((category: { CategoryID: string; CategoryName: string }) => ({
            value: category.CategoryID,
            label: category.CategoryName
          }))
          .sort((a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label))
      );
    } else {
      throw new Error('Failed to load categories: Invalid response format');
    }
  } catch (err: unknown) {
    const error = err as Error;
    categoryError.set(error.message || 'Failed to load categories');
  } finally {
    loadingCategories.set(false);
  }
}

// Function to handle select all checkbox
export function handleSelectAll(checked: boolean) {
  selectAll.set(checked);
  if (checked) {
    const allSkus = new Set<string>();
    products.update(prods => {
      prods.forEach(prod => allSkus.add(prod.sku));
      return prods;
    });
    selectedRows.set(allSkus);
  } else {
    selectedRows.set(new Set<string>());
  }
}

// Function to handle submit checked rows
export async function handleSubmitChecked() {
  submitLoading.set(true);
  try {
    const selectedProducts: Array<{
      sku: string;
      client_price: number;
      rrp: number;
      [key: string]: any;
    }> = [];
    
    let currentSelectedRows: Set<string> = new Set<string>();
    selectedRows.subscribe(value => {
      currentSelectedRows = value;
    })();

    console.log('Submit Checked: Selected rows count:', currentSelectedRows.size);

    products.update(prods => {
      selectedProducts.push(...prods.filter(prod => currentSelectedRows.has(prod.sku)));
      return prods;
    });

    if (selectedProducts.length === 0) {
      console.log('Submit Checked: No products selected');
      submitLoading.set(false);
      return { success: false, message: 'No products selected' };
    }

    console.log('Submit Checked: Selected products:', selectedProducts);

    const payload = {
      Item: selectedProducts.map(prod => {
        // Create the base product object
        const productObject: any = {
          SKU: prod.sku,
          Brand: prod.brand,
          PrimarySupplier: prod.primary_supplier,
          DefaultPurchasePrice: prod.purchase_price.toString(),
          RRP: prod.rrp.toString(),
          Misc02: prod.client_mup.toString(),  // client MUP
          Misc09: prod.retail_mup.toString(),  // retail MUP
          PriceGroups: {
            PriceGroup: [
              {
                Group: "Default Client Group",
                Price: prod.client_price.toString()
              }
            ]
          }
        };
        
        // Only add Categories if category is not empty
        if (prod.category && typeof prod.category === 'string' && prod.category.trim() !== '') {
          productObject.Categories = {
            Category: [
              { CategoryID: prod.category }
            ]
          };
        }
        
        return productObject;
      })
    };

    console.log('API Endpoint:', updatePricingUrl);
    console.log('PAYLOAD FOR REVIEW:', JSON.stringify(payload, null, 2));
    
    // Stop here and don't send to API yet
    submitLoading.set(false);
    return { 
      success: true, 
      message: 'Payload logged to console for review. Check browser console.' 
    };

    /* The code below will not execute - uncomment when ready to send to API
    
    const response = await fetch(updatePricingUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    console.log('Submit Checked: Response status:', response.status);
    console.log('Submit Checked: Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Submit Checked: API Error response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const data = await response.json();
    console.log('Response Data:', data);

    if (data.status === 200 && data.message?.Ack === "Success") {
      // Mark updated products
      products.update(prods => {
        return prods.map(prod => {
          if (currentSelectedRows.has(prod.sku)) {
            return { ...prod, updated: true };
          }
          return prod;
        });
      });
      return { success: true, message: 'Products updated successfully' };
    } else {
      console.error('Submit Checked: API returned non-success response:', data);
      throw new Error('Failed to update products: Invalid response format');
    }
    */
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Submit Checked: Error occurred:', error);
    console.error('Submit Checked: Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    submitLoading.set(false);
    return { success: false, message: error.message || 'Failed to update products' };
  }
}

// Function to transform API response to our product format
function transformApiResponse(apiResponse: any): Product[] {
  console.log('Starting API response transformation');
  
  // Handle case where Item is not an array
  const items = Array.isArray(apiResponse.Item) ? apiResponse.Item : [apiResponse.Item];
  console.log('Items to process:', items);

  return items.map((item: any) => {
    console.log('Processing item:', item);
    
    // Handle PriceGroups structure
    const priceGroups = Array.isArray(item.PriceGroups) ? item.PriceGroups[0] : item.PriceGroups;
    const priceGroupArray = Array.isArray(priceGroups?.PriceGroup) ? priceGroups.PriceGroup : [priceGroups?.PriceGroup];
    
    // Find the client price from PriceGroups
    const clientPrice = priceGroupArray?.find(
      (pg: any) => pg?.Group === "Default Client Group"
    )?.Price || item.RRP || '0';

    // Find the RRP from PriceGroups
    const rrp = priceGroupArray?.find(
      (pg: any) => pg?.Group === "Default RRP (Dont Assign to clients)"
    )?.Price || item.RRP || '0';

    const transformedProduct = {
      sku: item.SKU || '',  // Using SKU instead of InventoryID
      inventory_id: item.InventoryID || '',  // Include InventoryID
      product_name: item.Model || '',
      brand: item.Brand || '',
      primary_supplier: item.PrimarySupplier || '',
      category: Array.isArray(item.Categories) ? (item.Categories[0] || '') : '',
      purchase_price: parseFloat(item.DefaultPurchasePrice || '0'),
      client_price: parseFloat(clientPrice),
      rrp: parseFloat(rrp),
      client_mup: parseFloat(item.Misc02 || '0'),
      retail_mup: parseFloat(item.Misc09 || '0')
    };

    console.log('Transformed product:', transformedProduct);
    return transformedProduct;
  });
}

// Function to handle filter submit
export async function handleFilterSubmit(filters: {
  skuFilter: string;
  productNameFilter: string;
  brandFilter: SelectOption | null;
  supplierFilter: SelectOption | null;
  categoryFilter: SelectOption | null;
}) {
  try {
    console.log('Starting handleFilterSubmit with filters:', filters);
    loading.set(true);

    // Reset selection state and pagination
    selectedRows.set(new Set<string>());
    selectAll.set(false);
    resetPagination();

    // Prepare SKUs for filter
    const skus = filters.skuFilter
      ? filters.skuFilter.split('\n').map(sku => sku.trim()).filter(Boolean)
      : [];
    console.log('Prepared SKUs:', skus);

    // Prepare the request payload
    const payload = {
      Filter: {
        SKU: skus.length > 0 ? skus : '',
        Name: filters.productNameFilter || '',
        Brand: filters.brandFilter?.value || '',
        Active: true,
        OutputSelector: [
          "SKU",
          "Model",
          "Categories",
          "Brand",
          "PrimarySupplier",
          "RRP",
          "DefaultPurchasePrice",
          "PriceGroups",
          "Misc02",
          "Misc09",
          "InventoryID"
        ]
      }
    };
    console.log('Request payload:', JSON.stringify(payload, null, 2));
    console.log('Making API call to:', filterProductsUrl);

    // Make API call with filter payload
    const response = await fetch(filterProductsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    console.log('API Response status:', response.status);
    console.log('API Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const data = await response.json();
    console.log('API Response data:', JSON.stringify(data, null, 2));

    if (data.Ack !== "Success") {
      console.error('API returned non-success Ack:', data);
      throw new Error('Failed to fetch products: Invalid response format');
    }

    // Transform API response to our product format
    let filteredProds = transformApiResponse(data);
    console.log('Transformed products:', filteredProds);

    // Apply additional client-side filters for supplier and category
    if (filters.supplierFilter) {
      filteredProds = filteredProds.filter((prod: Product) => 
        prod.primary_supplier === filters.supplierFilter?.value
      );
      console.log('After supplier filter:', filteredProds.length, 'products');
    }

    if (filters.categoryFilter) {
      filteredProds = filteredProds.filter((prod: Product) => 
        prod.category === filters.categoryFilter?.value
      );
      console.log('After category filter:', filteredProds.length, 'products');
    }

    // Update stores with a fresh array to trigger reactivity
    console.log('Setting products store with:', filteredProds);
    products.set([...filteredProds]);
    filteredProducts.set([...filteredProds]);
    console.log('Stores updated. Current state:', {
      productsLength: get(products).length,
      filteredLength: get(filteredProducts).length
    });

    return { 
      success: true, 
      message: `Found ${filteredProds.length} products matching the filters` 
    };
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error in handleFilterSubmit:', error);
    // Clear products on error
    products.set([]);
    filteredProducts.set([]);
    return { 
      success: false, 
      message: error.message || 'Failed to apply filters' 
    };
  } finally {
    loading.set(false);
  }
}

// Get paginated and sorted products
export function getPaginatedProducts(allProducts: any[]): any[] {
  console.log('Getting paginated products:', {
    totalProducts: allProducts.length,
    currentPage: get(currentPage),
    itemsPerPage: get(itemsPerPage),
    sortField: get(sortField),
    sortDirection: get(sortDirection)
  });

  let sorted = [...allProducts];
  
  // Apply sorting if a sort field is selected
  const currentSortField = get(sortField);
  const currentSortDirection = get(sortDirection);
  
  if (currentSortField) {
    console.log('Sorting by:', { field: currentSortField, direction: currentSortDirection });
    sorted.sort((a, b) => {
      let aValue = a[currentSortField];
      let bValue = b[currentSortField];
      
      // Handle null/undefined values
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';
      
      // Handle boolean values (for 'updated' field)
      if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
        return currentSortDirection === 'asc' 
          ? (aValue === bValue ? 0 : aValue ? -1 : 1)
          : (aValue === bValue ? 0 : aValue ? 1 : -1);
      }
      
      // Handle numeric values
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return currentSortDirection === 'asc' 
          ? aValue - bValue 
          : bValue - aValue;
      }
      
      // Convert to strings for string comparison
      const aString = String(aValue).toLowerCase();
      const bString = String(bValue).toLowerCase();
      
      return currentSortDirection === 'asc' 
        ? aString.localeCompare(bString)
        : bString.localeCompare(aString);
    });
  }
  
  // Get pagination values
  const perPage = get(itemsPerPage);
  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const page = Math.max(1, Math.min(get(currentPage), totalPages));
  
  // Calculate slice indices
  const start = (page - 1) * perPage;
  const end = Math.min(start + perPage, sorted.length);
  
  console.log('Pagination calculation:', {
    page,
    perPage,
    totalPages,
    start,
    end,
    resultLength: end - start
  });

  // Return the paginated slice
  return sorted.slice(start, end);
}

// Get total number of pages
export function getTotalPages(totalItems: number): number {
  const perPage = get(itemsPerPage);
  const pages = Math.max(1, Math.ceil(totalItems / perPage));
  console.log('Calculating total pages:', { totalItems, perPage, pages });
  return pages;
}

// Reset pagination
export function resetPagination() {
  console.log('Resetting pagination');
  currentPage.set(1);
}

// Handle sort change
export function handleSort(field: string) {
  sortField.update(currentField => {
    if (currentField === field) {
      // If clicking the same field, toggle direction
      sortDirection.update(dir => dir === 'asc' ? 'desc' : 'asc');
      return field;
    }
    // If clicking a new field, set to asc
    sortDirection.set('asc');
    return field;
  });
} 