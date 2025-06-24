import type { OrderInfo, OrderLine } from '../types';

const ENDPOINTS = {
  ORDER_DETAILS: "https://prod-29.australiasoutheast.logic.azure.com:443/workflows/0282bb0f980c4c6596ceba7d465d1269/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=FRC97yHJR3C2eV4mxLDx4Ud95WQZbihro6I6Rr58JGA",
  CUSTOMER_INFO: "https://prod-25.australiasoutheast.logic.azure.com:443/workflows/4f1fcf1326d54948b153273c442e8cf8/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=RAYNMIVXwsCfoqzZAQavfd01Ch07_pASYP6XGOqHd5U",
  COST_PRICE: "https://prod-62.australiasoutheast.logic.azure.com:443/workflows/e66b00b9cb084f5a8b7f4954526fecaa/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=CLVwwY4ZmM6CX_O-IPzgIND6QCk_C6tAaSaOwbxq6n0",
  SAVE_MAROPOST: "https://prod-53.australiasoutheast.logic.azure.com:443/workflows/105609f052e04dc8ab8b972bf1613942/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=TBHCbQPF_kEUBNkl-nFBDNEkooeZWc8gRINpD8PL4BE",
  GROUP_MAPPING: "https://prod-60.australiasoutheast.logic.azure.com:443/workflows/c38543a949594553b4ad99cab7dd8c00/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=411u61erX0g_vm0mpwRrWKWuzPlcio6FJlgLJEdADUo"
};

interface PricingData {
  Item: Array<{
    SKU: string;
    DefaultPurchasePrice: string;
    RRP: string;
  }>;
}

interface GroupMapping {
  GroupID: string;
  Group: string;
}

export class GPPService {
  private static instance: GPPService;
  private groupMappings: GroupMapping[] | null = null;

  private constructor() {}

  public static getInstance(): GPPService {
    if (!GPPService.instance) {
      GPPService.instance = new GPPService();
    }
    return GPPService.instance;
  }

  private async fetchGroupMappings(): Promise<GroupMapping[]> {
    if (this.groupMappings) {
      return this.groupMappings;
    }

    try {
      console.log('Calling Group Mapping API:', {
        endpoint: ENDPOINTS.GROUP_MAPPING,
        payload: {}
      });

      const response = await fetch(ENDPOINTS.GROUP_MAPPING, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        throw new Error(`Group mapping API error ${response.status}`);
      }

      this.groupMappings = await response.json();
      
      console.log('Group Mapping API Response:', {
        status: response.status,
        data: this.groupMappings
      });
      
      return this.groupMappings;
    } catch (error) {
      console.error('Error fetching group mappings:', error);
      return [];
    }
  }

