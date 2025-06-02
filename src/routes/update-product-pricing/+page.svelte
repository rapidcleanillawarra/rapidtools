<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import Select from 'svelte-select';
  import { SvelteToast } from '@zerodevx/svelte-toast';
  import { toastSuccess, toastError } from '$lib/utils/toast';

  interface SelectOption {
    value: string;
    label: string;
  }

  interface PriceGroupDetail {
    Multiple?: string;
    Price: string;
    MaximumQuantity?: string;
    MinimumQuantity?: string;
    MultipleStartQuantity?: string;
    Group: string;
    GroupID: string;
  }

  interface ApiProductItem {
    PrimarySupplier: string;
    Categories: string[];
    RRP: string;
    Model: string;
    InventoryID: string;
    Brand: string;
    Misc09: string;
    DefaultPurchasePrice: string;
    PriceGroups: {
      PriceGroup: PriceGroupDetail | PriceGroupDetail[];
    };
    SKU: string;
    Misc02: string;
  }

  // API Endpoints
  const brandsUrl = 'https://prod-06.australiasoutheast.logic.azure.com:443/workflows/58215302c1c24203886ccf481adbaac5/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=RFQ4OtbS6cyjB_JzaIsowmww4KBqPQgavWLg18znE5s';
  const suppliersUrl = 'https://prod-06.australiasoutheast.logic.azure.com:443/workflows/da5c5708146642768d63293d2bbb9668/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=-n0W0PxlF1G83xHYHGoEOhv3XmHXWlesbRk5NcgNT9w';
  const categoriesUrl = 'https://prod-47.australiasoutheast.logic.azure.com:443/workflows/0d67bc8f1bb64e78a2495f13a7498081/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=fJJzmNyuARuwEcNCoMuWwMS9kmWZQABw9kJXsUj9Wk8';
  const updatePricingUrl = 'https://prod-06.australiasoutheast.logic.azure.com:443/workflows/a14abba8479c457bafd63fe32fd9fea4/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=Evz4dRmWiP8p-hxjZxofNX1q_o_-ufQK2c_XI4Quxto';

  // State variables
  let products: any[] = [];
  let originalProducts: any[] = [];
  let filteredProducts: any[] = [];
  let brands: SelectOption[] = [];
  let suppliers: SelectOption[] = [];
  let categories: SelectOption[] = [];
  let loading = false;
  let loadingBrands = false;
  let loadingSuppliers = false;
  let loadingCategories = false;
  let brandError = '';
  let supplierError = '';
  let categoryError = '';
  let selectedRows: Set<string> = new Set();
  let selectAll = false;
  let submitLoading = false;

  // Filter state
  let skuFilter = '';
  let productNameFilter = '';
  let brandFilter: SelectOption | null = null;
  let supplierFilter: SelectOption | null = null;
  let categoryFilter: SelectOption | null = null;

  export let data: { products: any[] };

  // Add logging for when data changes
  $: {
    console.log('Data changed:', {
      hasData: !!data,
      productsLength: data?.products?.length || 0
    });
  }

  $: {
    // Initialize products from data prop
    if (data?.products && Array.isArray(data.products)) {
      console.log('Processing products data:', {
        receivedCount: data.products.length,
        currentOriginalCount: originalProducts.length
      });

      if (originalProducts.length === 0) {
        console.log('Initializing products arrays');
        originalProducts = [...data.products];
        products = [...data.products];
        filteredProducts = [...data.products];
        console.log('Products arrays initialized:', {
          originalCount: originalProducts.length,
          productsCount: products.length,
          filteredCount: filteredProducts.length
        });
      }
    } else {
      console.warn('Invalid or missing products data:', data);
    }
  }

  // Function to calculate client price and RRP
  function calculatePrices(product: any, source: 'mup' | 'price' = 'mup') {
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

    // Force Svelte reactivity
    products = products;
  }

  // Function to apply client MUP to all rows
  function applyClientMupToAll() {
    if (products.length === 0) {
      toastError('No data rows available');
      return;
    }
    const firstProduct = products[0];
    const clientMupVal = firstProduct.client_mup;
    
    products = products.map((prod, idx) => {
      if (idx === 0) return prod;
      prod.client_mup = clientMupVal;
      calculatePrices(prod);
      return prod;
    });
  }

  // Function to apply retail MUP to all rows
  function applyRetailMupToAll() {
    if (products.length === 0) {
      toastError('No data rows available');
      return;
    }
    const firstProduct = products[0];
    const retailMupVal = firstProduct.retail_mup;
    
    products = products.map((prod, idx) => {
      if (idx === 0) return prod;
      prod.retail_mup = retailMupVal;
      calculatePrices(prod);
      return prod;
    });
  }

  // Function to fetch brands
  async function fetchBrands() {
    loadingBrands = true;
    brandError = '';
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
        brands = data.message.Content
          .filter((brand: { ContentID: string; ContentName: string }) => brand.ContentName)
          .map((brand: { ContentID: string; ContentName: string }) => ({
            value: brand.ContentName,
            label: brand.ContentName
          }))
          .sort((a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label));
      } else {
        throw new Error('Failed to load brands: Invalid response format');
      }
    } catch (err: unknown) {
      const error = err as Error;
      brandError = error.message || 'Failed to load brands';
      brands = [];
    } finally {
      loadingBrands = false;
    }
  }

  // Function to fetch suppliers
  async function fetchSuppliers() {
    loadingSuppliers = true;
    supplierError = '';
    try {
      const response = await fetch(suppliersUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      const data = await response.json();

      if (data.status === 200 && data.message.Ack === "Success") {
        suppliers = data.message.Supplier
          .filter((supplier: { SupplierID: string }) => supplier.SupplierID !== "0")
          .map((supplier: { SupplierID: string }) => ({
            value: supplier.SupplierID,
            label: supplier.SupplierID
          }))
          .sort((a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label));
      } else {
        throw new Error('Failed to load suppliers: Invalid response format');
      }
    } catch (err: unknown) {
      const error = err as Error;
      supplierError = error.message || 'Failed to load suppliers';
    } finally {
      loadingSuppliers = false;
    }
  }

  // Function to fetch categories
  async function fetchCategories() {
    loadingCategories = true;
    categoryError = '';
    try {
      const response = await fetch(categoriesUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const data = await response.json();

      if (data.status === 200 && data.message?.Ack === "Success" && Array.isArray(data.message.Category)) {
        categories = data.message.Category.map((category: { CategoryID: string; CategoryName: string }) => ({
          value: category.CategoryID,
          label: category.CategoryName
        })).sort((a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label));
      } else {
        throw new Error('Failed to load categories: Invalid response format');
      }
    } catch (err: unknown) {
      const error = err as Error;
      categoryError = error.message || 'Failed to load categories';
    } finally {
      loadingCategories = false;
    }
  }

  function handleSelectAll() {
    if (selectAll) {
      products.forEach(prod => selectedRows.add(prod.sku));
    } else {
      selectedRows.clear();
    }
    selectedRows = selectedRows; // trigger reactivity
  }

  async function handleSubmitChecked() {
    if (selectedRows.size === 0) {
      toastError('Please select at least one row');
      return;
    }

    submitLoading = true;
    try {
      const selectedProducts = products.filter(prod => selectedRows.has(prod.sku));
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

      toastSuccess(`Successfully updated pricing for ${selectedRows.size} products`);
      
      // Mark updated rows with success class
      const updatedSkus = (data.Item || []).map((i: any) => i.SKU);
      products = products.map(prod => {
        if (updatedSkus.includes(prod.sku)) {
          prod.updated = true;
        }
        return prod;
      });
      
      selectedRows.clear();
      selectAll = false;
    } catch (error: any) {
      toastError(error.message || 'Failed to update pricing');
    } finally {
      submitLoading = false;
    }
  }

  async function handleFilterSubmit() {
    console.log('Filter button clicked');
    console.log('Current filter values:', {
      skuFilter,
      productNameFilter,
      brandFilter,
      supplierFilter,
      categoryFilter
    });

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
    if (skuFilter) {
      const skuArr = skuFilter
        .split(/\r?\n/)
        .map(s => s.trim())
        .filter(Boolean);
      if (skuArr.length) {
        f.SKU = skuArr;
      }
    }

    if (productNameFilter) f.Model = productNameFilter;
    if (brandFilter) f.Brand = brandFilter.value;
    if (supplierFilter) f.PrimarySupplier = supplierFilter.value;
    if (categoryFilter) f.CategoryID = categoryFilter.value;

    try {
      console.log('Making API request with filter:', JSON.stringify({ Filter: f }, null, 2));
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
      console.log('API response:', data);

      if (!data.Item) {
        console.warn('No Item array in response');
        products = [];
        originalProducts = [];
        filteredProducts = [];
        return;
      }

      // Transform the data
      const transformedProducts = (data.Item as ApiProductItem[]).map(item => {
        let clientPrice = '0';
        
        // Safely handle PriceGroups structure
        if (item.PriceGroups && typeof item.PriceGroups === 'object') {
          const priceGroup = Array.isArray(item.PriceGroups.PriceGroup) 
            ? item.PriceGroups.PriceGroup 
            : [item.PriceGroups.PriceGroup];
            
          const defaultClientGroup = priceGroup.find(
            (pg: PriceGroupDetail) => pg && (pg.Group === "Default Client Group" || pg.GroupID === "2")
          );
          
          if (defaultClientGroup) {
            clientPrice = defaultClientGroup.Price || '0';
          }
        }

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

      originalProducts = [...transformedProducts];
      products = [...transformedProducts];
      filteredProducts = [...transformedProducts];

      toastSuccess('Filters applied successfully');
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Error applying filters:', error);
      toastError('Error applying filters: ' + error.message);
    }
  }

  function handleResetFilters() {
    console.log('Reset filters clicked');
    // Reset all filters
    skuFilter = '';
    productNameFilter = '';
    brandFilter = null;
    supplierFilter = null;
    categoryFilter = null;
    
    // Reset products to original data
    products = [...originalProducts];
    filteredProducts = [...originalProducts];
    console.log('Reset complete. Products count:', products.length);
  }

  onMount(async () => {
    console.log('Component mounted');
    console.log('Current data state:', {
      originalProducts: originalProducts.length,
      products: products.length,
      filteredProducts: filteredProducts.length
    });
    
    await Promise.all([
      fetchBrands(),
      fetchSuppliers(),
      fetchCategories()
    ]);
  });
</script>

<SvelteToast options={{ 
  duration: 4000,
  pausable: true,
  reversed: false,
  intro: { y: -200 }
}} />

<div class="min-h-screen bg-gray-100 py-8 px-2 sm:px-3">
  <div class="max-w-[98%] mx-auto bg-white shadow p-6" transition:fade>
    <h2 class="text-2xl font-bold mb-6 text-gray-900">Update Product Pricing</h2>
    
    <!-- Filter Form -->
    <div class="mb-6 bg-white rounded-lg shadow">
      <div class="p-6">
        <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label for="sku_filter" class="block text-sm font-medium text-gray-700 mb-1">SKU</label>
            <textarea
              id="sku_filter"
              bind:value={skuFilter}
              class="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              rows="3"
              placeholder="Enter one SKU per line"
            ></textarea>
          </div>
          
          <div>
            <label for="product_name_filter" class="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
            <input
              type="text"
              id="product_name_filter"
              bind:value={productNameFilter}
              class="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Enter product name"
            />
          </div>
          
          <div>
            <label for="brand_filter" class="block text-sm font-medium text-gray-700 mb-1">Brand</label>
            {#if loadingBrands}
              <div class="animate-pulse bg-gray-200 h-9 rounded"></div>
            {:else if brandError}
              <div class="text-red-600 text-sm">{brandError}</div>
            {:else}
              <Select
                items={brands}
                bind:value={brandFilter}
                placeholder="Select Brand"
                containerStyles="position: relative;"
              />
            {/if}
          </div>
          
          <div>
            <label for="supplier_filter" class="block text-sm font-medium text-gray-700 mb-1">Primary Supplier</label>
            {#if loadingSuppliers}
              <div class="animate-pulse bg-gray-200 h-9 rounded"></div>
            {:else if supplierError}
              <div class="text-red-600 text-sm">{supplierError}</div>
            {:else}
              <Select
                items={suppliers}
                bind:value={supplierFilter}
                placeholder="Select Supplier"
                containerStyles="position: relative;"
              />
            {/if}
          </div>
          
          <div>
            <label for="category_filter" class="block text-sm font-medium text-gray-700 mb-1">Category</label>
            {#if loadingCategories}
              <div class="animate-pulse bg-gray-200 h-9 rounded"></div>
            {:else if categoryError}
              <div class="text-red-600 text-sm">{categoryError}</div>
            {:else}
              <Select
                items={categories}
                bind:value={categoryFilter}
                placeholder="Select Category"
                containerStyles="position: relative;"
              />
            {/if}
          </div>
        </div>
        
        <div class="mt-4 flex justify-end space-x-4">
          <button
            class="bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            on:click={handleResetFilters}
          >
            Reset Filters
          </button>
          <button
            class="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            on:click={handleFilterSubmit}
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="flex justify-between items-center sticky top-0 bg-white/80 backdrop-blur-sm py-4 z-50 border-b border-gray-200 shadow-sm">
      <button
        class="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[160px]"
        on:click={handleSubmitChecked}
        disabled={selectedRows.size === 0 || submitLoading}
      >
        {#if submitLoading}
          <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
          Updating...
        {:else}
          Submit Checked Rows
        {/if}
      </button>
    </div>

    <!-- Products Table -->
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <input
                type="checkbox"
                bind:checked={selectAll}
                on:change={handleSelectAll}
                class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Name</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Primary Supplier</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purchase Price</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Client MUP
              <button 
                class="ml-2 text-blue-600 hover:text-blue-800 text-xs"
                on:click={applyClientMupToAll}
              >Apply All</button>
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Retail MUP
              <button 
                class="ml-2 text-blue-600 hover:text-blue-800 text-xs"
                on:click={applyRetailMupToAll}
              >Apply All</button>
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client Price</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RRP</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#each products as product (product.sku)}
            <tr class={product.updated ? 'bg-green-50' : ''}>
              <td class="px-6 py-4 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={selectedRows.has(product.sku)}
                  on:change={(event) => {
                    const target = event.target as HTMLInputElement;
                    if (target.checked) {
                      selectedRows.add(product.sku);
                    } else {
                      selectedRows.delete(product.sku);
                    }
                    selectedRows = selectedRows;
                  }}
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </td>
              <td class="px-6 py-4 whitespace-nowrap">{product.sku}</td>
              <td class="px-6 py-4 whitespace-nowrap">{product.product_name}</td>
              <td class="px-6 py-4 whitespace-nowrap">
                {#if loadingBrands}
                  <div class="animate-pulse bg-gray-200 h-9 rounded"></div>
                {:else if brandError}
                  <div class="text-red-600 text-sm">{brandError}</div>
                {:else}
                  <Select
                    items={brands}
                    value={brands.find(b => b.value === product.brand)}
                    placeholder="Select Brand"
                    containerStyles="position: relative;"
                    on:change={(e) => {
                      product.brand = e.detail?.value || '';
                      products = products;
                    }}
                  />
                {/if}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                {#if loadingSuppliers}
                  <div class="animate-pulse bg-gray-200 h-9 rounded"></div>
                {:else if supplierError}
                  <div class="text-red-600 text-sm">{supplierError}</div>
                {:else}
                  <Select
                    items={suppliers}
                    value={suppliers.find(s => s.value === product.primary_supplier)}
                    placeholder="Select Supplier"
                    containerStyles="position: relative;"
                    on:change={(e) => {
                      product.primary_supplier = e.detail?.value || '';
                      products = products;
                    }}
                  />
                {/if}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                {#if loadingCategories}
                  <div class="animate-pulse bg-gray-200 h-9 rounded"></div>
                {:else if categoryError}
                  <div class="text-red-600 text-sm">{categoryError}</div>
                {:else}
                  <Select
                    items={categories}
                    value={categories.find(c => c.value === product.category)}
                    placeholder="Select Category"
                    containerStyles="position: relative;"
                    on:change={(e) => {
                      product.category = e.detail?.value || '';
                      products = products;
                    }}
                  />
                {/if}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <input
                  type="number"
                  bind:value={product.purchase_price}
                  on:input={() => calculatePrices(product)}
                  class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  step="0.01"
                />
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <input
                  type="number"
                  bind:value={product.client_mup}
                  on:input={() => calculatePrices(product, 'mup')}
                  class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  step="0.01"
                />
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <input
                  type="number"
                  bind:value={product.retail_mup}
                  on:input={() => calculatePrices(product, 'mup')}
                  class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  step="0.01"
                />
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <input
                  type="number"
                  bind:value={product.client_price}
                  on:input={() => calculatePrices(product, 'price')}
                  class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  step="0.01"
                />
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <input
                  type="number"
                  bind:value={product.rrp}
                  on:input={() => calculatePrices(product, 'price')}
                  class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  step="0.01"
                />
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>

<style>
  :global(.svelte-select) {
    --height: 38px;
    --border: 1px solid #d1d5db;
    --border-hover: 1px solid #3b82f6;
    --border-radius: 0.375rem;
    --background: white;
    --font-size: 0.875rem;
    --padding: 0 0.75rem;
    --placeholder-color: #9ca3af;
    width: 100%;
    position: relative;
  }

  :global(.svelte-select .selectContainer) {
    border: var(--border);
    border-radius: var(--border-radius);
    height: var(--height);
    background: var(--background);
    min-height: var(--height);
    padding: 0;
  }

  :global(.svelte-select .items) {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    border: var(--border);
    border-radius: var(--border-radius);
    background: var(--background);
    z-index: 10;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }

  :global(.svelte-select .item) {
    padding: 0.5rem 0.75rem;
    font-size: var(--font-size);
    cursor: pointer;
  }

  :global(.svelte-select .item.hover) {
    background-color: #f3f4f6;
  }

  :global(.svelte-select .item.active) {
    background-color: #e5e7eb;
  }

  :global(.svelte-toast) {
    top: 2rem !important;
    right: 2rem !important;
  }
  
  :global(.svelte-toast-item) {
    padding: 1rem !important;
    font-size: 1rem !important;
    font-weight: 500 !important;
    border-radius: 0.5rem !important;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
  }

  /* Mobile styles */
  @media (max-width: 768px) {
    .mobile-row {
      display: flex;
      flex-direction: column;
      padding: 1rem;
      border-bottom: 1px solid #e5e7eb;
    }

    .mobile-field {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 0;
    }

    .mobile-label {
      font-weight: 500;
      color: #374151;
      width: 40%;
    }

    .mobile-value {
      width: 60%;
    }
  }
</style> 