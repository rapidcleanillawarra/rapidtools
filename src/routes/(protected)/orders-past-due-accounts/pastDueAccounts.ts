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
	emailNotifs: string;
	notes: Note[];
	noteViews: NoteView[];
	username: string;
	[key: string]: string | number | Note[] | NoteView[];
}

export type ColumnKey =
	| 'customer'
	| 'invoice'
	| 'dateIssued'
	| 'dueDate'
	| 'pdCounter'
	| 'payments'
	| 'amount'
	| 'emailNotifs'
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
	{ key: 'emailNotifs', label: 'Email Notifs' },
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
	emailNotifs: false,
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

export function getUnreadNotesCount(order: ProcessedOrder, userEmail: string | null): number {
	if (!userEmail || !order.notes.length) return 0;

	const viewedNoteIds = new Set(
		order.noteViews
			.filter(view => view.user_email === userEmail)
			.map(view => view.note_id)
	);

	return order.notes.filter(note => !viewedNoteIds.has(note.id)).length;
}

export function getLatestNotesForDisplay(order: ProcessedOrder, maxLength: number = 100): string {
	if (!order.notes.length) return '';

	// Sort notes by created_at descending to get latest first
	const sortedNotes = [...order.notes].sort((a, b) =>
		new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
	);

	// Get the latest note
	const latestNote = sortedNotes[0];
	let displayText = latestNote.note;

	// Truncate if too long
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

