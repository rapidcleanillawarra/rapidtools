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

export interface StatementAccount {
	customer: string;
	username: string;
	totalInvoices: number;
	grandTotal: number;
	lastSent: string | null;
	nextSchedule: string | null;
}

export type ColumnKey = 'customer' | 'totalInvoices' | 'grandTotal' | 'lastSent' | 'nextSchedule';

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
 * Aggregates orders by customer, calculating total invoices and grand total
 */
export function aggregateByCustomer(orders: Order[]): StatementAccount[] {
	const customerMap = new Map<string, { totalInvoices: number; grandTotal: number; username: string }>();

	// Process each order
	orders.forEach((order) => {
		const outstandingAmount = calculateOutstandingAmount(order);

		// Skip orders with no outstanding amount
		if (outstandingAmount <= 0.01) {
			return;
		}

		const customerName = getCustomerName(order);

		if (!customerMap.has(customerName)) {
			customerMap.set(customerName, { totalInvoices: 0, grandTotal: 0, username: order.Username });
		}

		const customerData = customerMap.get(customerName)!;
		customerData.totalInvoices += 1;
		customerData.grandTotal += outstandingAmount;

		// Ensure username is set if it wasn't before (though it should be set on creation)
		if (!customerData.username && order.Username) {
			customerData.username = order.Username;
		}
	});

	// Convert map to array
	return Array.from(customerMap.entries()).map(([customer, data]) => ({
		customer,
		username: data.username,
		totalInvoices: data.totalInvoices,
		grandTotal: Math.round(data.grandTotal * 100) / 100, // Round to 2 decimal places
		lastSent: null, // TODO: Implement from Supabase tracking or another source
		nextSchedule: null // TODO: Implement from Supabase tracking or another source
	}));
}