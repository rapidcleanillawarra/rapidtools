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

export interface Note {
	id: string;
	order_id: string;
	note: string;
	created_by: string;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
	creator_full_name: string | null;
}

export interface ProcessedOrder {
	customer: string;
	contacts: string;
	email: string;
	invoice: string;
	dateIssued: string;
	dueDate: string;
	pdCounter: number;
	payments: string;
	amount: string;
	notes: Note[];
	username: string;
	[key: string]: string | number | Note[];
}

export type ColumnKey =
	| 'customer'
	| 'invoice'
	| 'dateIssued'
	| 'dueDate'
	| 'pdCounter'
	| 'payments'
	| 'amount'
	| 'notes';

export interface ColumnDefinition {
	key: ColumnKey;
	label: string;
}

export const columns: ColumnDefinition[] = [
	{ key: 'customer', label: 'Customer' },
	{ key: 'invoice', label: 'Invoice' },
	{ key: 'dateIssued', label: 'Date Issued' },
	{ key: 'dueDate', label: 'Due Date' },
	{ key: 'pdCounter', label: 'PD-Counter' },
	{ key: 'payments', label: 'Payments' },
	{ key: 'amount', label: 'Amount' },
	{ key: 'notes', label: 'Notes' }
];

export const defaultColumnVisibility: Record<ColumnKey, boolean> = {
	customer: true,
	invoice: true,
	dateIssued: true,
	dueDate: true,
	pdCounter: true,
	payments: true,
	amount: true,
	notes: true
};

export function parseDate(dateStr: string): number {
	const parts = dateStr.split('/');
	if (parts.length === 3) {
		return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
	}
	return 0;
}

export function getPdCounterColor(pdValue: number): string {
	if (pdValue >= 15 && pdValue <= 25) return 'text-blue-600 dark:text-blue-400';
	if (pdValue >= 26 && pdValue <= 40) return 'text-yellow-600 dark:text-yellow-400';
	if (pdValue >= 41 && pdValue <= 59) return 'text-orange-600 dark:text-orange-400';
	if (pdValue >= 60) return 'text-red-600 dark:text-red-400';
	return 'text-gray-500 dark:text-gray-400';
}

export function getPdCounterBgColor(pdValue: number): string {
	if (pdValue >= 15 && pdValue <= 25) return 'bg-blue-50 dark:bg-blue-900/20';
	if (pdValue >= 26 && pdValue <= 40) return 'bg-yellow-50 dark:bg-yellow-900/20';
	if (pdValue >= 41 && pdValue <= 59) return 'bg-orange-50 dark:bg-orange-900/20';
	if (pdValue >= 60) return 'bg-red-50 dark:bg-red-900/20';
	return '';
}

