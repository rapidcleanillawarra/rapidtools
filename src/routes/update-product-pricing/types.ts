export interface SelectOption {
  value: string;
  label: string;
}

export interface PriceGroupDetail {
  Multiple?: string;
  Price: string;
  MaximumQuantity?: string;
  MinimumQuantity?: string;
  MultipleStartQuantity?: string;
  Group: string;
  GroupID: string;
}

export interface ApiProductItem {
  PrimarySupplier: string;
  Categories: string[];
  RRP: string;
  Model: string;
  InventoryID: string;
  Brand: string;
  Misc09: string;
  DefaultPurchasePrice: string;
  PriceGroups: {
    PriceGroup: PriceGroupDetail | PriceGroupDetail[];
  };
  SKU: string;
  Misc02: string;
} 