<!-- Customer Group Invoices Management -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';

  import { toastSuccess, toastError } from '$lib/utils/toast';
  import Select from 'svelte-select';
  import {
    invoices,
    originalInvoices,
    filteredInvoices,
    loading,
    filterLoading,
    currentLoadingStep,
    invoiceError,
    dateError,
    customerGroupError,
    statusError,
    invoiceIdsError,
    currentPage,
    itemsPerPage,
    sortField,
    sortDirection,
    invoiceIds,
    parsedInvoiceIds,
    selectedCustomerGroup,
    selectedCustomer,
    filterType,
    dateFrom,
    dateTo,
    selectedStatus,
    applyFilters,
    applyFiltersViaAPI,
    validateFilters,
    customerGroups,
    customers,
    fetchCustomerGroups,
    searchFilters,
    fetchCustomers
  } from './stores';
  import type { CustomerGroupInvoice } from './types';
  import { handlePrint } from './utils/print';
  import { 
    getSortIcon, 
    handleSort, 
    getPaginatedInvoices, 
    getTotalPages, 
    getCurrentPageItems 
  } from './utils/table';
  import { writable } from 'svelte/store';
  import { DateTime } from 'luxon';

  export let data: { invoices: CustomerGroupInvoice[] };

  // Status options
  const statusOptions = [
    { value: 'Unpaid', label: 'Unpaid' },
    { value: 'PartiallyPaid', label: 'Partial Paid' },
    { value: 'FullyPaid', label: 'Fully Paid' }
  ];



  // Initialize invoices and customer groups only on mount
  onMount(async () => {
    if (data?.invoices && Array.isArray(data.invoices)) {
      $originalInvoices = [...data.invoices];
      $invoices = [...data.invoices];
      $filteredInvoices = [...data.invoices];
    }
    
    // Fetch customer groups and customers from Firestore
    try {
      await Promise.all([
        fetchCustomerGroups(),
        fetchCustomers()
      ]);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toastError('Failed to load customer data');
    }
  });

  // Declare reactive variables
  let paginatedInvoices: CustomerGroupInvoice[] = [];
  let totalPages = 0;
  let currentPageItems = {
    start: 0,
    end: 0,
    total: 0
  };

  // Add reactive statements for pagination and sorting
  $: {
    if ($invoices && $invoices.length > 0) {
      paginatedInvoices = getPaginatedInvoices($invoices, $currentPage, $itemsPerPage);
      totalPages = getTotalPages($invoices.length, $itemsPerPage);
      
      // Update current page items info
      currentPageItems = getCurrentPageItems($currentPage, $itemsPerPage, $invoices.length);
    } else {
      paginatedInvoices = [];
      totalPages = 0;
      currentPageItems = {
        start: 0,
        end: 0,
        total: 0
      };
    }
  }

  // Add reactive variables for print data
  let printData = {
    customerGroupLabel: 'All Groups',
    dateFrom: null as Date | null,
    dateTo: null as Date | null
  };

  // Update print data when stores change
  $: {
    printData.customerGroupLabel = $selectedCustomerGroup 
      ? $customerGroups.find(group => group.value === $selectedCustomerGroup)?.label || 'All Groups'
      : 'All Groups';
    
    if ($dateFrom && $dateTo) {
      printData.dateFrom = new Date($dateFrom);
      printData.dateTo = new Date($dateTo);
    }
  }

  // Function to handle filter application
  async function handleApplyFilter() {
    try {
      // Check if invoice IDs are provided first
      const currentInvoiceIds = $invoiceIds.trim();
      
      if (currentInvoiceIds) {
        // Invoice IDs filtering path - bypass customer/group filters
        const parsedIds = $parsedInvoiceIds;
        
        if (parsedIds.length === 0) {
          toastError('Please enter valid invoice IDs');
          return;
        }

        filterLoading.set(true);
        currentLoadingStep.set('Fetching specific invoices...');

        // Direct API call with invoice IDs
        const ordersPayload = {
          Filter: {
            OrderStatus: "Dispatched",
            OrderID: parsedIds, // Filter by specific invoice IDs
            PaymentStatus: ["Pending", "PartialPaid", "FullyPaid"],
            OutputSelector: [
              "ID",
              "Username", 
              "UserGroup",
              "DatePaymentDue",
              "OrderPayment",
              "GrandTotal",
              "DatePlaced"
            ]
          },
          action: "GetOrder"
        };

        const apiEndpoint = 'https://prod-56.australiasoutheast.logic.azure.com:443/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=G8m_h5Dl8GpIRQtlN0oShby5zrigLKTWEddou-zGQIs';
        
        console.log('=== INVOICE IDS FILTER API CALL ===');
        console.log('Endpoint:', apiEndpoint);
        console.log('Payload:', JSON.stringify(ordersPayload, null, 2));

        // Single API call for invoice IDs
        const ordersResponse = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(ordersPayload)
        });

        const orders_data = await ordersResponse.json();
        console.log('Get Orders API Response (Invoice IDs):', orders_data);

        if (!orders_data.Order || orders_data.Order.length === 0) {
          toastError('No invoices found for the provided IDs');
          filterLoading.set(false);
          currentLoadingStep.set('');
          return;
        }

        // Update loading message for mapping process
        currentLoadingStep.set('Processing and mapping invoice data...');

        // Calculate payment status for each order
        const mappedInvoices = orders_data.Order.map((order: any) => {
          // Calculate total payments
          const totalPayments = order.OrderPayment?.reduce((sum: number, payment: any) => 
            sum + (parseFloat(payment.Amount) || 0), 0) || 0;
          
          const grandTotal = parseFloat(order.GrandTotal) || 0;
          
          // Round both values to 2 decimal places to avoid floating-point precision issues
          const roundedTotalPayments = Math.round(totalPayments * 100) / 100;
          const roundedGrandTotal = Math.round(grandTotal * 100) / 100;
          const balance = roundedGrandTotal - roundedTotalPayments;

          // Check for zero invoice with no payments
          const hasNoPayments = !order.OrderPayment || order.OrderPayment.length === 0;
          const isZeroInvoice = roundedGrandTotal === 0 && roundedTotalPayments === 0 && hasNoPayments;
          
          // Determine payment status
          let status = 'Unpaid';
          let statusColor = 'bg-red-100 text-red-800';
          
          if (roundedTotalPayments > 0) {
            if (roundedTotalPayments >= roundedGrandTotal) {
              status = 'Fully Paid';
              statusColor = 'bg-green-100 text-green-800';
            } else {
              status = 'Partially Paid';
              statusColor = 'bg-yellow-100 text-yellow-800';
            }
          }

          return {
            invoiceNumber: order.ID,
            dateIssued: order.DatePlaced,
            dueDate: order.DatePaymentDue,
            totalAmount: roundedGrandTotal,
            amountPaid: roundedTotalPayments,
            balance: balance,
            username: order.Username,
            company: order.UserGroup, // Use UserGroup as company for direct invoice lookup
            status,
            statusColor,
            customerGroupName: order.UserGroup,
            isZeroInvoice,
            // New fields for Xero comparison
            xeroMatch: false, // Default to false, this would be populated from Xero API
            xeroTotal: 0, // Default to 0, this would be populated from Xero API
            netoTotal: roundedGrandTotal, // Use the neto total as the invoice total
            invoiceTotalMatch: null // Default to null, this would be calculated based on comparison
          };
        })
        .filter((invoice: CustomerGroupInvoice) => {
          // Apply status filter if provided
          if ($selectedStatus && $selectedStatus.length > 0) {
            const matchesStatus = $selectedStatus.some(selected => {
              const statusValue = selected.value;
              // Map the status values to match the invoice status format
              const statusMap: { [key: string]: string } = {
                'Unpaid': 'Unpaid',
                'PartiallyPaid': 'Partially Paid',
                'FullyPaid': 'Fully Paid'
              };
              const mappedStatus = statusMap[statusValue];
              return invoice.status === mappedStatus;
            });
            if (!matchesStatus) return false;
          }

          // Apply date filter if both dates are selected
          if ($dateFrom && $dateTo) {
            const dueDate = new Date(invoice.dueDate);
            const fromDate = new Date($dateFrom);
            fromDate.setHours(0, 0, 0, 0); // Start of day
            const toDate = new Date($dateTo);
            toDate.setHours(23, 59, 59, 999); // End of day

            // Check if due date is within range
            if (dueDate < fromDate || dueDate > toDate) {
              return false;
            }
          }

          return true;
        });

        // Call Xero API to enrich the data
        currentLoadingStep.set('Fetching Xero data for comparison...');
        const enrichedInvoices = await enrichWithXeroData(mappedInvoices);

        // Update all necessary stores
        $invoices = enrichedInvoices;
        $originalInvoices = enrichedInvoices;
        $filteredInvoices = enrichedInvoices;
        $currentPage = 1; // Reset to first page

        // Calculate pagination
        paginatedInvoices = getPaginatedInvoices($invoices, $currentPage, $itemsPerPage);
        totalPages = getTotalPages($invoices.length, $itemsPerPage);

        // Apply local filters after getting the response
        applyFilters();
        toastSuccess(`Found ${enrichedInvoices.length} invoices for the provided IDs`);
        
      } else {
        // Original filtering logic when no invoice IDs
        // Validate filters before proceeding
        if ($selectedStatus.length === 0) {
          toastError('Please select at least one status');
          return;
        }

        if ($filterType === 'group' && !$selectedCustomerGroup) {
          toastError('Please select a customer group');
          return;
        }

        if ($filterType === 'customer' && !$selectedCustomer) {
          toastError('Please select a customer');
          return;
        }

        filterLoading.set(true);
        currentLoadingStep.set('Fetching customer data...');
        
        // Prepare payload for Get Customer API
        const customerPayload = {
          Filter: {
            ...($filterType === 'group' 
              ? { UserGroup: [parseInt($selectedCustomerGroup || '0')] }
              : { Username: [$selectedCustomer] }
            ),
            OutputSelector: [
              "Username",
              "EmailAddress",
              "UserGroup",
              "BillingAddress"
            ]
          },
          action: "GetCustomer"
        };

        console.log('Get Customer API Payload:', customerPayload);
        
        // First API call - Get Customer
        const customerResponse = await fetch('https://prod-56.australiasoutheast.logic.azure.com:443/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=G8m_h5Dl8GpIRQtlN0oShby5zrigLKTWEddou-zGQIs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(customerPayload)
        });

        const customer_group_customers = await customerResponse.json();
        console.log('Customer Group Customers:', customer_group_customers);

        // Check if we have any customers in the response
        if (!customer_group_customers.Customer || customer_group_customers.Customer.length === 0) {
          toastError('No users found in the selected ' + ($filterType === 'group' ? 'customer group' : 'customer'));
          filterLoading.set(false);
          currentLoadingStep.set('');
          return;
        }

        // Create a map of username to UserGroup for company lookup
        const customerGroupMap = new Map(
          customer_group_customers.Customer.map((customer: { Username: string; BillingAddress: { BillCompany: string } }) => [
            customer.Username,
            customer.BillingAddress.BillCompany
          ])
        );

        // Extract usernames from the customer group response
        const usernames = customer_group_customers.Customer.map((customer: { Username: string }) => customer.Username);
        console.log('Extracted Usernames:', usernames);

        // Update loading message for status condition
        currentLoadingStep.set('Applying status filter: Pending, PartialPaid, FullyPaid...');

        // Update loading message for second API call
        currentLoadingStep.set('Fetching orders data...');

        // Prepare payload for Get Orders API
        const ordersPayload = {
          Filter: {
            OrderStatus: "Dispatched",
            Username: usernames,
            PaymentStatus: ["Pending", "PartialPaid", "FullyPaid"],
            OutputSelector: [
              "ID",
              "Username",
              "UserGroup",
              "DatePaymentDue",
              "OrderPayment",
              "GrandTotal",
              "DatePlaced"
            ]
          },
          action: "GetOrder"
        };

        console.log('Get Orders API Payload:', ordersPayload);

        // Second API call - Get Orders
        const ordersResponse = await fetch('https://prod-56.australiasoutheast.logic.azure.com:443/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=G8m_h5Dl8GpIRQtlN0oShby5zrigLKTWEddou-zGQIs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(ordersPayload)
        });

        const orders_data = await ordersResponse.json();
        console.log('Get Orders API Response:', orders_data);

        // Update loading message for mapping process
        currentLoadingStep.set('Processing and mapping invoice data...');

        // Calculate payment status for each order
        const mappedInvoices = orders_data.Order.map((order: any) => {
          // Calculate total payments
          const totalPayments = order.OrderPayment?.reduce((sum: number, payment: any) => 
            sum + (parseFloat(payment.Amount) || 0), 0) || 0;
          
          const grandTotal = parseFloat(order.GrandTotal) || 0;
          
          // Round both values to 2 decimal places to avoid floating-point precision issues
          const roundedTotalPayments = Math.round(totalPayments * 100) / 100;
          const roundedGrandTotal = Math.round(grandTotal * 100) / 100;
          const balance = roundedGrandTotal - roundedTotalPayments;

          // Check for zero invoice with no payments
          const hasNoPayments = !order.OrderPayment || order.OrderPayment.length === 0;
          const isZeroInvoice = roundedGrandTotal === 0 && roundedTotalPayments === 0 && hasNoPayments;
          
          // Determine payment status
          let status = 'Unpaid';
          let statusColor = 'bg-red-100 text-red-800';
          
          if (roundedTotalPayments > 0) {
            if (roundedTotalPayments >= roundedGrandTotal) {
              status = 'Fully Paid';
              statusColor = 'bg-green-100 text-green-800';
            } else {
              status = 'Partially Paid';
              statusColor = 'bg-yellow-100 text-yellow-800';
            }
          }

                     return {
             invoiceNumber: order.ID,
             dateIssued: order.DatePlaced,
             dueDate: order.DatePaymentDue,
             totalAmount: roundedGrandTotal,
             amountPaid: roundedTotalPayments,
             balance: balance,
             username: order.Username,
             company: customerGroupMap.get(order.Username) || order.UserGroup,
             status,
             statusColor,
             customerGroupName: order.UserGroup,
             isZeroInvoice,
                           // New fields for Xero comparison
              xeroMatch: false, // Default to false, this would be populated from Xero API
              xeroTotal: 0, // Default to 0, this would be populated from Xero API
              netoTotal: roundedGrandTotal, // Use the neto total as the invoice total
              invoiceTotalMatch: null // Default to null, this would be calculated based on comparison
           };
        })
        .filter((invoice: CustomerGroupInvoice) => {
          // First apply status filter
          if ($selectedStatus && $selectedStatus.length > 0) {
            const matchesStatus = $selectedStatus.some(selected => {
              const statusValue = selected.value;
              // Map the status values to match the invoice status format
              const statusMap: { [key: string]: string } = {
                'Unpaid': 'Unpaid',
                'PartiallyPaid': 'Partially Paid',
                'FullyPaid': 'Fully Paid'
              };
              const mappedStatus = statusMap[statusValue];
              return invoice.status === mappedStatus;
            });
            if (!matchesStatus) return false;
          }

          // Then apply date filter if both dates are selected
          if ($dateFrom && $dateTo) {
            const dueDate = new Date(invoice.dueDate);
            const fromDate = new Date($dateFrom);
            fromDate.setHours(0, 0, 0, 0); // Start of day
            const toDate = new Date($dateTo);
            toDate.setHours(23, 59, 59, 999); // End of day

            // Check if due date is within range
            if (dueDate < fromDate || dueDate > toDate) {
              return false;
            }
          }

          return true;
        });

                 // Call Xero API to enrich the data
         currentLoadingStep.set('Fetching Xero data for comparison...');
         const enrichedInvoices = await enrichWithXeroData(mappedInvoices);

         // Update all necessary stores
         $invoices = enrichedInvoices;
         $originalInvoices = enrichedInvoices;
         $filteredInvoices = enrichedInvoices;
         $currentPage = 1; // Reset to first page

         // Calculate pagination
         paginatedInvoices = getPaginatedInvoices($invoices, $currentPage, $itemsPerPage);
         totalPages = getTotalPages($invoices.length, $itemsPerPage);

         // Apply local filters after getting the response
         applyFilters();
         toastSuccess('Filters applied successfully');
      }
    } catch (error) {
      console.error('Error applying filters:', error);
      toastError(error instanceof Error ? error.message : 'Failed to apply filters');
    } finally {
      filterLoading.set(false);
      currentLoadingStep.set('');
    }
  }

  // Function to handle page change
  function handlePageChange(newPage: number) {
    if (newPage >= 1 && newPage <= totalPages) {
      currentPage.set(newPage);
      // Scroll to top of table
      document.querySelector('.overflow-x-auto')?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // Function to handle items per page change
  function handleItemsPerPageChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const value = parseInt(select.value);
    if (!isNaN(value)) {
      itemsPerPage.set(value);
      currentPage.set(1); // Reset to first page
    }
  }

  // Function to handle sorting
  function handleSortClick(field: keyof CustomerGroupInvoice) {
    const { sortedInvoices, newSortField, newSortDirection } = handleSort(
      $invoices,
      field,
      $sortField,
      $sortDirection
    );
    
    sortField.set(newSortField);
    sortDirection.set(newSortDirection);
    $invoices = sortedInvoices;
  }

  // Handle date input changes with proper type checking and validation
  function handleDateChange(event: Event, setter: (date: Date | null) => void) {
    const input = event.target as HTMLInputElement;
    const newDate = input.value ? new Date(input.value) : null;
    setter(newDate);
    
    // Validate dates whenever either date changes
    validateFilters();
  }

  // Handle customer group selection
  function handleCustomerGroupSelect(event: CustomEvent) {
    const value = event.detail?.value;
    selectedCustomerGroup.set(value);
    validateFilters();
  }

  // Handle customer selection
  function handleCustomerSelect(event: CustomEvent) {
    const value = event.detail?.value;
    selectedCustomer.set(value);
    validateFilters();
  }

  // Handle status selection
  function handleStatusSelect(event: CustomEvent) {
    const detail = event.detail;
    
    // Get the current selected values
    let currentValues = [...$selectedStatus];
    
    // If we have a new value, add it to the array
    if (detail?.value) {
      const newValue = {
        value: detail.value,
        label: detail.label
      };
      
      // Check if the value is already selected
      const exists = currentValues.some(v => v.value === newValue.value);
      
      if (!exists) {
        currentValues.push(newValue);
      }
    }
    
    selectedStatus.set(currentValues);
    validateFilters();
  }

  // Add search function
  function handleSearch(event: Event, field: string) {
    const input = event.target as HTMLInputElement;
    searchFilters.update(filters => ({
      ...filters,
      [field]: input.value.toLowerCase()
    }));
    
    // Apply search filters
    $invoices = $originalInvoices.filter(invoice => {
      return Object.entries($searchFilters).every(([key, value]) => {
        if (!value) return true; // Skip empty search fields
        
        const invoiceValue = String(invoice[key as keyof CustomerGroupInvoice]).toLowerCase();
        return invoiceValue.includes(value);
      });
    });
    
    // Reset to first page when searching
    currentPage.set(1);
  }



  // Handle invoice IDs input changes
  function handleInvoiceIdsChange(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    invoiceIds.set(textarea.value);
    validateFilters();
  }

  // Function to enrich Neto invoices with Xero data
  async function enrichWithXeroData(netoInvoices: CustomerGroupInvoice[]): Promise<CustomerGroupInvoice[]> {
    try {
      // Extract invoice numbers for Xero lookup
      const invoiceNumbers = netoInvoices.map(invoice => invoice.invoiceNumber);
      
      if (invoiceNumbers.length === 0) {
        return netoInvoices;
      }

      // Prepare Xero API payload
      const xeroPayload = {
        "tenant_id": "dad1e60b-64e1-4823-b219-a76079276af3",
        "invoice_numbers": invoiceNumbers
      };

      console.log('=== XERO API CALL ===');
      console.log('Endpoint: https://rapidtools-backend.netlify.app/.netlify/functions/getInvoices?tenant_id=dad1e60b-64e1-4823-b219-a76079276af3');
      console.log('Method: POST');
      console.log('Payload:', JSON.stringify(xeroPayload, null, 2));

      // Call Xero API
      const xeroResponse = await fetch('https://rapidtools-backend.netlify.app/.netlify/functions/getInvoices?tenant_id=dad1e60b-64e1-4823-b219-a76079276af3', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(xeroPayload)
      });

      const xeroData = await xeroResponse.json();
      console.log('Xero API Response:', xeroData);

      // Enrich Neto invoices with Xero data
      const enrichedInvoices = netoInvoices.map(netoInvoice => {
        const xeroInvoice = xeroData.invoices?.find((xero: any) => 
          xero.invoiceNumber === netoInvoice.invoiceNumber
        );

        if (xeroInvoice) {
          // Match found - calculate total match
          const xeroTotal = parseFloat(xeroInvoice.total) || 0;
          const netoTotal = netoInvoice.netoTotal;
          const totalsMatch = Math.abs(xeroTotal - netoTotal) < 0.01; // Allow for minor rounding differences

          return {
            ...netoInvoice,
            xeroMatch: true,
            xeroTotal: xeroTotal,
            invoiceTotalMatch: totalsMatch
          };
        } else {
          // No match found
          return {
            ...netoInvoice,
            xeroMatch: false,
            xeroTotal: 0,
            invoiceTotalMatch: null // Will display as "N/A"
          };
        }
      });

      return enrichedInvoices;
    } catch (error) {
      console.error('Error enriching with Xero data:', error);
      // Return original data if Xero API fails
      return netoInvoices.map(invoice => ({
        ...invoice,
        xeroMatch: false,
        xeroTotal: 0,
        invoiceTotalMatch: null
      }));
    }
  }
