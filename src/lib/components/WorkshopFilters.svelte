<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Select from 'svelte-select';
  import CustomerDropdown from './CustomerDropdown.svelte';

  export let statusFilter: string = '';
  export let customerFilter: string = '';
  export let sortBy: string = 'created_at';
  export let sortOrder: 'asc' | 'desc' = 'desc';

  const dispatch = createEventDispatcher<{
    statusFilterChanged: { value: string };
    customerFilterChanged: { value: string };
    sortByChanged: { value: string };
    sortOrderChanged: { value: 'asc' | 'desc' };
    applyFilters: void;
  }>();

  // Status options for filter
  const statusOptions = [
    { label: 'All Statuses', value: '' },
    { label: 'New', value: 'new' },
    { label: 'To be Quoted', value: 'to_be_quoted' },
    { label: 'Docket Ready', value: 'docket_ready' },
    { label: 'Quoted/Repaired', value: 'quoted_repaired' },
    { label: 'WAITING APPROVAL PO', value: 'waiting_approval_po' },
    { label: 'Waiting for Parts', value: 'waiting_for_parts' },
    { label: 'BOOKED IN FOR REPAIR/ SERVICE', value: 'booked_in_for_repair_service' },
    { label: 'PENDING JOBS', value: 'pending_jobs' }
  ];

  // Sort options
  const sortOptions = [
    { label: 'Created Date', value: 'created_at' },
    { label: 'Customer Name', value: 'customer_name' },
    { label: 'Product Name', value: 'product_name' },
    { label: 'Status', value: 'status' },
    { label: 'Work Order', value: 'clients_work_order' }
  ];

  function handleStatusSelect(event: any) {
    statusFilter = event.detail.value;
    dispatch('statusFilterChanged', { value: statusFilter });
    dispatch('applyFilters');
  }

  function handleSortBySelect(event: any) {
    sortBy = event.detail.value;
    dispatch('sortByChanged', { value: sortBy });
    dispatch('applyFilters');
  }

  function handleSortOrderToggle() {
    sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    dispatch('sortOrderChanged', { value: sortOrder });
    dispatch('applyFilters');
  }

  function handleCustomerSelect(event: any) {
    customerFilter = event.detail ? event.detail.customer.BillingAddress.BillCompany || event.detail.customer.Name : '';
    dispatch('customerFilterChanged', { value: customerFilter });
    dispatch('applyFilters');
  }

  function handleCustomerClear() {
    customerFilter = '';
    dispatch('customerFilterChanged', { value: customerFilter });
    dispatch('applyFilters');
  }
</script>

<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
  <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
    <!-- Status Filter -->
    <div>
      <label for="status-filter" class="block text-sm font-medium text-gray-700 mb-1">Status</label>
      <Select
        items={statusOptions}
        value={statusOptions.find(opt => opt.value === statusFilter)}
        on:select={handleStatusSelect}
        placeholder="Filter by status"
      />
    </div>

    <!-- Customer Filter -->
    <div>
      <label for="customer-filter" class="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
      <CustomerDropdown
        value={customerFilter}
        placeholder="Search customers..."
        on:select={handleCustomerSelect}
        on:clear={handleCustomerClear}
      />
    </div>

    <!-- Sort By -->
    <div>
      <label for="sort-by-filter" class="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
      <Select
        items={sortOptions}
        value={sortOptions.find(opt => opt.value === sortBy)}
        on:select={handleSortBySelect}
        placeholder="Sort by..."
      />
    </div>

    <!-- Sort Order -->
    <div>
      <label for="sort-order-filter" class="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
      <button
        on:click={handleSortOrderToggle}
        class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 flex items-center justify-between"
      >
        <span>{sortOrder === 'asc' ? 'Ascending' : 'Descending'}</span>
        <svg class="w-4 h-4 text-gray-400 transform {sortOrder === 'desc' ? 'rotate-180' : ''}" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
        </svg>
      </button>
    </div>
  </div>
</div>
