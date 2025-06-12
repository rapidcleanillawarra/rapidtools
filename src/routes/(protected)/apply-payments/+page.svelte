<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { Trash2 } from 'lucide-svelte';
  import { db } from '$lib/firebase';
  import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
  import { currentUser } from '$lib/firebase';
  import { userProfile, type UserProfile } from '$lib/userProfile';

  type Item = {
    invoiceNumber: string;
    price: string;
    paymentMethod: string;
  };

  let items: Item[] = [
    { invoiceNumber: '25-009131', price: '110.00', paymentMethod: 'Direct Deposit' },
    { invoiceNumber: '25-009169', price: '495.00', paymentMethod: 'Direct Deposit' }
  ];

  // State for user
  let user: any;
  let profile: UserProfile | null = null;
  let isLoading = false;
  let notification = { show: false, message: '', type: 'info' };
  
  // Subscribe to user changes
  const unsubUser = currentUser.subscribe((u) => {
    user = u;
  });

  // Subscribe to profile changes
  const unsubProfile = userProfile.subscribe((p) => {
    profile = p;
  });

  function handlePaste(event: ClipboardEvent, column: keyof Item, rowIndex: number) {
    event.preventDefault();
    const pastedText = event.clipboardData?.getData('text') || '';
    const pastedValues = pastedText.split(/\n/).map(value => value.trim()).filter(value => value);
    
    if (pastedValues.length === 0) return;

    // Keep all rows above the paste point unchanged
    const rowsAbove = items.slice(0, rowIndex);
    
    // For rows that will be affected by the paste
    const updatedRows = pastedValues.map((value, i) => {
      const existingRow = items[rowIndex + i] || { invoiceNumber: '', price: '', paymentMethod: 'Direct Deposit' };
      return {
        ...existingRow,
        [column]: value
      };
    });

    // Keep remaining rows below the pasted section unchanged
    const remainingRows = items.slice(rowIndex + pastedValues.length);

    // Combine all parts: rows above + updated rows + remaining rows
    items = [...rowsAbove, ...updatedRows, ...remainingRows];
  }

  function deleteRow(index: number) {
    items = items.filter((_, i) => i !== index);
    // Focus the delete button of the previous row, or the last row if we deleted the last one
    const nextFocusIndex = Math.min(index, items.length - 1);
    if (nextFocusIndex >= 0) {
      setTimeout(() => {
        const deleteButtons = document.querySelectorAll('[data-delete-button]');
        (deleteButtons[nextFocusIndex] as HTMLButtonElement)?.focus();
      });
    }
  }

  function addRow() {
    items = [...items, { invoiceNumber: '', price: '', paymentMethod: 'Direct Deposit' }];
    // Focus the invoice number input of the new row
    setTimeout(() => {
      const inputs = document.querySelectorAll('[data-invoice-input]');
      (inputs[inputs.length - 1] as HTMLInputElement)?.focus();
    });
  }

  function applyPaymentMethodToAll() {
    const method = items[0]?.paymentMethod || 'Direct Deposit';
    items = items.map(item => ({ ...item, paymentMethod: method }));
  }

  async function handleSubmit() {
    isLoading = true;
    console.log('=== Starting Payment Submission ===');
    console.log('Current user:', user);
    console.log('Number of items to submit:', items.length);
    
    try {
      // Validate items
      const invalidItems = items.filter(item => !item.invoiceNumber || !item.price || !item.paymentMethod);
      
      console.log('Validation check - Invalid items:', invalidItems.length);
      if (invalidItems.length > 0) {
        console.error('Validation failed - Missing required fields:', invalidItems);
        throw new Error('Please fill in all required fields');
      }

      // Check for duplicate invoice numbers
      const invoiceNumbers = items.map(item => item.invoiceNumber);
      const duplicates = invoiceNumbers.filter((inv, index) => invoiceNumbers.indexOf(inv) !== index);
      if (duplicates.length > 0) {
        console.error('Duplicate invoice numbers found:', duplicates);
        throw new Error('Duplicate invoice numbers found. Please ensure each invoice number is unique.');
      }

      // Prepare API payload
      const apiPayload = {
        Filter: {
          OrderID: invoiceNumbers,
          OutputSelector: ["Username", "ID"]
        },
        action: "GetOrder"
      };

      console.log('API Payload:', apiPayload);

      // Call API
      const response = await fetch('https://prod-56.australiasoutheast.logic.azure.com:443/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=G8m_h5Dl8GpIRQtlN0oShby5zrigLKTWEddou-zGQIs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(apiPayload)
      });

      const apiResponse = await response.json();
      console.log('API Response:', apiResponse);

      // Extract unique usernames
      const usernames = Array.from(new Set(apiResponse.Order.map((order: { Username: string }) => order.Username)));
      console.log('Unique Usernames:', usernames);

      // Prepare new API payload
      const newApiPayload = {
        Filter: {
          Username: usernames,
          OutputSelector: [
            "ID",
            "Username",
            "CreditLimit",
            "AvailableCredit",
            "OnCreditHold"
          ]
        },
        action: "GetCustomer"
      };

      console.log('New API Payload:', newApiPayload);

      // Call API with new payload
      const newResponse = await fetch('https://prod-56.australiasoutheast.logic.azure.com:443/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=G8m_h5Dl8GpIRQtlN0oShby5zrigLKTWEddou-zGQIs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newApiPayload)
      });

      const newApiResponse = await newResponse.json();
      console.log('New API Response:', newApiResponse);

      // Store customer data
      const customerData = newApiResponse.Customer;
      console.log('Customer Data:', customerData);

      showNotification('Payments submitted successfully', 'success');
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

  onMount(() => {
    return () => {
      // Unsubscribe from user changes
      unsubUser();
      unsubProfile();
    };
  });
