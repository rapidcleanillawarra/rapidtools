<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { db } from '$lib/firebase';
  import { collection, query, where, orderBy, getDocs, type QueryConstraint } from 'firebase/firestore';
  import type { AccountingBotRecord, HistoryEntry } from './+page.ts';

  // Filter variables
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-based (0 = January, 5 = June)
  
  // First day of current month
  const firstDay = new Date(year, month, 1);
  // Last day of current month
  const lastDay = new Date(year, month + 1, 0);
  
  let fromDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  let toDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
  let idFilter = '';
  
  // Data variables
  let history: HistoryEntry[] = [];
  let loading = false;
  let error = '';
  let message = '';
  
  // Modal variables
  let modalOrderId: string | null = null;
  let modalEntry: AccountingBotRecord | null = null;
  
  // Helper function to show modal
  function showModal(orderId: string) {
    modalOrderId = orderId;
    const record = history.find(h => h.current.order_id === orderId)?.previous;
    modalEntry = record || null;
  }
  
  // Helper function to close modal
  function closeModal() {
    modalOrderId = null;
    modalEntry = null;
  }
  
  // Validation function
  function validateFilters(): string | null {
    const hasDateRange = fromDate && toDate;
    const hasIds = idFilter.trim().length > 0;
    
    if (!hasDateRange && !hasIds) {
      return 'Please provide either a date range or order/invoice IDs';
    }
    
    if (hasDateRange) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      if (start >= end) {
        return 'From date must be before To date';
      }
    }
    
    return null;
  }
  
  // Function to fetch data from Firestore
  async function fetchHistory() {
    const validationError = validateFilters();
    if (validationError) {
      error = validationError;
      return;
    }
    
    loading = true;
    error = '';
    message = '';
    history = [];
    
    try {
      const ids = idFilter.trim().length > 0 
        ? idFilter.split('\n')
            .map(id => id.trim())
            .filter(id => id.length > 0)
        : [];
      
      const constraints: QueryConstraint[] = [];
      
      if (fromDate && toDate) {
        const startDateStr = fromDate + 'T00:00:00.000Z';
        const endDateStr = toDate + 'T23:59:59.999Z';
        
        constraints.push(where('timestamp_utc', '>=', startDateStr));
        constraints.push(where('timestamp_utc', '<=', endDateStr));
      }
      
      if (ids.length > 0) {
        if (ids.length > 10) {
          constraints.push(where('order_id', 'in', ids.slice(0, 10)));
        } else {
          constraints.push(where('order_id', 'in', ids));
        }
      }
      
      constraints.push(orderBy('timestamp_utc', 'desc'));
      
      const q = query(collection(db, 'accounting_bot'), ...constraints);
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        message = 'No records found for the specified filters';
        return;
      }
      
      // Log the table data
      const tableData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          order_id: data.order_id || '',
          maropost_total: data.maropost_total || 0,
          xero_total: data.xero_total || 0,
          difference: data.difference || '',
          maropost_paid_status: data.maropost_paid_status || '',
          xero_paid_status: data.xero_paid_status || '',
          order_status: data.order_status || '',
          notes: data.notes || '',
          timestamp_utc: data.timestamp_utc?.toDate?.() || data.timestamp_utc || ''
        };
      });
      
      console.log('Table data:', tableData);
      
      // Group by order_id and keep only the latest record per order
      const orderMap = new Map<string, AccountingBotRecord>();
      const allRecords: AccountingBotRecord[] = [];
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        
        // Handle timestamp_utc - could be Firestore Timestamp or string
        let timestamp: Date;
        if (data.timestamp_utc) {
          if (typeof data.timestamp_utc === 'string') {
            timestamp = new Date(data.timestamp_utc);
          } else if (data.timestamp_utc.toDate) {
            // Firestore Timestamp object
            timestamp = data.timestamp_utc.toDate();
          } else {
            timestamp = new Date();
          }
        } else {
          timestamp = new Date();
        }
        
        // Debug: Log first few timestamps
        if (allRecords.length < 3) {
          console.log('Sample record timestamp:', {
            order_id: data.order_id,
            raw_timestamp: data.timestamp_utc,
            parsed_timestamp: timestamp.toISOString(),
            timestamp_type: typeof data.timestamp_utc
          });
        }
        
        const record: AccountingBotRecord = {
          id: doc.id,
          order_id: data.order_id || '',
          maropost_total: data.maropost_total || 0,
          xero_total: data.xero_total || 0,
          maropost_paid_status: data.maropost_paid_status || '',
          xero_paid_status: data.xero_paid_status || '',
          difference: data.difference || '',
          order_status: data.order_status || '',
          notes: data.notes || '',
          timestamp_utc: timestamp
        };
        
        allRecords.push(record);
        
        // Keep only the latest record per order_id (first one due to desc order)
        if (!orderMap.has(record.order_id)) {
          orderMap.set(record.order_id, record);
        }
      });
      
      // Find previous records for each latest entry
      const historyEntries: HistoryEntry[] = [];
      
      for (const [orderId, currentRecord] of orderMap) {
        // Find the immediate predecessor
        const predecessors = allRecords
          .filter(record => 
            record.order_id === orderId && 
            record.timestamp_utc < currentRecord.timestamp_utc
          )
          .sort((a, b) => b.timestamp_utc.getTime() - a.timestamp_utc.getTime());
        
        const previousRecord = predecessors.length > 0 ? predecessors[0] : undefined;
        
        historyEntries.push({
          current: currentRecord,
          previous: previousRecord
        });
      }
      
      // Sort by timestamp descending
      history = historyEntries.sort((a, b) => 
        b.current.timestamp_utc.getTime() - a.current.timestamp_utc.getTime()
      );
      
    } catch (err) {
      console.error('Error fetching history:', err);
      error = 'Failed to fetch records. Please try again.';
    } finally {
      loading = false;
    }
  }
  
  // Helper function to get matching status color
  function getMatchingStatusColor(difference: string): string {
    switch (difference.toLowerCase()) {
      case 'match':
        return 'text-green-600 bg-green-50';
      case 'mismatch':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  }
  
  // Helper function to format currency
  function formatCurrency(amount: number): string {
    if (isNaN(amount)) {
      return 'N/A';
    }
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  }
  
    // Helper function to display value comparison
  function displayComparison(currentValue: any, previousValue: any, formatter?: (val: any) => string, skipComparison = false): string {
    if (!previousValue || skipComparison) {
      return formatter ? formatter(currentValue) : currentValue;
    }
    
    const current = formatter ? formatter(currentValue) : currentValue;
    const previous = formatter ? formatter(previousValue) : previousValue;
    
    if (currentValue !== previousValue) {
      return `${previous} > ${current}`;
    }
    
    return current;
  }
  
  // Helper function to check if value has changed
  function hasChanged(currentValue: any, previousValue: any): boolean {
    return previousValue && currentValue !== previousValue;
  }
  
  // Helper function to format text (capitalize first letter and replace underscores with spaces)
  function formatText(text: string): string {
    if (!text) return text;
    return text
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  
  // Helper function to get status background color
  function getStatusColor(status: string): string {
    if (!status) return '';
    const formattedStatus = formatText(status).toLowerCase();
    
    // Payment statuses
    if (formattedStatus === 'paid') return 'bg-green-100 text-green-800';
    if (formattedStatus === 'unpaid') return 'bg-red-100 text-red-800';
    if (formattedStatus === 'not exported') return 'bg-gray-100 text-gray-800';
    
    // Order statuses
    if (formattedStatus === 'pick') return 'bg-orange-100 text-orange-800';
    if (formattedStatus === 'dispatched') return 'bg-green-100 text-green-800';
    
    // Fallback for other cases
    return '';
  }
  
  // Helper function to format date in Sydney timezone
  function formatSydneyTime(date: Date | string): string {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('en-AU', {
      timeZone: 'Australia/Sydney',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }
  
  // Helper function to render order status with separate colors for comparison
  function renderOrderStatus(currentStatus: string, previousStatus?: string): { html: string, hasComparison: boolean } {
    const current = formatText(currentStatus);
    
    if (!previousStatus || currentStatus === previousStatus) {
      return {
        html: current,
        hasComparison: false
      };
    }
    
    const previous = formatText(previousStatus);
    return {
      html: `${previous} > ${current}`,
      hasComparison: true
    };
  }
</script>

<div class="container mx-auto px-4 py-8">
  <h1 class="text-2xl font-bold mb-8">Xero-Maropost History</h1>
  
  <!-- Filters Section -->
  <div class="bg-white rounded-lg shadow-md p-6 mb-8">
    <h2 class="text-lg font-semibold mb-2">Filters</h2>
    
    <div class="flex flex-wrap gap-6">
      <!-- Date Range Filter -->
      <div class="flex-1 min-w-[300px]">
        <h3 class="font-medium mb-3">Date Range (optional if IDs provided)</h3>
        <div class="flex gap-4">
          <div class="flex-1">
            <label for="fromDate" class="block text-sm font-medium text-gray-700 mb-1">
              From Date
            </label>
            <input
              id="fromDate"
              type="date"
              bind:value={fromDate}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div class="flex-1">
            <label for="toDate" class="block text-sm font-medium text-gray-700 mb-1">
              To Date
            </label>
            <input
              id="toDate"
              type="date"
              bind:value={toDate}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>
      
      <!-- ID Filter -->
      <div class="flex-1 min-w-[300px]">
        <h3 class="font-medium mb-3">Order/Invoice IDs (optional if dates provided)</h3>
        <textarea
          bind:value={idFilter}
          placeholder="Enter one Order/Invoice ID per line (optional)"
          rows="6"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
        ></textarea>
        <p class="text-xs text-gray-500 mt-1">
          Maximum 10 IDs supported. Enter one ID per line.
        </p>
      </div>
    </div>
    
    <div class="mt-6">
      <button
        on:click={fetchHistory}
        disabled={loading}
        class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Loading...' : 'Apply Filters'}
      </button>
    </div>
  </div>
  
  <!-- Error Message -->
  {#if error}
    <div class="bg-red-50 border border-red-200 rounded-md p-4 mb-6" transition:fade>
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <p class="text-sm text-red-800">{error}</p>
        </div>
      </div>
    </div>
  {/if}
  
  <!-- Info Message -->
  {#if message}
    <div class="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6" transition:fade>
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <p class="text-sm text-blue-800">{message}</p>
        </div>
      </div>
    </div>
  {/if}
  
  <!-- Results Table -->
  {#if history.length > 0}
    <div class="bg-white rounded-lg shadow-md overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 class="text-xl font-semibold">
          History Results ({history.length} records)
        </h2>
      </div>
      
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Order ID
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Maropost Total
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Xero Total
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Maropost Status
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Xero Status
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Matching Status
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Order Status
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Notes
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Updated
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                View Previous Record
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#each history as { current, previous }}
              <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {current.order_id}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 {isNaN(current.maropost_total) ? 'bg-gray-100' : ''}" class:text-blue-600={hasChanged(current.maropost_total, previous?.maropost_total)}>
                  {displayComparison(current.maropost_total, previous?.maropost_total, formatCurrency)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 {isNaN(current.xero_total) ? 'bg-gray-100' : ''}">
                  {displayComparison(current.xero_total, previous?.xero_total, formatCurrency, true)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                  <span class="px-2 py-1 rounded-full text-xs font-medium {getStatusColor(current.maropost_paid_status)}">
                    {displayComparison(formatText(current.maropost_paid_status), previous?.maropost_paid_status ? formatText(previous.maropost_paid_status) : null)}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                  <span class="px-2 py-1 rounded-full text-xs font-medium {getStatusColor(current.xero_paid_status)}">
                    {displayComparison(formatText(current.xero_paid_status), previous?.xero_paid_status ? formatText(previous.xero_paid_status) : null)}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                  <span class="px-2 py-1 rounded-full text-xs font-medium {getMatchingStatusColor(current.difference)}" class:ring-2={hasChanged(current.difference, previous?.difference)} class:ring-blue-300={hasChanged(current.difference, previous?.difference)}>
                    {displayComparison(formatText(current.difference), previous?.difference ? formatText(previous.difference) : null)}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                  {#if renderOrderStatus(current.order_status, previous?.order_status).hasComparison}
                    {@const parts = renderOrderStatus(current.order_status, previous?.order_status).html.split(' > ')}
                    <span class="px-2 py-1 rounded-full text-xs font-medium {getStatusColor(parts[0])}">
                      {parts[0]}
                    </span>
                    <span class="mx-1">></span>
                    <span class="px-2 py-1 rounded-full text-xs font-medium {getStatusColor(parts[1])}">
                      {parts[1]}
                    </span>
                  {:else}
                    <span class="px-2 py-1 rounded-full text-xs font-medium {getStatusColor(current.order_status)}">
                      {renderOrderStatus(current.order_status, previous?.order_status).html}
                    </span>
                  {/if}
                </td>
                <td class="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" class:text-blue-600={hasChanged(current.notes, previous?.notes)} title={displayComparison(current.notes, previous?.notes)}>
                  {displayComparison(current.notes, previous?.notes)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatSydneyTime(current.timestamp_utc)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                  {#if previous}
                    <button
                      on:click={() => showModal(current.order_id)}
                      class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      View Previous
                    </button>
                  {:else}
                    <span class="text-gray-400">N/A</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>

<!-- Modal for Previous Record -->
{#if modalOrderId && modalEntry}
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" transition:fade>
    <div class="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
      <div class="mt-3">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-medium text-gray-900">
            Previous Record Details - Order {modalOrderId}
          </h3>
          <button
            on:click={closeModal}
            class="text-gray-400 hover:text-gray-600 focus:outline-none"
          >
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">Order ID</label>
              <p class="mt-1 text-sm text-gray-900">{modalEntry.order_id}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Last Updated</label>
              <p class="mt-1 text-sm text-gray-900">{formatSydneyTime(modalEntry.timestamp_utc)}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Maropost Total</label>
              <p class="mt-1 text-sm text-gray-900">{formatCurrency(modalEntry.maropost_total)}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Xero Total</label>
              <p class="mt-1 text-sm text-gray-900">{formatCurrency(modalEntry.xero_total)}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Maropost Status</label>
              <p class="mt-1 px-2 py-1 rounded-full text-xs font-medium {getStatusColor(modalEntry.maropost_paid_status)}">
                {formatText(modalEntry.maropost_paid_status)}
              </p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Xero Status</label>
              <p class="mt-1 px-2 py-1 rounded-full text-xs font-medium {getStatusColor(modalEntry.xero_paid_status)}">
                {formatText(modalEntry.xero_paid_status)}
              </p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Matching Status</label>
              <span class="mt-1 px-2 py-1 rounded-full text-xs font-medium {getMatchingStatusColor(modalEntry.difference)}">
                {formatText(modalEntry.difference)}
              </span>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Order Status</label>
              <p class="mt-1 text-sm text-gray-900">
                {formatText(modalEntry.order_status)}
              </p>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Notes</label>
            <p class="mt-1 text-sm text-gray-900 break-words">{modalEntry.notes}</p>
          </div>
        </div>
        
        <div class="mt-6 flex justify-end">
          <button
            on:click={closeModal}
            class="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
{/if} 