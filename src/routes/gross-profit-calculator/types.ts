export interface OrderLine {
  productName: string;
  sku: string;
  quantity: number;
  costPrice: number;
  rrp: number;
  unitPrice: number;
  percentDiscount: number;
  accumulatedDiscount: number;
  unitPriceDiscounted: number;
  gppExGst: number;
  totalExGst: number;
  saveDiscount: boolean;
  highlight?: string;
}

export interface OrderInfo {
  customerName: string;
  customerId: string;
  customerGroup: string;
  orderUserGroup: string;
  orderDate: string;
  orderStatus: string;
  // Add more fields as needed
} 