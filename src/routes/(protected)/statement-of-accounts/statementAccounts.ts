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
	customerName: string;
	username: string;
	totalInvoices: number;
	balance: number;
	grandTotal: number;
	lastSent: string | null;
	lastCheck: string | null;
	lastFileGeneration: string | null;
	oneDriveId: string | null;
	payments: PaymentDetail[];
}

export type ColumnKey = 'customerName' | 'username' | 'totalInvoices' | 'balance' | 'grandTotal' | 'lastSent' | 'payments';

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
	const usernameMap = new Map<string, { totalInvoices: number; balance: number; grandTotal: number; customerName: string; payments: PaymentDetail[] }>();

	// Process each order
	orders.forEach((order) => {
		const outstandingAmount = calculateOutstandingAmount(order);

		// Skip orders with no outstanding amount
		if (outstandingAmount <= 0.01) {
			return;
		}

		const customerName = getCustomerName(order);

		if (!usernameMap.has(order.Username)) {
			usernameMap.set(order.Username, { totalInvoices: 0, balance: 0, grandTotal: 0, customerName, payments: [] });
		}

		const userData = usernameMap.get(order.Username)!;
		userData.totalInvoices += 1;
		userData.balance += outstandingAmount;
		userData.grandTotal += parseFloat(order.GrandTotal);

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

		// Ensure customer name is set if it wasn't before (though it should be set on creation)
		if (!userData.customerName && customerName) {
			userData.customerName = customerName;
		}
	});

	// Convert map to array
	return Array.from(usernameMap.entries()).map(([username, data]) => ({
		username,
		customerName: data.customerName,
		totalInvoices: data.totalInvoices,
		balance: Math.round(data.balance * 100) / 100, // Round to 2 decimal places
		grandTotal: Math.round(data.grandTotal * 100) / 100, // Round to 2 decimal places
		lastSent: null,
		lastCheck: null,
		lastFileGeneration: null,
		oneDriveId: null,
		payments: data.payments
	}));
}