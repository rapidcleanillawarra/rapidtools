import type { Order, StatementAccount } from './statementAccounts';

// Types for the new API response
interface CustomerOrder {
    id: string;
    grandTotal: number;
    payments: Array<{
        Amount: number;
    }>;
    outstandingAmount: number;
    datePaymentDue: string;
    isPastDue: boolean;
}

interface CustomerData {
    customer_username: string;
    email: string;
    company_name: string;
    total_orders: number;
    total_balance: number;
    due_invoice_balance: number;
    source: string;
    balance_matches: boolean;
    api_account_balance: number | null;
    orders: CustomerOrder[];
}

interface ApiResponse {
    success: boolean;
    message: string;
    stats: {
        customer_api_usernames: number;
        order_api_unique_username: number;
        matched_balances_count: number;
        unmatched_balances_count: number;
        usernames_with_unmatched_balances: string[];
    };
    customers: CustomerData[];
    timestamp: string;
}

const API_URL = 'https://rapidtools-backend.netlify.app/.netlify/functions/check_existing_customer_statement';

/**
 * Transforms the new API response structure to StatementAccount[] using pre-aggregated data
 */
function transformApiResponseToStatementAccounts(apiResponse: ApiResponse): StatementAccount[] {
    if (!apiResponse.success || !apiResponse.customers || !Array.isArray(apiResponse.customers)) {
        console.warn('Invalid API response: missing or invalid customers data');
        return [];
    }

    return apiResponse.customers
        .filter(customer => customer && customer.customer_username) // Filter out invalid customers
        .map(customer => {
            try {
                // Determine company name with fallbacks
                const companyName = (customer.company_name || '').trim() ||
                                   (customer.email || '').trim() ||
                                   customer.customer_username;

                return {
                    username: customer.customer_username,
                    companyName,
                    totalInvoices: typeof customer.total_orders === 'number' ? customer.total_orders : 0,
                    allInvoicesBalance: Math.round((customer.total_balance || 0) * 100) / 100,
                    dueInvoiceBalance: Math.round((customer.due_invoice_balance || 0) * 100) / 100,
                    totalBalanceCustomer: customer.api_account_balance !== null
                        ? Math.round(customer.api_account_balance * 100) / 100
                        : null,
                    lastSent: null,
                    lastCheck: null,
                    lastFileGeneration: null,
                    oneDriveId: null
                };
            } catch (error) {
                console.error(`Error transforming customer ${customer.customer_username}:`, error);
                return null;
            }
        })
        .filter(account => account !== null) as StatementAccount[]; // Remove null entries
}

/**
 * Transforms the new API response structure to the existing Order[] format
 */
function transformApiResponseToOrders(apiResponse: ApiResponse): Order[] {
    if (!apiResponse.success || !apiResponse.customers || !Array.isArray(apiResponse.customers)) {
        console.warn('Invalid API response: missing or invalid customers data');
        return [];
    }

    const orders: Order[] = [];

    for (const customer of apiResponse.customers) {
        if (!customer || !customer.customer_username || !Array.isArray(customer.orders)) {
            console.warn('Skipping invalid customer:', customer);
            continue;
        }

        for (const order of customer.orders) {
            try {
                if (!order || !order.id || typeof order.grandTotal !== 'number') {
                    console.warn('Skipping invalid order:', order);
                    continue;
                }

                // Safely transform payments
                const orderPayments = (order.payments || [])
                    .filter(payment => payment && typeof payment.Amount === 'number')
                    .map(payment => ({
                        Amount: payment.Amount.toString(), // Convert to string to match existing interface
                        Id: '', // Not available in new API
                        DatePaid: '' // Not available in new API
                    }));

                console.log(`Order ${order.id} payments transformation:`, {
                    originalPayments: order.payments,
                    transformedPayments: orderPayments,
                    totalPaymentAmount: orderPayments.reduce((sum, p) => sum + parseFloat(p.Amount), 0)
                });

                // Transform the order structure to match existing Order interface
                const transformedOrder: Order = {
                    ID: order.id,
                    OrderID: order.id,
                    DatePaymentDue: order.datePaymentDue || '',
                    BillLastName: '', // Not available in new API
                    BillStreetLine1: '', // Not available in new API
                    BillState: '', // Not available in new API
                    BillCountry: '', // Not available in new API
                    BillPostCode: '', // Not available in new API
                    OrderPayment: orderPayments,
                    DatePlaced: order.datePaymentDue || '', // Using due date as placed date since not available separately
                    GrandTotal: order.grandTotal.toString(), // Convert to string to match existing interface
                    Username: customer.customer_username,
                    BillCity: '', // Not available in new API
                    BillCompany: (customer.company_name || '').trim(),
                    BillFirstName: '', // Not available in new API
                    BillPhone: undefined, // Not available in new API
                    Email: (customer.email || '').trim()
                };
                orders.push(transformedOrder);
            } catch (error) {
                console.error(`Error transforming order ${order?.id} for customer ${customer.customer_username}:`, error);
                // Continue processing other orders
            }
        }
    }

    return orders;
}

