export type DocumentType = 'INVOICE' | 'QUOTE' | 'QUICK_QUOTE' | string;

export interface HistoryMeta {
  id: string;
  type: DocumentType;
  created_at?: string;
  updated_at?: string;
  customer?: string;
  project?: string;
  document_no?: string;
  document_date?: string;
  customer_code?: string;
  project_code?: string;
  project_uid?: string;
  total?: number;
  advance?: number;
  remaining?: number;
  status?: string;
}

export interface HistoryResponse {
  ok: boolean;
  items: HistoryMeta[];
  error?: string;
}

export interface ProductGroup {
  id: string;
  code: string;
  name: string;
  sort_order?: number;
  system_kind?: string;
}

export interface ProductItem {
  id: string;
  name?: string;
  group?: string;
  group_id?: string;
  group_name?: string;
  group_kind?: string;
  catalog_key?: string;
  image?: string;
  image_rotation?: number;
  unit?: string;
  price?: number | string;
  description?: string;
  note?: string;
}

export interface ProductLibraryResponse {
  ok: boolean;
  items: ProductItem[];
  groups: ProductGroup[];
  error?: string;
}

export interface PaymentInvoice {
  id: string;
  document_no?: string;
  document_date?: string;
  customer?: string;
  project?: string;
  project_code?: string;
  project_uid?: string;
  total?: number;
  advance?: number;
  ledger_net?: number;
  received?: number;
  remaining?: number;
  overpaid?: number;
  status?: 'PAID' | 'OVERPAID' | 'PARTIAL' | 'UNPAID' | string;
  updated_at?: string;
}

export interface PaymentEntry {
  id: string;
  type?: string;
  invoice_id?: string;
  customer?: string;
  project?: string;
  document_no?: string;
  amount?: number;
  date?: string;
  method?: string;
  note?: string;
}

export interface PaymentsResponse {
  ok: boolean;
  invoices: PaymentInvoice[];
  entries: PaymentEntry[];
  error?: string;
}

export interface FinanceSummary {
  month?: string;
  period_income?: number;
  period_expense?: number;
  period_net?: number;
  today_income?: number;
  today_expense?: number;
  balance?: number;
}

export interface FinanceTransaction {
  id: string;
  transaction_type?: 'INCOME' | 'EXPENSE' | string;
  amount?: number;
  date?: string;
  note?: string;
  party_name?: string;
  project_name?: string;
  category_id?: string;
  account_id?: string;
}

export interface FinanceResponse {
  ok: boolean;
  schema_version?: number | string;
  summary: FinanceSummary;
  book?: {
    transactions?: FinanceTransaction[];
    [key: string]: unknown;
  };
  context?: Record<string, unknown>;
  error?: string;
}

export interface ContractItem {
  id: string;
  contract_no?: string;
  customer?: string;
  project?: string;
  title?: string;
  status?: string;
  value?: number;
  updated_at?: string;
  [key: string]: unknown;
}

export interface ContractsResponse {
  ok: boolean;
  items?: ContractItem[];
  contracts?: ContractItem[];
  error?: string;
}
