import type { OrderInfo, OrderLine } from '../types';

const ENDPOINTS = {
  ORDER_DETAILS: "https://prod-29.australiasoutheast.logic.azure.com:443/workflows/0282bb0f980c4c6596ceba7d465d1269/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=FRC97yHJR3C2eV4mxLDx4Ud95WQZbihro6I6Rr58JGA",
  CUSTOMER_INFO: "https://prod-25.australiasoutheast.logic.azure.com:443/workflows/4f1fcf1326d54948b153273c442e8cf8/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=RAYNMIVXwsCfoqzZAQavfd01Ch07_pASYP6XGOqHd5U",
  COST_PRICE: "https://prod-62.australiasoutheast.logic.azure.com:443/workflows/e66b00b9cb084f5a8b7f4954526fecaa/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=CLVwwY4ZmM6CX_O-IPzgIND6QCk_C6tAaSaOwbxq6n0",
  SAVE_MAROPOST: "https://prod-53.australiasoutheast.logic.azure.com:443/workflows/105609f052e04dc8ab8b972bf1613942/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=TBHCbQPF_kEUBNkl-nFBDNEkooeZWc8gRINpD8PL4BE"
};

interface PricingData {
  Item: Array<{
    SKU: string;
    DefaultPurchasePrice: string;
    RRP: string;
  }>;
}

export class GPPService {
  private static instance: GPPService;

  private constructor() {}

  public static getInstance(): GPPService {
    if (!GPPService.instance) {
      GPPService.instance = new GPPService();
    }
    return GPPService.instance;
  }

  async fetchOrderDetails(orderId: string): Promise<{
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

      const orderData = await orderResponse.json();
      
      if (!orderData?.Order?.length) {
        throw new Error('No order data found');
      }

      // 2. Get SKUs for pricing data
      const skus = orderData.Order[0].OrderLine?.map(line => line.SKU) || [];
      
      // 3. Fetch pricing data
      const pricingData = await this.fetchPricingData(skus);
      
      // 4. Transform order lines with pricing data
      const orderLines = this.transformOrderLines(orderData, pricingData);

      // 5. Fetch customer info if available
      const customerInfo = await this.fetchCustomerInfo(
        orderData.Order[0].Username,
        orderData.Order[0].UserGroup
      );

      return {
        orderInfo: customerInfo,
        orderLines
      };
    } catch (error) {
      console.error('Error in fetchOrderDetails:', error);
      throw error;
    }
  }

  private async fetchPricingData(skus: string[]): Promise<PricingData> {
    if (!skus.length) return { Item: [] };

    const response = await fetch(ENDPOINTS.COST_PRICE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku: skus })
    });

    if (!response.ok) {
      throw new Error(`Pricing API error ${response.status}`);
    }

    return response.json();
  }

  private async fetchCustomerInfo(username?: string, userGroup?: string): Promise<OrderInfo> {
    if (!username) {
      return this.getDefaultOrderInfo();
    }

    try {
      const response = await fetch(ENDPOINTS.CUSTOMER_INFO, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          username,
          userGroup: userGroup || "N/A"
        })
      });

      if (!response.ok) {
        return this.getDefaultOrderInfo();
      }

      const data = await response.json();
      return {
        customerName: data.customerName || "N/A",
        customerId: data.customerId || "N/A",
        orderDate: data.orderDate || new Date().toISOString(),
        orderStatus: data.orderStatus || "N/A"
      };
    } catch (error) {
      console.error('Error fetching customer info:', error);
      return this.getDefaultOrderInfo();
    }
  }

  private getDefaultOrderInfo(): OrderInfo {
    return {
      customerName: "N/A",
      customerId: "N/A",
      orderDate: new Date().toISOString(),
      orderStatus: "N/A"
    };
  }

  private transformOrderLines(orderData: any, pricingData: PricingData): OrderLine[] {
    if (!orderData?.Order?.length || !orderData.Order[0].OrderLine?.length) {
      return [];
    }

    const pricingMap = new Map(
      pricingData.Item?.map(item => [item.SKU, {
        costPrice: parseFloat(item.DefaultPurchasePrice),
        rrp: parseFloat(item.RRP)
      }]) || []
    );

    return orderData.Order[0].OrderLine.map(line => {
      const pricing = pricingMap.get(line.SKU || "") || { costPrice: 0, rrp: 0 };
      const unitPrice = parseFloat(line.UnitPrice || '0');
      const quantity = parseFloat(line.Quantity || '0');
      const percentDiscount = parseFloat(line.PercentDiscount || '0');
      const unitPriceDiscounted = unitPrice * (1 - percentDiscount / 100);
      
      // Calculate GPP using cost price from pricing data
      const gppExGst = unitPriceDiscounted > 0 
        ? ((unitPriceDiscounted - pricing.costPrice) / unitPriceDiscounted) * 100
        : 0;

      // Calculate accumulated discount based on RRP
      const accumulatedDiscount = pricing.rrp > 0
        ? ((pricing.rrp - (unitPriceDiscounted * 1.1)) / pricing.rrp) * 100
        : 0;

      return {
        productName: line.ProductName || "N/A",
        sku: line.SKU || "N/A",
        quantity,
        costPrice: parseFloat(pricing.costPrice.toFixed(3)),
        rrp: parseFloat(pricing.rrp.toFixed(2)),
        unitPrice: parseFloat(unitPrice.toFixed(3)),
        percentDiscount: parseFloat(percentDiscount.toFixed(2)),
        accumulatedDiscount: parseFloat(accumulatedDiscount.toFixed(2)),
        unitPriceDiscounted: parseFloat(unitPriceDiscounted.toFixed(3)),
        gppExGst: parseFloat(gppExGst.toFixed(3)),
        totalExGst: parseFloat((quantity * unitPriceDiscounted).toFixed(3)),
        saveDiscount: false,
        highlight: this.calculateHighlight(unitPrice, pricing.rrp / 1.1, gppExGst)
      };
    });
  }

  private calculateHighlight(unitPrice: number, netRRP: number, gppExGst: number): string {
    if (gppExGst < 20) {
      return 'low-gpp';
    }
    
    const unitPriceRounded = parseFloat(unitPrice.toFixed(2));
    const netRRPRounded = parseFloat(netRRP.toFixed(2));
    
    if (Math.abs(unitPriceRounded - netRRPRounded) < 0.001) {
      return 'equal-price';
    }
    
    if (unitPriceRounded < netRRPRounded) {
      return 'lower-price';
    }
    
    return '';
  }

  async saveCustomerPricing(orderId: string, orderLines: OrderLine[]): Promise<void> {
    try {
      const response = await fetch(ENDPOINTS.SAVE_MAROPOST, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          order_id: orderId,
          lines: orderLines
            .filter(line => line.saveDiscount)
            .map(line => ({
              sku: line.sku,
              discount: line.percentDiscount
            }))
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save customer pricing');
      }
    } catch (error) {
      console.error('Error saving customer pricing:', error);
      throw error;
    }
  }
} 