/**
 * Fetches customer statement data from the Netlify API
 * Returns both pre-aggregated accounts and individual orders
 */
export async function fetchStatementData(): Promise<{ accounts: StatementAccount[]; orders: Order[] }> {
    try {
        console.log('Fetching statement data from Netlify API:', API_URL);

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
            // No body needed for this endpoint
        });

        console.log('Netlify API Response Status:', response.status);

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            console.error('Netlify API Error Response:', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        let data: ApiResponse;
        try {
            data = await response.json();
            console.log('Netlify API Response Data:', JSON.stringify(data, null, 2));
        } catch (parseError) {
            console.error('Failed to parse Netlify API response:', parseError);
            throw new Error(`Failed to parse API response: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`);
        }

        if (!data || typeof data.success !== 'boolean') {
            throw new Error('Invalid API response: missing success field');
        }

        if (!data.success) {
            throw new Error(`API request failed: ${data.message || 'Unknown error'}`);
        }

        if (!data.customers || !Array.isArray(data.customers)) {
            console.warn('API response contains no customers data');
            return { accounts: [], orders: [] };
        }

        const accounts = transformApiResponseToStatementAccounts(data);
        const orders = transformApiResponseToOrders(data);

        console.log(`Successfully fetched ${accounts.length} accounts and ${orders.length} orders`);

        return { accounts, orders };
    } catch (e) {
        console.error('Error fetching statement data:', e);
        throw e;
    }
}

/**
 * Fetches customer statement data from the Netlify API
 * Returns orders in the existing Order[] format for compatibility (legacy function)
 */
export async function fetchOrders(): Promise<Order[]> {
    const { orders } = await fetchStatementData();
    return orders;
}

const GENERATE_DOC_URL =
    'https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/b7ca6010fbe647cc81c80314b9b680c2/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=lJi8nh7QIBUj40phbYeZW7MqQwhKg3TRhVTXGQ_q9Es';

/**
 * Trigger generation of the statement document
 */
export async function generateDocument(
    htmlContent: string,
    fileName: string,
    folderName: string,
    customerUsername: string,
    createdBy: string
): Promise<any> {
    try {
        const payload = {
            pdf: htmlContent,
            file_name: fileName,
            folder_name: folderName,
            customer_username: customerUsername,
            created_by: createdBy
        };
        console.log('Generating Document Payload:', JSON.stringify(payload, null, 2));

        const response = await fetch(GENERATE_DOC_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        console.log('Generate Document Response Status:', response.status);
        const responseText = await response.text();
        console.log('Generate Document Response Body:', responseText);

        if (!response.ok) {
            throw new Error('Failed to generate document');
        }

        try {
            return JSON.parse(responseText);
        } catch (parseError) {
            console.warn("Could not parse response as JSON, returning text", responseText);
            return { message: responseText };
        }

    } catch (e) {
        console.error('Error generating document:', e);
        throw e;
    }
}