</script>

<div class="min-h-screen bg-gray-100 py-8 px-2 sm:px-3">
  <div class="max-w-[98%] mx-auto bg-white shadow p-6" transition:fade>
    <h2 class="text-2xl font-bold mb-6 text-gray-900">Customer Group Invoices</h2>

    <!-- Filter Section -->
    <div class="mb-6 grid grid-cols-1 md:grid-cols-5 gap-4">
      <!-- Invoice IDs Filter (First Column) -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Invoice IDs
          <span class="text-xs text-gray-500 block">(Optional - overrides other filters)</span>
        </label>
        <textarea
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm resize-none"
          rows="2"
          placeholder="Enter IDs separated by commas or new lines..."
          bind:value={$invoiceIds}
          on:input={handleInvoiceIdsChange}
        />
        {#if $invoiceIdsError}
          <p class="mt-1 text-sm text-red-600">{$invoiceIdsError}</p>
        {/if}
      </div>

      <!-- Filter Type (Second Column) -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="block text-sm font-medium text-gray-700">Filter Type</label>
          <div class="flex items-center space-x-2">
            <button
              class={`px-3 py-1 text-sm rounded-md ${$filterType === 'group' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              on:click={() => filterType.set('group')}
            >
              Group
            </button>
            <button
              class={`px-3 py-1 text-sm rounded-md ${$filterType === 'customer' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              on:click={() => filterType.set('customer')}
            >
              Customer
            </button>
          </div>
        </div>
        
        {#if $filterType === 'group'}
          <Select
            items={$customerGroups}
            placeholder="Select customer group"
            clearable={true}
            on:clear={() => {
              selectedCustomerGroup.set(null);
              validateFilters();
            }}
            on:select={handleCustomerGroupSelect}
          />
        {:else}
          <Select
            items={$customers}
            placeholder="Select customer"
            clearable={true}
            on:clear={() => {
              selectedCustomer.set(null);
              validateFilters();
            }}
            on:select={handleCustomerSelect}
          />
        {/if}
        {#if $customerGroupError}
          <p class="mt-1 text-sm text-red-600">{$customerGroupError}</p>
        {/if}
      </div>
      
      <!-- Date From (Third Column) -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Date From</label>
        <input
          type="date"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          on:change={(e) => handleDateChange(e, dateFrom.set)}
        />
      </div>
      
      <!-- Date To (Fourth Column) -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Date To</label>
        <input
          type="date"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          on:change={(e) => handleDateChange(e, dateTo.set)}
        />
      </div>
      
      <!-- Status (Fifth Column) -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <Select
          items={statusOptions}
          placeholder="Select status"
          clearable={true}
          multiple={true}
          value={$selectedStatus}
          on:clear={() => {
            console.log('Status filter cleared');
            console.log('Previous selected status:', $selectedStatus);
            selectedStatus.set([]);
            console.log('New selected status:', $selectedStatus);
            validateFilters();
          }}
          on:select={handleStatusSelect}
        />
        {#if $statusError}
          <p class="mt-1 text-sm text-red-600">{$statusError}</p>
        {/if}
      </div>
    </div>

    <!-- Date Error Message -->
    {#if $dateError}
      <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
        <p class="text-sm text-red-600">{$dateError}</p>
      </div>
    {/if}

    <!-- Apply Filter Button -->
    <div class="mb-6 flex justify-end gap-4">
      {#if $invoices && $invoices.length > 0}
        <button
          class="bg-gray-600 text-white py-2 px-4 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[160px]"
          on:click={() => handlePrint($invoices, printData)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print Table
        </button>
      {/if}
      <button
        class="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[160px]"
        on:click={handleApplyFilter}
        disabled={$filterLoading || !!$dateError || !!$customerGroupError || !!$statusError || !!$invoiceIdsError}
      >
        {#if $filterLoading}
          <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
          Applying...
        {:else}
          Apply Filter
        {/if}
      </button>
    </div>

    <!-- Add this before the Invoices Table section -->
    {#if $filterLoading}
      <div class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
        <div class="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
          <div class="flex items-center justify-center mb-4">
            <div class="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
          </div>
          <p class="text-center text-gray-700 font-medium">{$currentLoadingStep}</p>
          <p class="text-center text-sm text-gray-500 mt-2">This may take a few moments</p>
        </div>
      </div>
    {/if}

    <!-- Invoices Table -->
    <div class="overflow-x-auto">
      {#if $loading}
        <div class="flex justify-center items-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
        </div>
      {:else}
        <table class="min-w-full divide-y divide-gray-200 table-fixed">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div class="flex flex-col">
                  <div class="flex items-center cursor-pointer hover:bg-gray-100" on:click={() => handleSortClick('invoiceNumber')}>
                    Invoice # {getSortIcon('invoiceNumber', $sortField, $sortDirection)}
                  </div>
                  <input
                    type="text"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Search..."
                    on:input={(e) => handleSearch(e, 'invoiceNumber')}
                  />
                </div>
              </th>
              <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div class="flex flex-col">
                  <div class="flex items-center cursor-pointer hover:bg-gray-100" on:click={() => handleSortClick('xeroMatch')}>
                    Xero Match {getSortIcon('xeroMatch', $sortField, $sortDirection)}
                  </div>
                  <input
                    type="text"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Search..."
                    on:input={(e) => handleSearch(e, 'xeroMatch')}
                  />
                </div>
              </th>
              <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div class="flex flex-col">
                  <div class="flex items-center cursor-pointer hover:bg-gray-100" on:click={() => handleSortClick('dueDate')}>
                    Due Date {getSortIcon('dueDate', $sortField, $sortDirection)}
                  </div>
                  <input
                    type="text"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Search..."
                    on:input={(e) => handleSearch(e, 'dueDate')}
                  />
                </div>
              </th>
              <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div class="flex flex-col">
                  <div class="flex items-center cursor-pointer hover:bg-gray-100" on:click={() => handleSortClick('xeroTotal')}>
                    Xero Total {getSortIcon('xeroTotal', $sortField, $sortDirection)}
                  </div>
                  <input
                    type="text"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Search..."
                    on:input={(e) => handleSearch(e, 'xeroTotal')}
                  />
                </div>
              </th>
              <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div class="flex flex-col">
                  <div class="flex items-center cursor-pointer hover:bg-gray-100" on:click={() => handleSortClick('netoTotal')}>
                    Neto Total {getSortIcon('netoTotal', $sortField, $sortDirection)}
                  </div>
                  <input
                    type="text"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Search..."
                    on:input={(e) => handleSearch(e, 'netoTotal')}
                  />
                </div>
              </th>
              <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div class="flex flex-col">
                  <div class="flex items-center cursor-pointer hover:bg-gray-100" on:click={() => handleSortClick('invoiceTotalMatch')}>
                    Invoice Total Match {getSortIcon('invoiceTotalMatch', $sortField, $sortDirection)}
                  </div>
                  <input
                    type="text"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Search..."
                    on:input={(e) => handleSearch(e, 'invoiceTotalMatch')}
                  />
                </div>
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#if !$invoices || $invoices.length === 0}
              <tr>
                <td colspan="6" class="px-2 py-4 text-center text-gray-500">
                  No results found
                </td>
              </tr>
            {:else}
              {#each paginatedInvoices as invoice (invoice.invoiceNumber)}
                <tr class={invoice.updated ? 'bg-green-50' : ''}>
                  <td class="px-2 py-1 text-sm">{invoice.invoiceNumber}</td>
                  <td class={`px-2 py-1 text-sm ${!invoice.xeroMatch ? 'bg-gray-200' : ''}`}>
                    <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${invoice.xeroMatch ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {invoice.xeroMatch ? 'Yes' : 'No Match'}
                    </span>
                  </td>
                  <td class="px-2 py-1 text-sm">
                    {new Date(invoice.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </td>
                  <td class={`px-2 py-1 text-sm ${!invoice.xeroMatch ? 'bg-gray-200' : ''}`}>
                    {#if invoice.xeroMatch}
                      {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(invoice.xeroTotal)}
                    {:else}
                      <span class="text-gray-500">-</span>
                    {/if}
                  </td>
                  <td class="px-2 py-1 text-sm">
                    {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(invoice.netoTotal)}
                  </td>
                  <td class={`px-2 py-1 text-sm ${invoice.invoiceTotalMatch === null ? 'bg-gray-200' : ''}`}>
                    <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      invoice.invoiceTotalMatch === null ? 'bg-gray-100 text-gray-800' : 
                      invoice.invoiceTotalMatch ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {invoice.invoiceTotalMatch === null ? 'N/A' : 
                       invoice.invoiceTotalMatch ? 'Match' : 'No Match'}
                    </span>
                  </td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      {/if}
    </div>

    <!-- Pagination -->
    <div class="mt-4 flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
      <div class="flex items-center">
        <span class="mr-2 text-sm text-gray-700">Items per page:</span>
        <select
          class="rounded border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
          on:change={handleItemsPerPageChange}
          value={$itemsPerPage}
        >
          <option value="5">5</option>
          <option value="10">10</option>
          <option value="20">20</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>
      </div>
      
      <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p class="text-sm text-gray-700">
            Showing <span class="font-medium">{currentPageItems.start}</span> to{' '}
            <span class="font-medium">{currentPageItems.end}</span> of{' '}
            <span class="font-medium">{currentPageItems.total}</span> results
          </p>
        </div>
        <div>
          <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
            <button
              class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
              on:click={() => handlePageChange($currentPage - 1)}
              disabled={$currentPage === 1}
            >
              <span class="sr-only">Previous</span>
              <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clip-rule="evenodd" />
              </svg>
            </button>
            
            <button
              class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
              on:click={() => handlePageChange($currentPage + 1)}
              disabled={$currentPage === totalPages}
            >
              <span class="sr-only">Next</span>
              <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
              </svg>
            </button>
          </nav>
        </div>
      </div>
    </div>
  </div>
</div>



<style>
  @media print {
    /* Hide elements that shouldn't be printed */
    button, 
    .filter-section,
    .pagination-section {
      display: none !important;
    }

    /* Ensure table is fully visible */
    .overflow-x-auto {
      overflow: visible !important;
    }

    /* Adjust table styles for printing */
    table {
      width: 100% !important;
      border-collapse: collapse !important;
    }

    th, td {
      border: 1px solid #ddd !important;
      padding: 8px !important;
    }

    /* Ensure text is black for better printing */
    * {
      color: black !important;
    }
  }

  tbody tr:hover {
    background-color: #f0f0f0; /* Light gray background on hover */
  }
</style> 