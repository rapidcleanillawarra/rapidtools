<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import Select from 'svelte-select';
  import { db } from '$lib/firebase';
  import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
  import { currentUser } from '$lib/firebase';
  import { userProfile, type UserProfile } from '$lib/userProfile';

  interface SelectOption {
    value: string;
    label: string;
  }

  interface ProductRow {
    sku: string;
    productName: string;
    brand: SelectOption | null;
    supplier: SelectOption | null;
    purchasePrice: string;
    gpm: string;
    listPrice: string;
    rrp: string;
    taxIncluded: boolean;
    exists: boolean;
  }

  // API Endpoints
  const brandsUrl = 'https://prod-06.australiasoutheast.logic.azure.com:443/workflows/58215302c1c24203886ccf481adbaac5/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=RFQ4OtbS6cyjB_JzaIsowmww4KBqPQgavWLg18znE5s';
  const suppliersUrl = 'https://prod-06.australiasoutheast.logic.azure.com:443/workflows/da5c5708146642768d63293d2bbb9668/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=-n0W0PxlF1G83xHYHGoEOhv3XmHXWlesbRk5NcgNT9w';
  const skuCheckUrl = 'https://prod-03.australiasoutheast.logic.azure.com:443/workflows/151bc47e0ba4447b893d1c9fea9af46f/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=bRyr_oW-ud06XlU5VLhBqQ7tyU__jD3clEOGIEhax-Q';
  const notificationUrl = 'https://prod-24.australiasoutheast.logic.azure.com:443/workflows/16979e5f23434b988b37be58343e93e9/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=loAkudpZIyE7_2o54CIncgVBLoXBtND6G_4Qm2MJzOE';

  // State for brands and suppliers
  let brands: SelectOption[] = [];
  let suppliers: SelectOption[] = [];
  let loadingBrands = false;
  let loadingSuppliers = false;
  let brandError = '';
  let supplierError = '';

  // Product Request Form
  let rows: ProductRow[] = [createEmptyRow()];
  let isLoading = false;
  let notification = { show: false, message: '', type: 'info' };

  // Local Storage Keys
  const STORAGE_KEY = 'product_request_new';
  const STORAGE_TIMESTAMP_KEY = 'product_request_timestamp';

  // State for user
  let user: any;
  let profile: UserProfile | null = null;
  
  // Subscribe to user changes
  currentUser.subscribe((u) => {
    user = u;
  });

  // Subscribe to profile changes
  userProfile.subscribe((p) => {
    profile = p;
  });

  let showTaxConfirmation = false;
  let taxFreeProducts: ProductRow[] = [];

  function createEmptyRow(): ProductRow {
    return {
      sku: '',
      productName: '',
      brand: null,
      supplier: null,
      purchasePrice: '',
      gpm: '',
      listPrice: '',
      rrp: '',
      taxIncluded: false,
      exists: false
    };
  }

  // Local Storage Functions
  function saveToLocalStorage() {
    try {
      const dataToSave = {
        rows: rows.map(row => ({
          sku: row.sku,
          productName: row.productName,
          brand: row.brand,
          supplier: row.supplier,
          purchasePrice: row.purchasePrice,
          gpm: row.gpm,
          listPrice: row.listPrice,
          rrp: row.rrp,
          taxIncluded: row.taxIncluded
        })),
        timestamp: Date.now()
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
      localStorage.setItem(STORAGE_TIMESTAMP_KEY, Date.now().toString());
      console.log('Data saved to local storage');
    } catch (error) {
      console.error('Error saving to local storage:', error);
    }
  }

  function loadFromLocalStorage(): boolean {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      const timestamp = localStorage.getItem(STORAGE_TIMESTAMP_KEY);
      
      if (!savedData || !timestamp) {
        return false;
      }

      // Check if data is older than 24 hours
      const dataAge = Date.now() - parseInt(timestamp);
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      
      if (dataAge > maxAge) {
        console.log('Saved data is too old, clearing...');
        clearLocalStorage();
        return false;
      }

      const parsedData = JSON.parse(savedData);
      
      if (parsedData.rows && Array.isArray(parsedData.rows)) {
        // Filter out completely empty rows
        const validRows = parsedData.rows.filter((row: any) => 
          row.sku || row.productName || row.brand || row.supplier || row.purchasePrice || row.rrp
        );
        
        if (validRows.length > 0) {
          rows = validRows.map((row: any) => {
            const processedRow = {
              ...row,
              exists: false // Reset exists flag
            };
            // Recalculate GPM for loaded data
            processedRow.gpm = calculateGPM(processedRow.purchasePrice, processedRow.listPrice);
            return processedRow;
          });
          console.log('Loaded data from local storage:', validRows.length, 'rows');
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error loading from local storage:', error);
      return false;
    }
  }

  function clearLocalStorage() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_TIMESTAMP_KEY);
      console.log('Local storage cleared');
    } catch (error) {
      console.error('Error clearing local storage:', error);
    }
  }

  function addRow() {
    rows = [...rows, createEmptyRow()];
  }

  function removeRow(index: number) {
    rows = rows.filter((_, i) => i !== index);
  }

  function applyToAll<K extends keyof ProductRow>(field: K, value: ProductRow[K]) {
    rows = rows.map(row => ({
      ...row,
      [field]: value
    }));
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
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log('API Response status:', response.status);
      const data = await response.json();
      console.log('API Response data:', data);

      if (data.status === 200 && data.message.Ack === "Success") {
        brands = data.message.Content.map((brand: { ContentID: string; ContentName: string }) => ({
          value: brand.ContentID,
          label: brand.ContentName
        }));
        console.log('Processed brands:', brands);
      } else {
        throw new Error('Failed to load brands: Invalid response format');
      }
    } catch (error) {
      console.error('Error in fetchBrands:', error);
      brandError = error instanceof Error ? error.message : 'Failed to load brands';
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

  // Function to send email notification
  async function sendEmailNotification(products: ProductRow[]) {
    console.log('=== Starting Email Notification Process ===');
    console.log('Current user:', user);
    console.log('Current profile:', profile);
    
    if (!user?.email) {
      console.error('No user email available for notification');
      return;
    }

    try {
      // Create a table format with inline styles that works in both email and Teams
      const productTable = `
<table style="border-collapse: collapse; width: 100%; margin: 10px 0; font-family: Arial, sans-serif;">
  <thead>
    <tr style="background-color: #f3f4f6;">
      <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: left; font-weight: bold;">#</th>
      <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: left; font-weight: bold;">SKU</th>
      <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: left; font-weight: bold;">Name</th>
      <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: left; font-weight: bold;">Brand</th>
      <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: left; font-weight: bold;">Supplier</th>
      <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: bold;">Purchase Price</th>
      <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: bold;">List Price</th>
      <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: bold;">Tax</th>
    </tr>
  </thead>
  <tbody>
    ${products.map((product, index) => `
    <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f9fafb'};">
      <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: left;">${index + 1}</td>
      <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: left;">${product.sku}</td>
      <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: left;">${product.productName}</td>
      <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: left;">${product.brand?.label || '-'}</td>
      <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: left;">${product.supplier?.label || '-'}</td>
      <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">$${parseFloat(product.purchasePrice).toFixed(2)}</td>
      <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">$${parseFloat(product.listPrice).toFixed(2)}</td>
      <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">${product.taxIncluded ? 'Yes' : 'No'}</td>
    </tr>
    `).join('')}
  </tbody>
</table>`;

      // For Teams, create a simplified ASCII table
      const teamsTable = products.map((product, index) => `
${index + 1}. ${product.sku} | ${product.productName} | ${product.brand?.label || '-'} | ${product.supplier?.label || '-'} | $${parseFloat(product.purchasePrice).toFixed(2)} | $${parseFloat(product.listPrice).toFixed(2)} | ${product.taxIncluded ? 'Yes' : 'No'}`).join('\n');

      // Create email body with HTML formatting
      const emailBody = `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <h2 style="color: #2563eb; margin-bottom: 20px;">🔔 Product Request Submission</h2>

  <div style="margin-bottom: 20px; padding: 15px; background-color: #f8fafc; border-radius: 6px;">
    <h3 style="color: #1e40af; margin-top: 0;">👤 Requestor Information</h3>
    <p style="margin: 5px 0;">• Email: ${user.email}</p>
    <p style="margin: 5px 0;">• Name: ${profile ? `${profile.firstName} ${profile.lastName}` : 'N/A'}</p>
    <p style="margin: 5px 0;">• User ID: ${user.uid}</p>
    <p style="margin: 5px 0;">• Submission Time: ${new Date().toLocaleString()}</p>
  </div>

  <div style="margin-bottom: 20px;">
    <h3 style="color: #1e40af;">📦 Requested Products</h3>
    ${productTable}
  </div>

  <p style="color: #6b7280; font-style: italic; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
    For any questions or concerns, please contact reach out to Joeven.
  </p>
</div>`;

      // Create Teams message with plain text formatting
      const teamsMessage = `
🔔 Product Request Submission

👤 Requestor Information
• Email: ${user.email}
• Name: ${profile ? `${profile.firstName} ${profile.lastName}` : 'N/A'}
• User ID: ${user.uid}
• Submission Time: ${new Date().toLocaleString()}

📦 Requested Products
${teamsTable}

For any questions or concerns, please contact the system administrator.`;

      console.log('Preparing email payload');

      const response = await fetch(notificationUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_subject: 'Product Request Submission Confirmation',
          email_body: emailBody,
          email_send_to: user.email,
          teams_message: teamsMessage
        })
      });

      const data = await response.json();
      console.log('Email notification API response:', data);

      if (!response.ok) {
        throw new Error('Failed to send email notification');
      }

      console.log('Email notification sent successfully');
    } catch (error) {
      console.error('Error sending email notification:', error);
    } finally {
      console.log('=== Email Notification Process Completed ===');
    }
  }

  async function handleProductRequestSubmit() {
    // Check if all products are tax included
    const allTaxIncluded = rows.every(row => row.taxIncluded);
    
    if (allTaxIncluded) {
      showTaxConfirmation = true;
      return;
    }
    
    // Proceed with submission if not all are tax included
    await submitProductRequest();
  }

  async function submitProductRequest() {
    showTaxConfirmation = false;
    isLoading = true;
    console.log('=== Starting Product Request Submission ===');
    console.log('Current user:', user);
    console.log('Number of rows to submit:', rows.length);
    
    try {
      // Validate rows
      let valid = true;
      const invalidRows = rows.filter(row => 
        !row.sku || 
        !row.productName || 
        !row.brand || 
        !row.supplier || 
        !row.purchasePrice
      );
      
      console.log('Validation check - Invalid rows:', invalidRows.length);
      if (invalidRows.length > 0) {
        console.error('Validation failed - Missing required fields:', invalidRows);
        throw new Error('Please fill in all required fields');
      }

      // Check for duplicate SKUs within the form
      const skus = rows.map(row => row.sku);
      console.log('SKUs to be submitted:', skus);
      
      const duplicates = skus.filter((sku, index) => skus.indexOf(sku) !== index);
      if (duplicates.length > 0) {
        console.error('Duplicate SKUs found in form:', duplicates);
        throw new Error('Duplicate SKUs found within the submitted requests. Please ensure each SKU is unique.');
      }

      // Check if SKUs already exist in the system
      console.log('Checking SKUs against existing system...');
      const response = await fetch(skuCheckUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ SKU: skus })
      });

      const data = await response.json();
      console.log('SKU check API response:', data);

      if (data.Ack === "Success") {
        const existingSKUs = new Set(data.Item?.map((item: any) => item.SKU) || []);
        const duplicateRows = rows.filter(row => existingSKUs.has(row.sku));
        
        if (duplicateRows.length > 0) {
          const duplicateSkus = duplicateRows.map(row => row.sku).join(', ');
          console.error('SKUs already exist in system:', duplicateSkus);
          throw new Error(`The following SKUs already exist: ${duplicateSkus}`);
        }

        console.log('=== Starting Firebase Submission ===');
        // If all validation passes, save to Firestore
        const savePromises = rows.map(row => {
          const productData = {
            sku: row.sku,
            product_name: row.productName,
            brand: row.brand?.label || '',
            primary_supplier: row.supplier?.value || '',
            purchase_price: parseFloat(row.purchasePrice) || 0,
            list_price: parseFloat(row.listPrice) || 0,
            rrp: parseFloat(row.rrp) || 0,
            tax_included: row.taxIncluded,
            status: 'request',
            date_created: serverTimestamp(),
            requestor_uid: user?.uid || '',
            requestor_email: user?.email || '',
            requestor_firstName: profile?.firstName || '',
            requestor_lastName: profile?.lastName || ''
          };
          
          console.log('Preparing to save product data:', productData);
          return addDoc(collection(db, 'product_requests'), productData)
            .then(docRef => {
              console.log('Successfully saved product with SKU:', productData.sku, 'Document ID:', docRef.id);
              return docRef;
            })
            .catch(error => {
              console.error('Error saving product with SKU:', productData.sku, 'Error:', error);
              throw error;
            });
        });

        console.log('Waiting for all Firebase submissions to complete...');
        const results = await Promise.all(savePromises);
        console.log('All Firebase submissions completed successfully!');
        console.log('Saved document references:', results.map(ref => ref.id));

        // Send email notification after successful submission
        await sendEmailNotification(rows);

        showNotification('Product request submitted successfully', 'success');
        
        // Clear local storage after successful submission
        clearLocalStorage();
        
        // Clear form and add new row
        rows = [createEmptyRow()];
        console.log('Form cleared and reset');
      } else {
        console.error('SKU check API returned error:', data);
        throw new Error('SKU check failed. Please try again later.');
      }
    } catch (error: any) {
      console.error('=== Submission Error ===');
      console.error('Error details:', error);
      showNotification(error.message || 'An error occurred', 'error');
    } finally {
      console.log('=== Submission Process Completed ===');
      isLoading = false;
    }
  }

  function showNotification(message: string, type: 'success' | 'error' | 'info' = 'info') {
    notification = { show: true, message, type };
    setTimeout(() => {
      notification = { ...notification, show: false };
    }, 3000);
  }

  // Handle Purchase Price change - update GPM
  function handlePurchasePriceChange(event: Event, rowIndex: number) {
    // Update GPM after a short delay to ensure the value is updated
    setTimeout(() => updateGPM(rowIndex), 0);
  }

  // Handle List Price change - calculate RRP as List Price + 10% and update GPM
  function handleListPriceChange(event: Event, rowIndex: number) {
    const target = event.target as HTMLInputElement;
    const listPrice = parseFloat(target.value);

    if (!isNaN(listPrice) && listPrice > 0) {
      const calculatedRRP = (listPrice * 1.10).toFixed(2);
      rows = rows.map((row, index) =>
        index === rowIndex
          ? { ...row, rrp: calculatedRRP }
          : row
      );
    }

    // Update GPM after RRP calculation
    setTimeout(() => updateGPM(rowIndex), 0);
  }

  // Handle List Price blur - clear RRP if List Price is empty/null
  function handleListPriceBlur(event: Event, rowIndex: number) {
    const target = event.target as HTMLInputElement;
    const listPrice = target.value.trim();

    if (!listPrice || listPrice === '') {
      rows = rows.map((row, index) =>
        index === rowIndex
          ? { ...row, rrp: '' }
          : row
      );
    }
  }

  // Calculate GPM (Gross Profit Margin)
  function calculateGPM(purchasePrice: string, listPrice: string): string {
    const purchase = parseFloat(purchasePrice);
    const list = parseFloat(listPrice);

    if (isNaN(purchase) || isNaN(list) || purchase <= 0 || list <= 0) {
      return '';
    }

    const gpm = ((list - purchase) / list) * 100;
    return gpm.toFixed(2);
  }

  // Update GPM for a specific row
  function updateGPM(rowIndex: number) {
    const row = rows[rowIndex];
    if (row) {
      const gpm = calculateGPM(row.purchasePrice, row.listPrice);
      rows = rows.map((r, index) =>
        index === rowIndex
          ? { ...r, gpm }
          : r
      );
    }
  }

  // Handle RRP change - calculate List Price as RRP - 10%
  function handleRRPChange(event: Event, rowIndex: number) {
    const target = event.target as HTMLInputElement;
    const rrp = parseFloat(target.value);

    if (!isNaN(rrp) && rrp > 0) {
      const calculatedListPrice = (rrp / 1.10).toFixed(2);
      rows = rows.map((row, index) =>
        index === rowIndex
          ? { ...row, listPrice: calculatedListPrice }
          : row
      );
      // Update GPM after list price calculation
      setTimeout(() => updateGPM(rowIndex), 0);
    }
  }

  // Handle RRP blur - clear list price if RRP is empty/null
  function handleRRPBlur(event: Event, rowIndex: number) {
    const target = event.target as HTMLInputElement;
    const rrp = target.value.trim();

    if (!rrp || rrp === '') {
      rows = rows.map((row, index) =>
        index === rowIndex
          ? { ...row, listPrice: '' }
          : row
      );
    }
  }

  // Handle GPM change - calculate List Price and RRP from GPM and Purchase Price
  function handleGPMChange(event: Event, rowIndex: number) {
    const target = event.target as HTMLInputElement;
    const gpm = parseFloat(target.value);
    const row = rows[rowIndex];

    if (!isNaN(gpm) && gpm >= 0 && gpm < 100 && row.purchasePrice) {
      const purchasePrice = parseFloat(row.purchasePrice);
      if (purchasePrice > 0) {
        // Calculate List Price: listPrice = purchasePrice / (1 - GPM/100)
        const calculatedListPrice = (purchasePrice / (1 - gpm / 100)).toFixed(2);
        // Calculate RRP: rrp = listPrice * 1.10
        const calculatedRRP = (parseFloat(calculatedListPrice) * 1.10).toFixed(2);

        rows = rows.map((r, index) =>
          index === rowIndex
            ? { ...r, listPrice: calculatedListPrice, rrp: calculatedRRP }
            : r
        );
      }
    }
  }

  // SVG icon for delete button
  const trashIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>`;

  // Function to handle Excel paste
  async function handlePaste(event: ClipboardEvent, rowIndex: number, field: keyof ProductRow) {
    console.log('=== Starting Paste Operation ===');
    console.log('Paste target:', { field, rowIndex });
    
    // Prevent default paste behavior
    event.preventDefault();
    event.stopPropagation();
    
    try {
      // Try to get clipboard data from the event first
      let clipboardData = event.clipboardData?.getData('text') || '';
      
      // If that's empty, try using the clipboard API
      if (!clipboardData && navigator.clipboard) {
        try {
          clipboardData = await navigator.clipboard.readText();
        } catch (clipError) {
          console.log('Clipboard API failed, trying alternative method');
        }
      }
      
      console.log('Raw clipboard data:', clipboardData);
      
      if (!clipboardData) {
        console.log('No clipboard data available');
        return;
      }
      
      // Split the clipboard data into rows and clean up
      const pastedRows = clipboardData
        .split('\n')
        .map(row => row.split('\t').map(cell => cell.trim()))
        .filter(row => row.some(cell => cell !== '')); // Filter out completely empty rows

      console.log('Processed rows:', pastedRows);

      if (pastedRows.length === 0) {
        console.log('No valid data to paste');
        return;
      }

      // For single cell paste
      if (pastedRows.length === 1 && pastedRows[0].length === 1) {
        const value = pastedRows[0][0];
        console.log('Single cell paste:', { value, field, rowIndex });

        if (field === 'sku' || field === 'productName' || field === 'purchasePrice' || field === 'listPrice' || field === 'rrp' || field === 'gpm') {
          // Use reactive assignment to ensure UI updates
          rows = rows.map((row, index) =>
            index === rowIndex
              ? { ...row, [field]: value }
              : row
          );

          // Trigger calculations for price fields
          if (field === 'listPrice') {
            const listPrice = parseFloat(value);
            if (!isNaN(listPrice) && listPrice > 0) {
              const calculatedRRP = (listPrice * 1.10).toFixed(2);
              rows = rows.map((row, index) =>
                index === rowIndex
                  ? { ...row, rrp: calculatedRRP }
                  : row
              );
            }
            // Update GPM after calculations
            setTimeout(() => updateGPM(rowIndex), 0);
          } else if (field === 'purchasePrice') {
            // Update GPM after purchase price change
            setTimeout(() => updateGPM(rowIndex), 0);
          } else if (field === 'rrp') {
            const rrp = parseFloat(value);
            if (!isNaN(rrp) && rrp > 0) {
              const calculatedListPrice = (rrp / 1.10).toFixed(2);
              rows = rows.map((row, index) =>
                index === rowIndex
                  ? { ...row, listPrice: calculatedListPrice }
                  : row
              );
            }
            // Update GPM after calculations
            setTimeout(() => updateGPM(rowIndex), 0);
          } else if (field === 'gpm') {
            const gpm = parseFloat(value);
            const row = rows[rowIndex];
            if (!isNaN(gpm) && gpm >= 0 && gpm < 100 && row.purchasePrice) {
              const purchasePrice = parseFloat(row.purchasePrice);
              if (purchasePrice > 0) {
                // Calculate List Price: listPrice = purchasePrice / (1 - GPM/100)
                const calculatedListPrice = (purchasePrice / (1 - gpm / 100)).toFixed(2);
                // Calculate RRP: rrp = listPrice * 1.10
                const calculatedRRP = (parseFloat(calculatedListPrice) * 1.10).toFixed(2);
                rows = rows.map((r, index) =>
                  index === rowIndex
                    ? { ...r, listPrice: calculatedListPrice, rrp: calculatedRRP }
                    : r
                );
              }
            }
          }
        }
        return;
      }

      // For multi-cell paste in a single column
      const values = pastedRows.map(row => row[0] || '');
      console.log('Multi-cell paste values:', values);
      
      // Create new rows if needed - use reactive assignment
      const newRows = [...rows];
      while (rowIndex + values.length > newRows.length) {
        newRows.push(createEmptyRow());
      }
      
      // Update the specific column for each row
      values.forEach((value, index) => {
        if (field === 'sku' || field === 'productName' || field === 'purchasePrice' || field === 'listPrice' || field === 'rrp' || field === 'gpm') {
          newRows[rowIndex + index] = { ...newRows[rowIndex + index], [field]: value };

          // Trigger calculations for price fields
          if (field === 'listPrice') {
            const listPrice = parseFloat(value);
            if (!isNaN(listPrice) && listPrice > 0) {
              const calculatedRRP = (listPrice * 1.10).toFixed(2);
              newRows[rowIndex + index] = { ...newRows[rowIndex + index], rrp: calculatedRRP };
            }
          } else if (field === 'rrp') {
            const rrp = parseFloat(value);
            if (!isNaN(rrp) && rrp > 0) {
              const calculatedListPrice = (rrp / 1.10).toFixed(2);
              newRows[rowIndex + index] = { ...newRows[rowIndex + index], listPrice: calculatedListPrice };
            }
          } else if (field === 'gpm') {
            const gpm = parseFloat(value);
            const row = newRows[rowIndex + index];
            if (!isNaN(gpm) && gpm >= 0 && gpm < 100 && row.purchasePrice) {
              const purchasePrice = parseFloat(row.purchasePrice);
              if (purchasePrice > 0) {
                // Calculate List Price: listPrice = purchasePrice / (1 - GPM/100)
                const calculatedListPrice = (purchasePrice / (1 - gpm / 100)).toFixed(2);
                // Calculate RRP: rrp = listPrice * 1.10
                const calculatedRRP = (parseFloat(calculatedListPrice) * 1.10).toFixed(2);
                newRows[rowIndex + index] = { ...newRows[rowIndex + index], listPrice: calculatedListPrice, rrp: calculatedRRP };
              }
            }
          }
        }

        // Update GPM for price-related fields (but not for GPM itself since we just set it)
        if (field === 'purchasePrice' || field === 'listPrice' || field === 'rrp') {
          const updatedRow = newRows[rowIndex + index];
          const gpm = calculateGPM(updatedRow.purchasePrice, updatedRow.listPrice);
          newRows[rowIndex + index] = { ...newRows[rowIndex + index], gpm };
        }
      });
      
      // Update rows reactively
      rows = newRows;
      
      console.log('Updated rows:', rows);
      console.log(`Updated ${values.length} rows starting from index ${rowIndex}`);

      // Show notification
      const notificationMessage = `Pasted ${values.length} values into ${field} column`;
      showNotification(notificationMessage, 'success');
      console.log(notificationMessage);
      console.log('=== Paste Operation Completed ===');
    } catch (error) {
      console.error('Error in handlePaste:', error);
    }
  }

  // Reactive statement to save data whenever rows change
  let saveTimeout: ReturnType<typeof setTimeout>;
  $: if (rows.length > 0) {
    // Clear previous timeout
    if (saveTimeout) clearTimeout(saveTimeout);
    
    // Debounce the save to avoid excessive localStorage writes
    saveTimeout = setTimeout(() => {
      saveToLocalStorage();
    }, 1000);
  }

  onMount(() => {
    console.log('Component mounted, fetching brands and suppliers...');
    
    // Try to load saved data first
    const hasLoadedData = loadFromLocalStorage();
    if (hasLoadedData) {
      showNotification('New data loaded from previous session', 'info');
    }
    
    fetchBrands();
    fetchSuppliers();
  });
</script>

<div class="min-h-screen bg-gray-100 py-6 px-1 sm:px-3 lg:px-6">
  <div class="w-full bg-white shadow-sm rounded-2xl p-4 sm:p-6 lg:p-8" transition:fade>
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold text-gray-900">Product Request</h2>
      {#if profile}
        <div class="text-sm text-gray-600">
          <span class="font-medium">User:</span> {profile.firstName} {profile.lastName}
        </div>
      {/if}
    </div>
    
    <!-- Product Request Form -->
    <div class="space-y-6">
      <div class="flex justify-between items-center sticky top-[64px] bg-white/95 backdrop-blur-sm py-4 z-30">
        <div class="flex gap-2">
          <button
            on:click={addRow}
            class="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
          >
            Add Row
          </button>
          <button
            on:click={() => {
              clearLocalStorage();
              rows = [createEmptyRow()];
              showNotification('New cleared', 'info');
            }}
            class="bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600"
          >
            Clear New
          </button>
          {#if user?.email === 'orders@rapidcleanillawarra.com.au' || user?.email === 'marketing@rapidcleanillawarra.com.au'}
            <span class="text-sm text-blue-600 font-medium italic">
              Wag mashadong balibag Zsa ha! Gentle lang
            </span>
          {/if}
        </div>
        <button
          on:click={handleProductRequestSubmit}
          class="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
          disabled={isLoading}
        >
          {isLoading ? 'Submitting...' : 'Submit'}
        </button>
      </div>

      <!-- Product Rows -->
      <section class="space-y-5">
        <div class="rounded-2xl border border-blue-100/80 bg-blue-50/80 p-4 text-sm text-blue-900 shadow-sm">
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p class="text-base font-semibold">Bulk apply</p>
              <p class="text-xs text-blue-700">Copy the first-row selections to every row below.</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                on:click={() => applyToAll('brand', rows[0]?.brand)}
                class="rounded-full border border-blue-200 bg-white/80 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700 shadow-sm hover:bg-white"
              >
                Brand
              </button>
              <button
                on:click={() => applyToAll('supplier', rows[0]?.supplier)}
                class="rounded-full border border-blue-200 bg-white/80 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700 shadow-sm hover:bg-white"
              >
                Supplier
              </button>
              <button
                on:click={() => applyToAll('taxIncluded', rows[0]?.taxIncluded)}
                class="rounded-full border border-blue-200 bg-white/80 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700 shadow-sm hover:bg-white"
              >
                Tax Included
              </button>
            </div>
          </div>
        </div>

        <div class="rounded-2xl border border-gray-200 bg-white shadow-lg">
          <div class="overflow-x-auto">
            <table class="w-full min-w-[1180px] divide-y divide-gray-200 text-sm">
              <thead class="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th class="py-3 pl-6 pr-3 text-left">#</th>
                  <th class="px-3 py-3 text-left">SKU</th>
                  <th class="px-3 py-3 text-left">Product Name</th>
                  <th class="px-3 py-3 text-left">
                    <div class="flex items-center gap-2">
                      <span>Brand</span>
                      <button
                        on:click={() => applyToAll('brand', rows[0]?.brand)}
                        class="text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                      >
                        Apply to All
                      </button>
                    </div>
                  </th>
                  <th class="px-3 py-3 text-left">
                    <div class="flex items-center gap-2">
                      <span>Supplier</span>
                      <button
                        on:click={() => applyToAll('supplier', rows[0]?.supplier)}
                        class="text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                      >
                        Apply to All
                      </button>
                    </div>
                  </th>
                  <th class="px-3 py-3 text-left">Purchase Price</th>
                  <th class="px-3 py-3 text-left">GPM (%)</th>
                  <th class="px-3 py-3 text-left">List Price</th>
                  <th class="px-3 py-3 text-center">
                    <div class="flex items-center justify-center gap-2">
                      <span>Tax Included</span>
                      <button
                        on:click={() => applyToAll('taxIncluded', rows[0]?.taxIncluded)}
                        class="text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                      >
                        Apply to All
                      </button>
                    </div>
                  </th>
                  <th class="py-3 pl-3 pr-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 bg-white">
                {#each rows as row, i}
                  <tr class="even:bg-gray-50/70">
                    <td class="whitespace-nowrap py-4 pl-6 pr-3 text-center text-sm font-semibold text-gray-500">{i + 1}</td>
                    <td class="px-3 py-4 align-top">
                      <label class="sr-only" for={`sku-${i}`}>SKU</label>
                      <input
                        id={`sku-${i}`}
                        type="text"
                        bind:value={row.sku}
                        on:paste={(e) => handlePaste(e, i, 'sku')}
                        class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                        placeholder="SKU"
                      />
                    </td>
                    <td class="px-3 py-4 align-top">
                      <label class="sr-only" for={`product-name-${i}`}>Product Name</label>
                      <input
                        id={`product-name-${i}`}
                        type="text"
                        bind:value={row.productName}
                        on:paste={(e) => handlePaste(e, i, 'productName')}
                        class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                        placeholder="Product Name"
                      />
                    </td>
                    <td class="px-3 py-4 align-top select-wrapper">
                      {#if loadingBrands}
                        <div class="h-10 animate-pulse rounded-lg bg-gray-100"></div>
                      {:else if brandError}
                        <div class="text-sm text-red-600">{brandError}</div>
                      {:else}
                        <Select
                          items={brands}
                          bind:value={row.brand}
                          placeholder="Select Brand"
                          containerStyles="position: relative;"
                        />
                      {/if}
                    </td>
                    <td class="px-3 py-4 align-top select-wrapper">
                      {#if loadingSuppliers}
                        <div class="h-10 animate-pulse rounded-lg bg-gray-100"></div>
                      {:else if supplierError}
                        <div class="text-sm text-red-600">{supplierError}</div>
                      {:else}
                        <Select
                          items={suppliers}
                          bind:value={row.supplier}
                          placeholder="Select Supplier"
                          containerStyles="position: relative;"
                        />
                      {/if}
                    </td>
                    <td class="px-3 py-4 align-top input-wrapper">
                      <label class="sr-only" for={`purchase-price-${i}`}>Purchase Price</label>
                      <input
                        id={`purchase-price-${i}`}
                        type="number"
                        bind:value={row.purchasePrice}
                        on:input={(e) => handlePurchasePriceChange(e, i)}
                        on:paste={(e) => handlePaste(e, i, 'purchasePrice')}
                        class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                        placeholder="0.00"
                        step="0.01"
                      />
                    </td>
                    <td class="px-3 py-4 align-top">
                      <label class="sr-only" for={`gpm-${i}`}>GPM</label>
                      <input
                        id={`gpm-${i}`}
                        type="number"
                        bind:value={row.gpm}
                        on:input={(e) => handleGPMChange(e, i)}
                        on:paste={(e) => handlePaste(e, i, 'gpm')}
                        class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                        placeholder="0.00"
                        step="0.01"
                      />
                    </td>
                    <td class="px-3 py-4 align-top">
                      <label class="sr-only" for={`list-price-${i}`}>List Price</label>
                      <input
                        id={`list-price-${i}`}
                        type="number"
                        bind:value={row.listPrice}
                        on:input={(e) => handleListPriceChange(e, i)}
                        on:blur={(e) => handleListPriceBlur(e, i)}
                        on:paste={(e) => handlePaste(e, i, 'listPrice')}
                        class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                        placeholder="0.00"
                        step="0.01"
                      />
                    </td>
                    <td class="px-3 py-4 text-center">
                      <label class="sr-only" for={`tax-${i}`}>Tax Included</label>
                      <input
                        id={`tax-${i}`}
                        type="checkbox"
                        bind:checked={row.taxIncluded}
                        class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td class="py-4 pl-3 pr-6 text-right">
                      <button
                        on:click={() => removeRow(i)}
                        class="inline-flex items-center justify-center rounded-full border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                        disabled={rows.length === 1}
                        title="Remove row"
                      >
                        Remove
                        <span class="sr-only">Remove row {i + 1}</span>
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  </div>

  <!-- Notification -->
  {#if notification.show}
    <div
      class="fixed bottom-4 right-4 px-4 py-2 rounded shadow-lg"
      class:bg-green-500={notification.type === 'success'}
      class:bg-red-500={notification.type === 'error'}
      class:bg-blue-500={notification.type === 'info'}
      transition:fade
    >
      <p class="text-white">{notification.message}</p>
    </div>
  {/if}

  <!-- Loading Overlay -->
  {#if isLoading}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white p-6 rounded-lg shadow-xl">
        <div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto"></div>
        <p class="mt-4 text-gray-700">Processing...</p>
      </div>
    </div>
  {/if}

  <!-- Tax Confirmation Modal -->
  {#if showTaxConfirmation}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
        <h3 class="text-lg font-bold mb-4">Tax Confirmation</h3>
        <p class="mb-4">
          All products are marked as tax included. Are you sure you want to proceed?
        </p>
        
        <div class="mt-4 flex justify-end space-x-3">
          <button
            on:click={() => showTaxConfirmation = false}
            class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            on:click={submitProductRequest}
            class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Proceed
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Add portal container at the end of the body -->
<div id="select-portal"></div>

<style>
  :global(body) {
    background-color: #f3f4f6;
  }

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
    margin-top: 4px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    z-index: 999;
    max-height: 300px;
    overflow-y: auto;
  }

  :global(.svelte-select .item) {
    font-size: var(--font-size);
    line-height: 1.25;
    padding: 0.5rem 0.75rem;
    white-space: normal;
    word-break: break-word;
  }

  :global(.svelte-select .item.hover) {
    background-color: #f3f4f6;
  }

  :global(.svelte-select .item.active) {
    background-color: #dbeafe;
    color: #1e40af;
  }

  #select-portal {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 0;
    overflow: visible;
    z-index: 999;
  }

  /* Add styles for the select wrapper */
  .select-wrapper {
    position: relative;
    z-index: 10;
  }
  
  .select-wrapper:focus-within {
    z-index: 20;
  }

  /* Ensure other elements don't overlap */
  .input-wrapper {
    position: relative;
    z-index: 1;
  }

  :global(.svelte-select .value-container) {
    padding: var(--padding);
    height: var(--height);
    line-height: var(--height);
    font-size: var(--font-size);
    display: flex;
    align-items: center;
  }

  :global(.svelte-select .selected-item) {
    display: flex;
    align-items: center;
    height: 100%;
    line-height: normal;
  }

  :global(.svelte-select input) {
    font-size: var(--font-size);
    padding: var(--padding);
    height: calc(var(--height) - 2px);
    display: flex;
    align-items: center;
  }

  :global(.svelte-select .placeholder) {
    color: var(--placeholder-color);
    font-size: var(--font-size);
  }

  :global(button:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global(.sr-only) {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
</style> 