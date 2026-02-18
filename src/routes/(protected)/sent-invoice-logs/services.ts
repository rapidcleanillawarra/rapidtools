import { supabase } from '$lib/supabase';
import type {
	InvoiceSendLog,
	InvoiceSendLogFormData,
	InvoiceSendLogQuery,
	InvoiceSendLogResult,
	YesNoAll
} from './types';

const TABLE = 'invoice_send_logs';

// API endpoints
const MAROPOST_API_URL = 'https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=pPhk80gODQOi843ixLjZtPPWqTeXIbIt9ifWZP6CJfY';
const EMAIL_TRIGGER_API_URL = 'https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/085d23545582412795e162562558953d/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=HLKhlTnMPzldKLVFn2pfHoFx3tCqAkFO0BXwhITJfIs';

function toFilterBoolean(value?: YesNoAll): boolean | undefined {
	if (value === 'yes') return true;
	if (value === 'no') return false;
	return undefined;
}

function recordMatchesFilters(record: InvoiceSendLog, filters?: InvoiceSendLogQuery['filters']): boolean {
	if (!filters) return true;
	const emailSent = toFilterBoolean(filters.emailSent);
	if (emailSent !== undefined && record.email_sent !== emailSent) return false;
	const emailBounced = toFilterBoolean(filters.emailBounced);
	if (emailBounced !== undefined && record.email_bounced !== emailBounced) return false;
	const pdfExists = toFilterBoolean(filters.pdfExists);
	if (pdfExists !== undefined && record.pdf_exists !== pdfExists) return false;
	const orderDetails = toFilterBoolean(filters.orderDetails);
	if (orderDetails !== undefined && record.order_details !== orderDetails) return false;
	return true;
}

