import type { Order } from './statementAccounts';

const API_URL =
    'https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=pPhk80gODQOi843ixLjZtPPWqTeXIbIt9ifWZP6CJfY';

/**
 * Fetches orders from the Power Automate API
 * Returns dispatched orders with pending/partial payment status
 */
export async function fetchOrders(): Promise<Order[]> {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                Filter: {
                    OrderStatus: ['Dispatched'],
                    PaymentStatus: ['Pending', 'PartialPaid'],
                    OutputSelector: [
                        'ID',
                        'Username',
                        'DatePaymentDue',
                        'OrderPayment',
                        'GrandTotal',
                        'DatePlaced',
                        'BillAddress',
                        'Email'
                    ]
                },
                action: 'GetOrder'
            })
        });

        if (!response.ok) {
            throw new Error('Failed to fetch orders');
        }

        const data = await response.json();

        if (data && data.Order) {
            return data.Order;
        }

        return [];
    } catch (e) {
        console.error('Error fetching orders:', e);
        throw e;
    }
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
