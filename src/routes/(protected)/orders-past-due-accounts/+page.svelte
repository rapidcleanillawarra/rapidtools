<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { currentUser } from '$lib/firebase';
	import { userProfile, type UserProfile } from '$lib/userProfile';
	import {
		columns,
		defaultColumnVisibility,
		parseDate,
		getPdCounterBgColor,
		getPdCounterColor,
		type ColumnKey,
		type Note,
		type Order,
		type ProcessedOrder
	} from './pastDueAccounts';
	import PastDueLegend from './components/PastDueLegend.svelte';
	import PastDueToolbar from './components/PastDueToolbar.svelte';
	import ColumnVisibilityPills from './components/ColumnVisibilityPills.svelte';

	let orders: ProcessedOrder[] = [];
	let loading = true;
	let error = '';
	let searchFilters: Partial<Record<ColumnKey, string>> = {};
	let sortField: ColumnKey = 'pdCounter';
	let sortDirection: 'asc' | 'desc' = 'desc';

	// Column visibility state
	let columnVisibility: Record<ColumnKey, boolean> = { ...defaultColumnVisibility };
	let visibleColumns = columns.filter((column) => columnVisibility[column.key]);
	let filteredOrders: ProcessedOrder[] = [];

	// PD Counter Filter State
	let pdFilterOperator = '>';
	let pdFilterValue: number | null = 30;
	let initialized = false;

	// Temporary PD Counter Filter State (for inputs)
	let tempPdFilterOperator = pdFilterOperator;
	let tempPdFilterValue: number | null = pdFilterValue;

	// Notes Modal State
	let showNotesModal = false;
	let selectedOrder: ProcessedOrder | null = null;
	let newNote = '';
	let notesLoading = false;

	// User information
	let user: import('firebase/auth').User | null = null;
	let profile: UserProfile | null = null;

	// Subscribe to user stores
	const unsubCurrentUser = currentUser.subscribe((value) => {
		user = value;
	});

	const unsubUserProfile = userProfile.subscribe((value) => {
		profile = value;
	});

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
								'BillAddress',
								'Email'
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
						contacts: order.BillPhone || '',
						email: order.Email || '',
						invoice: order.ID,
						dateIssued: dateIssued,
						dueDate: formattedDueDate,
						pdCounter: pdCounter,
						payments: totalPayments.toFixed(2),
						amount: outstandingAmount.toFixed(2),
						notes: []
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

	function handleSearchChange(key: ColumnKey, value: string) {
		searchFilters = { ...searchFilters, [key]: value };
	}

	function handleSort(key: ColumnKey) {
		if (sortField === key) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = key;
			sortDirection = 'asc'; // Default new sort to ascending
		}
	}

	function applyPdFilter() {
		pdFilterOperator = tempPdFilterOperator;
		pdFilterValue = tempPdFilterValue;
	}

	function toggleColumnVisibility(key: ColumnKey) {
		columnVisibility = { ...columnVisibility, [key]: !columnVisibility[key] };
	}

	function getCurrentUserName(): string {
		if (profile && profile.firstName && profile.lastName) {
			return `${profile.firstName} ${profile.lastName}`;
		}
		if (user?.email) {
			return user.email.split('@')[0] || 'Unknown User';
		}
		return 'Unknown User';
	}

	async function openNotesModal(order: ProcessedOrder) {
		selectedOrder = order;
		newNote = '';
		showNotesModal = true;

		// Fetch existing notes from Supabase
		await fetchNotes(order.invoice);
	}

	async function fetchNotes(invoiceId: string) {
		try {
			notesLoading = true;
			const { data, error: supabaseError } = await supabase
				.from('orders_past_due_accounts_notes')
				.select('notes')
				.eq('invoice_id', invoiceId)
				.single();

			if (supabaseError && supabaseError.code !== 'PGRST116') { // PGRST116 is "not found"
				console.error('Error fetching notes:', supabaseError);
			} else if (selectedOrder) {
				selectedOrder.notes = data?.notes || [];
			}
		} catch (error) {
			console.error('Error fetching notes:', error);
		} finally {
			notesLoading = false;
		}
	}

	async function saveNote() {
		if (!selectedOrder || !newNote.trim()) return;

		try {
			notesLoading = true;

			// First, try to get existing notes
			const { data: existingData, error: fetchError } = await supabase
				.from('orders_past_due_accounts_notes')
				.select('notes')
				.eq('invoice_id', selectedOrder.invoice)
				.single();

			let notes = [];
			if (existingData && existingData.notes) {
				notes = existingData.notes;
			}

			// Add the new note
			notes.push({
				note: newNote.trim(),
				timestamp: new Date().toISOString(),
				user: getCurrentUserName()
			});

			// Upsert the record
			const { error: upsertError } = await supabase
				.from('orders_past_due_accounts_notes')
				.upsert({
					invoice_id: selectedOrder.invoice,
					notes,
					updated_at: new Date().toISOString()
				}, {
					onConflict: 'invoice_id'
				});

			if (upsertError) {
				console.error('Error saving note:', upsertError);
			} else {
				// Refresh notes
				await fetchNotes(selectedOrder.invoice);
				newNote = '';
			}
		} catch (error) {
			console.error('Error saving note:', error);
		} finally {
			notesLoading = false;
		}
	}

	function closeNotesModal() {
		showNotesModal = false;
		selectedOrder = null;
		newNote = '';
	}

	function exportToCSV() {
		const csvColumns = visibleColumns.filter(col => col.key !== 'notes'); // Use visible columns, exclude notes
		const headers = csvColumns.map(col => col.label).join(',');

		const rows = filteredOrders.map(order =>
			csvColumns.map(col => {
				let value = order[col.key];
				// Format currency values
				if (col.key === 'amount' || col.key === 'payments') {
					value = `$${value}`;
				}
				// Escape commas and quotes in values
				if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
					value = `"${value.replace(/"/g, '""')}"`;
				}
				return value;
			}).join(',')
		);

		const csvContent = [headers, ...rows].join('\n');
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');

		if (link.download !== undefined) {
			const url = URL.createObjectURL(blob);
			link.setAttribute('href', url);
			link.setAttribute('download', `past-due-accounts-${new Date().toISOString().split('T')[0]}.csv`);
			link.style.visibility = 'hidden';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		}
	}

	function printTable() {
		const printWindow = window.open('', '_blank');
		if (!printWindow) return;

		const csvColumns = visibleColumns.filter(col => col.key !== 'notes'); // Use visible columns, exclude notes

		const htmlContent = `
			<!DOCTYPE html>
			<html>
				<head>
					<title>Past Due Accounts Report</title>
					<style>
						body { font-family: Arial, sans-serif; margin: 20px; }
						h1 { color: #333; text-align: center; margin-bottom: 10px; }
						.legend { display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 20px; font-size: 12px; }
						.legend-item { display: flex; align-items: center; gap: 5px; }
						.legend-color { width: 12px; height: 12px; border-radius: 2px; border: 1px solid #ccc; }
						table { width: 100%; border-collapse: collapse; margin-top: 20px; }
						th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
						th { background-color: #f5f5f5; font-weight: bold; }
						tr:nth-child(even) { background-color: #f9f9f9; }
						.amount { text-align: right; }
						.pd-counter { font-weight: bold; }
						@media print { body { margin: 0; } }
					</style>
				</head>
				<body>
					<h1>Past Due Accounts Report</h1>
					<p>Generated on: ${new Date().toLocaleDateString('en-AU')} ${new Date().toLocaleTimeString('en-AU')}</p>
					<p>Total Records: ${filteredOrders.length}</p>

					<div class="legend">
						<div class="legend-item">
							<div class="legend-color" style="background-color: #dbeafe;"></div>
							<span><strong>15-25 days:</strong> Friendly Reminder</span>
						</div>
						<div class="legend-item">
							<div class="legend-color" style="background-color: #fef3c7;"></div>
							<span><strong>26-40 days:</strong> 2nd follow & Warning for Hold</span>
						</div>
						<div class="legend-item">
							<div class="legend-color" style="background-color: #fed7aa;"></div>
							<span><strong>41-59 days:</strong> Urgent payment required</span>
						</div>
						<div class="legend-item">
							<div class="legend-color" style="background-color: #fecaca;"></div>
							<span><strong>60+ days:</strong> Matigas pa sa bato! walang hiya!</span>
						</div>
					</div>

					<table>
						<thead>
							<tr>
								${csvColumns.map(col => `<th>${col.label}</th>`).join('')}
							</tr>
						</thead>
						<tbody>
							${filteredOrders.map(order => `
								<tr>
									${csvColumns.map(col => {
										let value = order[col.key];
										let className = '';

										if (col.key === 'amount' || col.key === 'payments') {
											value = '$' + value;
											className = 'amount';
										} else if (col.key === 'pdCounter') {
											className = 'pd-counter';
										}

										return '<td class="' + className + '">' + value + '</td>';
									}).join('')}
								</tr>
							`).join('')}
						</tbody>
					</table>
				</body>
			</html>
		`;

		printWindow.document.write(htmlContent);
		printWindow.document.close();
		printWindow.print();
	}

	$: visibleColumns = columns.filter(column => columnVisibility[column.key]);

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
		if (typeof window !== 'undefined' && initialized) {
			localStorage.setItem('orders-pd-filter-operator', pdFilterOperator);
			if (pdFilterValue !== null) {
				localStorage.setItem('orders-pd-filter-value', String(pdFilterValue));
			} else {
				localStorage.removeItem('orders-pd-filter-value');
			}
			localStorage.setItem('orders-column-visibility', JSON.stringify(columnVisibility));
		}
	}

	onMount(() => {
		if (typeof window !== 'undefined') {
			const storedOp = localStorage.getItem('orders-pd-filter-operator');
			const storedVal = localStorage.getItem('orders-pd-filter-value');
			const storedVisibility = localStorage.getItem('orders-column-visibility');

			// Set defaults if no localStorage data exists
			if (!storedOp && !storedVal) {
				pdFilterOperator = '>';
				pdFilterValue = 30;
				tempPdFilterOperator = pdFilterOperator;
				tempPdFilterValue = pdFilterValue;
				// Save defaults to localStorage
				localStorage.setItem('orders-pd-filter-operator', pdFilterOperator);
				localStorage.setItem('orders-pd-filter-value', String(pdFilterValue));
			} else {
				// Load existing preferences
				if (storedOp) pdFilterOperator = storedOp;
				if (storedVal) pdFilterValue = Number(storedVal);
				// Initialize temp values with loaded values
				tempPdFilterOperator = pdFilterOperator;
				tempPdFilterValue = pdFilterValue;
			}

			// Load column visibility preferences
			if (storedVisibility) {
				try {
					columnVisibility = { ...columnVisibility, ...JSON.parse(storedVisibility) };
				} catch (e) {
					console.error('Error parsing column visibility preferences:', e);
				}
			}
		}

		fetchOrders();
		initialized = true;

		return () => {
			unsubCurrentUser();
			unsubUserProfile();
		};
	});
