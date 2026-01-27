import { supabase } from '$lib/supabase';
import type { InvoiceSendLog, InvoiceSendLogFormData } from './types';

const TABLE = 'invoice_send_logs';

export async function fetchInvoiceSendLogs(): Promise<InvoiceSendLog[]> {
	const { data, error } = await supabase
		.from(TABLE)
		.select('*')
		.order('created_at', { ascending: false });

	if (error) {
		console.error('Error fetching invoice send logs:', error);
		throw new Error('Failed to fetch invoice send logs');
	}
	return (data ?? []) as InvoiceSendLog[];
}

export async function createInvoiceSendLog(form: InvoiceSendLogFormData): Promise<InvoiceSendLog> {
	const { data, error } = await supabase
		.from(TABLE)
		.insert({
			order_id: form.order_id.trim(),
			customer_email: form.customer_email.trim() || null,
			order_details: form.order_details,
			document_id: form.document_id.trim() || null,
			pdf_path: form.pdf_path.trim() || null,
			pdf_exists: form.pdf_exists,
			email_sent: form.email_sent,
			email_bounced: form.email_bounced
		})
		.select()
		.single();

	if (error) {
		console.error('Error creating invoice send log:', error);
		throw new Error('Failed to create invoice send log');
	}
	return data as InvoiceSendLog;
}

export async function updateInvoiceSendLog(
	id: string,
	form: InvoiceSendLogFormData
): Promise<InvoiceSendLog> {
	const { data, error } = await supabase
		.from(TABLE)
		.update({
			order_id: form.order_id.trim(),
			customer_email: form.customer_email.trim() || null,
			order_details: form.order_details,
			document_id: form.document_id.trim() || null,
			pdf_path: form.pdf_path.trim() || null,
			pdf_exists: form.pdf_exists,
			email_sent: form.email_sent,
			email_bounced: form.email_bounced
		})
		.eq('id', id)
		.select()
		.single();

	if (error) {
		console.error('Error updating invoice send log:', error);
		throw new Error('Failed to update invoice send log');
	}
	return data as InvoiceSendLog;
}

export async function deleteInvoiceSendLog(id: string): Promise<void> {
	const { error } = await supabase.from(TABLE).delete().eq('id', id);

	if (error) {
		console.error('Error deleting invoice send log:', error);
		throw new Error('Failed to delete invoice send log');
	}
}