export async function fetchInvoiceSendLogs(query: InvoiceSendLogQuery): Promise<InvoiceSendLogResult> {
	const { page, perPage, sortField, sortDirection, search, filters } = query;
	const safePage = Math.max(1, page);
	const safePerPage = Math.max(1, perPage);

	// Apply only search filters to get candidate records (no yes/no filters yet)
	let baseRequest = supabase.from(TABLE).select('*');

	const orderId = search?.orderId?.trim();
	if (orderId) baseRequest = baseRequest.ilike('order_id', `%${orderId}%`);

	const customerEmail = search?.customerEmail?.trim();
	if (customerEmail) baseRequest = baseRequest.ilike('customer_email', `%${customerEmail}%`);

	const documentId = search?.documentId?.trim();
	if (documentId) baseRequest = baseRequest.ilike('document_id', `%${documentId}%`);

	// Fetch all matching rows, then resolve latest record per order
	const { data: allRows, error: fetchError } = await baseRequest
		.not('order_id', 'is', null)
		.order('order_id')
		.order('created_at', { ascending: false });

	if (fetchError) {
		console.error('Error fetching invoice send logs:', fetchError);
		throw new Error('Failed to fetch invoice send logs');
	}

	if (!allRows || allRows.length === 0) {
		return { data: [], total: 0 };
	}

	// Group by order_id and keep the latest record for each (first seen = most recent by created_at desc)
	const latestRecordsMap = new Map<string, InvoiceSendLog>();
	for (const record of allRows) {
		if (!latestRecordsMap.has(record.order_id)) {
			latestRecordsMap.set(record.order_id, record);
		}
	}

	// Apply yes/no filters on the latest record only (e.g. "Email sent = No" means latest record has email_sent === false)
	let distinctRecords = Array.from(latestRecordsMap.values()).filter((r) =>
		recordMatchesFilters(r, filters)
	);

	// Apply sorting to the distinct records
	distinctRecords.sort((a, b) => {
		const aValue = a[sortField] ?? '';
		const bValue = b[sortField] ?? '';

		let comparison = 0;
		if (aValue < bValue) comparison = -1;
		else if (aValue > bValue) comparison = 1;

		return sortDirection === 'asc' ? comparison : -comparison;
	});

	// Apply pagination
	const total = distinctRecords.length;
	const from = (safePage - 1) * safePerPage;
	const to = Math.min(from + safePerPage, total);
	const paginatedData = distinctRecords.slice(from, to);

	return {
		data: paginatedData,
		total: total
	};
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

/**
 * Get order email and username from the order record
 */
export async function getOrderEmail(orderId: string): Promise<{ email: string | null; username: string | null }> {
	if (!orderId) {
		throw new Error('Order ID is required to fetch order email');
	}

	try {
		const payload = {
			"Filter": {
				"OrderID": [orderId],
				"OutputSelector": ["ID", "Username", "Email"]
			},
			"action": "GetOrder"
		};

		console.log('Fetching order email for OrderID:', orderId);

		const response = await fetch(MAROPOST_API_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(payload)
		});

		if (!response.ok) {
			throw new Error(`GetOrder API call failed: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();
		console.log('GetOrder response:', data);

		// Check if response has Order array and first item exists
		if (!data.Order || !Array.isArray(data.Order) || data.Order.length === 0) {
			throw new Error('Invalid GetOrder response format - no order data found');
		}

		const order = data.Order[0];
		const email = order.Email || null;
		const username = order.Username || null;

		console.log('Extracted order data:', { email, username });
		return { email, username };
	} catch (error) {
		console.error('Error fetching order email:', error);
		throw error;
	}
}

/**
 * Get customer email from the customer record
 */
export async function getCustomerEmail(username: string): Promise<string | null> {
	if (!username) {
		throw new Error('Username is required to fetch customer email');
	}

	try {
		const payload = {
			"Filter": {
				"Username": username,
				"OutputSelector": ["Username", "EmailAddress"]
			},
			"action": "GetCustomer"
		};

		console.log('Fetching customer email for username:', username);

		const response = await fetch(MAROPOST_API_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(payload)
		});

		if (!response.ok) {
			throw new Error(`GetCustomer API call failed: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();
		console.log('GetCustomer response:', data);

		// Check if response has Customer array and first item exists
		if (!data.Customer || !Array.isArray(data.Customer) || data.Customer.length === 0) {
			throw new Error('Invalid GetCustomer response format - no customer data found');
		}

		const customer = data.Customer[0];
		const email = customer.EmailAddress || null;

		console.log('Extracted customer email:', email);
		return email;
	} catch (error) {
		console.error('Error fetching customer email:', error);
		throw error;
	}
}

/**
 * Update order email address
 */
export async function updateOrderEmail(orderId: string, email: string): Promise<any> {
	if (!orderId) {
		throw new Error('Order ID is required for order update');
	}
	if (!email || !email.trim()) {
		throw new Error('Email address is required for order update');
	}

	// Basic email validation
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!emailRegex.test(email.trim())) {
		throw new Error('Invalid email address format');
	}

	try {
		const payload = {
			"Order": [
				{
					"OrderID": orderId,
					"Email": email.trim()
				}
			],
			"action": "UpdateOrder"
		};

		console.log('Updating order email for OrderID:', orderId, 'with email:', email);

		const response = await fetch(MAROPOST_API_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(payload)
		});

		if (!response.ok) {
			throw new Error(`UpdateOrder API call failed: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();
		console.log('UpdateOrder response:', data);

		// Check API response status
		if (data.Ack === 'Success') {
			console.log('Order email updated successfully');
			return data;
		} else if (data.Ack === 'Warning' && data.Messages?.Warning?.Message) {
			throw new Error(data.Messages.Warning.Message);
		} else {
			throw new Error('Unknown UpdateOrder API response format');
		}
	} catch (error) {
		console.error('Error updating order email:', error);
		throw error;
	}
}

/**
 * Trigger invoice email sending
 */
export async function triggerInvoiceEmail(orderId: string): Promise<any> {
	if (!orderId) {
		throw new Error('Order ID is required to trigger invoice email');
	}

	try {
		// Generate current timestamp in required format: YYYY-MM-DD HH:mm:ss
		const now = new Date();
		const currentTime = now.toISOString().slice(0, 19).replace('T', ' ');
		const eventId = Date.now(); // Use timestamp as EventID

		// Create XML payload
		const xmlPayload = `<?xml version="1.0" encoding="utf-8"?>
<ns:Event xmlns:ns="NetoAPI">
  <CurrentTime>${currentTime}</CurrentTime>
  <EventID>${eventId}</EventID>
  <EventType>Order</EventType>
  <Order>
    <OrderID>${orderId}</OrderID>
    <OrderStatus>Dispatched</OrderStatus>
  </Order>
</ns:Event>`;

		console.log('Triggering invoice email for OrderID:', orderId);
		console.log('XML Payload:', xmlPayload);

		const response = await fetch(EMAIL_TRIGGER_API_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/xml',
			},
			body: xmlPayload
		});

		if (!response.ok) {
			throw new Error(`Email trigger API call failed: ${response.status} ${response.statusText}`);
		}

		const data = await response.text(); // JSON response, so get as text
		console.log('Email trigger response:', data);

		// Parse the JSON response
		const jsonResponse = JSON.parse(data);
		console.log('Parsed Power Automate response:', jsonResponse);

		// Check if email was sent successfully based on email_sent field
		if (jsonResponse.email_sent === false) {
			throw new Error('Email retry failed - Power Automate reported email_sent: false');
		}

		return jsonResponse;
	} catch (error) {
		console.error('Error triggering invoice email:', error);
		throw error;
	}
}

