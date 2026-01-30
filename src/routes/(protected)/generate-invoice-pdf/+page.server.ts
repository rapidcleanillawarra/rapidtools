import type { Actions } from './$types';
import { fail } from '@sveltejs/kit';

export const actions = {
    default: async ({ request, fetch }) => {
        const data = await request.formData();
        const orderId = data.get('order_id');

        if (!orderId) {
            return fail(400, { missing: true });
        }

        const endpoint = "https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/085d23545582412795e162562558953d/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=HLKhlTnMPzldKLVFn2pfHoFx3tCqAkFO0BXwhITJfIs";

        // Current time format: 2026-01-23 03:13:17
        const now = new Date();
        const currentTime = now.toISOString().replace('T', ' ').substring(0, 19);

        const xmlPayload = `<?xml version="1.0" encoding="utf-8"?>
<ns:Event xmlns:ns="NetoAPI">
  <CurrentTime>${currentTime}</CurrentTime>
  <EventID>15954</EventID>
  <EventType>Order</EventType>
  <Order>
    <OrderID>${orderId}</OrderID>
    <OrderStatus>generate</OrderStatus>
  </Order>
</ns:Event>`;

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/xml' // Or text/xml, usually application/xml is safer for APIs but Power Automate can be picky. The prompt didn't specify, but XML payload usually implies XML content type.
                },
                body: xmlPayload
            });

            if (!response.ok) {
                const text = await response.text();
                console.error("Power Automate Error:", text);
                return fail(response.status, { error: 'Failed to generate invoice.', details: text });
            }

            const result = await response.json();
            return { success: true, data: result };

        } catch (error) {
            console.error("Request failed:", error);
            return fail(500, { error: 'Internal server error.' });
        }
    }
} satisfies Actions;
