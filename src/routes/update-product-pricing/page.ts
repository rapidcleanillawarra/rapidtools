import { writable } from 'svelte/store';
import type { SelectOption, PriceGroupDetail, ApiProductItem } from './types';

// API Endpoints
export const brandsUrl = 'https://prod-06.australiasoutheast.logic.azure.com:443/workflows/58215302c1c24203886ccf481adbaac5/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=RFQ4OtbS6cyjB_JzaIsowmww4KBqPQgavWLg18znE5s';
export const suppliersUrl = 'https://prod-06.australiasoutheast.logic.azure.com:443/workflows/da5c5708146642768d63293d2bbb9668/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=-n0W0PxlF1G83xHYHGoEOhv3XmHXWlesbRk5NcgNT9w';
export const categoriesUrl = 'https://prod-47.australiasoutheast.logic.azure.com:443/workflows/0d67bc8f1bb64e78a2495f13a7498081/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=fJJzmNyuARuwEcNCoMuWwMS9kmWZQABw9kJXsUj9Wk8';
export const updatePricingUrl = 'https://prod-06.australiasoutheast.logic.azure.com:443/workflows/a14abba8479c457bafd63fe32fd9fea4/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=Evz4dRmWiP8p-hxjZxofNX1q_o_-ufQK2c_XI4Quxto';

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

// Function to handle select all
export function handleSelectAll(checked: boolean) {
  products.subscribe(prods => {
    if (checked) {
      selectedRows.update(rows => {
        prods.forEach(prod => rows.add(prod.sku));
        return rows;
      });
    } else {
      selectedRows.set(new Set());
    }
  })();
}

// Function to handle submit checked rows
export async function handleSubmitChecked() {
  let currentSelectedRows: Set<string> = new Set();
  selectedRows.subscribe(value => {
    currentSelectedRows = value;
  })();

  if (currentSelectedRows.size === 0) {
    return { success: false, message: 'Please select at least one row' };
  }

  submitLoading.set(true);
  try {
    let currentProducts: any[] = [];
    products.subscribe(value => {
      currentProducts = value;
    })();

    const selectedProducts = currentProducts.filter(prod => currentSelectedRows.has(prod.sku));
    const items = selectedProducts.map(prod => ({
      SKU: prod.sku,
      DefaultPurchasePrice: parseFloat(prod.purchase_price) || 0,
      RRP: parseFloat(prod.rrp) || 0,
      Misc02: parseFloat(prod.client_mup) || 0,
      Misc09: parseFloat(prod.retail_mup) || 0,
      PriceGroups: {
        PriceGroup: [
          { Group: "Default Client Group", Price: parseFloat(prod.client_price) || 0 },
          { Group: "Default RRP (Dont Assign to clients)", Price: parseFloat(prod.rrp) || 0 }
        ]
      }
    }));

    const payload = { Item: items };
    const response = await fetch(updatePricingUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to update pricing');
    }

    // Mark updated rows with success class
    const updatedSkus = (data.Item || []).map((i: any) => i.SKU);
    products.update(prods => 
      prods.map(prod => ({
        ...prod,
        updated: updatedSkus.includes(prod.sku)
      }))
    );
    
    selectedRows.set(new Set());
    selectAll.set(false);

    return { 
      success: true, 
      message: `Successfully updated pricing for ${currentSelectedRows.size} products` 
    };
  } catch (error: any) {
    return { 
      success: false, 
      message: error.message || 'Failed to update pricing' 
    };
  } finally {
    submitLoading.set(false);
  }
}

// Function to handle filter submit
export async function handleFilterSubmit(filters: {
  skuFilter: string;
  productNameFilter: string;
  brandFilter: SelectOption | null;
  supplierFilter: SelectOption | null;
  categoryFilter: SelectOption | null;
}) {
  const f: any = {
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
  };

  // Read and split SKUs from textarea into an array
  if (filters.skuFilter) {
    const skuArr = filters.skuFilter
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);
    if (skuArr.length) {
      f.SKU = skuArr;
    }
  }

  if (filters.productNameFilter) f.Name = filters.productNameFilter;
  if (filters.brandFilter) f.Brand = filters.brandFilter.value;
  if (filters.supplierFilter) f.PrimarySupplier = filters.supplierFilter.value;
  if (filters.categoryFilter) f.CategoryID = filters.categoryFilter.value;

  try {
    const response = await fetch(
      'https://prod-19.australiasoutheast.logic.azure.com:443/workflows/67422be18c5e4af0ad9291110dedb2fd/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=N_VRTyaFEkOUGjtwu8O56_L-qY6xwvHuGWEOvqKsoAk',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Filter: f })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to load products: ${response.status} ${response.statusText}. Error: ${errorText}`);
    }

    const data = await response.json();

    if (!data.Item) {
      products.set([]);
      originalProducts.set([]);
      filteredProducts.set([]);
      return { success: true, message: 'No products found' };
    }

    // Transform the data
    const transformedProducts = (data.Item as ApiProductItem[]).map(item => {
      const clientPrice = item.PriceGroups?.PriceGroup
        ? (Array.isArray(item.PriceGroups.PriceGroup)
            ? item.PriceGroups.PriceGroup.find((pg: PriceGroupDetail) => pg.Group === "Default Client Group" || pg.GroupID === "2")?.Price
            : item.PriceGroups.PriceGroup.Group === "Default Client Group" || item.PriceGroups.PriceGroup.GroupID === "2"
              ? item.PriceGroups.PriceGroup.Price
              : '0')
        : '0';

      return {
        sku: item.SKU || '',
        product_name: item.Model || '',
        brand: item.Brand || '',
        primary_supplier: item.PrimarySupplier || '',
        category: Array.isArray(item.Categories) ? item.Categories[0] || '' : '',
        purchase_price: parseFloat(item.DefaultPurchasePrice || '0'),
        client_mup: parseFloat(item.Misc02 || '0'),
        retail_mup: parseFloat(item.Misc09 || '0'),
        client_price: parseFloat(clientPrice),
        rrp: parseFloat(item.RRP || '0'),
        inventory_id: item.InventoryID || ''
      };
    });

    originalProducts.set(transformedProducts);
    products.set(transformedProducts);
    filteredProducts.set(transformedProducts);

    return { success: true, message: 'Filters applied successfully' };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('Error applying filters:', error);
    return { success: false, message: 'Error applying filters: ' + error.message };
  }
} 