export interface SelectOption {
  value: string;
  label: string;
}

export interface MultiSelectOption {
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

export interface PricingSession {
  id: string;
  session_name: string;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  user_info: Record<string, unknown>;
  status: 'active' | 'completed' | 'cancelled';
  items_updated_count: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export type ImportTargetField =
  | 'sku'
  | 'purchase_price'
  | 'rrp'
  | 'markup'
  | 'gpp'
  | 'ignore';

export interface ColumnMapping {
  columnIndex: number;
  headerName: string;
  targetField: ImportTargetField;
}

export type ImportRowStatus =
  | 'ready'
  | 'unmatched_sku'
  | 'invalid_number'
  | 'no_change'
  | 'duplicate_sku';

export interface ImportPreviewItem {
  id: string;
  rawSku: string;
  matchedSku?: string;
  productName?: string;
  brand?: string;

  // Current values
  currentPurchasePrice?: number;
  currentRrp?: number;
  currentMarkup?: number;

  // New values parsed from paste
  newPurchasePrice?: number;
  newRrp?: number;
  newMarkup?: number;
  newGpp?: number;

  // Recalculated values
  calculatedRrp?: number;
  calculatedMarkup?: number;
  calculatedGpp?: number;

  // Which field was explicitly supplied
  primarySource: 'purchase_price' | 'rrp' | 'markup' | 'gpp';

  status: ImportRowStatus;
  statusMessage?: string;
  selected: boolean;
}

export interface ImportParseSummary {
  totalRows: number;
  matchedCount: number;
  unmatchedCount: number;
  invalidCount: number;
  readyCount: number;
}