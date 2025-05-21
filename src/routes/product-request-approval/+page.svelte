<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { db } from '$lib/firebase';
  import { collection, query, where, getDocs } from 'firebase/firestore';
  import { toastSuccess, toastError } from '$lib/utils/toast';
  import type { ProductRequest, Brand, Supplier, Category, Markup } from '$lib/types';
  import Select from 'svelte-select';

  interface SelectOption {
    value: string;
    label: string;
  }

  // API Endpoints
  const brandsUrl = 'https://prod-06.australiasoutheast.logic.azure.com:443/workflows/58215302c1c24203886ccf481adbaac5/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=RFQ4OtbS6cyjB_JzaIsowmww4KBqPQgavWLg18znE5s';
  const suppliersUrl = 'https://prod-06.australiasoutheast.logic.azure.com:443/workflows/da5c5708146642768d63293d2bbb9668/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=-n0W0PxlF1G83xHYHGoEOhv3XmHXWlesbRk5NcgNT9w';

  let productRequests: ProductRequest[] = [];
  let brands: SelectOption[] = [];
  let suppliers: SelectOption[] = [];
  let categoriesList: Category[] = [];
  let markupResults: Record<string, Markup[]> = {};
  let loading = true;
  let loadingBrands = false;
  let loadingSuppliers = false;
  let brandError = '';
  let supplierError = '';
  let selectedRows: Set<string> = new Set();
  let selectAll = false;

  // Function to calculate client price and RRP
  function calculatePrices(request: ProductRequest, source: 'mup' | 'price' = 'mup') {
    const purchasePrice = parseFloat(request.purchase_price?.toString() || '0');

    if (source === 'mup') {
      // Calculate prices from MUPs
      const clientMup = parseFloat(request.client_mup?.toString() || '0');
      const retailMup = parseFloat(request.retail_mup?.toString() || '0');

      // Calculate client price: purchase price * client MUP * 1.1 (GST)
      if (purchasePrice && clientMup) {
        request.client_price = parseFloat((purchasePrice * clientMup * 1.1).toFixed(2));
      }

      // Calculate RRP: purchase price * retail MUP * 1.1 (GST)
      if (purchasePrice && retailMup) {
        request.rrp = parseFloat((purchasePrice * retailMup * 1.1).toFixed(2));
      }
    } else {
      // Calculate MUPs from prices
      const clientPrice = parseFloat(request.client_price?.toString() || '0');
      const rrp = parseFloat(request.rrp?.toString() || '0');

      // Calculate client MUP: (client price / 1.1) / purchase price
      if (purchasePrice && clientPrice) {
        request.client_mup = parseFloat(((clientPrice / 1.1) / purchasePrice).toFixed(2));
      }

      // Calculate retail MUP: (RRP / 1.1) / purchase price
      if (purchasePrice && rrp) {
        request.retail_mup = parseFloat(((rrp / 1.1) / purchasePrice).toFixed(2));
      }
    }
  }

  // Function to apply client MUP to all rows
  function applyClientMupToAll() {
    if (productRequests.length === 0) {
      toastError('No data rows available');
      return;
    }
    const firstRequest = productRequests[0];
    const clientMupVal = firstRequest.client_mup;
    
    productRequests = productRequests.map((req, idx) => {
      if (idx === 0) return req;
      req.client_mup = clientMupVal;
      calculatePrices(req);
      return req;
    });
  }

  // Function to apply retail MUP to all rows
  function applyRetailMupToAll() {
    if (productRequests.length === 0) {
      toastError('No data rows available');
      return;
    }
    const firstRequest = productRequests[0];
    const retailMupVal = firstRequest.retail_mup;
    
    productRequests = productRequests.map((req, idx) => {
      if (idx === 0) return req;
      req.retail_mup = retailMupVal;
      calculatePrices(req);
      return req;
    });
  }

  // Function to apply category to all rows
  function applyCategoryToAll() {
    if (productRequests.length === 0) {
      toastError('No data rows available');
      return;
    }
    const firstRequest = productRequests[0];
    const categoryVal = firstRequest.category;
    
    productRequests = productRequests.map((req, idx) => {
      if (idx === 0) return req;
      req.category = categoryVal;
      return req;
    });
  }

  // Function to fetch brands
  async function fetchBrands() {
    console.log('Starting fetchBrands...');
    loadingBrands = true;
    brandError = '';
    try {
      console.log('Making API call to fetch brands...');
      const response = await fetch(brandsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      console.log('API Response status:', response.status);
      const data = await response.json();
      console.log('API Response data:', data);

      if (data.status === 200 && data.message?.Ack === "Success" && Array.isArray(data.message.Content)) {
        brands = data.message.Content
          .filter((brand: { ContentID: string; ContentName: string }) => brand.ContentName)
          .map((brand: { ContentID: string; ContentName: string }) => ({
            value: brand.ContentName,
            label: brand.ContentName
          }))
          .sort((a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label));
        console.log('Processed brands:', brands);
      } else {
        throw new Error('Failed to load brands: Invalid response format');
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error in fetchBrands:', error);
      brandError = error.message || 'Failed to load brands';
      brands = [];
    } finally {
      loadingBrands = false;
      console.log('fetchBrands completed. Brands:', brands, 'Error:', brandError);
    }
  }

  // Function to fetch suppliers
  async function fetchSuppliers() {
    console.log('Starting fetchSuppliers...');
    loadingSuppliers = true;
    supplierError = '';
    try {
      console.log('Making API call to fetch suppliers...');
      const response = await fetch(suppliersUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      console.log('API Response status:', response.status);
      const data = await response.json();
      console.log('API Response data:', data);

      if (data.status === 200 && data.message.Ack === "Success") {
        suppliers = data.message.Supplier
          .filter((supplier: { SupplierID: string }) => supplier.SupplierID !== "0")
          .map((supplier: { SupplierID: string }) => ({
            value: supplier.SupplierID,
            label: supplier.SupplierID
          }))
          .sort((a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label));
        console.log('Processed suppliers:', suppliers);
      } else {
        throw new Error('Failed to load suppliers: Invalid response format');
      }
    } catch (error) {
      console.error('Error in fetchSuppliers:', error);
      supplierError = error instanceof Error ? error.message : 'Failed to load suppliers';
    } finally {
      loadingSuppliers = false;
      console.log('fetchSuppliers completed. Suppliers:', suppliers, 'Error:', supplierError);
    }
  }

  // Fetch data from APIs
  async function loadData() {
    try {
      const response = await fetch('https://prod-47.australiasoutheast.logic.azure.com:443/workflows/0d67bc8f1bb64e78a2495f13a7498081/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=fJJzmNyuARuwEcNCoMuWwMS9kmWZQABw9kJXsUj9Wk8', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const data = await response.json();
      console.log('Categories API Response:', data);

      if (data.status === 200 && data.message?.Ack === "Success" && Array.isArray(data.message.Category)) {
        categoriesList = data.message.Category.map((category: { CategoryID: string; CategoryName: string }) => ({
          value: category.CategoryID,
          label: category.CategoryName
        })).sort((a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label));
        console.log('Processed categories:', categoriesList);
      } else {
        throw new Error('Failed to load categories: Invalid response format');
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error loading categories:', error);
      toastError('Failed to load reference data');
    }
  }

  // Load product requests from Firestore
  async function loadProductRequests() {
    console.log('Starting to load product requests...');
    try {
      const q = query(
        collection(db, 'product_requests'),
        where('status', '==', 'request')
      );
      console.log('Executing Firestore query:', {
        collection: 'product_requests',
        status: 'request'
      });

      const querySnapshot = await getDocs(q);
      console.log('Query response received. Total documents:', querySnapshot.size);

      productRequests = querySnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Processing document:', {
          id: doc.id,
          data: {
            requestor: `${data.requestor_firstName} ${data.requestor_lastName}`,
            sku: data.sku,
            product_name: data.product_name,
            brand: data.brand,
            primary_supplier: data.primary_supplier,
            category: data.category,
            purchase_price: data.purchase_price,
            client_mup: data.client_mup,
            retail_mup: data.retail_mup,
            client_price: data.client_price,
            rrp: data.rrp,
            status: data.status
          }
        });
        return {
          id: doc.id,
          ...data
        };
      }) as ProductRequest[];

      console.log('Final processed product requests:', {
        count: productRequests.length,
        requests: productRequests.map(req => ({
          id: req.id,
          sku: req.sku,
          brand: req.brand,
          supplier: req.primary_supplier
        }))
      });
    } catch (error) {
      console.error('Error loading product requests:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      toastError('Failed to load product requests');
    }
  }

  // Search markups based on product request terms
  async function searchMarkups() {
    try {
      const brandTerms = productRequests.map(req => (req.brand || '').trim());
      const supplierTerms = productRequests.map(req => (req.primary_supplier || '').trim());
      const searchTerms = Array.from(new Set([...brandTerms, ...supplierTerms]))
        .filter(term => term !== '');

      const markupsSnapshot = await getDocs(collection(db, 'markups'));
      const allMarkups = markupsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Markup[];

      markupResults = {};
      searchTerms.forEach(term => {
        markupResults[term] = allMarkups.filter(markup => 
          markup.brand?.toLowerCase().includes(term.toLowerCase())
        );
      });
    } catch (error) {
      console.error('Error searching markups:', error);
      toastError('Failed to search markups');
    }
  }

  function handleSelectAll() {
    if (selectAll) {
      productRequests.forEach(req => selectedRows.add(req.id));
    } else {
      selectedRows.clear();
    }
    selectedRows = selectedRows; // trigger reactivity
  }

  async function handleSubmitChecked() {
    if (selectedRows.size === 0) {
      toastError('Please select at least one request');
      return;
    }
    // Implementation for submitting checked rows
    toastSuccess('Selected requests submitted successfully');
  }

  async function handleDeleteChecked() {
    if (selectedRows.size === 0) {
      toastError('Please select at least one request');
      return;
    }
    // Implementation for deleting checked rows
    toastSuccess('Selected requests deleted successfully');
  }

  onMount(async () => {
    await Promise.all([
      fetchBrands(),
      fetchSuppliers(),
      loadData(),
      loadProductRequests(),
      searchMarkups()
    ]);
    loading = false;
  });
</script>

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
</style>

<div class="min-h-screen bg-gray-100 py-8 px-2 sm:px-3">
  <div class="max-w-[98%] mx-auto bg-white shadow p-6" transition:fade>
    <h2 class="text-2xl font-bold mb-6 text-gray-900">Product Request Approval</h2>
    
    <!-- Product Request Form -->
    <div class="space-y-6">
      <div class="flex justify-between items-center sticky top-0 bg-white/80 backdrop-blur-sm py-4 z-50 border-b border-gray-200 shadow-sm">
        <button
          class="bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700"
          on:click={handleDeleteChecked}
          disabled={selectedRows.size === 0}
        >
          Delete Checked Request
        </button>
        <button
          class="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
          on:click={handleSubmitChecked}
          disabled={selectedRows.size === 0}
        >
          Submit Checked Rows
        </button>
      </div>

      <!-- Product Requests Table -->
      <div class="overflow-visible">
        <!-- Headers -->
        <div class="hidden md:grid md:grid-cols-[40px_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] md:gap-4 md:px-6 md:py-3 text-sm font-medium text-gray-500 uppercase tracking-wider bg-gray-50 rounded-t-lg">
          <div>
            <input
              type="checkbox"
              bind:checked={selectAll}
              on:change={handleSelectAll}
              class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </div>
          <div>Requestor Name</div>
          <div>SKU</div>
          <div>Product Name</div>
          <div>Brand</div>
          <div>Primary Supplier</div>
          <div>
            Category
            <button 
              class="ml-2 text-blue-600 hover:text-blue-800 text-xs"
              on:click={applyCategoryToAll}
            >Apply All</button>
          </div>
          <div>Purchase Price</div>
          <div>
            Client MUP
            <button 
              class="ml-2 text-blue-600 hover:text-blue-800 text-xs"
              on:click={applyClientMupToAll}
            >Apply All</button>
          </div>
          <div>
            Retail MUP
            <button 
              class="ml-2 text-blue-600 hover:text-blue-800 text-xs"
              on:click={applyRetailMupToAll}
            >Apply All</button>
          </div>
          <div>Client Price</div>
          <div>RRP</div>
        </div>

        <!-- Rows -->
        <div class="divide-y divide-gray-200">
          {#each productRequests as request}
            <div class="bg-white md:hover:bg-gray-50 transition-colors">
              <div class="md:grid md:grid-cols-[40px_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] md:gap-4 md:items-center p-4 md:px-6 md:py-4">
                <!-- Checkbox -->
                <div class="mb-4 md:mb-0">
                  <input
                    type="checkbox"
                    checked={selectedRows.has(request.id)}
                    on:change={(event) => {
                      const target = event.target as HTMLInputElement;
                      if (target.checked) {
                        selectedRows.add(request.id);
                      } else {
                        selectedRows.delete(request.id);
                      }
                      selectedRows = selectedRows;
                    }}
                    class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>

                <!-- Requestor Name -->
                <div class="mb-4 md:mb-0">
                  <label class="block md:hidden text-sm font-medium text-gray-700 mb-1">Requestor Name</label>
                  <span class="text-gray-900">{request.requestor_firstName} {request.requestor_lastName}</span>
                </div>

                <!-- SKU -->
                <div class="mb-4 md:mb-0">
                  <label class="block md:hidden text-sm font-medium text-gray-700 mb-1">SKU</label>
                  <span class="text-gray-900">{request.sku}</span>
                </div>

                <!-- Product Name -->
                <div class="mb-4 md:mb-0">
                  <label class="block md:hidden text-sm font-medium text-gray-700 mb-1">Product Name</label>
                  <span class="text-gray-900">{request.product_name}</span>
                </div>

                <!-- Brand -->
                <div class="mb-4 md:mb-0">
                  <label class="block md:hidden text-sm font-medium text-gray-700 mb-1">Brand</label>
                  {#if loadingBrands}
                    <div class="animate-pulse bg-gray-200 h-9 rounded"></div>
                  {:else if brandError}
                    <div class="text-red-600 text-sm">{brandError}</div>
                  {:else}
                    <Select
                      items={brands}
                      value={brands.find(b => b.value === request.brand) || null}
                      placeholder="Select Brand"
                      containerStyles="position: relative;"
                      on:change={(e) => {
                        request.brand = e.detail?.value || '';
                        // Trigger search for markups when brand changes
                        searchMarkups();
                      }}
                    />
                  {/if}
                </div>

                <!-- Primary Supplier -->
                <div class="mb-4 md:mb-0">
                  <label class="block md:hidden text-sm font-medium text-gray-700 mb-1">Primary Supplier</label>
                  {#if loadingSuppliers}
                    <div class="animate-pulse bg-gray-200 h-9 rounded"></div>
                  {:else if supplierError}
                    <div class="text-red-600 text-sm">{supplierError}</div>
                  {:else}
                    <Select
                      items={suppliers}
                      value={suppliers.find(s => s.value === request.primary_supplier)}
                      placeholder="Select Supplier"
                      containerStyles="position: relative;"
                      on:change={(e) => {
                        request.primary_supplier = e.detail?.value || '';
                      }}
                    />
                  {/if}
                </div>

                <!-- Category -->
                <div class="mb-4 md:mb-0">
                  <label class="block md:hidden text-sm font-medium text-gray-700 mb-1">Category</label>
                  <Select
                    items={categoriesList}
                    value={categoriesList.find(c => c.value === request.category) || null}
                    placeholder="Select Category"
                    containerStyles="position: relative;"
                    on:change={(e) => {
                      request.category = e.detail?.value || '';
                    }}
                  />
                </div>

                <!-- Purchase Price -->
                <div class="mb-4 md:mb-0">
                  <label class="block md:hidden text-sm font-medium text-gray-700 mb-1">Purchase Price</label>
                  <input
                    type="number"
                    value={request.purchase_price}
                    class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    step="0.01"
                    readonly
                  />
                </div>

                <!-- Client MUP -->
                <div class="mb-4 md:mb-0">
                  <label class="block md:hidden text-sm font-medium text-gray-700 mb-1">Client MUP</label>
                  <input
                    type="number"
                    bind:value={request.client_mup}
                    on:input={() => calculatePrices(request, 'mup')}
                    class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    step="0.01"
                  />
                </div>

                <!-- Retail MUP -->
                <div class="mb-4 md:mb-0">
                  <label class="block md:hidden text-sm font-medium text-gray-700 mb-1">Retail MUP</label>
                  <input
                    type="number"
                    bind:value={request.retail_mup}
                    on:input={() => calculatePrices(request, 'mup')}
                    class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    step="0.01"
                  />
                </div>

                <!-- Client Price -->
                <div class="mb-4 md:mb-0">
                  <label class="block md:hidden text-sm font-medium text-gray-700 mb-1">Client Price</label>
                  <input
                    type="number"
                    bind:value={request.client_price}
                    on:input={() => calculatePrices(request, 'price')}
                    class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    step="0.01"
                  />
                </div>

                <!-- RRP -->
                <div class="mb-4 md:mb-0">
                  <label class="block md:hidden text-sm font-medium text-gray-700 mb-1">RRP</label>
                  <input
                    type="number"
                    bind:value={request.rrp}
                    on:input={() => calculatePrices(request, 'price')}
                    class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    step="0.01"
                  />
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Markup Search Results -->
      <div class="mt-8">
        <h3 class="text-xl font-bold mb-4 text-gray-900">Search Results from Markups</h3>
        <div class="overflow-x-auto">
          <div class="hidden md:grid md:grid-cols-[1fr_1fr_1fr_2fr_1fr] md:gap-4 md:px-6 md:py-3 text-sm font-medium text-gray-500 uppercase tracking-wider bg-gray-50 rounded-t-lg">
            <div>Brand</div>
            <div>Main Category</div>
            <div>Sub Category</div>
            <div>Description</div>
            <div>RRP Markup</div>
          </div>

          <div class="divide-y divide-gray-200">
            {#each Object.entries(markupResults) as [term, markups]}
              {#each markups as markup}
                <div class="bg-white md:hover:bg-gray-50 transition-colors">
                  <div class="md:grid md:grid-cols-[1fr_1fr_1fr_2fr_1fr] md:gap-4 md:items-center p-4 md:px-6 md:py-4">
                    <div class="mb-4 md:mb-0">
                      <label class="block md:hidden text-sm font-medium text-gray-700 mb-1">Brand</label>
                      <span class="text-gray-900">{markup.brand}</span>
                    </div>
                    <div class="mb-4 md:mb-0">
                      <label class="block md:hidden text-sm font-medium text-gray-700 mb-1">Main Category</label>
                      <span class="text-gray-900">{markup.main_category}</span>
                    </div>
                    <div class="mb-4 md:mb-0">
                      <label class="block md:hidden text-sm font-medium text-gray-700 mb-1">Sub Category</label>
                      <span class="text-gray-900">{markup.sub_category}</span>
                    </div>
                    <div class="mb-4 md:mb-0">
                      <label class="block md:hidden text-sm font-medium text-gray-700 mb-1">Description</label>
                      <span class="text-gray-900">{markup.description}</span>
                    </div>
                    <div class="mb-4 md:mb-0">
                      <label class="block md:hidden text-sm font-medium text-gray-700 mb-1">RRP Markup</label>
                      <span class="text-gray-900">{markup.rrp_markup}</span>
                    </div>
                  </div>
                </div>
              {/each}
            {/each}
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Loading Overlay -->
  {#if loading}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white p-6 rounded-lg shadow-xl">
        <div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto"></div>
        <p class="mt-4 text-gray-700">Loading...</p>
      </div>
    </div>
  {/if}
</div>

<!-- Add portal container at the end of the body -->
<div id="select-portal" /> 