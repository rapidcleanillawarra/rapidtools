/**
 * Maropost API service functions
 */

export interface CustomerApiData {
  Customer?: any[];
  [key: string]: any;
}

export interface OrderApiData {
  Order?: {
    OrderID?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

const MAROPOST_API_URL = 'https://prod-56.australiasoutheast.logic.azure.com:443/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=G8m_h5Dl8GpIRQtlN0oShby5zrigLKTWEddou-zGQIs';

export async function fetchCustomerData(): Promise<CustomerApiData> {
  try {
    const response = await fetch(MAROPOST_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        "Filter": {
          "Username": ["joeven_customer"],
          "OutputSelector": [
            "EmailAddress",
            "BillingAddress",
            "ShippingAddress"
          ]
        },
        "action": "GetCustomer"
      })
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }

    const data: CustomerApiData = await response.json();
    console.log('Customer API data fetched successfully:', data);
    return data;
  } catch (error) {
    console.error('Error fetching customer data:', error);
    throw error;
  }
}

export async function createOrder(customerApiData: CustomerApiData): Promise<OrderApiData> {
  if (!customerApiData || !customerApiData.Customer || customerApiData.Customer.length === 0) {
    throw new Error('Customer data not available for creating order');
  }

  const customer = customerApiData.Customer[0];

  // Generate OrderID in format: YYYYWMDDHHMMSS (Year + W + Month + Day + Hour + Minutes + Seconds)
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0'); // getMonth() returns 0-11, so +1
  const day = String(now.getDate()).padStart(2, '0');
  const hour = now.getHours(); // Single digit for hour
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const orderId = `${year}W${month}${day}${hour}${minutes}${seconds}`;

  console.log('Generated OrderID:', orderId);

  try {
    const orderPayload = {
      "Order": [
        {
          "OrderID": orderId,
          "OrderStatus": "Quote",
          "Username": customer.Username || "joeven_customer",
          "BillFirstName": customer.BillingAddress?.BillFirstName || "Joeven Customer",
          "BillLastName": customer.BillingAddress?.BillLastName || "Cerveza",
          "BillCompany": customer.BillingAddress?.BillCompany || "Rapid Clean Illawarra",
          "BillStreet1": customer.BillingAddress?.BillStreetLine1 || "32 Crawford St.",
          "BillStreet2": customer.BillingAddress?.BillStreetLine2 || "1148 Mountain Ash Rd",
          "BillCity": customer.BillingAddress?.BillCity || "CANNINGTON",
          "BillState": customer.BillingAddress?.BillState || "WA",
          "BillPostCode": customer.BillingAddress?.BillPostCode || "6107",
          "BillCountry": customer.BillingAddress?.BillCountry || "AU",
          "BillPhone": customer.BillingAddress?.BillPhone || "61 2 9071 7908",
          "BillFax": customer.BillingAddress?.BillFax || "",
          "ShipFirstName": customer.ShippingAddress?.ShipFirstName || "Joeven Customer",
          "ShipLastName": customer.ShippingAddress?.ShipLastName || "Cerveza",
          "ShipCompany": customer.ShippingAddress?.ShipCompany || "Rapid Clean Illawarra",
          "ShipStreet1": customer.ShippingAddress?.ShipStreetLine1 || "32 Crawford St.",
          "ShipStreet2": customer.ShippingAddress?.ShipStreetLine2 || "1148 Mountain Ash Rd",
          "ShipCity": customer.ShippingAddress?.ShipCity || "CANNINGTON",
          "ShipState": customer.ShippingAddress?.ShipState || "WA",
          "ShipPostCode": customer.ShippingAddress?.ShipPostCode || "6107",
          "ShipCountry": customer.ShippingAddress?.ShipCountry || "AU",
          "ShipPhone": customer.ShippingAddress?.ShipPhone || "61 2 9071 7908",
          "ShipFax": customer.ShippingAddress?.ShipFax || "",
          "EmailAddress": customer.EmailAddress || "joeven_rc@gmail.com"
        }
      ],
      "action": "AddOrder"
    };

    console.log('Creating order with payload:', orderPayload);

    const response = await fetch(MAROPOST_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload)
    });

    if (!response.ok) {
      throw new Error(`AddOrder API call failed: ${response.status} ${response.statusText}`);
    }

    const data: OrderApiData = await response.json();
    console.log('Order created successfully:', data);
    return data;
  } catch (error) {
    console.error('Error creating order:', error);
    throw error;
  }
}