</script>

<div class="px-4 sm:px-6 lg:px-8">
	<div class="justify-between sm:flex sm:items-center">
		<div class="sm:flex-auto">
			<h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Past Due Accounts</h1>
			<p class="mt-2 text-sm text-gray-700 dark:text-gray-400">A list of all past due accounts.</p>

			<PastDueLegend />
		</div>
		<PastDueToolbar
			bind:operator={tempPdFilterOperator}
			bind:value={tempPdFilterValue}
			disableActions={filteredOrders.length === 0}
			on:apply={applyPdFilter}
			on:exportCsv={exportToCSV}
			on:print={printTable}
		/>
	</div>

	<ColumnVisibilityPills {columns} {columnVisibility} on:toggle={(e) => toggleColumnVisibility(e.detail.key)} />

	<!-- Orders Table -->
	<div class="mt-8 flex flex-col">
		<div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
			<div class="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
				<div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
					<table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
						<thead class="bg-gray-50 dark:bg-gray-800">
							<tr>
								<th
									scope="col"
									colspan="2"
									class="pl-4 pr-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 sm:pl-6"
								>
									<div class="flex flex-col gap-2">
										<button
											type="button"
											class="group inline-flex cursor-pointer font-semibold"
											on:click={() => handleSort('customer')}
										>
											Customer
											<span
												class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible"
												class:visible={sortField === 'customer'}
												class:invisible={sortField !== 'customer'}
											>
												{#if sortField === 'customer' && sortDirection === 'desc'}
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
											value={searchFilters['customer'] || ''}
											on:input={(e) => handleSearchChange('customer', e.currentTarget.value)}
										/>
									</div>
								</th>
								{#each visibleColumns.slice(1) as column}
									<th
										scope="col"
										class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100"
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
										colspan={visibleColumns.length + 1}
										class="py-4 pl-4 pr-3 text-center text-sm text-gray-500 sm:pl-6">Loading...</td
									>
								</tr>
							{:else if error}
								<tr>
									<td
										colspan={visibleColumns.length + 1}
										class="py-4 pl-4 pr-3 text-center text-sm text-red-500 sm:pl-6">{error}</td
									>
								</tr>
							{:else if filteredOrders.length === 0}
								<tr>
									<td
										colspan={visibleColumns.length + 1}
										class="py-4 pl-4 pr-3 text-center text-sm text-gray-500 sm:pl-6"
										>No past due orders found.</td
									>
								</tr>
							{:else}
								{#each filteredOrders as order}
									<!-- Main row with customer spanning 2 columns -->
									<tr>
										<td
											colspan="2"
											class="pl-4 pr-3 py-4 text-sm font-medium text-gray-900 dark:text-gray-100 sm:pl-6"
										>
											{order.customer}
										</td>
										{#each visibleColumns.slice(1) as column}
											<td
												class="whitespace-nowrap px-3 py-4 text-sm {column.key === 'pdCounter'
													? `${getPdCounterColor(order[column.key] as number)} ${getPdCounterBgColor(order[column.key] as number)} font-semibold`
													: 'text-gray-500 dark:text-gray-400'}"
											>
												{#if column.key === 'amount' || column.key === 'payments'}
													${order[column.key]}
												{:else if column.key === 'invoice'}
													<a
														href="https://www.rapidsupplies.com.au/_cpanel/salesorder/view?id={order[column.key]}"
														target="_blank"
														rel="noopener noreferrer"
														class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 underline"
													>
														{order[column.key]}
													</a>
												{:else if column.key === 'notes'}
													<button
														type="button"
														on:click={() => openNotesModal(order)}
														class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 underline text-sm"
													>
														{(order[column.key] as Note[]).length > 0 ? `${(order[column.key] as Note[]).length} notes` : 'Add notes'}
													</button>
												{:else}
													{order[column.key]}
												{/if}
											</td>
										{/each}
									</tr>
									<!-- Phone row -->
									<tr class="border-t border-gray-100 dark:border-gray-700">
										<td
											colspan="2"
											class="pl-4 pr-3 py-2 text-sm text-gray-600 dark:text-gray-400 sm:pl-6"
										>
											{#if order.contacts}
												<span class="font-medium">Phone: </span>
												<a
													href="tel:{order.contacts}"
													class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 underline"
												>
													{order.contacts}
												</a>
											{:else}
												<span class="text-gray-400 dark:text-gray-500">No phone</span>
											{/if}
										</td>
										{#each visibleColumns.slice(1) as column}
											<td class="px-3 py-2"></td>
										{/each}
									</tr>
									<!-- Email row -->
									<tr class="border-b border-gray-200 dark:border-gray-600">
										<td
											colspan="2"
											class="pl-4 pr-3 py-2 text-sm text-gray-600 dark:text-gray-400 sm:pl-6"
										>
											{#if order.email}
												<span class="font-medium">Email: </span>
												<a
													href="mailto:{order.email}"
													class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 underline"
												>
													{order.email}
												</a>
											{:else}
												<span class="text-gray-400 dark:text-gray-500">No email</span>
											{/if}
										</td>
										{#each visibleColumns.slice(1) as column}
											<td class="px-3 py-2"></td>
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

	<!-- Notes Modal -->
	{#if showNotesModal && selectedOrder}
		<div class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
			<div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
				<div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" on:click={closeNotesModal}></div>

				<span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

				<div class="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
					<div class="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
						<div class="sm:flex sm:items-start">
							<div class="mt-3 text-center sm:mt-0 sm:text-left w-full">
								<h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100" id="modal-title">
									Notes for Invoice {selectedOrder.invoice}
								</h3>
								<div class="mt-4">
									<p class="text-sm text-gray-500 dark:text-gray-400 mb-2">Customer: {selectedOrder.customer}</p>

									<!-- Existing Notes -->
									<div class="mb-4 max-h-60 overflow-y-auto">
										<h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Past Notes:</h4>
										{#if notesLoading}
											<p class="text-sm text-gray-500 dark:text-gray-400">Loading notes...</p>
										{:else if selectedOrder.notes.length === 0}
											<p class="text-sm text-gray-500 dark:text-gray-400 italic">No notes yet</p>
										{:else}
											<div class="space-y-2">
												{#each selectedOrder.notes as note, index}
													<div class="bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
														<p class="text-sm text-gray-900 dark:text-gray-100">{note.note}</p>
														<div class="flex justify-between items-center mt-1">
															<p class="text-xs text-gray-500 dark:text-gray-400">Note #{index + 1}</p>
															<p class="text-xs text-gray-500 dark:text-gray-400">
																{note.user} • {new Date(note.timestamp).toLocaleDateString()}
															</p>
														</div>
													</div>
												{/each}
											</div>
										{/if}
									</div>

									<!-- Add New Note -->
									<div>
										<label for="new-note" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
											Add New Note:
										</label>
										<textarea
											id="new-note"
											rows="3"
											class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
											placeholder="Enter your note here..."
											bind:value={newNote}
											disabled={notesLoading}
										></textarea>
									</div>
								</div>
							</div>
						</div>
					</div>
					<div class="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
						<button
							type="button"
							on:click={saveNote}
							disabled={!newNote.trim() || notesLoading}
							class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{#if notesLoading}
								Saving...
							{:else}
								Add Note
							{/if}
						</button>
						<button
							type="button"
							on:click={closeNotesModal}
							class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm dark:bg-gray-600 dark:text-gray-200 dark:border-gray-500 dark:hover:bg-gray-500"
						>
							Close
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
