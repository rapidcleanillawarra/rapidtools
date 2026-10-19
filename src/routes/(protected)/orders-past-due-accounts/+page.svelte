<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { supabase } from '$lib/supabase';
	import { currentUser } from '$lib/firebase';
	import { userProfile, type UserProfile } from '$lib/userProfile';
	import {
		columns,
		defaultColumnVisibility,
		parseDate,
		serializeNoteWithAttachments,
		type ColumnKey,
		type Note,
		type NoteAttachment,
		type NoteView,
		type Order,
		type ProcessedOrder
	} from './pastDueAccounts';
	import PastDueLegend from './components/PastDueLegend.svelte';
	import PastDueToolbar from './components/PastDueToolbar.svelte';
	import ColumnVisibilityPills from './components/ColumnVisibilityPills.svelte';
	import PastDueOrdersTable from './components/PastDueOrdersTable.svelte';
	import PastDuePagination from './components/PastDuePagination.svelte';
	import NotesModal from './components/NotesModal.svelte';
	import EmailModal from './components/EmailModal.svelte';
	import { processInvoiceTracking } from './invoiceTracking';

	let orders: ProcessedOrder[] = [];
	let loading = true;
	let error = '';
	let globalSearch = '';
	let searchFilters: Partial<Record<ColumnKey, string>> = {};
	let sortField: ColumnKey = 'pdCounter';
	let sortDirection: 'asc' | 'desc' = 'desc';

	// Aging Bucket Filter State
	type PdBucket = 'all' | '1-30' | '31-60' | '61-90' | '90+';
	let selectedBucket: PdBucket = 'all';

	// Top-right more menu state
	let showHeaderMenu = false;

	// Column visibility state
	let columnVisibility: Record<ColumnKey, boolean> = { ...defaultColumnVisibility };
	let visibleColumns = columns.filter(
		(column) => column.key === 'customer' || columnVisibility[column.key]
	);
	let nonCustomerColumns = visibleColumns.filter((column) => column.key !== 'customer');
	let filteredOrders: ProcessedOrder[] = [];

	// PD Counter Filter State
	let pdFilterOperator = '>';
	let pdFilterValue: number | null = 0;
	let initialized = false;

	// Temporary PD Counter Filter State (for inputs)
	let tempPdFilterOperator = pdFilterOperator;
	let tempPdFilterValue: number | null = pdFilterValue;

	// UI Toggle States
	let showLegend = false;
	let showColumnVisibility = false;
	let showInvoiceFilter = false;

	// Invoice ID Filter State
	let invoiceIds = '';

	// Pagination State
	let currentPage = 1;
	let itemsPerPage = 25;
	let totalPages = 1;

	// Notes Modal State
	let showNotesModal = false;
	let selectedOrder: ProcessedOrder | null = null;
	let newNote = '';
	let outlookLink = '';
	let pendingNoteFiles: File[] = [];
	let noteUploadError = '';
	let notesLoading = false;

	// Email Modal State
	let showEmailModal = false;
	let emailOrder: ProcessedOrder | null = null;

	// User information
	let user: import('firebase/auth').User | null = null;
	let profile: UserProfile | null = null;

	// Assignment and follow-up state
	let availableUsers: string[] = [
		'Windy',
		'AJ',
		'Joevenito',
		'Orders Team',
		'Olie',
		'Sabina',
		'Krista',
		'Luke',
		'Mario'
	]; // Default users, will be updated from database

	async function fetchAvailableUsers() {
		try {
			const { data, error } = await supabase
				.from('users')
				.select('full_name')
				.order('full_name', { ascending: true });

			if (error) {
				console.error('Error fetching users:', error);
			} else if (data) {
				availableUsers = data.map((user) => user.full_name).filter(Boolean);
			}
		} catch (error) {
			console.error('Error in fetchAvailableUsers:', error);
		}
	}

	async function fetchOrders(runTracking: boolean = false) {
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
							OrderStatus: ['Dispatched'],
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
					// Skip orders with grand total <= $0 (only synchronize orders with grand total > $0)
					const grandTotal = parseFloat(order.GrandTotal);
					if (grandTotal <= 0) {
						return acc;
					}

					// Calculate Amount (Outstanding) and Payments
					let outstandingAmount = grandTotal;
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
						invoiceAmount: grandTotal.toFixed(2),
						amount: outstandingAmount.toFixed(2),
						assignedTo: '', // Initialize as empty string
						followUp: '', // Initialize as empty string
						notes: [],
						noteViews: [],
						username: order.Username || '',
						tickets: [] // Initialize as empty array
					});

					return acc;
				}, []);

				console.log(`Orders count from API: ${orders.length}`);

				const trackingOrders = orders.filter((order) => {
					// PD Counter Filter
					if (
						pdFilterValue !== null &&
						pdFilterValue !== undefined &&
						String(pdFilterValue) !== ''
					) {
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
				});

				/**
				 * INVOICE TRACKING PROCESS
				 */
				if (runTracking) {
					await processInvoiceTracking(trackingOrders, data.Order);
				}
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'An unknown error occurred';
			console.error(e);
		} finally {
			loading = false;
		}

		// Fetch notes and views for all orders
		if (orders.length > 0) {
			await fetchNotesAndViews();
		}
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
		currentPage = 1;
	}

	function selectBucket(bucket: PdBucket) {
		selectedBucket = bucket;
		currentPage = 1;
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
		outlookLink = '';
		pendingNoteFiles = [];
		noteUploadError = '';
		showNotesModal = true;

		// Fetch existing notes from Supabase
		await fetchNotes(order.invoice);

		// Mark notes as viewed for the current user
		if (user?.email && selectedOrder) {
			await markNotesAsViewed(selectedOrder, user.email);
		}
	}

	/**
	 * Efficiently fetch both notes and note views in parallel, then update orders once
	 */
	async function fetchNotesAndViews() {
		try {
			const invoiceIds = orders.map((order) => order.invoice);

			// First, fetch notes for the current orders
			const notesResult = await supabase
				.from('orders_past_due_accounts_order_notes')
				.select('*')
				.in('order_id', invoiceIds)
				.is('deleted_at', null);

			if (notesResult.error) {
				console.error('Error fetching notes:', notesResult.error);
				return;
			}

			const notes = notesResult.data || [];

			// Group notes by order_id and collect note IDs
			const notesByOrderId: Record<string, Note[]> = {};
			const noteIds: string[] = [];

			notes.forEach((note) => {
				if (!notesByOrderId[note.order_id]) {
					notesByOrderId[note.order_id] = [];
				}
				notesByOrderId[note.order_id].push(note);
				noteIds.push(note.id);
			});

			// Only fetch note views if we have notes
			let allNoteViews: NoteView[] = [];
			if (noteIds.length > 0) {
				const noteViewsResult = await supabase
					.from('orders_past_due_accounts_order_note_views')
					.select('note_id,user_email,viewed_at')
					.in('note_id', noteIds);

				if (noteViewsResult.error) {
					console.error('Error fetching note views:', noteViewsResult.error);
				} else {
					allNoteViews = noteViewsResult.data || [];
				}
			}

			// Group note views by order_id
			const noteViewsByOrderId: Record<string, NoteView[]> = {};

			const noteIdToOrderId = new Map<string, string>();
			notes.forEach((note) => {
				noteIdToOrderId.set(note.id, note.order_id);
			});

			allNoteViews.forEach((view) => {
				const orderId = noteIdToOrderId.get(view.note_id);
				if (orderId) {
					if (!noteViewsByOrderId[orderId]) {
						noteViewsByOrderId[orderId] = [];
					}
					noteViewsByOrderId[orderId].push(view);
				}
			});

			orders = orders.map((order) => ({
				...order,
				notes: notesByOrderId[order.invoice] || [],
				noteViews: noteViewsByOrderId[order.invoice] || []
			}));
		} catch (error) {
			console.error('Error fetching notes and views:', error);
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

	async function markNotesAsViewed(order: ProcessedOrder, userEmail: string) {
		if (!userEmail || !order.notes.length) return;

		try {
			const unreadNotes = order.notes.filter((note) => {
				return !order.noteViews.some(
					(view) => view.note_id === note.id && view.user_email === userEmail
				);
			});

			if (unreadNotes.length === 0) return;

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

	function classifyAttachmentType(file: File): 'image' | 'email' | 'file' {
		const lower = file.name.toLowerCase();
		if (file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(lower)) {
			return 'image';
		}
		if (
			lower.endsWith('.eml') ||
			lower.endsWith('.msg') ||
			file.type === 'message/rfc822' ||
			file.type === 'application/vnd.ms-outlook'
		) {
			return 'email';
		}
		return 'file';
	}

	async function uploadNoteFiles(invoiceId: string, files: File[]): Promise<NoteAttachment[]> {
		const uploaded: NoteAttachment[] = [];
		const bucket = 'rapidtools';
		const safeInvoice = invoiceId.replace(/[^a-zA-Z0-9._-]+/g, '_');

		for (const file of files) {
			const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
			const safeBase = file.name
				.replace(/\.[^/.]+$/, '')
				.replace(/[^a-zA-Z0-9._-]+/g, '_')
				.slice(0, 60);
			const storagePath = `past_due_notes/${safeInvoice}/${crypto.randomUUID()}_${safeBase}${ext}`;

			const { error: upErr } = await supabase.storage.from(bucket).upload(storagePath, file, {
				upsert: false,
				contentType: file.type || 'application/octet-stream'
			});

			if (upErr) {
				throw new Error(`Failed to upload ${file.name}: ${upErr.message}`);
			}

			const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
			uploaded.push({
				name: file.name,
				url: data.publicUrl,
				type: classifyAttachmentType(file)
			});
		}

		return uploaded;
	}

	async function saveNote() {
		const hasContent =
			Boolean(newNote.trim()) || Boolean(outlookLink.trim()) || pendingNoteFiles.length > 0;
		if (!selectedOrder || !hasContent || !user?.email) return;

		const currentOrder = selectedOrder;
		const invoiceId = currentOrder.invoice;

		try {
			notesLoading = true;
			noteUploadError = '';

			let uploadedAttachments: NoteAttachment[] = [];
			if (pendingNoteFiles.length > 0) {
				uploadedAttachments = await uploadNoteFiles(invoiceId, pendingNoteFiles);
			}

			const serializedNote = serializeNoteWithAttachments(
				newNote,
				outlookLink,
				uploadedAttachments
			);

			const creatorFullName =
				profile && profile.firstName && profile.lastName
					? `${profile.firstName} ${profile.lastName}`
					: null;

			const { data: insertedNote, error: insertError } = await supabase
				.from('orders_past_due_accounts_order_notes')
				.insert({
					order_id: invoiceId,
					note: serializedNote,
					created_by: user.email,
					creator_full_name: creatorFullName
				})
				.select('id')
				.single();

			if (insertError) {
				console.error('Error saving note:', insertError);
				noteUploadError = insertError.message;
			} else {
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
				await fetchNotes(invoiceId);

				if (selectedOrder) {
					const updatedNotes = selectedOrder.notes;
					orders = orders.map((order) =>
						order.invoice === invoiceId ? { ...order, notes: updatedNotes } : order
					);
				}

				await fetchNotesAndViews();

				newNote = '';
				outlookLink = '';
				pendingNoteFiles = [];
			}
		} catch (err) {
			console.error('Error saving note:', err);
			noteUploadError = err instanceof Error ? err.message : 'Failed to save note';
		} finally {
			notesLoading = false;
		}
	}

	function closeNotesModal() {
		showNotesModal = false;
		selectedOrder = null;
		newNote = '';
		outlookLink = '';
		pendingNoteFiles = [];
		noteUploadError = '';
	}

	async function openEmailModal(order: ProcessedOrder) {
		emailOrder = order;
		showEmailModal = true;
	}

	function closeEmailModal() {
		showEmailModal = false;
		emailOrder = null;
	}

	// Pagination functions
	function goToPage(page: number) {
		if (page >= 1 && page <= totalPages) {
			currentPage = page;
		}
	}

	function nextPage() {
		if (currentPage < totalPages) {
			currentPage++;
		}
	}

	function previousPage() {
		if (currentPage > 1) {
			currentPage--;
		}
	}

	function changeItemsPerPage(newItemsPerPage: number) {
		itemsPerPage = newItemsPerPage;
		currentPage = 1;
	}

	async function manualTriggerTracking() {
		try {
			await fetchOrders(true);
		} catch (err) {
			console.error('Error manually triggering tracking:', err);
			error = 'Failed to manually trigger tracking';
		}
	}

	function exportToCSV() {
		const csvColumns = visibleColumns.filter((col) => col.key !== 'notes');
		const headers = csvColumns.map((col) => col.label).join(',');

		const rows = filteredOrders.map((order) =>
			csvColumns
				.map((col) => {
					let value = order[col.key];
					if (col.key === 'amount' || col.key === 'payments' || col.key === 'invoiceAmount') {
						value = `$${value}`;
					}
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

		const csvColumns = visibleColumns.filter((col) => col.key !== 'notes');

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
						@media print { body { margin: 0; } }</style>
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

											if (col.key === 'amount' || col.key === 'payments' || col.key === 'invoiceAmount') {
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

	function handleWindowClick(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (showHeaderMenu && !target.closest('.header-menu-container')) {
			showHeaderMenu = false;
		}
	}

	// Base orders matching PD counter operator/value, invoice IDs, and search (used to compute bucket counts)
	$: baseFilteredOrders = orders.filter((order) => {
		// PD Counter Filter
		if (pdFilterValue !== null && pdFilterValue !== undefined && String(pdFilterValue) !== '') {
			const pd = order.pdCounter;
			const val = Number(pdFilterValue);
			if (pdFilterOperator === '>' && !(pd > val)) return false;
			if (pdFilterOperator === '<' && !(pd < val)) return false;
			if (pdFilterOperator === '=' && !(pd === val)) return false;
		}

		// Invoice IDs Filter
		if (invoiceIds && invoiceIds.trim() !== '') {
			const idsToFilter = invoiceIds
				.split('\n')
				.map((id) => id.trim())
				.filter((id) => id !== '');

			if (idsToFilter.length > 0 && !idsToFilter.includes(order.invoice)) {
				return false;
			}
		}

		// Global Search
		if (globalSearch.trim() !== '') {
			const q = globalSearch.trim().toLowerCase();
			const matchCustomer = order.customer.toLowerCase().includes(q);
			const matchInvoice = order.invoice.toLowerCase().includes(q);
			const matchEmail = order.email.toLowerCase().includes(q);
			const matchPhone = order.contacts.toLowerCase().includes(q);
			const matchUsername = order.username.toLowerCase().includes(q);
			if (!matchCustomer && !matchInvoice && !matchEmail && !matchPhone && !matchUsername) {
				return false;
			}
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
	});

	// Bucket Counts
	$: countAllOverdue = baseFilteredOrders.length;
	$: count1To30 = baseFilteredOrders.filter((o) => o.pdCounter >= 1 && o.pdCounter <= 30).length;
	$: count31To60 = baseFilteredOrders.filter((o) => o.pdCounter >= 31 && o.pdCounter <= 60).length;
	$: count61To90 = baseFilteredOrders.filter((o) => o.pdCounter >= 61 && o.pdCounter <= 90).length;
	$: count90Plus = baseFilteredOrders.filter((o) => o.pdCounter > 90).length;

	$: visibleColumns = columns.filter(
		(column) => column.key === 'customer' || columnVisibility[column.key]
	);
	$: nonCustomerColumns = visibleColumns.filter((column) => column.key !== 'customer');
	$: filteredOrders = baseFilteredOrders
		.filter((order) => {
			if (selectedBucket === '1-30') return order.pdCounter >= 1 && order.pdCounter <= 30;
			if (selectedBucket === '31-60') return order.pdCounter >= 31 && order.pdCounter <= 60;
			if (selectedBucket === '61-90') return order.pdCounter >= 61 && order.pdCounter <= 90;
			if (selectedBucket === '90+') return order.pdCounter > 90;
			return true;
		})
		.sort((a, b) => {
			let valA = a[sortField];
			let valB = b[sortField];

			if (sortField === 'pdCounter') {
				return sortDirection === 'asc'
					? (valA as number) - (valB as number)
					: (valB as number) - (valA as number);
			} else if (
				sortField === 'payments' ||
				sortField === 'amount' ||
				sortField === 'invoiceAmount'
			) {
				const numA = parseFloat(valA as string);
				const numB = parseFloat(valB as string);
				return sortDirection === 'asc' ? numA - numB : numB - numA;
			} else if (sortField === 'dateIssued' || sortField === 'dueDate') {
				const timeA = parseDate(valA as string);
				const timeB = parseDate(valB as string);
				return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
			} else if (sortField === 'notes') {
				const noteA = a.notes[0]?.note?.toLowerCase() || '';
				const noteB = b.notes[0]?.note?.toLowerCase() || '';
				return sortDirection === 'asc'
					? noteA.localeCompare(noteB)
					: noteB.localeCompare(noteA);
			} else {
				const strA = String(valA).toLowerCase();
				const strB = String(valB).toLowerCase();
				return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
			}
		});

	// Reset to page 1 when globalSearch changes
	$: if (globalSearch !== undefined) {
		currentPage = 1;
	}

	// Pagination logic
	$: totalPages = Math.max(1, Math.ceil(filteredOrders.length / itemsPerPage));
	$: paginatedOrders = filteredOrders.slice(
		(currentPage - 1) * itemsPerPage,
		currentPage * itemsPerPage
	);

	$: {
		if (typeof window !== 'undefined' && initialized) {
			localStorage.setItem('orders-pd-filter-operator', pdFilterOperator);
			if (pdFilterValue !== null) {
				localStorage.setItem('orders-pd-filter-value', String(pdFilterValue));
			} else {
				localStorage.removeItem('orders-pd-filter-value');
			}
			localStorage.setItem('orders-column-visibility', JSON.stringify(columnVisibility));
			localStorage.setItem('orders-show-legend', String(showLegend));
			localStorage.setItem('orders-show-column-visibility', String(showColumnVisibility));
			localStorage.setItem('orders-current-page', String(currentPage));
			localStorage.setItem('orders-items-per-page', String(itemsPerPage));
			localStorage.setItem('orders-invoice-ids', invoiceIds);
			localStorage.setItem('orders-show-invoice-filter', String(showInvoiceFilter));
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
			const storedShowLegend = localStorage.getItem('orders-show-legend');
			const storedShowColumnVisibility = localStorage.getItem('orders-show-column-visibility');
			const storedCurrentPage = localStorage.getItem('orders-current-page');
			const storedItemsPerPage = localStorage.getItem('orders-items-per-page');
			const storedInvoiceIds = localStorage.getItem('orders-invoice-ids');
			const storedShowInvoiceFilter = localStorage.getItem('orders-show-invoice-filter');

			if (!storedOp && !storedVal) {
				pdFilterOperator = '>';
				pdFilterValue = 0;
				tempPdFilterOperator = pdFilterOperator;
				tempPdFilterValue = pdFilterValue;
				localStorage.setItem('orders-pd-filter-operator', pdFilterOperator);
				localStorage.setItem('orders-pd-filter-value', String(pdFilterValue));
			} else {
				if (storedOp) pdFilterOperator = storedOp;
				if (storedVal) pdFilterValue = Number(storedVal);
				tempPdFilterOperator = pdFilterOperator;
				tempPdFilterValue = pdFilterValue;
			}

			if (storedVisibility) {
				try {
					columnVisibility = {
						...defaultColumnVisibility,
						...JSON.parse(storedVisibility),
						customer: true,
						invoiceAmount:
							JSON.parse(storedVisibility).invoiceAmount !== undefined
								? JSON.parse(storedVisibility).invoiceAmount
								: true
					};
				} catch (e) {
					console.error('Error parsing column visibility preferences:', e);
				}
			}

			showLegend = storedShowLegend === 'true';
			showColumnVisibility = storedShowColumnVisibility === 'true';
			showInvoiceFilter = storedShowInvoiceFilter === 'true';

			if (storedInvoiceIds) invoiceIds = storedInvoiceIds;
			if (storedCurrentPage) currentPage = Number(storedCurrentPage);
			if (storedItemsPerPage) itemsPerPage = Number(storedItemsPerPage);
		}

		fetchAvailableUsers();
		fetchOrders();
		initialized = true;

		return () => {
			unsubCurrentUser();
			unsubUserProfile();
		};
	});
</script>

<svelte:window on:click={handleWindowClick} />

<svelte:head>
	<title>Past Due Accounts - RapidTools</title>
</svelte:head>

<div class="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
	<div class="mx-auto max-w-7xl">
		<!-- Breadcrumb -->
		<div class="mb-3 flex items-center gap-2 text-xs font-medium text-gray-400">
			<span class="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#262a30] bg-[#141619] text-gray-400">
				<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
				</svg>
			</span>
			<span>Customers</span>
			<span class="text-gray-600">/</span>
			<span class="text-lime-400 font-semibold">Accounts</span>
		</div>

		<!-- Title & Top-Right Actions -->
		<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div>
				<h1 class="text-3xl font-bold tracking-tight text-white">Past Due Accounts</h1>
				<p class="mt-1 text-sm text-gray-400">
					Review overdue invoices and manage follow-ups.
				</p>
			</div>

			<div class="flex flex-wrap items-center gap-2.5">
				<button
					type="button"
					on:click={manualTriggerTracking}
					class="inline-flex items-center gap-2 rounded-xl border border-[#262a30] bg-[#141619] px-4 py-2 text-sm font-medium text-gray-200 transition hover:border-[#333842] hover:bg-[#1a1d22] hover:text-white"
				>
					<svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
						/>
					</svg>
					Sync invoices
				</button>

				<button
					type="button"
					on:click={exportToCSV}
					disabled={filteredOrders.length === 0}
					class="inline-flex items-center gap-2 rounded-xl border border-[#262a30] bg-[#141619] px-4 py-2 text-sm font-medium text-gray-200 transition hover:border-[#333842] hover:bg-[#1a1d22] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
				>
					<svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
						/>
					</svg>
					Export
				</button>

				<!-- More Menu (...) -->
				<div class="relative header-menu-container">
					<button
						type="button"
						on:click={() => (showHeaderMenu = !showHeaderMenu)}
						class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#262a30] bg-[#141619] text-gray-300 transition hover:border-[#333842] hover:bg-[#1a1d22] hover:text-white"
						title="More options"
					>
						<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
							<path
								d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z"
							/>
						</svg>
					</button>

					{#if showHeaderMenu}
						<div
							class="absolute right-0 z-30 mt-2 w-48 rounded-xl border border-[#262a30] bg-[#181b20] py-1.5 shadow-2xl"
						>
							<button
								type="button"
								disabled={filteredOrders.length === 0}
								on:click={() => {
									showHeaderMenu = false;
									printTable();
								}}
								class="flex w-full items-center gap-2.5 px-4 py-2 text-xs font-medium text-gray-200 transition hover:bg-[#22262d] disabled:opacity-40"
							>
								<svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
									/>
								</svg>
								Print report
							</button>

							<button
								type="button"
								on:click={() => {
									showHeaderMenu = false;
									showLegend = !showLegend;
								}}
								class="flex w-full items-center gap-2.5 px-4 py-2 text-xs font-medium text-gray-200 transition hover:bg-[#22262d]"
							>
								<svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
								{showLegend ? 'Hide PD legend' : 'Show PD legend'}
							</button>

							<a
								href="{base}/orders-past-due-accounts/settings"
								class="flex w-full items-center gap-2.5 px-4 py-2 text-xs font-medium text-gray-200 transition hover:bg-[#22262d]"
							>
								<svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
									/>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
									/>
								</svg>
								Email settings
							</a>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Summary & Aging Buckets Card -->
		<div
			class="mt-6 flex flex-col gap-4 rounded-2xl border border-[#262a30] bg-[#141619] px-6 py-4 shadow-xl lg:flex-row lg:items-center lg:justify-between"
		>
			<!-- Left: Total Overdue Count -->
			<div class="flex items-center gap-3.5 lg:pr-6 lg:border-r lg:border-[#262a30]">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-xl border border-[#262a30] bg-[#181b20] text-gray-300"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="1.75"
							d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
						/>
					</svg>
				</div>
				<div>
					<div class="text-2xl font-bold leading-none text-white">{countAllOverdue}</div>
					<div class="mt-1 text-xs text-gray-400">overdue invoices</div>
				</div>
			</div>

			<!-- Right: Aging Bucket Pills -->
			<div class="grid flex-1 grid-cols-2 gap-2.5 sm:grid-cols-5">
				<button
					type="button"
					on:click={() => selectBucket('all')}
					class="flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs font-medium transition {selectedBucket ===
					'all'
						? 'border-lime-500/60 bg-lime-950/30 text-white'
						: 'border-[#262a30] bg-[#16191d] text-gray-300 hover:border-[#333842] hover:bg-[#1a1d22]'}"
				>
					<span class="flex items-center gap-2">
						{#if selectedBucket === 'all'}
							<span class="h-2 w-2 rounded-full bg-lime-400"></span>
						{/if}
						<span>All overdue</span>
					</span>
					<span
						class="rounded-md px-2 py-0.5 text-xs font-semibold {selectedBucket === 'all'
							? 'bg-[#1f2918] text-gray-100'
							: 'bg-[#22262c] text-gray-300'}"
					>
						{countAllOverdue}
					</span>
				</button>

				<button
					type="button"
					on:click={() => selectBucket('1-30')}
					class="flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs font-medium transition {selectedBucket ===
					'1-30'
						? 'border-lime-500/60 bg-lime-950/30 text-white'
						: 'border-[#262a30] bg-[#16191d] text-gray-300 hover:border-[#333842] hover:bg-[#1a1d22]'}"
				>
					<span class="flex items-center gap-2">
						{#if selectedBucket === '1-30'}
							<span class="h-2 w-2 rounded-full bg-lime-400"></span>
						{/if}
						<span>1 &ndash; 30 days</span>
					</span>
					<span
						class="rounded-md px-2 py-0.5 text-xs font-semibold {selectedBucket === '1-30'
							? 'bg-[#1f2918] text-gray-100'
							: 'bg-[#22262c] text-gray-300'}"
					>
						{count1To30}
					</span>
				</button>

				<button
					type="button"
					on:click={() => selectBucket('31-60')}
					class="flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs font-medium transition {selectedBucket ===
					'31-60'
						? 'border-lime-500/60 bg-lime-950/30 text-white'
						: 'border-[#262a30] bg-[#16191d] text-gray-300 hover:border-[#333842] hover:bg-[#1a1d22]'}"
				>
					<span class="flex items-center gap-2">
						{#if selectedBucket === '31-60'}
							<span class="h-2 w-2 rounded-full bg-lime-400"></span>
						{/if}
						<span>31 &ndash; 60 days</span>
					</span>
					<span
						class="rounded-md px-2 py-0.5 text-xs font-semibold {selectedBucket === '31-60'
							? 'bg-[#1f2918] text-gray-100'
							: 'bg-[#22262c] text-gray-300'}"
					>
						{count31To60}
					</span>
				</button>

				<button
					type="button"
					on:click={() => selectBucket('61-90')}
					class="flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs font-medium transition {selectedBucket ===
					'61-90'
						? 'border-lime-500/60 bg-lime-950/30 text-white'
						: 'border-[#262a30] bg-[#16191d] text-gray-300 hover:border-[#333842] hover:bg-[#1a1d22]'}"
				>
					<span class="flex items-center gap-2">
						{#if selectedBucket === '61-90'}
							<span class="h-2 w-2 rounded-full bg-lime-400"></span>
						{/if}
						<span>61 &ndash; 90 days</span>
					</span>
					<span
						class="rounded-md px-2 py-0.5 text-xs font-semibold {selectedBucket === '61-90'
							? 'bg-[#1f2918] text-gray-100'
							: 'bg-[#22262c] text-gray-300'}"
					>
						{count61To90}
					</span>
				</button>

				<button
					type="button"
					on:click={() => selectBucket('90+')}
					class="flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs font-medium transition {selectedBucket ===
					'90+'
						? 'border-lime-500/60 bg-lime-950/30 text-white'
						: 'border-[#262a30] bg-[#16191d] text-gray-300 hover:border-[#333842] hover:bg-[#1a1d22]'}"
				>
					<span class="flex items-center gap-2">
						{#if selectedBucket === '90+'}
							<span class="h-2 w-2 rounded-full bg-lime-400"></span>
						{/if}
						<span>90+ days</span>
					</span>
					<span
						class="rounded-md px-2 py-0.5 text-xs font-semibold {selectedBucket === '90+'
							? 'bg-[#1f2918] text-gray-100'
							: 'bg-[#22262c] text-gray-300'}"
					>
						{count90Plus}
					</span>
				</button>
			</div>
		</div>

		<!-- Search & Filter Toolbar -->
		<PastDueToolbar
			bind:globalSearch
			bind:operator={tempPdFilterOperator}
			bind:value={tempPdFilterValue}
			appliedOperator={pdFilterOperator}
			appliedValue={pdFilterValue}
			bind:showLegend
			bind:showColumnVisibility
			bind:invoiceIds
			bind:showInvoiceFilter
			on:apply={applyPdFilter}
		/>

		<!-- Collapsible Legend Section -->
		{#if showLegend}
			<div class="animate-in fade-in slide-in-from-top-2 mt-3 duration-200">
				<PastDueLegend />
			</div>
		{/if}

		<!-- Collapsible Column Visibility Section -->
		{#if showColumnVisibility}
			<div class="animate-in fade-in slide-in-from-top-2 mt-3 duration-200">
				<ColumnVisibilityPills
					{columns}
					{columnVisibility}
					on:toggle={(e) => toggleColumnVisibility(e.detail.key)}
				/>
			</div>
		{/if}

		<!-- Orders Table -->
		<PastDueOrdersTable
			{loading}
			{error}
			{paginatedOrders}
			{nonCustomerColumns}
			{sortField}
			{sortDirection}
			filteredCount={filteredOrders.length}
			userEmail={user?.email || null}
			on:sort={(e) => handleSort(e.detail)}
			on:openNotes={(e) => openNotesModal(e.detail)}
			on:openEmail={(e) => openEmailModal(e.detail)}
		/>

		<!-- Pagination Controls at Bottom -->
		{#if filteredOrders.length > 0}
			<PastDuePagination
				filteredCount={filteredOrders.length}
				{currentPage}
				{itemsPerPage}
				{totalPages}
				on:previous={previousPage}
				on:next={nextPage}
				on:goToPage={(e) => goToPage(e.detail)}
				on:changeItemsPerPage={(e) => changeItemsPerPage(e.detail)}
			/>
		{/if}
	</div>

	<!-- Notes Modal -->
	<NotesModal
		show={showNotesModal}
		{selectedOrder}
		bind:newNote
		bind:outlookLink
		bind:pendingFiles={pendingNoteFiles}
		uploadError={noteUploadError}
		{notesLoading}
		on:save={saveNote}
		on:close={closeNotesModal}
	/>
	<!-- Email Modal -->
	<EmailModal showModal={showEmailModal} order={emailOrder} on:close={closeEmailModal} />
</div>

