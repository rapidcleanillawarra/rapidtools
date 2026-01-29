import { supabase } from '$lib/supabase';
import { currentUser } from '$lib/firebase';
import { get } from 'svelte/store';

// Ticket interface matching the database schema
export interface Ticket {
	id: string;
	ticket_number: number;
	ticket_title: string;
	ticket_description: string | null;
	module: string;
	status: string;
	priority: string;
	assigned_to: string | null;
	assigned_by: string;
	created_at: string;
	due_date: string | null;
	notes: string | null;
	ticket_data: any;
	updated_at: string | null;
	deleted_at: string | null;
	deleted_by: string | null;
}

// Ticket filters interface
export interface TicketFilters {
	search: string;
	status: string[];
	priority: string[];
	module: string[];
	assignedTo: string[];
	dateRange: {
		from: string | null;
		to: string | null;
	};
	createdDateRange: {
		from: string | null;
		to: string | null;
	};
}

// Ticket creation data
export interface CreateTicketData {
	module: string;
	ticket_title: string;
	ticket_description?: string;
	priority: string;
	assigned_to?: string;
	due_date?: string;
	notes?: string;
	ticket_data?: any;
}

// Ticket update data
export interface UpdateTicketData {
	ticket_title?: string;
	ticket_description?: string | null;
	status?: string;
	priority?: string;
	assigned_to?: string | null;
	due_date?: string | null;
	notes?: string | null;
}

/**
 * Fetches all tickets from the database with optional filtering
 */
export async function fetchAllTickets(filters?: Partial<TicketFilters>): Promise<Ticket[]> {
	try {
		let query = supabase
			.from('tickets')
			.select('*')
			.is('deleted_at', null)
			.order('created_at', { ascending: false });

		// Apply filters if provided
		if (filters) {
			if (filters.search && filters.search.trim()) {
				const searchTerm = `%${filters.search.trim()}%`;
				query = query.or(`ticket_title.ilike.${searchTerm},ticket_description.ilike.${searchTerm},ticket_number::text.ilike.${searchTerm}`);
			}

			if (filters.status && filters.status.length > 0) {
				query = query.in('status', filters.status);
			}

			if (filters.priority && filters.priority.length > 0) {
				query = query.in('priority', filters.priority);
			}

			if (filters.module && filters.module.length > 0) {
				query = query.in('module', filters.module);
			}

			if (filters.assignedTo && filters.assignedTo.length > 0) {
				query = query.in('assigned_to', filters.assignedTo);
			}

			if (filters.dateRange?.from) {
				query = query.gte('due_date', filters.dateRange.from);
			}

			if (filters.dateRange?.to) {
				query = query.lte('due_date', filters.dateRange.to);
			}

			if (filters.createdDateRange?.from) {
				query = query.gte('created_at', filters.createdDateRange.from);
			}

			if (filters.createdDateRange?.to) {
				query = query.lte('created_at', filters.createdDateRange.to);
			}
		}

		const { data, error } = await query;

		if (error) {
			console.error('Error fetching tickets:', error);
			throw error;
		}

		// Return the data as-is for now
		return data || [];
	} catch (error) {
		console.error('Error in fetchAllTickets:', error);
		throw error;
	}
}

/**
 * Creates a new ticket
 */
export async function createTicket(ticketData: CreateTicketData): Promise<Ticket> {
	try {
		const user = get(currentUser);
		if (!user?.email) {
			throw new Error('User not authenticated');
		}

		// Get the next ticket number from the counter
		const { data: counterData, error: counterError } = await supabase.rpc('get_next_ticket_number');

		if (counterError) {
			console.error('Error getting ticket number:', counterError);
			throw counterError;
		}

		const ticketNumber = counterData;

		const insertData = {
			ticket_number: ticketNumber,
			module: ticketData.module,
			ticket_title: ticketData.ticket_title,
			ticket_description: ticketData.ticket_description || null,
			priority: ticketData.priority,
			status: 'Not Started',
			assigned_to: ticketData.assigned_to || null,
			assigned_by: user.email,
			due_date: ticketData.due_date || null,
			notes: ticketData.notes || null,
			ticket_data: ticketData.ticket_data || {},
		};

		const { data, error } = await supabase
			.from('tickets')
			.insert(insertData)
			.select('*')
			.single();

		if (error) {
			console.error('Error creating ticket:', error);
			throw error;
		}

		return data;
	} catch (error) {
		console.error('Error in createTicket:', error);
		throw error;
	}
}

/**
 * Updates an existing ticket
 */
export async function updateTicket(ticketNumber: number, updates: UpdateTicketData): Promise<Ticket> {
	try {
		const { data, error } = await supabase
			.from('tickets')
			.update({
				...updates,
				updated_at: new Date().toISOString(),
			})
			.eq('ticket_number', ticketNumber)
			.select('*')
			.single();

		if (error) {
			console.error('Error updating ticket:', error);
			throw error;
		}

		return data;
	} catch (error) {
		console.error('Error in updateTicket:', error);
		throw error;
	}
}

/**
 * Soft deletes a ticket
 */
export async function deleteTicket(ticketNumber: number): Promise<void> {
	try {
		const user = get(currentUser);
		if (!user?.email) {
			throw new Error('User not authenticated');
		}

		const { error } = await supabase
			.from('tickets')
			.update({
				deleted_at: new Date().toISOString(),
				deleted_by: user.email,
				status: 'Closed',
			})
			.eq('ticket_number', ticketNumber);

		if (error) {
			console.error('Error deleting ticket:', error);
			throw error;
		}
	} catch (error) {
		console.error('Error in deleteTicket:', error);
		throw error;
	}
}

/**
 * Gets all available modules from existing tickets
 */
export async function getAvailableModules(): Promise<string[]> {
	try {
		const { data, error } = await supabase
			.from('tickets')
			.select('module')
			.is('deleted_at', null);

		if (error) {
			console.error('Error fetching modules:', error);
			return [];
		}

		const modules = [...new Set(data.map(ticket => ticket.module))];
		return modules.sort();
	} catch (error) {
		console.error('Error in getAvailableModules:', error);
		return [];
	}
}

/**
 * Gets all available users for assignment
 */
export async function getAvailableUsers(): Promise<{ email: string; full_name: string }[]> {
	try {
		const { data, error } = await supabase
			.from('users')
			.select('email, full_name')
			.order('full_name', { ascending: true });

		if (error) {
			console.error('Error fetching users:', error);
			return [];
		}

		return data || [];
	} catch (error) {
		console.error('Error in getAvailableUsers:', error);
		return [];
	}
}

/**
 * Gets the priority badge color class
 */
export function getTicketPriorityColor(priority: string): string {
	switch (priority?.toLowerCase()) {
		case 'critical':
			return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
		case 'high':
			return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
		case 'medium':
			return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
		case 'low':
			return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
		default:
			return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
	}
}

/**
 * Gets the status badge color class
 */
export function getTicketStatusColor(status: string): string {
	switch (status?.toLowerCase()) {
		case 'not started':
			return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
		case 'in progress':
			return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
		case 'on hold':
			return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
		case 'completed':
			return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
		case 'closed':
			return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
		default:
			return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
	}
}

/**
 * Generates a ticket number (for reference, actual generation is handled by database)
 */
export function generateTicketNumber(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	return `${year}${month}${day}001`; // This is just for display, actual number comes from DB
}