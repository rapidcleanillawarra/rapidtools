import type { OrderInfo, OrderLine } from '../types';

const ENDPOINTS = {
  ORDER_DETAILS: "https://prod-29.australiasoutheast.logic.azure.com:443/workflows/0282bb0f980c4c6596ceba7d465d1269/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=FRC97yHJR3C2eV4mxLDx4Ud95WQZbihro6I6Rr58JGA",
  CUSTOMER_INFO: "https://prod-25.australiasoutheast.logic.azure.com:443/workflows/4f1fcf1326d54948b153273c442e8cf8/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=RAYNMIVXwsCfoqzZAQavfd01Ch07_pASYP6XGOqHd5U",
  SAVE_MAROPOST: "https://prod-53.australiasoutheast.logic.azure.com:443/workflows/105609f052e04dc8ab8b972bf1613942/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=TBHCbQPF_kEUBNkl-nFBDNEkooeZWc8gRINpD8PL4BE"
};

interface OrderResponse {
  Order: Array<{
    Username: string;
    UserGroup?: string;
    OrderLine?: Array<{
      OrderLineID?: string;
      ProductName?: string;
      SKU?: string;
      Quantity?: string;
      UnitPrice?: string;
      CostPrice?: string;
      PercentDiscount?: string;
    }>;
  }>;
}

interface CustomerResponse {
  customerName: string;
  customerId: string;
  orderDate: string;
  orderStatus: string;
}

export class OrderService {
  private static instance: OrderService;

  private constructor() {}

  public static getInstance(): OrderService {
    if (!OrderService.instance) {
      OrderService.instance = new OrderService();
    }
    return OrderService.instance;
  }

  async getOrderDetails(orderId: string): Promise<{
    orderInfo: OrderInfo;
    orderLines: OrderLine[];
  }> {
    try {
      // 1. Fetch order details
      const orderResponse = await fetch(ENDPOINTS.ORDER_DETAILS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId })
      });

      if (!orderResponse.ok) {
        throw new Error(`Order API error ${orderResponse.status}`);
      }

      const orderData: OrderResponse = await orderResponse.json();

      // 2. Fetch customer info if available
      let customerData: CustomerResponse | null = null;
      if (orderData?.Order?.length && orderData.Order[0].Username) {
        const customerResponse = await fetch(ENDPOINTS.CUSTOMER_INFO, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            username: orderData.Order[0].Username,
            userGroup: orderData.Order[0].UserGroup || "N/A"
          })
        });

        if (!customerResponse.ok) {
          throw new Error(`Customer API error ${customerResponse.status}`);
        }

        customerData = await customerResponse.json();
      }

      return {
        orderInfo: {
          customerName: customerData?.customerName || "N/A",
          customerId: customerData?.customerId || "N/A",
          orderDate: customerData?.orderDate || new Date().toISOString(),
          orderStatus: customerData?.orderStatus || "N/A"
        },
        orderLines: this.transformOrderLines(orderData)
      };
    } catch (error) {
      console.error('Error fetching order details:', error);
      throw error;
    }
  }

  private transformOrderLines(orderData: OrderResponse): OrderLine[] {
    if (!orderData?.Order?.length || !orderData.Order[0].OrderLine?.length) {
      return [];
    }

    // Sort order lines by OrderLineID
    const sortedOrderLines = [...orderData.Order[0].OrderLine].sort((a, b) => {
      const seqA = parseInt(a.OrderLineID?.split('-').pop() || '0', 10);
      const seqB = parseInt(b.OrderLineID?.split('-').pop() || '0', 10);
      return seqA - seqB;
    });

    return sortedOrderLines.map(line => {
      const unitPrice = parseFloat(line.UnitPrice || '0');
      const costPrice = parseFloat(line.CostPrice || '0');
      const quantity = parseFloat(line.Quantity || '0');
      const percentDiscount = parseFloat(line.PercentDiscount || '0');
      const unitPriceDiscounted = unitPrice * (1 - percentDiscount / 100);
      const gppExGst = unitPriceDiscounted > 0 
        ? ((unitPriceDiscounted - costPrice) / unitPriceDiscounted) * 100
        : 0;

      return {
        productName: line.ProductName || "N/A",
        sku: line.SKU || "N/A",
        quantity,
        costPrice: parseFloat(costPrice.toFixed(3)),
        rrp: 0, // Will be updated later with default price
        unitPrice: parseFloat(unitPrice.toFixed(3)),
        percentDiscount: parseFloat(percentDiscount.toFixed(2)),
        accumulatedDiscount: 0, // Will be calculated when RRP is available
        unitPriceDiscounted: parseFloat(unitPriceDiscounted.toFixed(3)),
        gppExGst: parseFloat(gppExGst.toFixed(3)),
        totalExGst: parseFloat((quantity * unitPriceDiscounted).toFixed(3)),
        saveDiscount: false,
        highlight: gppExGst < 20 ? 'low-gpp' : ''
      };
    });
  }

  async applyCustomerPricing(orderId: string, orderLines: OrderLine[]): Promise<void> {
    try {
      const response = await fetch(ENDPOINTS.SAVE_MAROPOST, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          order_id: orderId,
          lines: orderLines.filter(line => line.saveDiscount).map(line => ({
            sku: line.sku,
            discount: line.percentDiscount
          }))
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to apply customer pricing');
      }
    } catch (error) {
      console.error('Error applying customer pricing:', error);
      throw error;
    }
  }
} 