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

	// Deduplicate by order_id, keeping only the latest (first occurrence since ordered by created_at desc)
	const seen = new Set<string>();
	return (data ?? []).filter((log) => {
		const oid = log.order_id ?? '';
		if (seen.has(oid)) return false;
		seen.add(oid);
		return true;
	}) as InvoiceSendLog[];
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

