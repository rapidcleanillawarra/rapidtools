import { supabase } from '$lib/supabase';
import type { ProcessedOrder, Ticket } from './pastDueAccounts';

/**
 * Fetches tickets for the given orders from the database
 * 
 * This function queries the tickets table for tickets belonging to the 
 * 'Past Due Accounts' module and maps them to their corresponding orders
 * based on the order_id stored in ticket_data.
 * 
 * @param orders - Array of processed orders to fetch tickets for
 * @returns Promise containing the orders array with tickets populated
 */
export async function fetchTicketsForOrders(
    orders: ProcessedOrder[]
): Promise<ProcessedOrder[]> {
    if (orders.length === 0) {
        return orders;
    }

    try {
        const invoiceIds = orders.map((order) => order.invoice);

        // Fetch all active tickets for the Past Due Accounts module
        // Note: We fetch by module since ticket_data is JSONB and Supabase
        // doesn't efficiently support 'IN' queries on JSONB fields
        const { data, error } = await supabase
            .from('tickets')
            .select(
                'ticket_number, ticket_title, status, priority, assigned_to, created_at, ticket_data'
            )
            .eq('module', 'Past Due Accounts')
            .neq('status', 'Closed');

        if (error) {
            console.error('Error fetching tickets:', error);
            return orders;
        }

        const tickets = data || [];

        // Map tickets to orders based on order_id in ticket_data
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

        // Update orders with their tickets
        return orders.map((order) => ({
            ...order,
            tickets: ticketsByOrder[order.invoice] || []
        }));
    } catch (error) {
        console.error('Error in fetchTicketsForOrders:', error);
        return orders;
    }
}

/**
 * Returns the count of active (non-closed) tickets for an order
 * 
 * @param order - The processed order to count tickets for
 * @returns Number of active tickets
 */
export function getActiveTicketCount(order: ProcessedOrder): number {
    return order.tickets.filter((t) => t.status !== 'Closed').length;
}

/**
 * Returns a summary of tickets for display in the UI
 * 
 * @param order - The processed order to summarize tickets for
 * @returns String summary like "2 tickets" or "No tickets"
 */
export function getTicketsSummary(order: ProcessedOrder): string {
    const total = order.tickets.length;
    if (total === 0) return 'No tickets';
    if (total === 1) return '1 ticket';
    return `${total} tickets`;
}

/**
 * Groups tickets by their status for display purposes
 * 
 * @param tickets - Array of tickets to group
 * @returns Object with status as key and array of tickets as value
 */
export function groupTicketsByStatus(
    tickets: Ticket[]
): Record<string, Ticket[]> {
    return tickets.reduce(
        (acc, ticket) => {
            const status = ticket.status || 'Unknown';
            if (!acc[status]) {
                acc[status] = [];
            }
            acc[status].push(ticket);
            return acc;
        },
        {} as Record<string, Ticket[]>
    );
}

/**
 * Gets the priority badge color class for a ticket priority
 * 
 * @param priority - The ticket priority (Low, Medium, High, Critical)
 * @returns Tailwind CSS classes for the badge
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
 * Gets the status badge color class for a ticket status
 * 
 * @param status - The ticket status (Open, In Progress, Resolved, Closed)
 * @returns Tailwind CSS classes for the badge
 */
export function getTicketStatusColor(status: string): string {
    switch (status?.toLowerCase()) {
        case 'open':
            return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
        case 'in progress':
            return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
        case 'resolved':
            return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
        case 'closed':
            return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
        default:
            return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
}
