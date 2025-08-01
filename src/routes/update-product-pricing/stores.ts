import { writable, get } from 'svelte/store';
import type { SelectOption, MultiSelectOption } from './types';

// API Endpoints
export const brandsUrl = 'https://prod-06.australiasoutheast.logic.azure.com:443/workflows/58215302c1c24203886ccf481adbaac5/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=RFQ4OtbS6cyjB_JzaIsowmww4KBqPQgavWLg18znE5s';
export const suppliersUrl = 'https://prod-06.australiasoutheast.logic.azure.com:443/workflows/da5c5708146642768d63293d2bbb9668/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=-n0W0PxlF1G83xHYHGoEOhv3XmHXWlesbRk5NcgNT9w';
export const categoriesUrl = 'https://prod-47.australiasoutheast.logic.azure.com:443/workflows/0d67bc8f1bb64e78a2495f13a7498081/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=fJJzmNyuARuwEcNCoMuWwMS9kmWZQABw9kJXsUj9Wk8';
export const updatePricingUrl = 'https://prod-56.australiasoutheast.logic.azure.com:443/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=G8m_h5Dl8GpIRQtlN0oShby5zrigLKTWEddou-zGQIs';
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
export const categoryFilter = writable<MultiSelectOption[]>([]);

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
  category: string[];
  category_name: string[];
  original_category: string[];
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
      product.client_price = parseFloat((purchasePrice * clientMup).toFixed(2));
    }

    if (purchasePrice && retailMup) {
      product.rrp = parseFloat((purchasePrice * retailMup).toFixed(2));
    }
  } else {
    const clientPrice = parseFloat(product.client_price?.toString() || '0');
    const rrp = parseFloat(product.rrp?.toString() || '0');

    if (purchasePrice && clientPrice) {
      product.client_mup = parseFloat((clientPrice / purchasePrice).toFixed(2));
    }

    if (purchasePrice && rrp) {
      product.retail_mup = parseFloat((rrp / purchasePrice).toFixed(2));
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

    // Verify and update category information before constructing the payload
    const verifyAndUpdateCategoryInfo = (products: any[]) => {
      console.log('Verifying category information before submission...');
      return products.map(prod => {
        // Ensure category arrays are properly initialized
        if (!prod.category) {
          prod.category = [];
        }
        if (!prod.category_name) {
          prod.category_name = [];
        }
        if (!prod.original_category) {
          prod.original_category = prod.category ? [...prod.category] : [];
        }
        
        // Verify categories are properly formatted
        if (prod.category && !Array.isArray(prod.category)) {
          console.warn(`Converting non-array category to array for product ${prod.sku}`);
          prod.category = [prod.category];
        }
        
        if (prod.original_category && !Array.isArray(prod.original_category)) {
          console.warn(`Converting non-array original_category to array for product ${prod.sku}`);
          prod.original_category = [prod.original_category];
        }
        
        // Filter out any invalid category values (null, undefined, empty strings)
        if (Array.isArray(prod.category)) {
          prod.category = prod.category.filter((catId: string | null | undefined) => catId);
        }
        
        return prod;
      });
    };
    
    // Apply the verification and update to selected products
    const verifiedProducts = verifyAndUpdateCategoryInfo(selectedProducts);

    const payload = {
      "Item": verifiedProducts.map(prod => {
        // Create the base product object
        const productObject: any = {
          "SKU": prod.sku,
          "Brand": prod.brand,
          "PrimarySupplier": prod.primary_supplier,
          "DefaultPurchasePrice": prod.purchase_price.toString(),
          "RRP": prod.rrp.toString(),
          "Misc02": prod.client_mup.toString(),  // client MUP
          "Misc09": prod.retail_mup.toString(),  // retail MUP
          "TaxFreeItem": prod.tax_free || false,
          "PriceGroups": {
            "PriceGroup": [
              {
                "Group": "1",
                "Price": prod.rrp.toString()
              },
              {
                "Group": "2",
                "Price": prod.client_price.toString()
              }
            ]
          }
        };
        
        // Handle category changes with deletion for removed categories
        if (prod.category || prod.original_category) {
          const categoryPayload: Array<{ CategoryID: string; Delete?: boolean }> = [];
          
          // Add current categories (without Delete flag)
          if (prod.category && Array.isArray(prod.category)) {
            prod.category.forEach((catId: string) => {
              if (catId) {
                categoryPayload.push({ CategoryID: catId });
              }
            });
          }
          
          // Add categories to delete (with Delete flag set to true)
          if (prod.original_category && Array.isArray(prod.original_category)) {
            prod.original_category.forEach((catId: string) => {
              // Only include for deletion if it's in original but not in current categories
              if (catId && (!prod.category || !prod.category.includes(catId))) {
                categoryPayload.push({ CategoryID: catId, Delete: true });
              }
            });
          }
          
          // Only add Categories if we have category entries
          if (categoryPayload.length > 0) {
            productObject.Categories = {
              "Category": categoryPayload
            };
          }
        }
        
        return productObject;
      }),
      "action": "UpdateItem"
    };

    console.log('API Endpoint:', updatePricingUrl);
    console.log('PAYLOAD FOR REVIEW:', JSON.stringify(payload, null, 2));
    
    // Send to API
    const response = await fetch(updatePricingUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    console.log('Submit Checked: Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Submit Checked: API Error response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const data = await response.json();
    console.log('Response Data:', data);

    // Check if data.Item exists and has SKUs
    if (data.Item && data.Ack === "Success") {
      // Get array of successfully updated SKUs
      const updatedSkus = new Set(
        (Array.isArray(data.Item) ? data.Item : [data.Item])
          .map((item: any) => item.SKU)
          .filter(Boolean)
      );
      
      console.log('Successfully updated SKUs:', Array.from(updatedSkus));
      
      // Simply mark products as updated if their SKU is in the response
      products.update(prods => 
        prods.map(prod => 
          updatedSkus.has(prod.sku) ? { ...prod, updated: true } : prod
        )
      );
      
      // Reset loading state
      submitLoading.set(false);
      // Don't clear the selectedRows after successful submission so users can see what was updated
      return { success: true, message: 'Products updated successfully' };
    }
    
    // If we get here, the response didn't contain the expected data
    submitLoading.set(false);
    console.error('Submit Checked: API returned invalid response:', data);
    throw new Error('Failed to update products: Invalid response format');
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

// Function to handle filter submit
export async function handleFilterSubmit(filters: {
  skuFilter: string;
  productNameFilter: string;
  brandFilter: SelectOption | null;
  supplierFilter: SelectOption | null;
  categoryFilter: MultiSelectOption[];
}) {
  loading.set(true);
  try {
    // Process SKU filter to get an array of SKUs
    const skuList = filters.skuFilter
      .split('\n')
      .map(sku => sku.trim())
      .filter(sku => sku.length > 0);

    // Create filter payload
    const payload: any = {};

    // Add SKU filter
    if (skuList.length > 0) {
      payload.sku = skuList;
    }

    // Add product name filter
    if (filters.productNameFilter) {
      payload.productName = filters.productNameFilter;
    }

    // Add brand filter
    if (filters.brandFilter) {
      payload.brand = filters.brandFilter.value;
    }

    // Add supplier filter
    if (filters.supplierFilter) {
      payload.supplier = filters.supplierFilter.value;
    }

    // Add category filter
    if (filters.categoryFilter && filters.categoryFilter.length > 0) {
      payload.category = filters.categoryFilter.map(cat => cat.value);
    }

    console.log('Filter payload:', payload);

    // If no filters are applied, restore the original product list
    if (Object.keys(payload).length === 0) {
      originalProducts.subscribe(value => {
        products.set([...value]);
        filteredProducts.set([...value]);
      })();
      loading.set(false);
      return { success: true, message: 'All products loaded' };
    }

    // Prepare the request payload
    const payloadForAPI = {
      Filter: {
        SKU: payload.sku || '',
        Name: payload.productName || '',
        Brand: payload.brand || '',
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
          "InventoryID",
          "TaxFreeItem"
        ]
      }
    };
    console.log('Request payload:', JSON.stringify(payloadForAPI, null, 2));
    console.log('Making API call to:', filterProductsUrl);

    // Make API call with filter payload
    const response = await fetch(filterProductsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadForAPI)
    });

    console.log('API Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const data = await response.json();
    console.log('API Response data:', JSON.stringify(data, null, 2));

    // Process the filtered products
    if (data.Item && data.Ack === "Success") {
      const filteredItems = Array.isArray(data.Item) ? data.Item : [data.Item];
      const filteredProds = filteredItems.map((item: { 
        SKU?: string;
        InventoryID?: string;
        Model?: string;
        Brand?: string;
        PrimarySupplier?: string;
        DefaultPurchasePrice?: string;
        RRP?: string;
        Misc02?: string;
        Misc09?: string;
        TaxFreeItem?: string;
        Categories?: Array<{
          Category: {
            CategoryID: string;
            CategoryName: string;
          }
        }>
      }) => {
        // Extract category information
        const categoryIds: string[] = [];
        const categoryNames: string[] = [];
        
        if (item.Categories) {
          item.Categories.forEach(catEntry => {
            if (catEntry.Category) {
              categoryIds.push(catEntry.Category.CategoryID);
              categoryNames.push(catEntry.Category.CategoryName);
            }
          });
        }

        return {
          sku: item.SKU || '',
          inventory_id: item.InventoryID || '',
          product_name: item.Model || '',
          brand: item.Brand || '',
          primary_supplier: item.PrimarySupplier || '',
          category: categoryIds,
          category_name: categoryNames,
          original_category: [...categoryIds],
          purchase_price: parseFloat(item.DefaultPurchasePrice || '0'),
          client_price: 0,
          rrp: parseFloat(item.RRP || '0'),
          client_mup: parseFloat(item.Misc02 || '0'),
          retail_mup: parseFloat(item.Misc09 || '0'),
          tax_free: item.TaxFreeItem === 'True'
        };
      });

      products.set(filteredProds);
      filteredProducts.set(filteredProds);
      loading.set(false);
      return { success: true, message: 'Products filtered successfully' };
    }

    loading.set(false);
    throw new Error('Failed to filter products: Invalid response format');
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Filter Error:', error);
    loading.set(false);
    return { success: false, message: error.message || 'Failed to filter products' };
  }
}

// Get paginated and sorted products
export function getPaginatedProducts(allProducts: any[]): any[] {
  let sorted = [...allProducts];
  
  // Apply sorting if a sort field is selected
  const currentSortField = get(sortField);
  const currentSortDirection = get(sortDirection);
  
  if (currentSortField) {
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
  
  // Return the paginated slice
  return sorted.slice(start, end);
}

// Get total number of pages
export function getTotalPages(totalItems: number): number {
  const perPage = get(itemsPerPage);
  const pages = Math.max(1, Math.ceil(totalItems / perPage));
  return pages;
}

// Reset pagination
export function resetPagination() {
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