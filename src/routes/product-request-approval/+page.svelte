<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { db } from '$lib/firebase';
  import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
  import { toastSuccess, toastError } from '$lib/utils/toast';
  import type { ProductRequest, Brand, Supplier, Category, Markup } from '$lib/types';
  import { userProfile, type UserProfile } from '$lib/userProfile';
  import Select from 'svelte-select';


  interface SelectOption {
    value: string;
    label: string;
  }

  // API Endpoints
  const brandsUrl = 'https://prod-06.australiasoutheast.logic.azure.com:443/workflows/58215302c1c24203886ccf481adbaac5/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=RFQ4OtbS6cyjB_JzaIsowmww4KBqPQgavWLg18znE5s';
  const suppliersUrl = 'https://prod-06.australiasoutheast.logic.azure.com:443/workflows/da5c5708146642768d63293d2bbb9668/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=-n0W0PxlF1G83xHYHGoEOhv3XmHXWlesbRk5NcgNT9w';
  const teamsNotificationUrl = 'https://prod-41.australiasoutheast.logic.azure.com:443/workflows/c616bc7890dc4174877af4a47898eca2/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=Fgu75prN-vWpPg5JKVcWpt3zcOL4V76TI_ssXhgPk8I';

  let productRequests: ProductRequest[] = [];
  let brands: SelectOption[] = [];
  let suppliers: SelectOption[] = [];
  let categoriesList: Category[] = [];
  let markupResults: Record<string, Markup[]> = {};
  let loading = false;
  let loadingBrands = false;
  let loadingSuppliers = false;
  let brandError = '';
  let supplierError = '';
  let selectedRows: Set<string> = new Set();
  let selectAll = false;
  let deleteLoading = false;
  let submitLoading = false;
  let profile: UserProfile | null = null;

  interface SkuToRequestMap {
    [key: string]: ProductRequest[];
  }

  interface ApiItem {
    SKU: string;
    [key: string]: any;
  }

  interface ApiResponseItem {
    InventoryID: string;
    SKU: string;
  }

  interface ApiResponse {
    Item: ApiResponseItem[];
    CurrentTime: string;
    Ack: string;
    message?: string;
  }

  interface ProductRequestPayload {
    SKU: string;
    Model: string;
    Brand: string;
    PrimarySupplier: string;
    DefaultPurchasePrice: number;
    Category: number;
    RRP: number;
    ClientMUP: number;
    RetailMUP: number;
    PriceGroup: number;
    requestor_email: string;
    requestor_firstname: string;
    requestor_lastname: string;
    TaxIncluded: boolean;
  }

  // Function to calculate client price and RRP
  function calculatePrices(request: ProductRequest, source: 'mup' | 'price' = 'mup') {
    const purchasePrice = parseFloat(request.purchase_price?.toString() || '0');

    if (source === 'mup') {
      // Calculate prices from MUPs
      const clientMup = parseFloat(request.client_mup?.toString() || '0');
      const retailMup = parseFloat(request.retail_mup?.toString() || '0');

      // Calculate client price: purchase price * client MUP
      if (purchasePrice && clientMup) {
        request.client_price = parseFloat((purchasePrice * clientMup).toFixed(2));
        // Force Svelte reactivity
        productRequests = productRequests;
      }

      // Calculate RRP: purchase price * retail MUP
      if (purchasePrice && retailMup) {
        request.rrp = parseFloat((purchasePrice * retailMup).toFixed(2));
        // Force Svelte reactivity
        productRequests = productRequests;
      }
    } else {
      // Calculate MUPs from prices
      const clientPrice = parseFloat(request.client_price?.toString() || '0');
      const rrp = parseFloat(request.rrp?.toString() || '0');

      // Calculate client MUP: client price / purchase price
      if (purchasePrice && clientPrice) {
        request.client_mup = parseFloat((clientPrice / purchasePrice).toFixed(2));
        // Force Svelte reactivity
        productRequests = productRequests;
      }

      // Calculate retail MUP: RRP / purchase price
      if (purchasePrice && rrp) {
        request.retail_mup = parseFloat((rrp / purchasePrice).toFixed(2));
        // Force Svelte reactivity
        productRequests = productRequests;
      }
    }

    // Ensure all values are properly formatted to 2 decimal places
    if (request.client_price) request.client_price = parseFloat(request.client_price.toFixed(2));
    if (request.rrp) request.rrp = parseFloat(request.rrp.toFixed(2));
    if (request.client_mup) request.client_mup = parseFloat(request.client_mup.toFixed(2));
    if (request.retail_mup) request.retail_mup = parseFloat(request.retail_mup.toFixed(2));
  }

  // Function to apply client MUP to all rows
  function applyClientMupToAll() {
    if (productRequests.length === 0) {
      toastError('No data rows available');
      return;
    }
    
    productRequests = productRequests.map((req) => {
      if (req.retail_mup && req.retail_mup > 0) {
        req.client_mup = parseFloat((req.retail_mup - 0.05).toFixed(2));
        calculatePrices(req);
      }
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

  // Fetch data from APIs
  async function loadData() {
    try {
      const response = await fetch('https://prod-47.australiasoutheast.logic.azure.com:443/workflows/0d67bc8f1bb64e78a2495f13a7498081/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=fJJzmNyuARuwEcNCoMuWwMS9kmWZQABw9kJXsUj9Wk8', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const data = await response.json();

      if (data.status === 200 && data.message?.Ack === "Success" && Array.isArray(data.message.Category)) {
        categoriesList = data.message.Category.map((category: { CategoryID: string; CategoryName: string }) => ({
          value: category.CategoryID,
          label: category.CategoryName
        })).sort((a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label));
      } else {
        throw new Error('Failed to load categories: Invalid response format');
      }
    } catch (err: unknown) {
      toastError('Failed to load reference data');
    }
  }

  // Load product requests from Firestore
  async function loadProductRequests() {
    try {
      const q = query(
        collection(db, 'product_requests'),
        where('status', '==', 'request')
      );

      const querySnapshot = await getDocs(q);
      productRequests = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data
        };
      }) as ProductRequest[];
      
      // Enhanced logging of fetched data
      console.log('=== Fetched Product Requests from Firebase ===');
      console.log('Total requests found:', productRequests.length);
      productRequests.forEach((request, index) => {
        console.log(`Request #${index + 1}:`, {
          id: request.id,
          sku: request.sku,
          product_name: request.product_name,
          brand: request.brand,
          primary_supplier: request.primary_supplier,
          category: request.category,
          purchase_price: request.purchase_price,
          client_mup: request.client_mup,
          retail_mup: request.retail_mup,
          client_price: request.client_price,
          rrp: request.rrp,
          tax_included: request.tax_included,
          requestor_email: request.requestor_email,
          requestor_firstName: request.requestor_firstName,
          requestor_lastName: request.requestor_lastName,
          status: request.status
        });
      });
      console.log('=======================================');
    } catch (err: unknown) {
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
    } catch (err: unknown) {
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

    submitLoading = true;
    const successfulSubmits: string[] = [];
    const failedSubmits: string[] = [];

    try {
      const selectedRequests = productRequests.filter(req => selectedRows.has(req.id));

      const createProductUrl = 'https://prod-56.australiasoutheast.logic.azure.com:443/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=G8m_h5Dl8GpIRQtlN0oShby5zrigLKTWEddou-zGQIs';

      // Validate all requests first
      const invalidRequests = selectedRequests.filter(request => 
        !request.sku || !request.product_name || !request.brand || 
        !request.primary_supplier || !request.category || 
        !request.purchase_price || !request.client_mup || 
        !request.retail_mup || !request.rrp
      );

      if (invalidRequests.length > 0) {
        invalidRequests.forEach(request => {
          failedSubmits.push(`${request.sku || 'Unknown SKU'} (missing required fields)`);
        });
      } else {
        // Create a single payload for all valid requests
        const payload = {
          Item: selectedRequests.map(request => {
            return {
              SKU: request.sku,
              Model: request.product_name,
              Brand: request.brand,
              PrimarySupplier: request.primary_supplier,
              DefaultPurchasePrice: parseFloat(request.purchase_price.toString()),
              Category: parseInt(request.category, 10),
              RRP: parseFloat(request.rrp.toString()),
              Misc02: parseFloat(request.client_mup.toString()),
              Misc09: parseFloat(request.retail_mup.toString()),
              Active: true,
              PriceGroups: {
                PriceGroup: [
                  {
                    Group: "Default Client Group",
                    Price: parseFloat(request.client_price.toString())
                  },
                  {
                    Group: "Default RRP (Dont Assign to clients)",
                    Price: parseFloat(request.client_price.toString())
                  }
                ]
              },
              TaxInclusive: false,
              TaxFreeItem: request.tax_included || false
            };
          }),
          action: "AddItem"
        };

        console.log('Submitted payload:', payload);
        console.log('Target endpoint:', createProductUrl);
        // Enable API call
        const response = await fetch(createProductUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const responseData = await response.json();
        
        // Log the full response structure
        console.log('API Response Structure:', JSON.stringify(responseData, null, 2));
        
        // Debug the response structure
        console.log('Response analysis:', {
          directAck: responseData.Ack,
          nestedAck: responseData.message?.Ack,
          directMessages: responseData.Messages,
          nestedMessages: responseData.message?.Messages,
          directItem: responseData.Item,
          nestedItem: responseData.message?.Item,
          responseOk: response.ok,
          responseStatus: response.status
        });
        
        interface MaropostItem {
          SKU: string;
          InventoryID: string;
        }
        
        interface MaropostResponse {
          status: number;
          message: {
            Ack: string;
            Item: MaropostItem[];
          };
        }
        
        // Handle both direct response and nested message response structures
        const ackStatus = responseData.Ack || responseData.message?.Ack;
        const messagesData = responseData.Messages || responseData.message?.Messages;
        const itemData = responseData.Item || responseData.message?.Item;

        if (response.ok && (ackStatus === "Success" || ackStatus === "Warning")) {
          // Store selected requests data for Teams notification before removing them
          const requestsForNotification = [...selectedRequests];
          
          // Handle existing products (Warning case)
          const existingSkus: string[] = [];
          if (ackStatus === "Warning" && messagesData?.Warning) {
            messagesData.Warning.forEach((warning: any) => {
              if (warning.Message && warning.Message.includes("SKU already exists")) {
                const skuMatch = warning.Message.match(/SKU already exists - use UpdateItem (.+)/);
                if (skuMatch && skuMatch[1] && typeof skuMatch[1] === 'string') {
                  existingSkus.push(skuMatch[1].trim());
                }
              }
            });
          }
          
          console.log('Extracted existing SKUs:', existingSkus);
          
          // Map SKUs to their inventory IDs from the response
          const skuToInventoryId: Record<string, string> = {};
          
          // Handle the Item field - it could be an array, empty string, or null
          if (itemData && Array.isArray(itemData) && itemData.length > 0) {
            console.log('Processing Item array from response:', itemData);
            (itemData as MaropostItem[]).forEach(item => {
              if (item.SKU && item.InventoryID) {
                skuToInventoryId[item.SKU] = item.InventoryID;
              }
            });
          } else {
            console.log('No Item array in response, Item field:', itemData);
          }
          
          // For existing SKUs, we'll mark them as processed but note they already existed
          existingSkus.forEach(sku => {
            skuToInventoryId[sku] = 'existing-product';
          });
          
          // Log the mapping process
          console.log('Mapped SKU to Inventory IDs:', skuToInventoryId);
          console.log('Response type:', ackStatus === 'Warning' ? 'Warning (some products exist)' : 'Success (new products created)');
          
          for (const request of selectedRequests) {
            const inventoryId = skuToInventoryId[request.sku] || 'not-found';
            const isExistingProduct = existingSkus.includes(request.sku);
            
            console.log('Would save to Firebase for request ID:', request.id, {
              status: 'product_created',
              product_creation_date: new Date().toISOString(),
              category: request.category,
              client_mup: request.client_mup,
              retail_mup: request.retail_mup,
              client_price: request.client_price,
              rrp: request.rrp,
              tax_included: false,
              approved_by: profile ? `${profile.firstName} ${profile.lastName}` : 'Unknown User',
              approved_by_email: profile?.email || 'Unknown Email',
              inventory_id: inventoryId,
              product_already_existed: isExistingProduct
            });
            
            // Enable Firestore update
            const docRef = doc(db, 'product_requests', request.id);
            await updateDoc(docRef, {
              status: 'product_created',
              product_creation_date: new Date().toISOString(),
              category: request.category,
              client_mup: request.client_mup,
              retail_mup: request.retail_mup,
              client_price: request.client_price,
              rrp: request.rrp,
              tax_included: request.tax_included || false,
              approved_by: profile ? `${profile.firstName} ${profile.lastName}` : 'Unknown User',
              approved_by_email: profile?.email || 'Unknown Email',
              inventory_id: inventoryId,
              product_already_existed: isExistingProduct
            });

            successfulSubmits.push(isExistingProduct ? `${request.sku} (already existed)` : request.sku);
          }

          // Remove from local list and clear selections after processing all requests
          selectedRequests.forEach(request => {
            productRequests = productRequests.filter(req => req.id !== request.id);
            selectedRows.delete(request.id);
          });

          // Force reactivity updates
          productRequests = productRequests;
          selectedRows = selectedRows;
          selectAll = false;

          // Prepare and send Teams notification using stored data
          const tableRows = requestsForNotification.map(request => {
            const isExisting = existingSkus.includes(request.sku || '');
            const statusIcon = isExisting ? '⚠️' : '✅';
            const sku = request.sku || 'Unknown SKU';
            const productName = request.product_name || 'Unknown Product';
            const brand = request.brand || 'Unknown Brand';
            const supplier = request.primary_supplier || 'Unknown Supplier';
            const clientPrice = request.client_price ? request.client_price.toFixed(2) : '0.00';
            const rrp = request.rrp ? request.rrp.toFixed(2) : '0.00';
            const taxInclusive = request.tax_included || false;
            
            return `<tr><td><a href="https://www.rapidsupplies.com.au/_cpanel/products/view?sku=${sku}">${sku}</a> ${statusIcon}</td><td>${productName}</td><td>${brand}</td><td>${supplier}</td><td>${clientPrice}</td><td>${rrp}</td><td>${taxInclusive}</td></tr>`;
          }).join('');
          
          const newProductCount = requestsForNotification.filter(r => r.sku && !existingSkus.includes(r.sku)).length;
          const existingProductCount = existingSkus.length;
          
          let statusMessage = '';
          if (newProductCount > 0 && existingProductCount > 0) {
            statusMessage = `✅${newProductCount} product(s) have been successfully created and ⚠️${existingProductCount} product(s) already existed in the system.`;
          } else if (newProductCount > 0) {
            statusMessage = `✅The following ${newProductCount} product(s) have been successfully created.`;
          } else {
            statusMessage = `⚠️All ${existingProductCount} product(s) already existed in the system.`;
          }
          
          const firstRequest = requestsForNotification[0];
          const requestorName = firstRequest ? `${firstRequest.requestor_firstName || 'Unknown'} ${firstRequest.requestor_lastName || 'Name'}` : 'Unknown User';
          const requestorEmail = firstRequest?.requestor_email || 'Unknown Email';
          
          const notificationPayload = {
            action: "product",
            body: `<h1 class=\"editor-heading-h3\"><b><strong class=\"editor-text-bold\">🔔 </strong></b><b><strong class=\"editor-text-bold\" style=\"color: rgb(65, 117, 5);\">Product Request Processed!</strong></b>✅</h1>
<p class=\"editor-paragraph\">${statusMessage} Approved by <b><strong class=\"editor-text-bold\">${profile ? `${profile.firstName} ${profile.lastName}` : 'Unknown User'}</strong></b>👤</p>
<p class=\"editor-paragraph\">👤<b><strong class=\"editor-text-bold\" style=\"color: rgb(139, 87, 42);\">Requestor Information:</strong></b></p>
<p class=\"editor-paragraph\">Name: <b><strong class=\"editor-text-bold\">${requestorName}</strong></b></p>
<p class=\"editor-paragraph\">Email: <b><strong class=\"editor-text-bold\">${requestorEmail}</strong></b></p>
<p class=\"editor-paragraph\">📦<b><strong class=\"editor-text-bold\" style=\"color: rgb(139, 87, 42);\">Processed Products:</strong></b></p>
<p class=\"editor-paragraph\"><small>✅ = Newly Created | ⚠️ = Already Existed</small></p>
<table><thead><tr><th><strong>SKU</strong></th><th><strong>Product Name</strong></th><th><strong>Brand</strong></th><th><strong>Primary Supplier</strong></th><th><strong>Client Price</strong></th><th><strong>RRP</strong></th><th><strong>Tax Inclusive</strong></th></tr></thead><tbody>${tableRows}</tbody></table>`
          };

          console.log('Would send Teams notification:', notificationPayload);

          // Enable Teams notification API call
          try {
            const teamsResponse = await fetch(teamsNotificationUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(notificationPayload)
            });
            
            if (!teamsResponse.ok) {
              console.error('Failed to send Teams notification:', await teamsResponse.text());
              try {
                toastError('Products processed but failed to send Teams notification');
              } catch (toastErr) {
                console.error('Error showing toast notification:', toastErr);
              }
            } else {
              console.log('Teams notification sent successfully');
            }
          } catch (error) {
            console.error('Error sending Teams notification:', error);
            try {
              toastError('Products processed but failed to send Teams notification');
            } catch (toastErr) {
              console.error('Error showing toast notification:', toastErr);
            }
          }
        } else {
          // Handle other response scenarios (Error, etc.)
          console.error('API Response Error:', responseData);
          
          if (ackStatus === "Error" && messagesData?.Error) {
            // Handle specific API errors
            messagesData.Error.forEach((error: any) => {
              console.error('API Error:', error.Message);
            });
            selectedRequests.forEach(request => {
              failedSubmits.push(`${request.sku} (API Error: ${messagesData.Error[0]?.Message || 'Unknown error'})`);
            });
          } else if (!response.ok) {
            // HTTP response failed
            selectedRequests.forEach(request => {
              failedSubmits.push(`${request.sku} (HTTP Error: ${response.status})`);
            });
          } else {
            // Unknown response format
            selectedRequests.forEach(request => {
              failedSubmits.push(`${request.sku} (Unknown response format)`);
            });
          }
        }
      }

      // Show success message for successful submits
      if (successfulSubmits.length > 0) {
        try {
          const newProducts = successfulSubmits.filter(sku => !sku.includes('(already existed)'));
          const existingProducts = successfulSubmits.filter(sku => sku.includes('(already existed)'));
          
          let message = '';
          if (newProducts.length > 0 && existingProducts.length > 0) {
            message = `Successfully processed ${successfulSubmits.length} products: ${newProducts.length} newly created, ${existingProducts.length} already existed`;
          } else if (newProducts.length > 0) {
            message = `Successfully created ${newProducts.length} products: ${newProducts.join(', ')}`;
          } else {
            message = `Processed ${existingProducts.length} products (all already existed in system): ${existingProducts.map(s => s.replace(' (already existed)', '')).join(', ')}`;
          }
          
          toastSuccess(message);
        } catch (error) {
          console.error('Error showing success toast:', error);
          // Fallback message without toast
          console.log(`Successfully processed ${successfulSubmits.length} products`);
        }
      }

      // Show error message for failed submits
      if (failedSubmits.length > 0) {
        try {
          if (failedSubmits.length === 1) {
            toastError(`Failed to process product: ${failedSubmits[0]}`);
          } else {
            toastError(`Failed to process ${failedSubmits.length} products: ${failedSubmits.join(', ')}`);
          }
        } catch (error) {
          console.error('Error showing error toast:', error);
          // Fallback message without toast
          console.error(`Failed to process ${failedSubmits.length} products`);
        }
      }
    } catch (error) {
      console.error('Unexpected error during submission:', error);
      try {
        toastError('Error during submission. Please try again later.');
      } catch (toastErr) {
        console.error('Error showing error toast:', toastErr);
        console.error('Submission failed due to unexpected error');
      }
    } finally {
      submitLoading = false;
      selectedRows = selectedRows;
      productRequests = productRequests;
    }
  }

  async function handleDeleteChecked() {
    if (selectedRows.size === 0) {
      toastError('Please select at least one request');
      return;
    }

    deleteLoading = true;
    const successfulDeletes: string[] = [];
    const failedDeletes: string[] = [];

    try {
      const selectedRequests = productRequests.filter(req => selectedRows.has(req.id));
      
      for (const request of selectedRequests) {
        try {
          // Update status to "delete" in Firebase
          const docRef = doc(db, 'product_requests', request.id);
          await updateDoc(docRef, {
            status: 'delete'
          });
          
          // Remove from local list
          productRequests = productRequests.filter(req => req.id !== request.id);
          selectedRows.delete(request.id);
          successfulDeletes.push(request.sku || request.id);
        } catch (error) {
          failedDeletes.push(request.sku || request.id);
        }
      }
      
      // Show success message for successful deletes
      if (successfulDeletes.length > 0) {
        if (successfulDeletes.length === 1) {
          toastSuccess(`Successfully deleted request: ${successfulDeletes[0]}`);
        } else {
          toastSuccess(`Successfully deleted ${successfulDeletes.length} requests: ${successfulDeletes.join(', ')}`);
        }
      }

      // Show error message for failed deletes
      if (failedDeletes.length > 0) {
        if (failedDeletes.length === 1) {
          toastError(`Failed to delete request: ${failedDeletes[0]}`);
        } else {
          toastError(`Failed to delete ${failedDeletes.length} requests: ${failedDeletes.join(', ')}`);
        }
      }
    } catch (error) {
      toastError('An unexpected error occurred during deletion. Please try again.');
    } finally {
      deleteLoading = false;
      selectedRows = selectedRows;
      productRequests = productRequests;
    }
  }

  onMount(() => {
    const unsubProfile = userProfile.subscribe(value => {
      profile = value;
    });

    Promise.all([
      fetchBrands(),
      fetchSuppliers(),
      loadData(),
      loadProductRequests(),
      searchMarkups()
    ]).then(() => {
      // Calculate retail MUP for any requests that have RRP but no retail MUP
      productRequests.forEach(request => {
        if (request.rrp && (!request.retail_mup || request.retail_mup === 0)) {
          calculatePrices(request, 'price');
        }
      });

      loading = false;
    });

    return () => {
      unsubProfile();
    };
  });
</script>

<style>
  :global(.svelte-select) {
    --height: 32px;
    --border: 1px solid #d1d5db;
    --border-hover: 1px solid #3b82f6;
    --border-radius: 0.375rem;
    --background: white;
    --font-size: 0.7rem;
    --padding: 0 0.5rem;
    --placeholder-color: #9ca3af;
    width: 100%;
    position: relative;
  }

  /* Add styles for the clear button */
  :global(.svelte-select .icon.clear-select) {
    width: 14px;
    height: 14px;
    min-width: 14px;
    margin-right: 4px;
  }

  :global(.svelte-select .icon.clear-select svg) {
    width: 14px;
    height: 14px;
  }

  /* Add new table cell styles */
  .table-cell {
    word-wrap: break-word;
    overflow-wrap: break-word;
    min-width: 0;
  }

  .requestor-cell {
    width: 100%;
  }

  .sku-cell {
    width: 100%;
  }

  .product-name-cell {
    width: 100%;
  }

  .brand-cell {
    width: 100%;
  }

  .supplier-cell {
    width: 100%;
  }

  .category-cell {
    width: 100%;
  }

  .price-cell {
    width: 100%;
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
    padding: 0.25rem 0.5rem;
    font-size: 0.7rem;
    cursor: pointer;
  }

  :global(.svelte-select .item.hover) {
    background-color: #f3f4f6;
  }

  :global(.svelte-select .item.active) {
    background-color: #e5e7eb;
  }

  :global(.svelte-select input) {
    width: calc(100% - 24px); /* Adjust input width to account for smaller clear button */
    font-size: 0.7rem !important;
  }

  :global(.svelte-select .selected-item) {
    font-size: 0.7rem !important;
  }

  :global(.svelte-select .selected-item span) {
    font-size: 0.7rem !important;
  }

  /* Reduce input field padding and height */
  :global(input[type="number"]) {
    padding: 0.25rem 0.5rem !important;
    height: 32px !important;
    min-height: 32px !important;
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

    .mobile-buttons {
      position: sticky;
      top: 0;
      background-color: white;
      padding: 1rem;
      z-index: 40;
      border-bottom: 1px solid #e5e7eb;
    }
  }


</style>

<div class="min-h-screen bg-gray-100 py-8 px-2 sm:px-3">
  <div class="max-w-[98%] mx-auto bg-white shadow p-6" transition:fade>
    <h2 class="text-2xl font-bold mb-6 text-gray-900">Product Request Approval</h2>
    
    <!-- Product Request Form -->
    <div class="space-y-6">
      <div class="flex justify-between items-center sticky top-[64px] bg-white/95 backdrop-blur-sm py-4 z-5 mobile-buttons">
        <button
          class="bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[160px]"
          on:click={handleDeleteChecked}
          disabled={selectedRows.size === 0 || deleteLoading}
        >
          {#if deleteLoading}
            <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
            Deleting...
          {:else}
            Delete Checked Request
          {/if}
        </button>
        <button
          class="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[160px]"
          on:click={handleSubmitChecked}
          disabled={selectedRows.size === 0 || submitLoading}
        >
          {#if submitLoading}
            <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
            Submitting...
          {:else}
            Submit Checked Rows
          {/if}
        </button>
      </div>

      <!-- Product Requests Table -->
      <div class="overflow-visible">
        <!-- Desktop Headers -->
        <div class="hidden md:grid md:grid-cols-[10px_100px_100px_100px_120px_120px_120px_80px_100px_100px_100px_100px_80px] md:gap-4 md:px-6 md:py-3 text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 rounded-t-lg" style="font-size: 0.7rem;">
          <div>
            <input
              type="checkbox"
              bind:checked={selectAll}
              on:change={handleSelectAll}
              class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </div>
          <div class="table-cell requestor-cell">Requestor Name</div>
          <div class="table-cell sku-cell">SKU</div>
          <div class="table-cell product-name-cell">Product Name</div>
          <div class="table-cell brand-cell">Brand</div>
          <div class="table-cell supplier-cell">Supplier</div>
          <div class="table-cell category-cell">
            <div>Category</div>
            <button 
              class="text-blue-600 hover:text-blue-800 text-xs"
              on:click={applyCategoryToAll}
            >Apply All</button>
          </div>
          <div class="table-cell price-cell">Price</div>
          <div class="table-cell price-cell">
            Client MUP
            <button 
              class="ml-2 text-blue-600 hover:text-blue-800 text-xs"
              on:click={applyClientMupToAll}
            >Adjust</button>
          </div>
          <div class="table-cell price-cell">
            Retail MUP
            <button 
              class="ml-2 text-blue-600 hover:text-blue-800 text-xs"
              on:click={applyRetailMupToAll}
            >Apply All</button>
          </div>
          <div class="table-cell price-cell">Client Price</div>
          <div class="table-cell price-cell">RRP</div>
          <div class="table-cell">Tax Free</div>
        </div>

        <!-- Rows -->
        <div class="divide-y divide-gray-200">
          {#each productRequests as request}
            <!-- Desktop View -->
            <div class="bg-white md:hover:bg-gray-50 transition-colors hidden md:block">
              <div class="md:grid md:grid-cols-[10px_100px_100px_100px_120px_120px_120px_80px_100px_100px_100px_100px_80px] md:gap-4 md:items-center p-4 md:px-6 md:py-4">
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
                <div class="mb-4 md:mb-0 table-cell requestor-cell">
                  <label class="block md:hidden text-sm font-medium text-gray-700 mb-1">Requestor Name</label>
                  <span class="text-gray-900 text-xs" style="font-size: 0.7rem;">{request.requestor_firstName} {request.requestor_lastName}</span>
                </div>

                <!-- SKU -->
                <div class="mb-4 md:mb-0 table-cell sku-cell">
                  <label class="block md:hidden text-sm font-medium text-gray-700 mb-1">SKU</label>
                  <span class="text-gray-900 text-xs" style="font-size: 0.7rem;">{request.sku}</span>
                </div>

                <!-- Product Name -->
                <div class="mb-4 md:mb-0 table-cell product-name-cell">
                  <label class="block md:hidden text-sm font-medium text-gray-700 mb-1">Product Name</label>
                  <span class="text-gray-900 text-xs" style="font-size: 0.7rem;">{request.product_name}</span>
                </div>

                <!-- Brand -->
                <div class="mb-4 md:mb-0 table-cell brand-cell">
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
                      clearable={false}
                      on:change={(e) => {
                        request.brand = e.detail?.value || '';
                        // Trigger search for markups when brand changes
                        searchMarkups();
                      }}
                    />
                  {/if}
                </div>

                <!-- Primary Supplier -->
                <div class="mb-4 md:mb-0 table-cell supplier-cell">
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
                      clearable={false}
                      on:change={(e) => {
                        request.primary_supplier = e.detail?.value || '';
                      }}
                    />
                  {/if}
                </div>

                <!-- Category -->
                <div class="mb-4 md:mb-0 table-cell category-cell">
                  <label class="block md:hidden text-sm font-medium text-gray-700 mb-1">Category</label>
                  <Select
                    items={categoriesList}
                    value={categoriesList.find(c => c.value === request.category) || null}
                    placeholder="Select Category"
                    clearable={false}
                    on:change={(e) => {
                      request.category = e.detail?.value || '';
                    }}
                  />
                </div>

                <!-- Purchase Price -->
                <div class="mb-4 md:mb-0 table-cell price-cell">
                  <label class="block md:hidden text-sm font-medium text-gray-700 mb-1">Purchase Price</label>
                  <input
                    type="number"
                    bind:value={request.purchase_price}
                    on:input={() => calculatePrices(request, 'mup')}
                    class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    style="font-size: 0.7rem !important;"
                    step="0.01"
                  />
                </div>

                <!-- Client MUP -->
                <div class="mb-4 md:mb-0 table-cell price-cell">
                  <label class="block md:hidden text-sm font-medium text-gray-700 mb-1">Client MUP</label>
                  <input
                    type="number"
                    bind:value={request.client_mup}
                    on:input={() => calculatePrices(request, 'mup')}
                    class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    style="font-size: 0.7rem !important;"
                    step="0.01"
                  />
                </div>

                <!-- Retail MUP -->
                <div class="mb-4 md:mb-0 table-cell price-cell">
                  <label class="block md:hidden text-sm font-medium text-gray-700 mb-1">Retail MUP</label>
                  <input
                    type="number"
                    bind:value={request.retail_mup}
                    on:input={() => calculatePrices(request, 'mup')}
                    class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    style="font-size: 0.7rem !important;"
                    step="0.01"
                  />
                </div>

                <!-- Client Price -->
                <div class="mb-4 md:mb-0 table-cell price-cell">
                  <label class="block md:hidden text-sm font-medium text-gray-700 mb-1">Client Price</label>
                  <input
                    type="number"
                    bind:value={request.client_price}
                    on:input={() => calculatePrices(request, 'price')}
                    class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    style="font-size: 0.7rem !important;"
                    step="0.01"
                  />
                </div>

                <!-- RRP -->
                <div class="mb-4 md:mb-0 table-cell price-cell">
                  <label class="block md:hidden text-sm font-medium text-gray-700 mb-1">RRP</label>
                  <input
                    type="number"
                    bind:value={request.rrp}
                    on:input={() => calculatePrices(request, 'price')}
                    class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    style="font-size: 0.7rem !important;"
                    step="0.01"
                  />
                </div>

                <!-- Tax Included -->
                <div class="mb-4 md:mb-0 table-cell">
                  <label class="block md:hidden text-sm font-medium text-gray-700 mb-1">Tax Free</label>
                  <input
                    type="checkbox"
                    bind:checked={request.tax_included}
                    on:change={() => calculatePrices(request, 'mup')}
                    class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <!-- Mobile View -->
            <div class="md:hidden mobile-row">
              <div class="mobile-field">
                <span class="mobile-label">Select</span>
                <div class="mobile-value">
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
              </div>

              <div class="mobile-field">
                <span class="mobile-label">Requestor Name</span>
                <span class="mobile-value text-gray-900">{request.requestor_firstName} {request.requestor_lastName}</span>
              </div>

              <div class="mobile-field">
                <span class="mobile-label">SKU</span>
                <span class="mobile-value text-gray-900">{request.sku}</span>
              </div>

              <div class="mobile-field">
                <span class="mobile-label">Product Name</span>
                <span class="mobile-value text-gray-900">{request.product_name}</span>
              </div>

              <div class="mobile-field">
                <span class="mobile-label">Brand</span>
                <div class="mobile-value">
                  {#if loadingBrands}
                    <div class="animate-pulse bg-gray-200 h-9 rounded"></div>
                  {:else if brandError}
                    <div class="text-red-600 text-sm">{brandError}</div>
                  {:else}
                    <Select
                      items={brands}
                      value={brands.find(b => b.value === request.brand) || null}
                      placeholder="Select Brand"
                      clearable={false}
                      on:change={(e) => {
                        request.brand = e.detail?.value || '';
                        searchMarkups();
                      }}
                    />
                  {/if}
                </div>
              </div>

              <div class="mobile-field">
                <span class="mobile-label">Primary Supplier</span>
                <div class="mobile-value">
                  {#if loadingSuppliers}
                    <div class="animate-pulse bg-gray-200 h-9 rounded"></div>
                  {:else if supplierError}
                    <div class="text-red-600 text-sm">{supplierError}</div>
                  {:else}
                    <Select
                      items={suppliers}
                      value={suppliers.find(s => s.value === request.primary_supplier)}
                      placeholder="Select Supplier"
                      clearable={false}
                      on:change={(e) => {
                        request.primary_supplier = e.detail?.value || '';
                      }}
                    />
                  {/if}
                </div>
              </div>

              <div class="mobile-field">
                <span class="mobile-label">Category</span>
                <div class="mobile-value">
                  <Select
                    items={categoriesList}
                    value={categoriesList.find(c => c.value === request.category) || null}
                    placeholder="Select Category"
                    clearable={false}
                    on:change={(e) => {
                      request.category = e.detail?.value || '';
                    }}
                  />
                </div>
              </div>

              <div class="mobile-field">
                <span class="mobile-label">Purchase Price</span>
                <div class="mobile-value">
                  <input
                    type="number"
                    bind:value={request.purchase_price}
                    on:input={() => calculatePrices(request, 'mup')}
                    class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    style="font-size: 0.7rem !important;"
                    step="0.01"
                  />
                </div>
              </div>

              <div class="mobile-field">
                <span class="mobile-label">Client MUP</span>
                <div class="mobile-value">
                  <input
                    type="number"
                    bind:value={request.client_mup}
                    on:input={() => calculatePrices(request, 'mup')}
                    class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    style="font-size: 0.7rem !important;"
                    step="0.01"
                  />
                </div>
              </div>

              <div class="mobile-field">
                <span class="mobile-label">Retail MUP</span>
                <div class="mobile-value">
                  <input
                    type="number"
                    bind:value={request.retail_mup}
                    on:input={() => calculatePrices(request, 'mup')}
                    class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    style="font-size: 0.7rem !important;"
                    step="0.01"
                  />
                </div>
              </div>

              <div class="mobile-field">
                <span class="mobile-label">Client Price</span>
                <div class="mobile-value">
                  <input
                    type="number"
                    bind:value={request.client_price}
                    on:input={() => calculatePrices(request, 'price')}
                    class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    style="font-size: 0.7rem !important;"
                    step="0.01"
                  />
                </div>
              </div>

              <div class="mobile-field">
                <span class="mobile-label">RRP</span>
                <div class="mobile-value">
                  <input
                    type="number"
                    bind:value={request.rrp}
                    on:input={() => calculatePrices(request, 'price')}
                    class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    style="font-size: 0.7rem !important;"
                    step="0.01"
                  />
                </div>
              </div>

              <div class="mobile-field">
                <span class="mobile-label">Tax Free</span>
                <div class="mobile-value">
                  <input
                    type="checkbox"
                    bind:checked={request.tax_included}
                    on:change={() => calculatePrices(request, 'mup')}
                    class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
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
          <div class="hidden md:grid md:grid-cols-[1fr_1fr_1fr_2fr_1fr] md:gap-4 md:px-6 md:py-3 text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 rounded-t-lg" style="font-size: 0.7rem;">
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
</div>