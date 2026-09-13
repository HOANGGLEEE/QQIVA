/**
 * Offline compatibility service.
 * Screens keep the old qqivaApi calls, but every operation now reads/writes the
 * SQLite database inside the Android app. There are NO HTTP requests here.
 */
import { getDatabase } from '@/db/database';
import type {
  ContractItem,
  ContractsResponse,
  FinanceResponse,
  FinanceTransaction,
  HistoryMeta,
  HistoryResponse,
  PaymentEntry,
  PaymentInvoice,
  PaymentsResponse,
  ProductGroup,
  ProductItem,
  ProductLibraryResponse,
} from '@/types/qqiva';

export const API_BASE_URL = 'SQLite cục bộ • không cần máy chủ';

export class ApiError extends Error {
  status = 0;
  constructor(message: string) {
    super(message);
    this.name = 'OfflineDatabaseError';
  }
}

type DocumentRow = HistoryMeta & { raw_json: string };
type ProductRow = ProductItem & { group_code?: string; raw_json: string };
type ProductGroupRow = ProductGroup & { raw_json: string };
type ContractRow = ContractItem & { raw_json: string };
type PaymentRow = PaymentEntry & { raw_json: string };
type FinanceRow = FinanceTransaction & { raw_json: string; book_type: string };

async function getHistory(): Promise<HistoryResponse> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<DocumentRow>(
    `SELECT id,type,created_at,updated_at,customer,project,document_no,document_date,
            customer_code,project_code,project_uid,total,advance,remaining,status,raw_json
       FROM documents
      ORDER BY COALESCE(updated_at,created_at,document_date) DESC`,
  );
  return { ok: true, items: rows.map(({ raw_json: _raw, ...item }) => item) };
}

async function getProducts(): Promise<ProductLibraryResponse> {
  const db = await getDatabase();
  const [rows, groups] = await Promise.all([
    db.getAllAsync<ProductRow>('SELECT * FROM products ORDER BY name COLLATE NOCASE ASC'),
    db.getAllAsync<ProductGroupRow>('SELECT * FROM product_groups ORDER BY sort_order ASC, name ASC'),
  ]);
  return {
    ok: true,
    items: rows.map(({ raw_json: _raw, group_code, ...item }) => ({ ...item, group: item.group || group_code })),
    groups: groups.map(({ raw_json: _raw, ...group }) => group),
  };
}

async function getContracts(): Promise<ContractsResponse> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ContractRow>('SELECT * FROM contracts ORDER BY COALESCE(updated_at,created_at) DESC');
  return { ok: true, items: rows.map(({ raw_json: _raw, ...item }) => item) };
}

async function getPayments(): Promise<PaymentsResponse> {
  const db = await getDatabase();
  const [documents, entries] = await Promise.all([
    db.getAllAsync<DocumentRow>(`SELECT * FROM documents WHERE type = 'INVOICE' ORDER BY COALESCE(updated_at,created_at) DESC`),
    db.getAllAsync<PaymentRow>('SELECT * FROM payments ORDER BY COALESCE(date,created_at) DESC'),
  ]);

  const paymentItems = entries.map(({ raw_json: _raw, ...item }) => item);
  const invoices: PaymentInvoice[] = documents.map((doc) => {
    const ledgerNet = paymentItems
      .filter((entry) => entry.invoice_id === doc.id)
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const received = Number(doc.advance || 0) + ledgerNet;
    const total = Number(doc.total || 0);
    const remaining = Math.max(0, total - received);
    const overpaid = Math.max(0, received - total);
    const status = overpaid > 0 ? 'OVERPAID' : remaining <= 0 && total > 0 ? 'PAID' : received > 0 ? 'PARTIAL' : 'UNPAID';
    return {
      id: doc.id,
      document_no: doc.document_no,
      document_date: doc.document_date,
      customer: doc.customer,
      project: doc.project,
      project_code: doc.project_code,
      project_uid: doc.project_uid,
      total,
      advance: Number(doc.advance || 0),
      ledger_net: ledgerNet,
      received,
      remaining,
      overpaid,
      status,
      updated_at: doc.updated_at,
    };
  });

  return { ok: true, invoices, entries: paymentItems };
}

async function getFinance(book: 'BUSINESS' | 'PERSONAL' = 'BUSINESS', month?: string): Promise<FinanceResponse> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<FinanceRow>(
    'SELECT * FROM finance_transactions WHERE book_type = ? ORDER BY date DESC',
    book,
  );
  const transactions = rows.map(({ raw_json: _raw, book_type: _book, ...tx }) => tx);
  const activeMonth = month || currentMonth();
  const monthly = transactions.filter((tx) => String(tx.date || '').slice(0, 7) === activeMonth);
  const today = new Date().toISOString().slice(0, 10);

  const income = (items: FinanceTransaction[]) => items
    .filter((x) => x.transaction_type === 'INCOME')
    .reduce((sum, x) => sum + Number(x.amount || 0), 0);
  const expense = (items: FinanceTransaction[]) => items
    .filter((x) => x.transaction_type === 'EXPENSE')
    .reduce((sum, x) => sum + Number(x.amount || 0), 0);

  const periodIncome = income(monthly);
  const periodExpense = expense(monthly);
  const todayRows = transactions.filter((tx) => String(tx.date || '').slice(0, 10) === today);
  const allIncome = income(transactions);
  const allExpense = expense(transactions);

  return {
    ok: true,
    schema_version: 'qqiva.offline.sqlite.v1',
    summary: {
      month: activeMonth,
      period_income: periodIncome,
      period_expense: periodExpense,
      period_net: periodIncome - periodExpense,
      today_income: income(todayRows),
      today_expense: expense(todayRows),
      balance: allIncome - allExpense,
    },
    book: { transactions },
    context: { storage_mode: 'OFFLINE_SQLITE', server_required: false },
  };
}

async function deleteHistory(id: string) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM documents WHERE id = ?', id);
  return { ok: true };
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const qqivaApi = {
  getHistory,
  getPayments,
  getProducts,
  getContracts,
  getFinance,
  deleteHistory,
  healthCheck: async () => {
    await getDatabase();
    return true;
  },
};
