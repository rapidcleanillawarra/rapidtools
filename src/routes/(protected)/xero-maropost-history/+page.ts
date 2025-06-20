export interface AccountingBotRecord {
  id: string;
  order_id: string;
  maropost_total: number;
  xero_total: number;
  maropost_paid_status: string;
  xero_paid_status: string;
  difference: string;
  order_status: string;
  notes: string;
  timestamp_utc: Date;
}

export interface HistoryEntry {
  current: AccountingBotRecord;
  previous?: AccountingBotRecord;
}

export const ssr = false;
export const prerender = false;

export const load = async () => {
  return {};
}; 