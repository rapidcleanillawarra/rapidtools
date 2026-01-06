<script lang="ts">
	import { onMount } from 'svelte';

	interface OrderPayment {
		Amount: string;
		Id: string;
		DatePaid: string;
	}

	interface Order {
		ID: string;
		DatePaymentDue: string;
		BillLastName: string;
		BillStreetLine1: string;
		BillState: string;
		BillCountry: string;
		BillPostCode: string;
		OrderID: string;
		OrderPayment: OrderPayment[];
		DatePlaced: string;
		GrandTotal: string;
		Username: string;
		BillCity: string;
		BillCompany: string;
		BillFirstName: string;
		BillPhone?: string;
	}

	interface ProcessedOrder {
		customer: string;
		invoice: string;
		dateIssued: string;
		dueDate: string;
		pdCounter: number;
		payments: string;
		amount: string;
		[key: string]: string | number; // Index signature for dynamic access
	}

	let orders: ProcessedOrder[] = [];
	let loading = true;
	let error = '';
	let searchFilters: Record<string, string> = {};
	let sortField = 'pdCounter';
	let sortDirection: 'asc' | 'desc' = 'desc';

	// PD Counter Filter State
	let pdFilterOperator = '>';
	let pdFilterValue: number | null = 30;

	const columns = [
		{ key: 'customer', label: 'Customer' },
		{ key: 'invoice', label: 'Invoice' },
		{ key: 'dateIssued', label: 'Date Issued' },
		{ key: 'dueDate', label: 'Due Date' },
		{ key: 'pdCounter', label: 'PD-Counter' },
		{ key: 'payments', label: 'Payments' },
		{ key: 'amount', label: 'Amount' }
	];

	async function fetchOrders() {
		try {
			const response = await fetch(
				'https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=pPhk80gODQOi843ixLjZtPPWqTeXIbIt9ifWZP6CJfY',
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						Filter: {
							OrderStatus: ['Dispatched', 'Backorder Approved'],
							PaymentStatus: ['Pending', 'PartialPaid'],
							OutputSelector: [
								'ID',
								'Username',
								'DatePaymentDue',
								'OrderPayment',
								'GrandTotal',
								'DatePlaced',
								'BillAddress'
							]
						},
						action: 'GetOrder'
					})
				}
			);

			if (!response.ok) {
				throw new Error('Failed to fetch orders');
			}

			const data = await response.json();

			if (data && data.Order) {
				const now = new Date();
				orders = data.Order.reduce((acc: ProcessedOrder[], order: Order) => {
					// Calculate Amount (Outstanding) and Payments
					let outstandingAmount = parseFloat(order.GrandTotal);
					let totalPayments = 0;
					if (order.OrderPayment && order.OrderPayment.length > 0) {
						order.OrderPayment.forEach((payment) => {
							const paymentAmount = parseFloat(payment.Amount);
							outstandingAmount -= paymentAmount;
							totalPayments += paymentAmount;
						});
					}

					// Filter if outstanding amount is effectively 0
					if (outstandingAmount <= 0.01) {
						return acc;
					}

					// Calculate PD-Counter
					const dueDate = new Date(order.DatePaymentDue);
					const diffTime = now.getTime() - dueDate.getTime();
					const pdCounter = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

					// Format Date Issued and Due Date
					const dateIssued = new Date(order.DatePlaced).toLocaleDateString('en-AU');
					const formattedDueDate = dueDate.toLocaleDateString('en-AU');

					// Customer Name logic (Company if available, else First + Last Name)
					const customerName = order.BillCompany
						? order.BillCompany
						: `${order.BillFirstName} ${order.BillLastName}`;

					acc.push({
						customer: customerName,
						invoice: order.ID,
						dateIssued: dateIssued,
						dueDate: formattedDueDate,
						pdCounter: pdCounter,
						payments: totalPayments.toFixed(2),
						amount: outstandingAmount.toFixed(2)
					});
					return acc;
				}, []);
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'An unknown error occurred';
			console.error(e);
		} finally {
			loading = false;
		}
	}

	function handleSearchChange(key: string, value: string) {
		searchFilters = { ...searchFilters, [key]: value };
	}

	function handleSort(key: string) {
		if (sortField === key) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = key;
			sortDirection = 'asc'; // Default new sort to ascending
		}
	}

	function parseDate(dateStr: string): number {
		const parts = dateStr.split('/');
		if (parts.length === 3) {
			return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
		}
		return 0;
	}

	$: filteredOrders = orders
		.filter((order) => {
			// PD Counter Filter
			if (pdFilterValue !== null && pdFilterValue !== undefined && String(pdFilterValue) !== '') {
				const pd = order.pdCounter;
				const val = Number(pdFilterValue);
				if (pdFilterOperator === '>' && !(pd > val)) return false;
				if (pdFilterOperator === '<' && !(pd < val)) return false;
				if (pdFilterOperator === '=' && !(pd === val)) return false;
			}

			return Object.entries(searchFilters).every(([key, value]) => {
				if (!value) return true;
				const orderValue = String(order[key]).toLowerCase();
				return orderValue.includes(value.toLowerCase());
			});
		})
		.sort((a, b) => {
			let valA = a[sortField];
			let valB = b[sortField];

			// Handle different types
			if (sortField === 'pdCounter') {
				// Number
				return sortDirection === 'asc'
					? (valA as number) - (valB as number)
					: (valB as number) - (valA as number);
			} else if (sortField === 'payments' || sortField === 'amount') {
				// String numeric ('123.45')
				const numA = parseFloat(valA as string);
				const numB = parseFloat(valB as string);
				return sortDirection === 'asc' ? numA - numB : numB - numA;
			} else if (sortField === 'dateIssued' || sortField === 'dueDate') {
				// Date string 'dd/mm/yyyy'
				const timeA = parseDate(valA as string);
				const timeB = parseDate(valB as string);
				return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
			} else {
				// String
				const strA = String(valA).toLowerCase();
				const strB = String(valB).toLowerCase();
				return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
			}
		});

	$: {
		if (typeof window !== 'undefined') {
			localStorage.setItem('orders-pd-filter-operator', pdFilterOperator);
			if (pdFilterValue !== null) {
				localStorage.setItem('orders-pd-filter-value', String(pdFilterValue));
			} else {
				localStorage.removeItem('orders-pd-filter-value');
			}
		}
	}

	onMount(() => {
		if (typeof window !== 'undefined') {
			const storedOp = localStorage.getItem('orders-pd-filter-operator');
			const storedVal = localStorage.getItem('orders-pd-filter-value');
			if (storedOp) pdFilterOperator = storedOp;
			if (storedVal) pdFilterValue = Number(storedVal);
		}

		fetchOrders();
	});
