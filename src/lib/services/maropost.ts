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

export async function fetchCustomerData(username: string): Promise<CustomerApiData> {
  if (!username) {
    throw new Error('Username is required to fetch customer data');
  }

  try {
    const response = await fetch(MAROPOST_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        "Filter": {
          "Username": [username],
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
    console.log('Customer API data fetched successfully for username:', username, data);
    return data;
  } catch (error) {
    console.error('Error fetching customer data for username:', username, error);
    throw error;
  }
}

export async function createOrder(customerData: any): Promise<OrderApiData> {
  if (!customerData) {
    throw new Error('Customer data not available for creating order');
  }

  console.log('createOrder received customerData:', customerData);

  // Handle both API response format and direct customer object format
  const customer = customerData.Customer && customerData.Customer.length > 0
    ? customerData.Customer[0]
    : customerData;

  console.log('Extracted customer object:', customer);
  console.log('Customer Username:', customer.Username);

  // Validate required fields
  if (!customer.Username) {
    throw new Error('Customer Username is required for order creation');
  }
  if (!customer.BillingAddress?.BillFirstName || !customer.BillingAddress?.BillLastName) {
    throw new Error('Customer billing name is required for order creation');
  }
  if (!customer.EmailAddress) {
    throw new Error('Customer email address is required for order creation');
  }

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
          "SalesChannel": "Workshop",
          "OrderStatus": "Quote",
          "Username": customer.Username || "",
          "BillFirstName": customer.BillingAddress?.BillFirstName || "",
          "BillLastName": customer.BillingAddress?.BillLastName || "",
          "BillCompany": customer.BillingAddress?.BillCompany || "",
          "BillStreet1": customer.BillingAddress?.BillStreetLine1 || "",
          "BillStreet2": customer.BillingAddress?.BillStreetLine2 || "",
          "BillCity": customer.BillingAddress?.BillCity || "",
          "BillState": customer.BillingAddress?.BillState || "",
          "BillPostCode": customer.BillingAddress?.BillPostCode || "",
          "BillCountry": customer.BillingAddress?.BillCountry || "",
          "BillPhone": customer.BillingAddress?.BillPhone || "",
          "BillFax": customer.BillingAddress?.BillFax || "",
          "ShipFirstName": customer.ShippingAddress?.ShipFirstName || "",
          "ShipLastName": customer.ShippingAddress?.ShipLastName || "",
          "ShipCompany": customer.ShippingAddress?.ShipCompany || "",
          "ShipStreet1": customer.ShippingAddress?.ShipStreetLine1 || "",
          "ShipStreet2": customer.ShippingAddress?.ShipStreetLine2 || "",
          "ShipCity": customer.ShippingAddress?.ShipCity || "",
          "ShipState": customer.ShippingAddress?.ShipState || "",
          "ShipPostCode": customer.ShippingAddress?.ShipPostCode || "",
          "ShipCountry": customer.ShippingAddress?.ShipCountry || "",
          "ShipPhone": customer.ShippingAddress?.ShipPhone || "",
          "ShipFax": customer.ShippingAddress?.ShipFax || "",
          "EmailAddress": customer.EmailAddress || "",
          "OrderLine": [
            {
              "SKU": "LABOUR",
              "Quantity": 1
            }
          ]
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
