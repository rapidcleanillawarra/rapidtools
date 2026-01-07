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
		getUnreadNotesCount,
		type ColumnKey,
		type Note,
		type NoteView,
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
	let visibleColumns = columns.filter(
		(column) => column.key === 'customer' || columnVisibility[column.key]
	);
	let nonCustomerColumns = visibleColumns.filter((column) => column.key !== 'customer');
	let tableColumnCount = nonCustomerColumns.length + 1;
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

	async function fetchOrders() {
		try {
			loading = true;
			error = '';
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
						notes: [],
						noteViews: [],
						username: order.Username || ''
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

		// Fetch notes status for all orders
		if (orders.length > 0) {
			await fetchNotesStatus();
			await fetchNoteViews();
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
		if (key === 'customer') return;
		const nextVisibility = !columnVisibility[key];
		columnVisibility = { ...columnVisibility, [key]: !columnVisibility[key] };
		if (!nextVisibility && searchFilters[key]) {
			const nextFilters = { ...searchFilters };
			delete nextFilters[key];
			searchFilters = nextFilters;
		}
	}

	async function openNotesModal(order: ProcessedOrder) {
		selectedOrder = order;
		newNote = '';
		showNotesModal = true;

		// Fetch existing notes from Supabase
		await fetchNotes(order.invoice);

		// Mark notes as viewed for the current user
		if (user?.email && selectedOrder) {
			await markNotesAsViewed(selectedOrder, user.email);
		}
	}

	async function fetchNotesStatus() {
		try {
			const invoiceIds = orders.map((order) => order.invoice);
			const { data, error: supabaseError } = await supabase
				.from('orders_past_due_accounts_order_notes')
				.select('*')
				.in('order_id', invoiceIds)
				.is('deleted_at', null);

			if (supabaseError) {
				console.error('Error fetching notes status:', supabaseError);
			} else if (data) {
				// Group notes by order_id
				const notesByOrderId = data.reduce(
					(acc, note) => {
						if (!acc[note.order_id]) {
							acc[note.order_id] = [];
						}
						acc[note.order_id].push(note);
						return acc;
					},
					{} as Record<string, Note[]>
				);

				// Update orders with notes data
				orders = orders.map((order) => ({
					...order,
					notes: notesByOrderId[order.invoice] || []
				}));
			}
		} catch (error) {
			console.error('Error fetching notes status:', error);
		}
	}

	async function fetchNotes(invoiceId: string) {
		try {
			notesLoading = true;
			const { data, error: supabaseError } = await supabase
				.from('orders_past_due_accounts_order_notes')
				.select('*')
				.eq('order_id', invoiceId)
				.is('deleted_at', null)
				.order('created_at', { ascending: false });

			if (supabaseError) {
				console.error('Error fetching notes:', supabaseError);
			} else if (selectedOrder) {
				selectedOrder.notes = data || [];
			}
		} catch (error) {
			console.error('Error fetching notes:', error);
		} finally {
			notesLoading = false;
		}
	}

	async function fetchNoteViews() {
		try {
			const noteIds = Array.from(
				new Set(orders.flatMap((order) => order.notes.map((note) => note.id)))
			);
			if (noteIds.length === 0) {
				orders = orders.map((order) => ({ ...order, noteViews: [] }));
				return;
			}

			const { data, error: supabaseError } = await supabase
				.from('orders_past_due_accounts_order_note_views')
				.select('note_id,user_email,viewed_at')
				.in('note_id', noteIds);

			if (supabaseError) {
				console.error('Error fetching note views:', supabaseError);
				return;
			}

			const noteIdToOrderId = new Map<string, string>();
			orders.forEach((order) => {
				order.notes.forEach((note) => {
					noteIdToOrderId.set(note.id, order.invoice);
				});
			});

			const noteViewsByOrderId: Record<string, NoteView[]> = {};
			orders.forEach((order) => {
				noteViewsByOrderId[order.invoice] = [];
			});

			(data || []).forEach((view: NoteView) => {
				const orderId = noteIdToOrderId.get(view.note_id);
				if (!orderId) return;
				noteViewsByOrderId[orderId].push(view);
			});

			orders = orders.map((order) => ({
				...order,
				noteViews: noteViewsByOrderId[order.invoice] || []
			}));
		} catch (error) {
			console.error('Error fetching note views:', error);
		}
	}

	async function markNotesAsViewed(order: ProcessedOrder, userEmail: string) {
		if (!userEmail || !order.notes.length) return;

		try {
			const unreadNotes = order.notes.filter((note) => {
				return !order.noteViews.some(
					(view) => view.note_id === note.id && view.user_email === userEmail
				);
			});

			if (unreadNotes.length === 0) return;

			// Insert view records for unread notes
			const viewRecords = unreadNotes.map((note) => ({
				note_id: note.id,
				user_email: userEmail
			}));

			const { error: insertError } = await supabase
				.from('orders_past_due_accounts_order_note_views')
				.insert(viewRecords);

			if (insertError) {
				console.error('Error marking notes as viewed:', insertError);
			} else {
				// Update the order's noteViews in the local state
				const newViews = viewRecords.map((record) => ({
					note_id: record.note_id,
					user_email: record.user_email,
					viewed_at: new Date().toISOString()
				}));

				orders = orders.map((o) =>
					o.invoice === order.invoice ? { ...o, noteViews: [...o.noteViews, ...newViews] } : o
				);
			}
		} catch (error) {
			console.error('Error marking notes as viewed:', error);
		}
	}

	async function saveNote() {
		if (!selectedOrder || !newNote.trim() || !user?.email) return;

		const currentOrder = selectedOrder;
		const invoiceId = currentOrder.invoice;

		try {
			notesLoading = true;

			const creatorFullName =
				profile && profile.firstName && profile.lastName
					? `${profile.firstName} ${profile.lastName}`
					: null;

			// Insert the new note
			const { data: insertedNote, error: insertError } = await supabase
				.from('orders_past_due_accounts_order_notes')
				.insert({
					order_id: invoiceId,
					note: newNote.trim(),
					created_by: user.email,
					creator_full_name: creatorFullName
				})
				.select('id')
				.single();

			if (insertError) {
				console.error('Error saving note:', insertError);
			} else {
				// Automatically mark the note as viewed by the creator
				if (insertedNote?.id) {
					const { error: viewError } = await supabase
						.from('orders_past_due_accounts_order_note_views')
						.insert({
							note_id: insertedNote.id,
							user_email: user.email
						});

					if (viewError) {
						console.error('Error marking note as viewed by creator:', viewError);
					}
				}
				// Refresh notes for the selected order
				await fetchNotes(invoiceId);

				// Update the order in the orders array to trigger reactivity
				// After fetchNotes, selectedOrder.notes contains the updated notes
				if (selectedOrder) {
					const updatedNotes = selectedOrder.notes;
					orders = orders.map((order) =>
						order.invoice === invoiceId ? { ...order, notes: updatedNotes } : order
					);
				}

				// Refresh note views to include any new notes
				await fetchNoteViews();

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
		const csvColumns = visibleColumns.filter((col) => col.key !== 'notes'); // Use visible columns, exclude notes
		const headers = csvColumns.map((col) => col.label).join(',');

		const rows = filteredOrders.map((order) =>
			csvColumns
				.map((col) => {
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
				})
				.join(',')
		);

		const csvContent = [headers, ...rows].join('\n');
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');

		if (link.download !== undefined) {
			const url = URL.createObjectURL(blob);
			link.setAttribute('href', url);
			link.setAttribute(
				'download',
				`past-due-accounts-${new Date().toISOString().split('T')[0]}.csv`
			);
			link.style.visibility = 'hidden';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		}
	}

	function printTable() {
		const printWindow = window.open('', '_blank');
		if (!printWindow) return;

		const csvColumns = visibleColumns.filter((col) => col.key !== 'notes'); // Use visible columns, exclude notes

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
								${csvColumns.map((col) => `<th>${col.label}</th>`).join('')}
							</tr>
						</thead>
						<tbody>
							${filteredOrders
								.map(
									(order) => `
								<tr>
									${csvColumns
										.map((col) => {
											let value = order[col.key];
											let className = '';

											if (col.key === 'amount' || col.key === 'payments') {
												value = '$' + value;
												className = 'amount';
											} else if (col.key === 'pdCounter') {
												className = 'pd-counter';
											}

											return '<td class="' + className + '">' + value + '</td>';
										})
										.join('')}
								</tr>
							`
								)
								.join('')}
						</tbody>
					</table>
				</body>
			</html>
		`;

		printWindow.document.write(htmlContent);
		printWindow.document.close();
		printWindow.print();
	}

	$: visibleColumns = columns.filter(
		(column) => column.key === 'customer' || columnVisibility[column.key]
	);
	$: nonCustomerColumns = visibleColumns.filter((column) => column.key !== 'customer');
	$: tableColumnCount = nonCustomerColumns.length + 1;

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
				const normalizedValue = value.toLowerCase();
				const columnKey = key as ColumnKey;

				if (columnKey === 'notes') {
					return order.notes.some((note) => {
						const noteText = note.note.toLowerCase();
						const createdBy = note.created_by.toLowerCase();
						const creatorName = note.creator_full_name?.toLowerCase() || '';
						return (
							noteText.includes(normalizedValue) ||
							createdBy.includes(normalizedValue) ||
							creatorName.includes(normalizedValue)
						);
					});
				}

				const orderValue = String(order[columnKey]).toLowerCase();
				return orderValue.includes(normalizedValue);
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
		const unsubCurrentUser = currentUser.subscribe((value) => {
			user = value;
		});

		const unsubUserProfile = userProfile.subscribe((value) => {
			profile = value;
		});

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
					columnVisibility = {
						...columnVisibility,
						...JSON.parse(storedVisibility),
						customer: true
					};
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

	<ColumnVisibilityPills
		{columns}
		{columnVisibility}
		on:toggle={(e) => toggleColumnVisibility(e.detail.key)}
	/>

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
									class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 sm:pl-6"
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
								{#each nonCustomerColumns as column}
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
										colspan={tableColumnCount}
										class="py-4 pl-4 pr-3 text-center text-sm text-gray-500 sm:pl-6">Loading...</td
									>
								</tr>
							{:else if error}
								<tr>
									<td
										colspan={tableColumnCount}
										class="py-4 pl-4 pr-3 text-center text-sm text-red-500 sm:pl-6">{error}</td
									>
								</tr>
							{:else if filteredOrders.length === 0}
								<tr>
									<td
										colspan={tableColumnCount}
										class="py-4 pl-4 pr-3 text-center text-sm text-gray-500 sm:pl-6"
										>No past due orders found.</td
									>
								</tr>
							{:else}
								{#each filteredOrders as order, index}
									<!-- Main row with all columns spanning 3 rows except customer -->
									<tr
										class="!border-b-0 {index % 2 === 0
											? 'bg-white dark:bg-gray-900'
											: 'bg-gray-50 dark:bg-gray-800/50'}"
									>
										<td
											class="!border-b-0 py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-gray-100 sm:pl-6"
										>
											{#if order.username}
												<a
													href="https://www.rapidsupplies.com.au/_cpanel/customer/view?id={order.username}"
													target="_blank"
													rel="noopener noreferrer"
													class="group inline-flex items-center gap-1.5 text-[rgb(40,40,40)] transition-colors hover:text-black dark:text-gray-200 dark:hover:text-white"
												>
													<span>{order.customer}</span>
													<svg
														class="h-4 w-4 opacity-70 transition-all group-hover:scale-110 group-hover:opacity-100"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
														></path>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
														></path>
													</svg>
												</a>
											{:else}
												{order.customer}
											{/if}
										</td>
										{#each nonCustomerColumns as column}
											<td
												rowspan="3"
												class="whitespace-nowrap px-3 py-4 text-sm {column.key === 'pdCounter'
													? `${getPdCounterColor(order[column.key] as number)} ${getPdCounterBgColor(order[column.key] as number)} font-semibold`
													: column.key === 'notes' && (order[column.key] as Note[]).length > 0
														? 'rounded-md border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'
														: 'text-gray-500 dark:text-gray-400'}"
											>
												{#if column.key === 'amount' || column.key === 'payments'}
													${order[column.key]}
												{:else if column.key === 'invoice'}
													<a
														href="https://www.rapidsupplies.com.au/_cpanel/salesorder/view?id={order[
															column.key
														]}"
														target="_blank"
														rel="noopener noreferrer"
														class="group inline-flex items-center gap-1.5 text-[rgb(40,40,40)] transition-colors hover:text-black dark:text-gray-200 dark:hover:text-white"
													>
														<span>{order[column.key]}</span>
														<svg
															class="h-4 w-4 opacity-70 transition-all group-hover:scale-110 group-hover:opacity-100"
															fill="none"
															stroke="currentColor"
															viewBox="0 0 24 24"
														>
															<path
																stroke-linecap="round"
																stroke-linejoin="round"
																stroke-width="2"
																d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
															></path>
															<path
																stroke-linecap="round"
																stroke-linejoin="round"
																stroke-width="2"
																d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
															></path>
														</svg>
													</a>
												{:else if column.key === 'notes'}
													{@const unreadCount = getUnreadNotesCount(order, user?.email || null)}
													<button
														type="button"
														on:click={() => openNotesModal(order)}
														class="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-all duration-200 {(
															order[column.key] as Note[]
														).length > 0
															? 'border-blue-300 bg-blue-100 text-blue-800 hover:border-blue-400 hover:bg-blue-200 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:border-blue-600 dark:hover:bg-blue-900/50'
															: 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-700'}"
													>
														<svg
															class="h-3.5 w-3.5"
															fill="none"
															stroke="currentColor"
															viewBox="0 0 24 24"
														>
															<path
																stroke-linecap="round"
																stroke-linejoin="round"
																stroke-width="2"
																d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
															></path>
														</svg>
														{(order[column.key] as Note[]).length > 0 ? 'View Notes' : 'Add notes'}
														{#if unreadCount > 0}
															<span
																class="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-bold leading-none text-white"
															>
																{unreadCount}
															</span>
														{/if}
													</button>
												{:else}
													{order[column.key]}
												{/if}
											</td>
										{/each}
									</tr>
									<!-- Phone row -->
									<tr
										class={index % 2 === 0
											? 'bg-white dark:bg-gray-900'
											: 'bg-gray-50 dark:bg-gray-800/50'}
									>
										<td class="py-2 pl-4 pr-3 text-sm text-gray-600 dark:text-gray-400 sm:pl-6">
											{#if order.contacts}
												<div class="flex items-center gap-2">
													<svg
														class="h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
														></path>
													</svg>
													<a
														href="tel:{order.contacts}"
														class="group inline-flex items-center gap-1.5 text-[rgb(40,40,40)] transition-colors hover:text-black dark:text-gray-200 dark:hover:text-white"
													>
														<span>{order.contacts}</span>
														<svg
															class="h-3.5 w-3.5 opacity-70 transition-all group-hover:scale-110 group-hover:opacity-100"
															fill="none"
															stroke="currentColor"
															viewBox="0 0 24 24"
														>
															<path
																stroke-linecap="round"
																stroke-linejoin="round"
																stroke-width="2"
																d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
															></path>
															<path
																stroke-linecap="round"
																stroke-linejoin="round"
																stroke-width="2"
																d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
															></path>
														</svg>
													</a>
												</div>
											{:else}
												<div class="flex items-center gap-2">
													<svg
														class="h-4 w-4 flex-shrink-0 text-gray-300 dark:text-gray-600"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
														></path>
													</svg>
													<span class="italic text-gray-400 dark:text-gray-500">No phone</span>
												</div>
											{/if}
										</td>
									</tr>
									<!-- Email row -->
									<tr
										class="!border-t-0 {index % 2 === 0
											? 'bg-white dark:bg-gray-900'
											: 'bg-gray-50 dark:bg-gray-800/50'}"
									>
										<td
											class="!border-t-0 py-2 pl-4 pr-3 text-sm text-gray-600 dark:text-gray-400 sm:pl-6"
										>
											{#if order.email}
												<div class="flex items-center gap-2">
													<svg
														class="h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
														></path>
													</svg>
													<a
														href="mailto:{order.email}"
														class="group inline-flex items-center gap-1.5 text-[rgb(40,40,40)] transition-colors hover:text-black dark:text-gray-200 dark:hover:text-white"
													>
														<span>{order.email}</span>
														<svg
															class="h-3.5 w-3.5 opacity-70 transition-all group-hover:scale-110 group-hover:opacity-100"
															fill="none"
															stroke="currentColor"
															viewBox="0 0 24 24"
														>
															<path
																stroke-linecap="round"
																stroke-linejoin="round"
																stroke-width="2"
																d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
															></path>
															<path
																stroke-linecap="round"
																stroke-linejoin="round"
																stroke-width="2"
																d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
															></path>
														</svg>
													</a>
												</div>
											{:else}
												<div class="flex items-center gap-2">
													<svg
														class="h-4 w-4 flex-shrink-0 text-gray-300 dark:text-gray-600"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
														></path>
													</svg>
													<span class="italic text-gray-400 dark:text-gray-500">No email</span>
												</div>
											{/if}
										</td>
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
		<div
			class="fixed inset-0 z-50 overflow-y-auto"
			aria-labelledby="modal-title"
			role="dialog"
			aria-modal="true"
		>
			<div
				class="flex min-h-screen items-end justify-center px-4 pb-20 pt-4 text-center sm:block sm:p-0"
			>
				<div
					class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
					aria-hidden="true"
					on:click={closeNotesModal}
				></div>

				<span class="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true"
					>&#8203;</span
				>

				<div
					class="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all dark:bg-gray-800 sm:my-8 sm:w-full sm:max-w-lg sm:align-middle"
				>
					<div class="bg-white px-4 pb-4 pt-5 dark:bg-gray-800 sm:p-6 sm:pb-4">
						<div class="sm:flex sm:items-start">
							<div class="mt-3 w-full text-center sm:mt-0 sm:text-left">
								<h3
									class="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100"
									id="modal-title"
								>
									Notes for Invoice {selectedOrder.invoice}
								</h3>
								<div class="mt-4">
									<p class="mb-2 text-sm text-gray-500 dark:text-gray-400">
										Customer: {selectedOrder.customer}
									</p>

									<!-- Existing Notes -->
									<div class="mb-4 max-h-60 overflow-y-auto">
										<h4 class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
											Past Notes:
										</h4>
										{#if notesLoading}
											<p class="text-sm text-gray-500 dark:text-gray-400">Loading notes...</p>
										{:else if selectedOrder.notes.length === 0}
											<p class="text-sm italic text-gray-500 dark:text-gray-400">No notes yet</p>
										{:else}
											<div class="space-y-2">
												{#each selectedOrder.notes as note, index}
													<div class="rounded-md bg-gray-50 p-3 dark:bg-gray-700">
														<p class="text-sm text-gray-900 dark:text-gray-100">{note.note}</p>
														<div class="mt-1 flex items-center justify-between">
															<p class="text-xs text-gray-500 dark:text-gray-400">
																Note #{index + 1}
															</p>
															<p class="text-xs text-gray-500 dark:text-gray-400">
																{note.creator_full_name || note.created_by} • {new Date(
																	note.created_at
																).toLocaleDateString()}
															</p>
														</div>
													</div>
												{/each}
											</div>
										{/if}
									</div>

									<!-- Add New Note -->
									<div>
										<label
											for="new-note"
											class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
										>
											Add New Note:
										</label>
										<textarea
											id="new-note"
											rows="3"
											class="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 sm:text-sm"
											placeholder="Enter your note here..."
											bind:value={newNote}
											disabled={notesLoading}
										></textarea>
									</div>
								</div>
							</div>
						</div>
					</div>
					<div class="bg-gray-50 px-4 py-3 dark:bg-gray-700 sm:flex sm:flex-row-reverse sm:px-6">
						<button
							type="button"
							on:click={saveNote}
							disabled={!newNote.trim() || notesLoading}
							class="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:ml-3 sm:w-auto sm:text-sm"
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
							class="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:border-gray-500 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 sm:ml-3 sm:mt-0 sm:w-auto sm:text-sm"
						>
							Close
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