  private async getGroupName(groupId: string): Promise<string> {
    const mappings = await this.fetchGroupMappings();
    const mapping = mappings.find(m => m.GroupID === groupId);
    return mapping ? mapping.Group : groupId;
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
      console.log('Order Details API Response:', orderData);
      
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
        orderData.Order[0].UserGroup,
        orderData.Order[0].DatePlaced,
        orderData.Order[0].OrderStatus
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

  private async fetchCustomerInfo(
    username?: string,
    userGroup?: string,
    datePlaced?: string,
    orderStatus?: string
  ): Promise<OrderInfo> {
    if (!username) {
      return this.getDefaultOrderInfo();
    }

    try {
      const payload = { 
        username: [username],
        userGroup: userGroup || "N/A"
      };
      
      console.log('Calling Customer Info API:', {
        endpoint: ENDPOINTS.CUSTOMER_INFO,
        payload: payload
      });
      
      const [customerResponse, mappings] = await Promise.all([
        fetch(ENDPOINTS.CUSTOMER_INFO, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }),
        this.fetchGroupMappings()
      ]);

      if (!customerResponse.ok) {
        return this.getDefaultOrderInfo();
      }

      const data = await customerResponse.json();
      
      console.log('Customer Info API Response:', {
        status: customerResponse.status,
        data: data
      });
      
      if (!data?.Customer?.length) {
        return this.getDefaultOrderInfo();
      }

      const customer = data.Customer[0];
      const billing = customer.BillingAddress || {};
      const customerName = `${billing.BillFirstName || ""} ${billing.BillLastName || ""}`.trim();
      const customerUserGroup = customer.UserGroup || "N/A";

      // Find group mappings
      const orderMapping = mappings.find(item => item.GroupID === userGroup);
      const orderGroupName = orderMapping ? orderMapping.Group : userGroup;

      const customerMapping = mappings.find(item => item.Group === customerUserGroup);
      const customerGroupName = customerMapping ? customerMapping.Group : customerUserGroup;

      // Format the date in Sydney timezone with the desired format
      const dateToFormat = datePlaced ? new Date(datePlaced) : new Date();
      const sydneyDate = dateToFormat.toLocaleString('en-AU', {
        timeZone: 'Australia/Sydney',
        weekday: 'long',
        month: 'long',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).replace(/,/g, ''); // Remove commas for the desired format

      return {
        customerName: customerName || "N/A",
        customerId: customer.Username || "N/A",
        customerGroup: customerGroupName,
        orderUserGroup: orderGroupName,
        orderDate: sydneyDate,
        orderStatus: orderStatus || "N/A",
        isGroupMismatch: customerMapping?.GroupID !== userGroup
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
      customerGroup: "N/A",
      orderUserGroup: "N/A",
      orderDate: new Date().toISOString(),
      orderStatus: "N/A",
      isGroupMismatch: false
    };
  }

  private transformOrderLines(orderData: any, pricingData: PricingData): OrderLine[] {
    if (!orderData?.Order?.length || !orderData.Order[0].OrderLine?.length) {
      return [];
    }

    // Sort order lines by the sequence number in OrderLineID
    const sortedOrderLines = [...orderData.Order[0].OrderLine].sort((a, b) => {
      const seqA = parseInt(a.OrderLineID?.split('-').pop() || '0', 10);
      const seqB = parseInt(b.OrderLineID?.split('-').pop() || '0', 10);
      return seqA - seqB;
    });

    const pricingMap = new Map(
      pricingData.Item?.map(item => [item.SKU, {
        costPrice: parseFloat(item.DefaultPurchasePrice),
        rrp: parseFloat(item.RRP)
      }]) || []
    );

    return sortedOrderLines.map(line => {
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
        ? ((pricing.rrp - unitPriceDiscounted) / pricing.rrp) * 100
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
        totalExGst: parseFloat(((quantity * unitPriceDiscounted) / 1.10).toFixed(2)),
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

  async saveCustomerPricing(orderId: string, orderLines: OrderLine[], orderInfo?: OrderInfo): Promise<void> {
    try {
      // Get only the selected lines
      const selectedLines = orderLines.filter(line => line.saveDiscount);
      
      // Get the customer's group ID
      let priceGroupId = "1"; // Default as fallback
      
      if (orderInfo) {
        // Fetch group mappings to get the correct group ID
        const mappings = await this.fetchGroupMappings();
        
        // Find the mapping for the customer's group
        const customerMapping = mappings.find(item => item.Group === orderInfo.customerGroup);
        
        // Use the customer's group ID if found
        if (customerMapping && customerMapping.GroupID) {
          priceGroupId = customerMapping.GroupID;
        }
      }
      
      console.log('Using price group ID:', priceGroupId);
      
      // For each selected line, make a separate API call
      for (const line of selectedLines) {
        const payload = {
          sku: line.sku,
          price_group_id: priceGroupId,
          price: line.unitPriceDiscounted
        };
        
        const response = await fetch(ENDPOINTS.SAVE_MAROPOST, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        
        console.log('Submitted to Maropost:', {
          endpoint: ENDPOINTS.SAVE_MAROPOST,
          payload: payload
        });

        // Log the API response
        const responseData = await response.clone().json().catch(() => 'No JSON response');
        console.log('Maropost API Response:', {
          status: response.status,
          statusText: response.statusText,
          data: responseData
        });

        if (!response.ok) {
          throw new Error(`Failed to save customer pricing for SKU: ${line.sku}`);
        }
      }
    } catch (error) {
      console.error('Error saving customer pricing:', error);
      throw error;
    }
  }
} 