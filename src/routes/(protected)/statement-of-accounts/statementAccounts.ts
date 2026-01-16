import { writable } from 'svelte/store';

export interface OrderPayment {
	Amount: string;
	Id: string;
	DatePaid: string;
}

export interface Order {
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
	Email?: string;
}

export interface PaymentDetail {
	amount: number;
	datePaid: string;
	orderId: string;
}

export interface StatementAccount {
	companyName: string;
	username: string;
	totalInvoices: number;
	allInvoicesBalance: number;
	dueInvoiceBalance: number;
	totalBalanceCustomer: number | null;
	lastSent: string | null;
	lastCheck: string | null;
	lastFileGeneration: string | null;
	oneDriveId: string | null;
	payments: PaymentDetail[];
}

export type ColumnKey = 'companyName' | 'username' | 'totalInvoices' | 'allInvoicesBalance' | 'dueInvoiceBalance' | 'totalBalanceCustomer' | 'lastSent' | 'payments';

// Sorting stores
export const sortField = writable<ColumnKey | ''>('');
export const sortDirection = writable<'asc' | 'desc'>('asc');

// Column visibility stores
export const visibleColumns = writable<Record<ColumnKey, boolean>>({
	companyName: true,
	username: true,
	totalInvoices: true,
	allInvoicesBalance: true,
	dueInvoiceBalance: true,
	totalBalanceCustomer: true,
	lastSent: true,
	payments: true
});

/**
 * Gets a visual indicator for the current sort status of a column.
 */
export function getSortIcon(field: ColumnKey, currentSortField: string, direction: 'asc' | 'desc'): string {
	if (currentSortField !== field) return '↕️';
	return direction === 'asc' ? '↑' : '↓';
}

/**
 * Sorts an array of StatementAccount data based on a specified field and direction.
 */
export function sortData(
	data: StatementAccount[],
	field: ColumnKey,
	direction: 'asc' | 'desc'
): StatementAccount[] {
	return [...data].sort((a, b) => {
		let valueA: any = a[field];
		let valueB: any = b[field];

		// Handle null/undefined values
		if (valueA == null && valueB == null) return 0;
		if (valueA == null) return direction === 'asc' ? -1 : 1;
		if (valueB == null) return direction === 'asc' ? 1 : -1;

		// Handle different data types
		if (typeof valueA === 'number' && typeof valueB === 'number') {
			return direction === 'asc' ? valueA - valueB : valueB - valueA;
		}

		if (typeof valueA === 'string' && typeof valueB === 'string') {
			const comparison = valueA.toLowerCase().localeCompare(valueB.toLowerCase());
			return direction === 'asc' ? comparison : -comparison;
		}

		// Handle date strings
		if (field === 'lastSent' && typeof valueA === 'string' && typeof valueB === 'string') {
			const dateA = new Date(valueA);
			const dateB = new Date(valueB);
			if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
				return direction === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
			}
		}

		// Default to string comparison
		const strA = String(valueA).toLowerCase();
		const strB = String(valueB).toLowerCase();
		const comparison = strA.localeCompare(strB);
		return direction === 'asc' ? comparison : -comparison;
	});
}

/**
 * Calculates the outstanding amount for an order
 */
export function calculateOutstandingAmount(order: Order): number {
	let outstandingAmount = parseFloat(order.GrandTotal);
	if (order.OrderPayment && order.OrderPayment.length > 0) {
		order.OrderPayment.forEach((payment) => {
			outstandingAmount -= parseFloat(payment.Amount);
		});
	}
	return outstandingAmount;
}

/**
 * Gets the customer name from an order (BillCompany if available, otherwise First + Last Name)
 */
export function getCustomerName(order: Order): string {
	return order.BillCompany || `${order.BillFirstName} ${order.BillLastName}`;
}

/**
 * Aggregates orders by username, calculating total invoices and grand total
 */
export function aggregateByUsername(orders: Order[]): StatementAccount[] {
	const usernameMap = new Map<string, { totalInvoices: number; companyName: string; payments: PaymentDetail[] }>();

	// Process each order
	orders.forEach((order) => {
		const outstandingAmount = calculateOutstandingAmount(order);

		// Skip orders with no outstanding amount
		if (outstandingAmount <= 0.01) {
			return;
		}

		const companyName = getCustomerName(order);

		if (!usernameMap.has(order.Username)) {
			usernameMap.set(order.Username, { totalInvoices: 0, companyName, payments: [] });
		}

		const userData = usernameMap.get(order.Username)!;
		userData.totalInvoices += 1;

		// Collect payment details
		if (order.OrderPayment && order.OrderPayment.length > 0) {
			order.OrderPayment.forEach((payment) => {
				userData.payments.push({
					amount: parseFloat(payment.Amount),
					datePaid: payment.DatePaid,
					orderId: order.OrderID
				});
			});
		}

		// Ensure company name is set if it wasn't before (though it should be set on creation)
		if (!userData.companyName && companyName) {
			userData.companyName = companyName;
		}
	});

	// Convert map to array
	return Array.from(usernameMap.entries()).map(([username, data]) => ({
		username,
		companyName: data.companyName,
		totalInvoices: data.totalInvoices,
		allInvoicesBalance: 0, // Not available in legacy aggregation
		dueInvoiceBalance: 0, // Not available in legacy aggregation
		totalBalanceCustomer: null, // Not available in legacy aggregation
		lastSent: null,
		lastCheck: null,
		lastFileGeneration: null,
		oneDriveId: null,
		payments: data.payments
	}));
}