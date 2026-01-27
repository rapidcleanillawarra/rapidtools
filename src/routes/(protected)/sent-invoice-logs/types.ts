export interface InvoiceSendLog {
	id: string;
	order_id: string;
	customer_email: string | null;
	order_details: boolean | null;
	document_id: string | null;
	pdf_path: string | null;
	pdf_exists: boolean;
	email_sent: boolean;
	created_at: string;
	email_bounced: boolean | null;
}

export type YesNoAll = 'all' | 'yes' | 'no';
export type InvoiceSendLogSortField = keyof InvoiceSendLog;

export interface InvoiceSendLogSearch {
	orderId?: string;
	customerEmail?: string;
	documentId?: string;
}

export interface InvoiceSendLogFilters {
	emailSent?: YesNoAll;
	emailBounced?: YesNoAll;
	pdfExists?: YesNoAll;
	orderDetails?: YesNoAll;
}

export interface InvoiceSendLogQuery {
	page: number;
	perPage: number;
	sortField: InvoiceSendLogSortField;
	sortDirection: 'asc' | 'desc';
	search?: InvoiceSendLogSearch;
	filters?: InvoiceSendLogFilters;
}

export interface InvoiceSendLogResult {
	data: InvoiceSendLog[];
	total: number;
}

export type InvoiceSendLogFormKey =
	| 'order_id'
	| 'customer_email'
	| 'order_details'
	| 'document_id'
	| 'pdf_path'
	| 'pdf_exists'
	| 'email_sent'
	| 'email_bounced';

export interface InvoiceSendLogFormData {
	order_id: string;
	customer_email: string;
	order_details: boolean;
	document_id: string;
	pdf_path: string;
	pdf_exists: boolean;
	email_sent: boolean;
	email_bounced: boolean;
}

export const emptyFormData: InvoiceSendLogFormData = {
	order_id: '',
	customer_email: '',
	order_details: false,
	document_id: '',
	pdf_path: '',
	pdf_exists: false,
	email_sent: false,
	email_bounced: false
};
