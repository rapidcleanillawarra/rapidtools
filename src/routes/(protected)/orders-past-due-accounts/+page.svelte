<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { currentUser } from '$lib/firebase';
	import { userProfile, type UserProfile } from '$lib/userProfile';
	import {
		columns,
		defaultColumnVisibility,
		parseDate,
		type ColumnKey,
		type Note,
		type NoteView,
		type Order,
		type ProcessedOrder,
		type EmailConversation
	} from './pastDueAccounts';
	import PastDueLegend from './components/PastDueLegend.svelte';
	import PastDueToolbar from './components/PastDueToolbar.svelte';
	import ColumnVisibilityPills from './components/ColumnVisibilityPills.svelte';
	import PastDueOrdersTable from './components/PastDueOrdersTable.svelte';
	import PastDuePagination from './components/PastDuePagination.svelte';
	import NotesModal from './components/NotesModal.svelte';
	import EmailModal from './components/EmailModal.svelte';
	import TicketModal from './components/TicketModal.svelte';
	import ViewTicketsModal from './components/ViewTicketsModal.svelte';
	import type { Ticket } from './pastDueAccounts';

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
	let filteredOrders: ProcessedOrder[] = [];

	// PD Counter Filter State
	let pdFilterOperator = '>';
	let pdFilterValue: number | null = 30;
	let initialized = false;

	// Temporary PD Counter Filter State (for inputs)
	let tempPdFilterOperator = pdFilterOperator;
	let tempPdFilterValue: number | null = pdFilterValue;

	// UI Toggle States
	let showLegend = false;
	let showColumnVisibility = false;

	// Pagination State
	let currentPage = 1;
	let itemsPerPage = 25;
	let totalPages = 1;

	// Notes Modal State
	let showNotesModal = false;
	let selectedOrder: ProcessedOrder | null = null;
	let newNote = '';
	let notesLoading = false;

	// Email Modal State
	let showEmailModal = false;
	let emailOrder: ProcessedOrder | null = null;

	// Ticket Modal State
	let showTicketModal = false;
	let ticketOrder: ProcessedOrder | null = null;
	let showViewTicketsModal = false;
	let selectedTicketsOrder: ProcessedOrder | null = null;

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
			// TODO: Fetch users from your user management system/database
			// For now, using a placeholder that could be replaced with actual API call
			const { data, error } = await supabase
				.from('users')
				.select('full_name')
				.order('full_name', { ascending: true });

			if (error) {
				console.error('Error fetching users:', error);
				// Keep default users if fetch fails
			} else if (data) {
				availableUsers = data.map((user) => user.full_name).filter(Boolean);
			}
		} catch (error) {
			console.error('Error in fetchAvailableUsers:', error);
		}
	}

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
				const invoiceTrackingRecords: {
					order_id: string;
					does_exists: boolean;
					completed: boolean;
				}[] = [];

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
						amount: outstandingAmount.toFixed(2),
						emailNotifs: '', // Will be populated from tracking data
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
				});

				invoiceTrackingRecords.push(
					...trackingOrders.map((order) => ({
						order_id: order.invoice,
						does_exists: true,
						completed: false // Will be processed/displayed in the UI
					}))
				);

				// Save invoice tracking records to Supabase
				if (invoiceTrackingRecords.length > 0) {
					console.log(`Synchronizing ${invoiceTrackingRecords.length} orders to orders_past_due_accounts_invoice_tracking table`);
					try {
						const { error: trackingError } = await supabase
							.from('orders_past_due_accounts_invoice_tracking')
							.upsert(invoiceTrackingRecords, { onConflict: 'order_id' });

						if (trackingError) {
							console.error('Failed to save invoice tracking records:', trackingError);
						}
					} catch (trackingErr) {
						console.error('Error saving invoice tracking records:', trackingErr);
					}
				}

				// Mark order_ids that no longer exist in API response as completed
				if (data.Order && data.Order.length > 0) {
					try {
						// Get all order_ids from current API response
						const currentOrderIds = data.Order.map((order: Order) => order.ID);

						// Get all order_ids that exist in tracking table
						const { data: allTrackingRecords, error: fetchError } = await supabase
							.from('orders_past_due_accounts_invoice_tracking')
							.select('order_id')
							.eq('completed', false); // Only check records that aren't already completed

						if (fetchError) {
							console.error('Error fetching tracking records:', fetchError);
						} else if (allTrackingRecords) {
							// Find order_ids that exist in tracking table but not in current API response
							const trackedOrderIds = allTrackingRecords.map((record) => record.order_id);
							const missingOrderIds = trackedOrderIds.filter(
								(id: string) => !currentOrderIds.includes(id)
							);

							// Mark missing order_ids as completed (they've been resolved externally)
							if (missingOrderIds.length > 0) {
								const { error: updateError } = await supabase
									.from('orders_past_due_accounts_invoice_tracking')
									.update({ completed: true, updated_at: new Date().toISOString() })
									.in('order_id', missingOrderIds);

								if (updateError) {
									console.error('Error marking missing orders as completed:', updateError);
								}
							}
						}
					} catch (missingErr) {
						console.error('Error processing missing orders:', missingErr);
					}
				}
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'An unknown error occurred';
			console.error(e);
		} finally {
			loading = false;
		}

		// Fetch notes and views for all orders (in parallel)
		if (orders.length > 0) {
			await fetchNotesAndViews();
			await fetchEmailTrackingStatus();
			await fetchEmailConversations();
			await fetchAssignments();
			await fetchTickets();
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

			// Handle errors
			if (notesResult.error) {
				console.error('Error fetching notes:', notesResult.error);
				return;
			}

			// Process the notes data
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

			// Create a map of note_id -> order_id for quick lookup
			const noteIdToOrderId = new Map<string, string>();
			notes.forEach((note) => {
				noteIdToOrderId.set(note.id, note.order_id);
			});

			// Group note views by order_id
			allNoteViews.forEach((view) => {
				const orderId = noteIdToOrderId.get(view.note_id);
				if (orderId) {
					if (!noteViewsByOrderId[orderId]) {
						noteViewsByOrderId[orderId] = [];
					}
					noteViewsByOrderId[orderId].push(view);
				}
			});

			// Single update to orders array with both notes and noteViews
			orders = orders.map((order) => ({
				...order,
				notes: notesByOrderId[order.invoice] || [],
				noteViews: noteViewsByOrderId[order.invoice] || []
			}));
		} catch (error) {
			console.error('Error fetching notes and views:', error);
		}
	}

	async function fetchEmailTrackingStatus() {
		try {
			const invoiceIds = orders.map((order) => order.invoice);

			// Fetch email tracking status for all invoices
			const { data: trackingData, error } = await supabase
				.from('orders_past_due_accounts_invoice_tracking')
				.select('order_id, email_initialized')
				.in('order_id', invoiceIds);

			if (error) {
				console.error('Error fetching email tracking status:', error);
				return;
			}

			// Create a map of order_id to email_initialized status
			const trackingMap: Record<string, boolean> = {};
			if (trackingData) {
				trackingData.forEach((record) => {
					trackingMap[record.order_id] = record.email_initialized || false;
				});
			}

			// Update orders with email tracking status
			orders = orders.map((order) => ({
				...order,
				emailNotifs: trackingMap[order.invoice] ? '✓' : ''
			}));
		} catch (error) {
			console.error('Error in fetchEmailTrackingStatus:', error);
		}
	}

	async function fetchEmailConversations() {
		try {
			// 1. Query Supabase for order_ids with email_initialized=true and completed=false
			const { data: trackingRecords, error } = await supabase
				.from('orders_past_due_accounts_invoice_tracking')
				.select('order_id')
				.eq('completed', false)
				.eq('email_initialized', true);

			if (error) {
				console.error('Error fetching tracking records:', error);
				return;
			}

			if (!trackingRecords || trackingRecords.length === 0) {
				return; // No orders to fetch conversations for
			}

			const orderIds = trackingRecords.map((record) => record.order_id);

			// 2. Call Power Automate endpoint
			const response = await fetch(
				'https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/c464173437d741278f6f8932654e1550/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=NtiA92yZ4QU7KRsr7SbDddjYU4_UrTe9gknJb8OGToA',
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ order_ids: orderIds })
				}
			);

			if (!response.ok) {
				console.error('Failed to fetch email conversations');
				return;
			}

			const conversations = await response.json();

			// 3. Update orders with email conversations
			orders = orders.map((order) => {
				const orderConversations = conversations.filter(
					(conv: EmailConversation) => conv.order_id === order.invoice && conv.has_value === 'true'
				);
				return {
					...order,
					emailConversations: orderConversations
				};
			});
		} catch (error) {
			console.error('Error fetching email conversations:', error);
		}
	}

	async function fetchAssignments() {
		try {
			const invoiceIds = orders.map((order) => order.invoice);

			// Fetch assignments for all orders
			const { data: assignmentsData, error } = await supabase
				.from('orders_past_due_accounts_assignments')
				.select('order_id, assigned_to, follow_up_date')
				.in('order_id', invoiceIds);

			if (error) {
				console.error('Error fetching assignments:', error);
				return;
			}

			// Create a map of order_id to assignment data
			const assignmentsMap: Record<string, { assigned_to: string; follow_up_date: string }> = {};
			if (assignmentsData) {
				assignmentsData.forEach((assignment) => {
					assignmentsMap[assignment.order_id] = {
						assigned_to: assignment.assigned_to || '',
						follow_up_date: assignment.follow_up_date || ''
					};
				});
			}

			// Update orders with assignment data
			orders = orders.map((order) => ({
				...order,
				assignedTo: assignmentsMap[order.invoice]?.assigned_to || '',
				followUp: assignmentsMap[order.invoice]?.follow_up_date || ''
			}));
		} catch (error) {
			console.error('Error in fetchAssignments:', error);
		}
	}

	async function fetchTickets() {
		try {
			const invoiceIds = orders.map((order) => order.invoice);

			// We need to query tickets where ticket_data->>order_id is in our invoice list
			// Supabase postgrest doesn't support 'in' on JSONB fields directly in all versions well,
			// but we can try filtering locally or using a specific RPC if needed.
			// For now, let's try fetching all tickets that have order_id in their data.
			// A better way if efficient indexing is needed is to store order_id in a separate column.
			// Assuming ticket_data is a jsonb column.

			// Strategy: Fetch tickets that MIGHT match (e.g., all tickets for 'Past Due Accounts' module)
			// and filter in memory, OR if list is small.
			// Actually, we can use the containment operator @> if we construct the query right,
			// but for a list of IDs it's hard.

			// Let's fetch all active tickets for this module and map them.
			// This might scale poorly if there are thousands of tickets.
			// A better approach would be to have a dedicated `order_id` column on tickets table.
			// Given I cannot change schema easily here without permissions check, I will fetch tickets based on module.

			const { data, error } = await supabase
				.from('tickets')
				.select(
					'ticket_number, ticket_title, status, priority, assigned_to, created_at, ticket_data'
				)
				.eq('module', 'Past Due Accounts')
				.neq('status', 'Closed'); // Assuming we want active tickets, or maybe all? User said "view tickets", implied existing.

			if (error) {
				console.error('Error fetching tickets:', error);
				return;
			}

			const tickets = data || [];

			// Map tickets to orders
			const ticketsByOrder: Record<string, Ticket[]> = {};

			tickets.forEach((t: any) => {
				const orderId = t.ticket_data?.order_id;
				if (orderId && invoiceIds.includes(orderId)) {
					if (!ticketsByOrder[orderId]) {
						ticketsByOrder[orderId] = [];
					}
					ticketsByOrder[orderId].push(t);
				}
			});

			// Update orders
			orders = orders.map((order) => ({
				...order,
				tickets: ticketsByOrder[order.invoice] || []
			}));
		} catch (error) {
			console.error('Error in fetchTickets:', error);
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

				// Refresh all notes and views to include the new note's view record
				await fetchNotesAndViews();

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

	async function openEmailModal(order: ProcessedOrder) {
		emailOrder = order;
		showEmailModal = true;
	}

	function closeEmailModal() {
		showEmailModal = false;
		emailOrder = null;
	}

	async function openTicketModal(order: ProcessedOrder) {
		ticketOrder = order;
		showTicketModal = true;
	}

	function closeTicketModal() {
		showTicketModal = false;
		ticketOrder = null;
		// If we came from ViewTicketsModal, reopen it to show the new ticket
		if (selectedTicketsOrder) {
			// Re-fetch tickets to update the list
			fetchTickets().then(() => {
				// The order object in selectedTicketsOrder might be stale, update it
				const updatedOrder = orders.find((o) => o.invoice === selectedTicketsOrder!.invoice);
				if (updatedOrder) {
					selectedTicketsOrder = updatedOrder;
					showViewTicketsModal = true;
				}
			});
		}
	}

	function openViewTicketsModal(order: ProcessedOrder) {
		selectedTicketsOrder = order;
		showViewTicketsModal = true;
	}

	function closeViewTicketsModal() {
		showViewTicketsModal = false;
		selectedTicketsOrder = null;
	}

	function handleCreateTicketFromView(event: CustomEvent<ProcessedOrder>) {
		closeViewTicketsModal();
		// Keep selectedTicketsOrder set so we know to reopen it
		openTicketModal(event.detail);
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
		currentPage = 1; // Reset to first page when changing items per page
	}

	async function manualTriggerTracking() {
		try {
			await fetchOrders();
		} catch (error) {
			console.error('Error manually triggering tracking:', error);
			error = 'Failed to manually trigger tracking';
		}
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

	// Log count of displayed orders (only after data is loaded)
	$: if (!loading && orders.length > 0) {
		console.log(`Displayed orders count: ${filteredOrders.length}`);
	}

	// Pagination logic
	$: totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
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

			// Load UI toggle preferences (default to false)
			showLegend = storedShowLegend === 'true';
			showColumnVisibility = storedShowColumnVisibility === 'true';

			// Load pagination preferences
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

<div class="px-4 sm:px-6 lg:px-8">
	<!-- Header -->
	<div class="mb-4">
		<h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Past Due Accounts</h1>
		<p class="mt-2 text-sm text-gray-700 dark:text-gray-400">A list of all past due accounts.</p>
	</div>

	<PastDueToolbar
		bind:operator={tempPdFilterOperator}
		bind:value={tempPdFilterValue}
		bind:showLegend
		bind:showColumnVisibility
		disableActions={filteredOrders.length === 0}
		on:apply={applyPdFilter}
		on:exportCsv={exportToCSV}
		on:print={printTable}
		on:manualTrigger={manualTriggerTracking}
	/>

	<!-- Collapsible Legend Section -->
	{#if showLegend}
		<div class="animate-in fade-in slide-in-from-top-2 mt-4 duration-200">
			<PastDueLegend />
		</div>
	{/if}

	<!-- Collapsible Column Visibility Section -->
	{#if showColumnVisibility}
		<div class="animate-in fade-in slide-in-from-top-2 mt-4 duration-200">
			<ColumnVisibilityPills
				{columns}
				{columnVisibility}
				on:toggle={(e) => toggleColumnVisibility(e.detail.key)}
			/>
		</div>
	{/if}

	<!-- Pagination Controls -->
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

	<!-- Orders Table -->
	<PastDueOrdersTable
		{loading}
		{error}
		{paginatedOrders}
		{nonCustomerColumns}
		{searchFilters}
		{sortField}
		{sortDirection}
		filteredCount={filteredOrders.length}
		userEmail={user?.email || null}
		on:sort={(e) => handleSort(e.detail)}
		on:searchChange={(e) => handleSearchChange(e.detail.key, e.detail.value)}
		on:openNotes={(e) => openNotesModal(e.detail)}
		on:openEmail={(e) => openEmailModal(e.detail)}
		on:openTicket={(e) => openTicketModal(e.detail)}
		on:openViewTickets={(e) => openViewTicketsModal(e.detail)}
	/>
	<!-- Notes Modal -->
	<NotesModal
		show={showNotesModal}
		{selectedOrder}
		bind:newNote
		{notesLoading}
		on:save={saveNote}
		on:close={closeNotesModal}
	/>
	<!-- Email Modal -->
	<EmailModal showModal={showEmailModal} order={emailOrder} on:close={closeEmailModal} />

	<!-- Ticket Modal -->
	<TicketModal showModal={showTicketModal} order={ticketOrder} on:close={closeTicketModal} />

	<!-- View Tickets Modal -->
	<ViewTicketsModal
		showModal={showViewTicketsModal}
		order={selectedTicketsOrder}
		tickets={selectedTicketsOrder ? selectedTicketsOrder.tickets : []}
		on:close={closeViewTicketsModal}
		on:createTicket={handleCreateTicketFromView}
	/>
</div>