</script>

<div class="px-4 sm:px-6 lg:px-8">
	<div class="justify-between sm:flex sm:items-center">
		<div class="sm:flex-auto">
			<h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Past Due Accounts</h1>
			<p class="mt-2 text-sm text-gray-700 dark:text-gray-400">A list of all past due accounts.</p>
		</div>
		<div class="mt-4 flex items-center gap-2 sm:ml-16 sm:mt-0 sm:flex-none">
			<label for="pd-filter" class="text-sm font-medium text-gray-700 dark:text-gray-300"
				>PD Counter Filter:</label
			>
			<select
				bind:value={pdFilterOperator}
				class="rounded-md border-gray-300 py-1.5 text-sm font-semibold leading-6 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600"
			>
				<option value=">">&gt;</option>
				<option value="<">&lt;</option>
				<option value="=">=</option>
			</select>
			<input
				id="pd-filter"
				type="number"
				placeholder="Days"
				class="block w-24 rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
				bind:value={pdFilterValue}
			/>
		</div>
	</div>
	<div class="mt-8 flex flex-col">
		<div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
			<div class="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
				<div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
					<table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
						<thead class="bg-gray-50 dark:bg-gray-800">
							<tr>
								{#each columns as column}
									<th
										scope="col"
										class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 {column.key ===
										'customer'
											? 'pl-4 pr-3 sm:pl-6'
											: ''}"
									>
										<div class="flex flex-col gap-2">
											<button
												type="button"
												class="group inline-flex cursor-pointer font-semibold"
												on:click={() => handleSort(column.key)}
											>
												{column.label}
												<span
													class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible"
													class:visible={sortField === column.key}
													class:invisible={sortField !== column.key}
												>
													{#if sortField === column.key && sortDirection === 'desc'}
														↓
													{:else}
														↑
													{/if}
												</span>
											</button>
											<input
												type="text"
												placeholder="Search..."
												class="w-full rounded border px-2 py-1 text-xs font-normal text-gray-900"
												value={searchFilters[column.key] || ''}
												on:input={(e) => handleSearchChange(column.key, e.currentTarget.value)}
											/>
										</div>
									</th>
								{/each}
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
							{#if loading}
								<tr>
									<td
										colspan={columns.length}
										class="py-4 pl-4 pr-3 text-center text-sm text-gray-500 sm:pl-6">Loading...</td
									>
								</tr>
							{:else if error}
								<tr>
									<td
										colspan={columns.length}
										class="py-4 pl-4 pr-3 text-center text-sm text-red-500 sm:pl-6">{error}</td
									>
								</tr>
							{:else if filteredOrders.length === 0}
								<tr>
									<td
										colspan={columns.length}
										class="py-4 pl-4 pr-3 text-center text-sm text-gray-500 sm:pl-6"
										>No past due orders found.</td
									>
								</tr>
							{:else}
								{#each filteredOrders as order}
									<tr>
										{#each columns as column}
											<td
												class="whitespace-nowrap px-3 py-4 text-sm {column.key === 'customer'
													? 'pl-4 pr-3 font-medium text-gray-900 dark:text-gray-100 sm:pl-6'
													: 'text-gray-500 dark:text-gray-400'}"
											>
												{#if column.key === 'amount' || column.key === 'payments'}
													${order[column.key]}
												{:else}
													{order[column.key]}
												{/if}
											</td>
										{/each}
									</tr>
								{/each}
							{/if}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</div>
</div>
