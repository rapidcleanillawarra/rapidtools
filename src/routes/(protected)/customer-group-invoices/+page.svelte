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
		currentPage,
		itemsPerPage,
		sortField,
		sortDirection,
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

	// Modal visibility store
	const isModalOpen = writable(false);
	let modalInvoice: CustomerGroupInvoice | null = null;
	let defaultAmount = 0;
	let defaultPaymentDate = '';

	// Initialize invoices and customer groups only on mount
	onMount(async () => {
		if (data?.invoices && Array.isArray(data.invoices)) {
			$originalInvoices = [...data.invoices];
			$invoices = [...data.invoices];
			$filteredInvoices = [...data.invoices];
		}

		// Fetch customer groups and customers from Firestore
		try {
			await Promise.all([fetchCustomerGroups(), fetchCustomers()]);
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
			? $customerGroups.find((group) => group.value === $selectedCustomerGroup)?.label ||
				'All Groups'
			: 'All Groups';

		if ($dateFrom && $dateTo) {
			printData.dateFrom = new Date($dateFrom);
			printData.dateTo = new Date($dateTo);
		}
	}

	// Function to handle filter application
	async function handleApplyFilter() {
		try {
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
						: { Username: [$selectedCustomer] }),
					OutputSelector: ['Username', 'EmailAddress', 'UserGroup', 'BillingAddress']
				},
				action: 'GetCustomer'
			};

			console.log('Get Customer API Payload:', customerPayload);

			// First API call - Get Customer
			const customerResponse = await fetch(
				'https://prod-56.australiasoutheast.logic.azure.com:443/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=G8m_h5Dl8GpIRQtlN0oShby5zrigLKTWEddou-zGQIs',
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(customerPayload)
				}
			);

			const customer_group_customers = await customerResponse.json();
			console.log('Customer Group Customers:', customer_group_customers);

			// Check if we have any customers in the response
			if (!customer_group_customers.Customer || customer_group_customers.Customer.length === 0) {
				toastError(
					'No users found in the selected ' +
						($filterType === 'group' ? 'customer group' : 'customer')
				);
				filterLoading.set(false);
				currentLoadingStep.set('');
				return;
			}

			// Create a map of username to UserGroup for company lookup
			const customerGroupMap = new Map(
				customer_group_customers.Customer.map(
					(customer: { Username: string; BillingAddress: { BillCompany: string } }) => [
						customer.Username,
						customer.BillingAddress.BillCompany
					]
				)
			);

			// Extract usernames from the customer group response
			const usernames = customer_group_customers.Customer.map(
				(customer: { Username: string }) => customer.Username
			);
			console.log('Extracted Usernames:', usernames);

			// Update loading message for status condition
			currentLoadingStep.set('Applying status filter: Pending, PartialPaid, FullyPaid...');

			// Update loading message for second API call
			currentLoadingStep.set('Fetching orders data...');

			// Prepare payload for Get Orders API
			const ordersPayload = {
				Filter: {
					OrderStatus: ['Dispatched', 'Backorder Approved'],
					Username: usernames,
					PaymentStatus: ['Pending', 'PartialPaid', 'FullyPaid'],
					OutputSelector: [
						'ID',
						'Username',
						'UserGroup',
						'DatePaymentDue',
						'OrderPayment',
						'GrandTotal',
						'DatePlaced'
					]
				},
				action: 'GetOrder'
			};

			console.log('Get Orders API Payload:', ordersPayload);

			// Second API call - Get Orders
			const ordersResponse = await fetch(
				'https://prod-56.australiasoutheast.logic.azure.com:443/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=G8m_h5Dl8GpIRQtlN0oShby5zrigLKTWEddou-zGQIs',
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(ordersPayload)
				}
			);

			const orders_data = await ordersResponse.json();
			console.log('Get Orders API Response:', orders_data);

			// Update loading message for mapping process
			currentLoadingStep.set('Processing and mapping invoice data...');

			// Calculate payment status for each order and exclude zero invoices
			let zeroInvoiceCount = 0;
			const mappedInvoices = orders_data.Order.map((order: any) => {
				// Calculate total payments
				const totalPayments =
					order.OrderPayment?.reduce(
						(sum: number, payment: any) => sum + (parseFloat(payment.Amount) || 0),
						0
					) || 0;

				const grandTotal = parseFloat(order.GrandTotal) || 0;

				// Round both values to 2 decimal places to avoid floating-point precision issues
				const roundedTotalPayments = Math.round(totalPayments * 100) / 100;
				const roundedGrandTotal = Math.round(grandTotal * 100) / 100;
				const balance = roundedGrandTotal - roundedTotalPayments;

				// Check for zero invoice with no payments
				const hasNoPayments = !order.OrderPayment || order.OrderPayment.length === 0;
				const isZeroInvoice =
					roundedGrandTotal === 0 && roundedTotalPayments === 0 && hasNoPayments;

				// Skip zero invoices entirely
				if (isZeroInvoice) {
					zeroInvoiceCount++;
					console.log(
						`🚫 Excluding zero invoice: ${order.ID} (${order.Username}) - GrandTotal: ${order.GrandTotal}, Payments: ${order.OrderPayment?.length || 0}`
					);
					return null;
				}

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

				const mappedInvoice = {
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
					userGroupMismatch: false // Will be set during filtering
				};

				return mappedInvoice;
			})
				.filter((invoice: CustomerGroupInvoice | null) => invoice !== null) // Remove null entries (zero invoices)
				.filter((invoice: CustomerGroupInvoice) => {
					// Filter by username - show all invoices for users in the extracted usernames list
					if ($filterType === 'group' && usernames && usernames.length > 0) {
						const matchesUsername = usernames.includes(invoice.username);
						console.log('🔍 Username check:', invoice.invoiceNumber, {
							username: invoice.username,
							extractedUsernames: usernames,
							matchesUsername
						});
						if (!matchesUsername) {
							return false;
						}
						// Check if UserGroup matches the selected customer group for highlighting
						const userGroupMatches = invoice.customerGroupName === $selectedCustomerGroup;
						if (!userGroupMatches) {
							console.log('⚠️ UserGroup mismatch:', invoice.invoiceNumber, {
								invoiceUserGroup: invoice.customerGroupName,
								selectedGroup: $selectedCustomerGroup
							});
							invoice.userGroupMismatch = true;
						} else {
							invoice.userGroupMismatch = false;
						}
					}

					// For customer filter type, use the existing customer logic
					if ($filterType === 'customer' && $selectedCustomer) {
						if (invoice.username !== $selectedCustomer) {
							return false;
						}
					}

					// Apply status filter
					if ($selectedStatus && $selectedStatus.length > 0) {
						const matchesStatus = $selectedStatus.some((selected) => {
							const statusValue = selected.value;
							// Map the status values to match the invoice status format
							const statusMap: { [key: string]: string } = {
								Unpaid: 'Unpaid',
								PartiallyPaid: 'Partially Paid',
								FullyPaid: 'Fully Paid'
							};
							const mappedStatus = statusMap[statusValue];
							return invoice.status === mappedStatus;
						});
						if (!matchesStatus) {
							return false;
						}
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

			// Log summary of excluded zero invoices
			if (zeroInvoiceCount > 0) {
				console.log(`📊 Excluded ${zeroInvoiceCount} zero-dollar invoices from results`);
			}

			// Update all necessary stores
			$invoices = mappedInvoices;
			$originalInvoices = mappedInvoices;
			$filteredInvoices = mappedInvoices;
			$currentPage = 1; // Reset to first page

			console.log('✅ Final results:', {
				totalInvoices: mappedInvoices.length,
				invoiceNumbers: mappedInvoices.map((inv: CustomerGroupInvoice) => inv.invoiceNumber),
				selectedGroup: $selectedCustomerGroup,
				extractedUsernames: usernames
			});

			// Calculate pagination
			paginatedInvoices = getPaginatedInvoices($invoices, $currentPage, $itemsPerPage);
			totalPages = getTotalPages($invoices.length, $itemsPerPage);

			toastSuccess('Filters applied successfully');
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
	function handleStatusChange(event: CustomEvent) {
		const detail = event.detail;
		selectedStatus.set(detail || []);
		validateFilters();
	}

	// Add search function
	function handleSearch(event: Event, field: string) {
		const input = event.target as HTMLInputElement;
		searchFilters.update((filters) => ({
			...filters,
			[field]: input.value.toLowerCase()
		}));

		// Apply search filters
		$invoices = $originalInvoices.filter((invoice) => {
			return Object.entries($searchFilters).every(([key, value]) => {
				if (!value) return true; // Skip empty search fields

				const invoiceValue = String(invoice[key as keyof CustomerGroupInvoice]).toLowerCase();
				return invoiceValue.includes(value);
			});
		});

		// Reset to first page when searching
		currentPage.set(1);
	}

	// Function to open modal with invoice data
	function openModal(invoice: CustomerGroupInvoice) {
		modalInvoice = invoice;
		isModalOpen.set(true);

		// Set default values
		const sydneyTime = DateTime.now().setZone('Australia/Sydney');
		defaultPaymentDate = sydneyTime.toFormat("yyyy-MM-dd'T'HH:mm");
		defaultAmount = invoice.balance;
	}

	// Function to handle Get Order Lines
	async function handleGetOrderLines() {
		try {
			// Collect all order IDs from all pages (use originalInvoices to get all data)
			const orderIds = $originalInvoices.map((invoice) => invoice.invoiceNumber);

			if (orderIds.length === 0) {
				toastError('No orders found to retrieve line items');
				return;
			}

			console.log('Collecting order lines for orders:', orderIds);

			// Show loading state
			filterLoading.set(true);
			currentLoadingStep.set('Retrieving order line items...');

			// Prepare payload for Get Order Lines API
			const orderLinesPayload = {
				Filter: {
					OrderID: orderIds,
					OutputSelector: ['OrderLine', 'OrderLine.UnitPrice']
				},
				action: 'GetOrder'
			};

			console.log('Get Order Lines API Payload:', orderLinesPayload);

			// Make API call to get order lines
			const response = await fetch(
				'https://prod-56.australiasoutheast.logic.azure.com:443/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=G8m_h5Dl8GpIRQtlN0oShby5zrigLKTWEddou-zGQIs',
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(orderLinesPayload)
				}
			);

			const orderLinesData = await response.json();
			console.log('Get Order Lines API Response:', orderLinesData);

			if (!orderLinesData.Order || orderLinesData.Order.length === 0) {
				toastError('No order line data found');
				return;
			}

			// Process the data and generate CSV
			const csvData = await generateOrderLinesCSV(orderLinesData.Order);

			// Download the CSV file
			downloadCSV(csvData, 'order_lines.csv');

			toastSuccess(`Successfully exported ${csvData.length - 1} order line items to CSV`);
		} catch (error) {
			console.error('Error retrieving order lines:', error);
			toastError('Failed to retrieve order line items');
		} finally {
			filterLoading.set(false);
			currentLoadingStep.set('');
		}
	}

	// Function to generate CSV data from order lines including List Price (RRP)
	async function generateOrderLinesCSV(orders: any[]): Promise<string[][]> {
		const header = ['SKU', 'Discounted Price', 'List Price'];
		const rows: string[][] = [];

		// Collect all SKUs and their prices to find maximums (discounted price)
		const skuPrices: { [sku: string]: number[] } = {};

		// Process each order and its line items
		orders.forEach((order) => {
			if (order.OrderLine && Array.isArray(order.OrderLine)) {
				order.OrderLine.forEach((line: any) => {
					const sku = line.SKU || '';
					const unitPrice = parseFloat(line.UnitPrice) || 0;

					if (sku && unitPrice > 0) {
						if (!skuPrices[sku]) {
							skuPrices[sku] = [];
						}
						skuPrices[sku].push(unitPrice);
					}
				});
			}
		});

		const skus = Object.keys(skuPrices);

		// Fetch RRP (List Price) for filtered SKUs
		const rrpMap = await fetchRrpMapForSkus(skus);

		// Build rows combining discounted price (min unit price) and list price (RRP)
		// Skip SKUs where discounted price is equal to or higher than list price
		skus.forEach((sku) => {
			const lowestPrice = Math.min(...skuPrices[sku]);
			const listPrice = rrpMap.get(sku);

			if (listPrice != null && !isNaN(listPrice) && lowestPrice >= listPrice) {
				return; // Remove SKUs that are not actually discounted
			}

			rows.push([
				sku,
				lowestPrice.toFixed(2),
				listPrice != null && !isNaN(listPrice) ? listPrice.toFixed(2) : ''
			]);
		});

		// Sort by SKU for consistent output (do not sort header)
		rows.sort((a, b) => a[0].localeCompare(b[0]));

		return [header, ...rows];
	}

	// Helper: fetch RRP values for a set of SKUs in batches; returns Map<SKU, RRP>
	async function fetchRrpMapForSkus(skus: string[]): Promise<Map<string, number>> {
		const result = new Map<string, number>();
		if (!skus || skus.length === 0) return result;

		// Deduplicate and chunk to avoid payload limits
		const uniqueSkus = Array.from(
			new Set(skus.map((s) => (s || '').toString().trim()).filter(Boolean))
		);
		const chunkSize = 80;
		for (let i = 0; i < uniqueSkus.length; i += chunkSize) {
			const chunk = uniqueSkus.slice(i, i + chunkSize);
			const payload = {
				Filter: {
					SKU: chunk,
					OutputSelector: ['RRP']
				},
				action: 'GetItem'
			};

			try {
				const resp = await fetch(
					'https://prod-56.australiasoutheast.logic.azure.com:443/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=G8m_h5Dl8GpIRQtlN0oShby5zrigLKTWEddou-zGQIs',
					{
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(payload)
					}
				);
				const data = await resp.json();
				if (data.Item && Array.isArray(data.Item)) {
					for (const item of data.Item) {
						const sku: string = (item.SKU || '').toString().trim();
						const rrpRaw = parseFloat(item.RRP);
						if (sku && !isNaN(rrpRaw)) {
							result.set(sku, rrpRaw);
						}
					}
				}
			} catch (err) {
				console.error('RRP fetch failed for chunk', chunk, err);
			}
		}

		return result;
	}

	// Function to download CSV file
	function downloadCSV(data: string[][], filename: string) {
		const csvContent = data
			.map((row) =>
				row
					.map((field) => {
						// Escape fields containing commas, quotes, or newlines
						if (field.includes(',') || field.includes('"') || field.includes('\n')) {
							return '"' + field.replace(/"/g, '""') + '"';
						}
						return field;
					})
					.join(',')
			)
			.join('\n');

		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');

		if (link.download !== undefined) {
			const url = URL.createObjectURL(blob);
			link.setAttribute('href', url);
			link.setAttribute('download', filename);
			link.style.visibility = 'hidden';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		}
	}

	// Function to close modal
	function closeModal() {
		isModalOpen.set(false);
		modalInvoice = null;
	}
</script>

<div class="min-h-screen bg-gray-100 px-2 py-8 sm:px-3">
	<div class="mx-auto max-w-[98%] bg-white p-6 shadow" transition:fade>
		<h2 class="mb-6 text-2xl font-bold text-gray-900">Customer Group Invoices</h2>

		<!-- Legend for row highlighting -->
		{#if $filterType === 'group' && $selectedCustomerGroup}
			<div class="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3">
				<h3 class="mb-2 text-sm font-medium text-blue-800">Filtering & Color Legend:</h3>
				<div class="space-y-1 text-xs text-blue-700">
					<div class="flex items-center">
						<div class="mr-2 h-4 w-4 rounded border border-green-400 bg-green-100"></div>
						<span
							>Showing all invoices for users who belong to the selected customer group (filtered by
							username)</span
						>
					</div>
					<div class="flex items-center">
						<div class="mr-2 h-4 w-4 rounded border border-orange-400 bg-orange-100"></div>
						<span
							>Orange rows: Invoices where the UserGroup doesn't match the selected filter (user
							moved between groups)</span
						>
					</div>
					<div class="flex items-center">
						<div class="mr-2 h-4 w-4 rounded border border-gray-300 bg-white"></div>
						<span>White rows: Invoices where the UserGroup matches the selected filter</span>
					</div>
				</div>
			</div>
		{/if}

		<!-- Filter Section -->
		<div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
			<div>
				<div class="mb-2 flex items-center justify-between">
					<label class="block text-sm font-medium text-gray-700">Filter Type</label>
					<div class="flex items-center space-x-2">
						<button
							class={`rounded-md px-3 py-1 text-sm ${$filterType === 'group' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
							on:click={() => filterType.set('group')}
						>
							Group
						</button>
						<button
							class={`rounded-md px-3 py-1 text-sm ${$filterType === 'customer' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
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

			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Date From</label>
				<input
					type="date"
					class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
					on:change={(e) => handleDateChange(e, dateFrom.set)}
				/>
			</div>

			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Date To</label>
				<input
					type="date"
					class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
					on:change={(e) => handleDateChange(e, dateTo.set)}
				/>
			</div>

			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700">Status</label>
				<Select
					items={statusOptions}
					placeholder="Select status"
					clearable={true}
					multiple={true}
					value={$selectedStatus}
					on:change={() => {
						selectedStatus.set([]);
						validateFilters();
					}}
					on:change={handleStatusChange}
				/>
				{#if $statusError}
					<p class="mt-1 text-sm text-red-600">{$statusError}</p>
				{/if}
			</div>
		</div>

		<!-- Date Error Message -->
		{#if $dateError}
			<div class="mb-4 rounded-md border border-red-200 bg-red-50 p-3">
				<p class="text-sm text-red-600">{$dateError}</p>
			</div>
		{/if}

		<!-- Apply Filter Button -->
		<div class="mb-6 flex justify-end gap-4">
			<button
				class="flex min-w-[160px] items-center justify-center rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600"
				on:click={() => {
					// Clear all filters
					selectedCustomerGroup.set(null);
					selectedCustomer.set(null);
					dateFrom.set(null);
					dateTo.set(null);
					selectedStatus.set([
						{ value: 'Unpaid', label: 'Unpaid' },
						{ value: 'PartiallyPaid', label: 'Partial Paid' },
						{ value: 'FullyPaid', label: 'Fully Paid' }
					]);
					searchFilters.set({
						invoiceNumber: '',
						dateIssued: '',
						dueDate: '',
						totalAmount: '',
						amountPaid: '',
						balance: '',
						username: '',
						company: '',
						status: ''
					});
				}}
			>
				Clear All Filters
			</button>
			{#if $invoices && $invoices.length > 0}
				<button
					class="flex min-w-[160px] items-center justify-center rounded bg-purple-600 px-4 py-2 text-white hover:bg-purple-700"
					on:click={handleGetOrderLines}
				>
					Get Order Lines
				</button>
			{/if}
			{#if $invoices && $invoices.length > 0}
				<button
					class="flex min-w-[160px] items-center justify-center rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
					on:click={() => handlePrint($invoices, printData)}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="mr-2 h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
						/>
					</svg>
					Print Table
				</button>
			{/if}
			<button
				class="flex min-w-[160px] items-center justify-center rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
				on:click={handleApplyFilter}
				disabled={$filterLoading || !!$dateError || !!$customerGroupError || !!$statusError}
			>
				{#if $filterLoading}
					<div
						class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
					></div>
					Applying...
				{:else}
					Apply Filter
				{/if}
			</button>
		</div>

		<!-- Add this before the Invoices Table section -->
		{#if $filterLoading}
			<div class="fixed inset-0 z-50 flex items-center justify-center bg-gray-500 bg-opacity-75">
				<div class="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
					<div class="mb-4 flex items-center justify-center">
						<div
							class="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
						></div>
					</div>
					<p class="text-center font-medium text-gray-700">{$currentLoadingStep}</p>
					<p class="mt-2 text-center text-sm text-gray-500">This may take a few moments</p>
				</div>
			</div>
		{/if}

		<!-- Invoices Table -->
		<div class="overflow-x-auto">
			{#if $loading}
				<div class="flex items-center justify-center py-8">
					<div
						class="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
					></div>
				</div>
			{:else}
				<table class="min-w-full table-fixed divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th
								class="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
							>
								<div class="flex flex-col">
									<div
										class="flex cursor-pointer items-center hover:bg-gray-100"
										on:click={() => handleSortClick('invoiceNumber')}
									>
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
							<th
								class="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
							>
								<div class="flex flex-col">
									<div
										class="flex cursor-pointer items-center hover:bg-gray-100"
										on:click={() => handleSortClick('dateIssued')}
									>
										Date Issued {getSortIcon('dateIssued', $sortField, $sortDirection)}
									</div>
									<input
										type="text"
										class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
										placeholder="Search..."
										on:input={(e) => handleSearch(e, 'dateIssued')}
									/>
								</div>
							</th>
							<th
								class="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
							>
								<div class="flex flex-col">
									<div
										class="flex cursor-pointer items-center hover:bg-gray-100"
										on:click={() => handleSortClick('dueDate')}
									>
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
							<th
								class="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
							>
								<div class="flex flex-col">
									<div
										class="flex cursor-pointer items-center hover:bg-gray-100"
										on:click={() => handleSortClick('totalAmount')}
									>
										Total Invoice {getSortIcon('totalAmount', $sortField, $sortDirection)}
									</div>
									<input
										type="text"
										class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
										placeholder="Search..."
										on:input={(e) => handleSearch(e, 'totalAmount')}
									/>
								</div>
							</th>
							<th
								class="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
							>
								<div class="flex flex-col">
									<div
										class="flex cursor-pointer items-center hover:bg-gray-100"
										on:click={() => handleSortClick('amountPaid')}
									>
										Payments {getSortIcon('amountPaid', $sortField, $sortDirection)}
									</div>
									<input
										type="text"
										class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
										placeholder="Search..."
										on:input={(e) => handleSearch(e, 'amountPaid')}
									/>
								</div>
							</th>
							<th
								class="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
							>
								<div class="flex flex-col">
									<div
										class="flex cursor-pointer items-center hover:bg-gray-100"
										on:click={() => handleSortClick('balance')}
									>
										Balance AUD {getSortIcon('balance', $sortField, $sortDirection)}
									</div>
									<input
										type="text"
										class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
										placeholder="Search..."
										on:input={(e) => handleSearch(e, 'balance')}
									/>
								</div>
							</th>
							<th
								class="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
							>
								<div class="flex flex-col">
									<div
										class="flex cursor-pointer items-center hover:bg-gray-100"
										on:click={() => handleSortClick('username')}
									>
										Username {getSortIcon('username', $sortField, $sortDirection)}
									</div>
									<input
										type="text"
										class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
										placeholder="Search..."
										on:input={(e) => handleSearch(e, 'username')}
									/>
								</div>
							</th>
							<th
								class="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
							>
								<div class="flex flex-col">
									<div
										class="flex cursor-pointer items-center hover:bg-gray-100"
										on:click={() => handleSortClick('company')}
									>
										Company {getSortIcon('company', $sortField, $sortDirection)}
									</div>
									<input
										type="text"
										class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
										placeholder="Search..."
										on:input={(e) => handleSearch(e, 'company')}
									/>
								</div>
							</th>
							<th
								class="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
							>
								<div class="flex flex-col">
									<div
										class="flex cursor-pointer items-center hover:bg-gray-100"
										on:click={() => handleSortClick('status')}
									>
										Status {getSortIcon('status', $sortField, $sortDirection)}
									</div>
									<input
										type="text"
										class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
										placeholder="Search..."
										on:input={(e) => handleSearch(e, 'status')}
									/>
								</div>
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-200 bg-white">
						{#if !$invoices || $invoices.length === 0}
							<tr>
								<td colspan="9" class="px-2 py-4 text-center text-gray-500"> No results found </td>
							</tr>
						{:else}
							{#each paginatedInvoices as invoice (invoice.invoiceNumber)}
								<tr
									class={`${invoice.updated ? 'bg-green-50' : ''} ${invoice.userGroupMismatch ? 'border-l-4 border-orange-400 bg-orange-100' : ''}`}
								>
									<td class="px-2 py-1 text-sm">
										{invoice.invoiceNumber}
										{#if invoice.userGroupMismatch}
											<span
												class="ml-1 text-xs font-medium text-orange-600"
												title="UserGroup mismatch - this invoice was placed when user was in a different group"
												>⚠️</span
											>
										{/if}
									</td>
									<td class="px-2 py-1 text-sm">
										{new Date(invoice.dateIssued).toLocaleDateString('en-US', {
											year: 'numeric',
											month: 'long',
											day: 'numeric'
										})}
									</td>
									<td class="px-2 py-1 text-sm">
										{new Date(invoice.dueDate).toLocaleDateString('en-US', {
											year: 'numeric',
											month: 'long',
											day: 'numeric'
										})}
									</td>
									<td class="px-2 py-1 text-sm">
										{new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(
											invoice.totalAmount
										)}
									</td>
									<td class="px-2 py-1 text-sm">
										{new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(
											invoice.amountPaid
										)}
									</td>
									<td class="px-2 py-1 text-sm">
										{new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(
											invoice.balance
										)}
									</td>
									<td class="px-2 py-1 text-sm">{invoice.username}</td>
									<td class="px-2 py-1 text-sm">{invoice.company}</td>
									<td class="px-2 py-1 text-sm">
										<span
											class={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${invoice.statusColor}`}
										>
											{invoice.status}
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
		<div
			class="mt-4 flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6"
		>
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
							class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
							on:click={() => handlePageChange($currentPage - 1)}
							disabled={$currentPage === 1}
						>
							<span class="sr-only">Previous</span>
							<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
								<path
									fill-rule="evenodd"
									d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
									clip-rule="evenodd"
								/>
							</svg>
						</button>

						<button
							class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
							on:click={() => handlePageChange($currentPage + 1)}
							disabled={$currentPage === totalPages}
						>
							<span class="sr-only">Next</span>
							<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
								<path
									fill-rule="evenodd"
									d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
									clip-rule="evenodd"
								/>
							</svg>
						</button>
					</nav>
				</div>
			</div>
		</div>
	</div>
</div>

{#if $isModalOpen && modalInvoice}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-gray-500 bg-opacity-75">
		<div class="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
			<h3 class="mb-4 text-lg font-medium text-gray-900">Apply Payment</h3>
			<div class="space-y-2">
				<div class="flex justify-between">
					<span class="font-semibold text-gray-700">Order ID:</span>
					<span class="text-gray-900">{modalInvoice.invoiceNumber}</span>
				</div>
				<div class="flex justify-between">
					<span class="font-semibold text-gray-700">Total Invoice:</span>
					<span class="text-gray-900"
						>{new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(
							modalInvoice.totalAmount
						)}</span
					>
				</div>
				<div class="flex justify-between">
					<span class="font-semibold text-gray-700">Balance:</span>
					<span class="text-gray-900"
						>{new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(
							modalInvoice.balance
						)}</span
					>
				</div>
				<div class="flex justify-between">
					<span class="font-semibold text-gray-700">Username:</span>
					<span class="text-gray-900">{modalInvoice.username}</span>
				</div>
				<div class="flex justify-between">
					<span class="font-semibold text-gray-700">Company:</span>
					<span class="text-gray-900">{modalInvoice.company}</span>
				</div>
			</div>
			<div class="mt-4 space-y-4">
				<div>
					<label class="block text-sm font-medium text-gray-700">Payment Mode</label>
					<select
						class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
					>
						<option value="POS Card">POS Card</option>
					</select>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700">Amount</label>
					<input
						id="amount"
						type="number"
						step="0.01"
						bind:value={defaultAmount}
						class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700">Payment Date</label>
					<input
						id="payment-date"
						type="datetime-local"
						bind:value={defaultPaymentDate}
						class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700">Payment Notes</label>
					<textarea
						class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
						rows="3"
					></textarea>
				</div>
			</div>
			<button
				class="mt-6 w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
				on:click={closeModal}>Close</button
			>
		</div>
	</div>
{/if}

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

		th,
		td {
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
