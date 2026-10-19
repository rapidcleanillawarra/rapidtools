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

export interface NoteView {
	note_id: string;
	user_email: string;
	viewed_at: string;
}

export interface Ticket {
	id: string;
	ticket_number: number;
	ticket_title: string;
	ticket_description?: string | null;
	status: string;
	priority: string;
	assigned_to: string | null;
	created_at: string;
	due_date?: string | null;
	notes?: string | null;
	ticket_data: any;
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
	invoiceAmount: string;
	amount: string;
	assignedTo: string;
	followUp: string;
	notes: Note[];
	noteViews: NoteView[];
	username: string;
	tickets: Ticket[]; // Changed from string to Ticket[]
	[key: string]: string | number | Note[] | NoteView[] | Ticket[] | string[] | undefined;
}

export type ColumnKey =
	| 'customer'
	| 'invoice'
	| 'dateIssued'
	| 'dueDate'
	| 'pdCounter'
	| 'payments'
	| 'invoiceAmount'
	| 'amount'
	| 'assignedTo'
	| 'followUp'
	| 'username'
	| 'notes';

export interface ColumnDefinition {
	key: ColumnKey;
	label: string;
}

export const columns: ColumnDefinition[] = [
	{ key: 'customer', label: 'Customer' },
	{ key: 'invoice', label: 'Invoice' },
	{ key: 'pdCounter', label: 'PD counter' },
	{ key: 'payments', label: 'Payments' },
	{ key: 'invoiceAmount', label: 'Invoice amount' },
	{ key: 'amount', label: 'Balance due' },
	{ key: 'notes', label: 'Latest note' },
	{ key: 'dateIssued', label: 'Date Issued' },
	{ key: 'dueDate', label: 'Due Date' },
	{ key: 'assignedTo', label: 'Assigned To' },
	{ key: 'followUp', label: 'Follow Up' },
	{ key: 'username', label: 'Username' }
];

export const defaultColumnVisibility: Record<ColumnKey, boolean> = {
	customer: true,
	invoice: true,
	pdCounter: true,
	payments: true,
	invoiceAmount: true,
	amount: true,
	notes: true,
	dateIssued: false,
	dueDate: false,
	assignedTo: false,
	followUp: false,
	username: false
};

export function parseDate(dateStr: string): number {
	const parts = dateStr.split('/');
	if (parts.length === 3) {
		return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
	}
	return 0;
}

export function getPdCounterColor(pdValue: number): string {
	if (pdValue >= 15 && pdValue <= 25) return 'text-blue-400';
	if (pdValue >= 26 && pdValue <= 40) return 'text-yellow-400';
	if (pdValue >= 41 && pdValue <= 59) return 'text-orange-400';
	if (pdValue >= 60) return 'text-red-400';
	return 'text-gray-400';
}

export function getPdCounterBgColor(pdValue: number): string {
	if (pdValue >= 15 && pdValue <= 25) return 'bg-blue-950/30 border border-blue-500/30';
	if (pdValue >= 26 && pdValue <= 40) return 'bg-yellow-950/30 border border-yellow-500/30';
	if (pdValue >= 41 && pdValue <= 59) return 'bg-orange-950/30 border border-orange-500/30';
	if (pdValue >= 60) return 'bg-red-950/30 border border-red-500/30';
	return 'bg-gray-900/40 border border-gray-700/40';
}

export function getUnreadNotesCount(order: ProcessedOrder, userEmail: string | null): number {
	if (!userEmail || !order.notes.length) return 0;

	const viewedNoteIds = new Set(
		order.noteViews
			.filter(view => view.user_email === userEmail)
			.map(view => view.note_id)
	);

	return order.notes.filter(note => !viewedNoteIds.has(note.id)).length;
}

export function getLatestNote(order: ProcessedOrder): Note | null {
	if (!order.notes.length) return null;
	const sortedNotes = [...order.notes].sort((a, b) =>
		new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
	);
	return sortedNotes[0];
}

export function getLatestNotesForDisplay(order: ProcessedOrder, maxLength: number = 100): string {
	const latestNote = getLatestNote(order);
	if (!latestNote) return '';
	let displayText = latestNote.note;
	if (displayText.length > maxLength) {
		displayText = displayText.substring(0, maxLength) + '...';
	}
	return displayText;
}

export function getNotesSummary(order: ProcessedOrder): string {
	const totalNotes = order.notes.length;
	if (totalNotes === 0) return 'No notes';
	if (totalNotes === 1) return '1 note';
	return `${totalNotes} notes`;
}

export function formatShortDate(dateStr: string): string {
	if (!dateStr) return '';
	const date = new Date(dateStr);
	if (isNaN(date.getTime())) return dateStr;
	return date.toLocaleDateString('en-GB', {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});
}