</script>

<div class="min-h-screen bg-gray-100 py-8 px-2 sm:px-3">
  <div class="max-w-[98%] mx-auto bg-white shadow p-6" transition:fade>
    <h2 class="text-2xl font-bold mb-6 text-gray-900">Apply Payments</h2>
    
    <!-- Payment Form -->
    <div class="space-y-6">
      <div class="flex justify-between items-center sticky top-0 bg-white/80 backdrop-blur-sm py-4 z-50 border-b border-gray-200 shadow-sm">
        <button
          on:click={addRow}
          class="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
        >
          Add Row
        </button>
        <button
          on:click={handleSubmit}
          class="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
          disabled={isLoading}
        >
          {isLoading ? 'Submitting...' : 'Submit'}
        </button>
      </div>

      <!-- Payment Rows -->
      <div class="overflow-visible">
        <!-- Headers -->
        <div class="hidden md:grid md:grid-cols-[1fr_1fr_1fr_40px] md:gap-4 md:px-6 md:py-3 text-sm font-medium text-gray-500 uppercase tracking-wider bg-gray-50 rounded-t-lg">
          <div>Invoice Number</div>
          <div>Price</div>
          <div class="flex justify-between items-center">
            <span>Payment Method</span>
            <button
              on:click={applyPaymentMethodToAll}
              class="text-blue-600 hover:text-blue-800 text-xs"
            >
              Apply to All
            </button>
          </div>
          <div></div>
        </div>

        <!-- Rows -->
        <div class="divide-y divide-gray-200">
          {#each items as item, i}
            <div class="bg-white md:hover:bg-gray-50 transition-colors">
              <div class="md:grid md:grid-cols-[1fr_1fr_1fr_40px] md:gap-4 md:items-center p-4 md:px-6 md:py-4">
                <!-- Invoice Number -->
                <div class="mb-4 md:mb-0">
                  <label class="block md:hidden text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
                  <input
                    type="text"
                    bind:value={item.invoiceNumber}
                    on:paste={(e) => handlePaste(e, 'invoiceNumber', i)}
                    class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Invoice Number"
                    data-invoice-input
                  />
                </div>

                <!-- Price -->
                <div class="mb-4 md:mb-0">
                  <label class="block md:hidden text-sm font-medium text-gray-700 mb-1">Price</label>
                  <input
                    type="text"
                    bind:value={item.price}
                    on:paste={(e) => handlePaste(e, 'price', i)}
                    class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Price"
                  />
                </div>

                <!-- Payment Method -->
                <div class="mb-4 md:mb-0">
                  <label class="block md:hidden text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <select
                    bind:value={item.paymentMethod}
                    class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="Direct Deposit">Direct Deposit</option>
                    <option value="Credit Payment">Credit Payment</option>
                  </select>
                </div>

                <!-- Action -->
                <div class="text-right md:text-center">
                  <button
                    on:click={() => deleteRow(i)}
                    class="md:p-1 md:rounded hover:bg-red-50 transition-colors inline-flex items-center justify-center"
                    disabled={items.length === 1}
                    title="Remove row"
                    data-delete-button
                  >
                    <!-- Mobile view: Text button -->
                    <span class="md:hidden bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700">
                      Remove
                    </span>
                    
                    <!-- Desktop view: Icon only -->
                    <Trash2 class="hidden md:block w-4 h-4 text-red-600 hover:text-red-900" />
                    <span class="sr-only">Remove row</span>
                  </button>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
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
</div>

<style>
  :global(body) {
    background-color: #f3f4f6;
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