import * as SQLite from 'expo-sqlite';

const DB_NAME = 'qqiva_business_offline.db';
const SCHEMA_VERSION = 'qqiva-rn-offline-v2';
const SOURCE_SNAPSHOT = 'QQIVA-1.5.93.77-2026-09-10';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase() {
  if (!dbPromise) dbPromise = openAndPrepare();
  return dbPromise;
}

async function openAndPrepare() {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS json_store (
      key TEXT PRIMARY KEY NOT NULL,
      json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS studio_records (
      kind TEXT NOT NULL,
      id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT,
      meta_json TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      PRIMARY KEY (kind, id)
    );
    CREATE INDEX IF NOT EXISTS idx_studio_records_updated ON studio_records(kind, updated_at DESC);

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT,
      customer TEXT,
      project TEXT,
      document_no TEXT,
      document_date TEXT,
      customer_code TEXT,
      project_code TEXT,
      project_uid TEXT,
      total REAL NOT NULL DEFAULT 0,
      advance REAL NOT NULL DEFAULT 0,
      remaining REAL NOT NULL DEFAULT 0,
      status TEXT,
      raw_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS product_groups (
      id TEXT PRIMARY KEY NOT NULL,
      code TEXT,
      name TEXT NOT NULL,
      sort_order REAL NOT NULL DEFAULT 0,
      system_kind TEXT,
      raw_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      group_code TEXT,
      group_id TEXT,
      group_name TEXT,
      catalog_key TEXT,
      image TEXT,
      unit TEXT,
      price REAL NOT NULL DEFAULT 0,
      description TEXT,
      favorite INTEGER NOT NULL DEFAULT 0,
      hidden INTEGER NOT NULL DEFAULT 0,
      raw_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY NOT NULL,
      contract_no TEXT,
      title TEXT,
      category TEXT,
      status TEXT,
      customer TEXT,
      project TEXT,
      value REAL NOT NULL DEFAULT 0,
      deposit REAL NOT NULL DEFAULT 0,
      remaining REAL NOT NULL DEFAULT 0,
      contract_date TEXT,
      created_at TEXT,
      updated_at TEXT,
      raw_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      invoice_id TEXT,
      project_uid TEXT,
      customer TEXT,
      project TEXT,
      document_no TEXT,
      amount REAL NOT NULL DEFAULT 0,
      date TEXT,
      method TEXT,
      note TEXT,
      reversal_of TEXT,
      created_at TEXT,
      raw_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS finance_transactions (
      id TEXT PRIMARY KEY NOT NULL,
      book_type TEXT NOT NULL,
      transaction_type TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      date TEXT,
      note TEXT,
      party_name TEXT,
      project_uid TEXT,
      project_name TEXT,
      category_id TEXT,
      account_id TEXT,
      deleted_at TEXT,
      raw_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      tax_id TEXT,
      address TEXT,
      email TEXT,
      note TEXT,
      created_at TEXT,
      updated_at TEXT,
      raw_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      project_uid TEXT UNIQUE,
      customer_id TEXT,
      customer TEXT,
      customer_code TEXT,
      name TEXT,
      address TEXT,
      project_code TEXT,
      status TEXT,
      note TEXT,
      created_at TEXT,
      updated_at TEXT,
      raw_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY NOT NULL,
      owner_type TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      uri TEXT NOT NULL,
      original_name TEXT,
      mime TEXT,
      size INTEGER NOT NULL DEFAULT 0,
      legacy_path TEXT,
      created_at TEXT NOT NULL,
      raw_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      before_json TEXT,
      after_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_documents_project_uid ON documents(project_uid);
    CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
    CREATE INDEX IF NOT EXISTS idx_products_group_id ON products(group_id);
    CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_finance_date ON finance_transactions(date DESC);
    CREATE INDEX IF NOT EXISTS idx_projects_uid ON projects(project_uid);
    CREATE INDEX IF NOT EXISTS idx_attachments_owner ON attachments(owner_type, owner_id);

    CREATE TABLE IF NOT EXISTS retail_schema_migration (
      version TEXT PRIMARY KEY,
      applied_at_utc TEXT NOT NULL,
      source_qqiva_version TEXT NOT NULL,
      checksum TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS retail_business (
      business_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'VND',
      timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
      active INTEGER NOT NULL DEFAULT 1,
      created_at_utc TEXT NOT NULL,
      updated_at_utc TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS retail_branch (
      branch_id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at_utc TEXT NOT NULL,
      updated_at_utc TEXT NOT NULL,
      UNIQUE (business_id, code),
      FOREIGN KEY (business_id) REFERENCES retail_business(business_id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS retail_warehouse (
      warehouse_id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      branch_id TEXT,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at_utc TEXT NOT NULL,
      updated_at_utc TEXT NOT NULL,
      UNIQUE (business_id, code),
      FOREIGN KEY (business_id) REFERENCES retail_business(business_id) ON DELETE RESTRICT,
      FOREIGN KEY (branch_id) REFERENCES retail_branch(branch_id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS retail_device (
      device_id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      branch_id TEXT,
      device_name TEXT NOT NULL,
      device_kind TEXT NOT NULL DEFAULT 'ANDROID_OFFLINE',
      active INTEGER NOT NULL DEFAULT 1,
      created_at_utc TEXT NOT NULL,
      last_seen_at_utc TEXT,
      FOREIGN KEY (business_id) REFERENCES retail_business(business_id) ON DELETE RESTRICT,
      FOREIGN KEY (branch_id) REFERENCES retail_branch(branch_id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS retail_product_profile (
      business_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name_snapshot TEXT NOT NULL DEFAULT '',
      library_group_id_snapshot TEXT NOT NULL DEFAULT '',
      track_stock INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      library_missing INTEGER NOT NULL DEFAULT 0,
      created_at_utc TEXT NOT NULL,
      updated_at_utc TEXT NOT NULL,
      PRIMARY KEY (business_id, product_id),
      FOREIGN KEY (business_id) REFERENCES retail_business(business_id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS retail_sku (
      sku_id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      sku_code TEXT NOT NULL,
      variant_name TEXT NOT NULL DEFAULT '',
      unit TEXT NOT NULL DEFAULT '',
      cost_price_minor INTEGER,
      retail_price_minor INTEGER,
      currency TEXT NOT NULL DEFAULT 'VND',
      track_stock INTEGER NOT NULL DEFAULT 1,
      allow_negative_stock INTEGER NOT NULL DEFAULT 0,
      min_stock_micros INTEGER,
      active INTEGER NOT NULL DEFAULT 1,
      created_at_utc TEXT NOT NULL,
      updated_at_utc TEXT NOT NULL,
      UNIQUE (business_id, sku_code),
      FOREIGN KEY (business_id, product_id) REFERENCES retail_product_profile(business_id, product_id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS retail_barcode (
      barcode_id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      sku_id TEXT NOT NULL,
      barcode TEXT NOT NULL,
      barcode_type TEXT NOT NULL DEFAULT 'EAN',
      is_primary INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at_utc TEXT NOT NULL,
      UNIQUE (business_id, barcode),
      FOREIGN KEY (business_id) REFERENCES retail_business(business_id) ON DELETE RESTRICT,
      FOREIGN KEY (sku_id) REFERENCES retail_sku(sku_id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS stock_transaction (
      stock_tx_id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      warehouse_id TEXT NOT NULL,
      sku_id TEXT NOT NULL,
      tx_type TEXT NOT NULL,
      qty_delta_micros INTEGER NOT NULL,
      unit_cost_minor INTEGER,
      reference_type TEXT NOT NULL,
      reference_id TEXT NOT NULL,
      reversal_of_stock_tx_id TEXT,
      idempotency_key TEXT NOT NULL,
      actor_id TEXT,
      device_id TEXT,
      occurred_at_utc TEXT NOT NULL,
      created_at_utc TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      UNIQUE (business_id, idempotency_key),
      FOREIGN KEY (business_id) REFERENCES retail_business(business_id) ON DELETE RESTRICT,
      FOREIGN KEY (warehouse_id) REFERENCES retail_warehouse(warehouse_id) ON DELETE RESTRICT,
      FOREIGN KEY (sku_id) REFERENCES retail_sku(sku_id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS stock_balance (
      business_id TEXT NOT NULL,
      warehouse_id TEXT NOT NULL,
      sku_id TEXT NOT NULL,
      on_hand_micros INTEGER NOT NULL DEFAULT 0,
      updated_at_utc TEXT NOT NULL,
      ledger_version INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (business_id, warehouse_id, sku_id),
      FOREIGN KEY (business_id) REFERENCES retail_business(business_id) ON DELETE RESTRICT,
      FOREIGN KEY (warehouse_id) REFERENCES retail_warehouse(warehouse_id) ON DELETE RESTRICT,
      FOREIGN KEY (sku_id) REFERENCES retail_sku(sku_id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS sale (
      sale_id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      warehouse_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      sale_no TEXT NOT NULL,
      customer_id TEXT,
      customer_name TEXT,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      currency TEXT NOT NULL DEFAULT 'VND',
      subtotal_minor INTEGER NOT NULL DEFAULT 0,
      discount_total_minor INTEGER NOT NULL DEFAULT 0,
      tax_total_minor INTEGER NOT NULL DEFAULT 0,
      total_minor INTEGER NOT NULL DEFAULT 0,
      paid_total_minor INTEGER NOT NULL DEFAULT 0,
      payment_status TEXT NOT NULL DEFAULT 'UNPAID',
      idempotency_key TEXT NOT NULL,
      created_by_actor_id TEXT,
      created_at_utc TEXT NOT NULL,
      completed_at_utc TEXT,
      voided_at_utc TEXT,
      UNIQUE (business_id, sale_no),
      UNIQUE (business_id, idempotency_key),
      FOREIGN KEY (business_id) REFERENCES retail_business(business_id) ON DELETE RESTRICT,
      FOREIGN KEY (branch_id) REFERENCES retail_branch(branch_id) ON DELETE RESTRICT,
      FOREIGN KEY (warehouse_id) REFERENCES retail_warehouse(warehouse_id) ON DELETE RESTRICT,
      FOREIGN KEY (device_id) REFERENCES retail_device(device_id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS sale_item (
      sale_item_id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      line_no INTEGER NOT NULL,
      product_id TEXT NOT NULL,
      sku_id TEXT NOT NULL,
      product_name_snapshot TEXT NOT NULL,
      sku_code_snapshot TEXT NOT NULL,
      variant_name_snapshot TEXT NOT NULL DEFAULT '',
      unit_snapshot TEXT NOT NULL DEFAULT '',
      qty_micros INTEGER NOT NULL,
      unit_price_minor INTEGER NOT NULL,
      discount_minor INTEGER NOT NULL DEFAULT 0,
      tax_minor INTEGER NOT NULL DEFAULT 0,
      line_total_minor INTEGER NOT NULL,
      unit_cost_snapshot_minor INTEGER,
      note TEXT NOT NULL DEFAULT '',
      UNIQUE (sale_id, line_no),
      FOREIGN KEY (sale_id) REFERENCES sale(sale_id) ON DELETE RESTRICT,
      FOREIGN KEY (sku_id) REFERENCES retail_sku(sku_id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS sale_payment (
      payment_id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      business_id TEXT NOT NULL,
      method TEXT NOT NULL,
      amount_minor INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'CONFIRMED',
      external_ref TEXT,
      idempotency_key TEXT NOT NULL,
      paid_at_utc TEXT NOT NULL,
      created_at_utc TEXT NOT NULL,
      UNIQUE (business_id, idempotency_key),
      FOREIGN KEY (sale_id) REFERENCES sale(sale_id) ON DELETE RESTRICT,
      FOREIGN KEY (business_id) REFERENCES retail_business(business_id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS retail_audit_log (
      audit_id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT,
      created_at_utc TEXT NOT NULL
    );
  `);

  await seedFirstInstall(db);
  await migrateStudioRecords(db);
  await bootstrapRetail(db);
  await db.runAsync('INSERT OR REPLACE INTO app_meta (key,value) VALUES (?,?)', 'schema_version', SCHEMA_VERSION);
  return db;
}

async function seedFirstInstall(db: SQLite.SQLiteDatabase) {
  const marker = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_meta WHERE key=?', 'source_snapshot');
  if (marker?.value) return;

  // Keep the large seed module out of normal reloads; only first install needs it.
  const { seedJsonAssets } = await import('@/data/seed/seedJsonAssets');

  const [state, products, history, sequences, projectLog, payments, contractTemplates, adTemplates, adDrafts, groups, contracts, finance, adPrefs] = await Promise.all([
    seedJsonAssets.state, seedJsonAssets.product_library, seedJsonAssets.document_history, seedJsonAssets.document_sequences,
    seedJsonAssets.project_identity_history, seedJsonAssets.payment_ledger, seedJsonAssets.contract_templates, seedJsonAssets.ad_quote_templates,
    seedJsonAssets.ad_quote_drafts, seedJsonAssets.product_groups, seedJsonAssets.contracts, seedJsonAssets.finance_ledger, seedJsonAssets.ad_quote_preferences,
  ]);

  const now = new Date().toISOString();
  const stores: Record<string, unknown> = {
    state,
    product_library: products,
    document_history: history,
    document_sequences: sequences,
    project_identity_history: projectLog,
    payment_ledger: payments,
    contract_templates: contractTemplates,
    ad_quote_templates: adTemplates,
    ad_quote_drafts: adDrafts,
    product_groups: groups,
    contracts,
    finance_ledger: finance,
    ad_quote_preferences: adPrefs,
  };

  await db.withTransactionAsync(async () => {
    for (const [key, value] of Object.entries(stores)) {
      await db.runAsync('INSERT OR REPLACE INTO json_store (key,json,updated_at) VALUES (?,?,?)', key, JSON.stringify(value), now);
    }

    for (const entry of array(history)) await upsertDocumentRow(db, entry);
    for (const group of array(groups)) await upsertGroupRow(db, group);
    for (const item of array(products)) await upsertProductRow(db, item);
    for (const item of array(contracts)) await upsertContractRow(db, item);
    for (const item of array(payments)) await upsertPaymentRow(db, item);

    const books = object(finance?.books);
    for (const [bookType, book] of Object.entries<any>(books)) {
      for (const tx of array(book?.transactions)) await upsertFinanceRow(db, bookType, tx);
    }

    await seedDerivedCustomersAndProjects(db, array(history), state);
    await db.runAsync('INSERT OR REPLACE INTO app_meta (key,value) VALUES (?,?)', 'source_snapshot', SOURCE_SNAPSHOT);
  });
}

async function migrateStudioRecords(db: SQLite.SQLiteDatabase) {
  const marker = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_meta WHERE key=?', 'studio_storage_v1');
  if (marker?.value === 'done') return;
  const draftRow = await db.getFirstAsync<{ json: string }>('SELECT json FROM json_store WHERE key=?', 'ad_quote_drafts');
  const templateRow = await db.getFirstAsync<{ json: string }>('SELECT json FROM json_store WHERE key=?', 'ad_quote_templates');
  const drafts = parseSeedRows(draftRow?.json);
  const templates = parseSeedRows(templateRow?.json);
  await db.withTransactionAsync(async () => {
    for (const row of drafts) await upsertStudioRecord(db, 'draft', row);
    for (const row of templates) await upsertStudioRecord(db, 'template', row);
    await db.runAsync('INSERT OR REPLACE INTO app_meta (key,value) VALUES (?,?)', 'studio_storage_v1', 'done');
  });
}

function parseSeedRows(raw?: string) {
  if (!raw) return [];
  try { const value = JSON.parse(raw); return Array.isArray(value) ? value : []; } catch { return []; }
}

function studioMeta(row: any) {
  const meta = { ...row };
  delete meta.work;
  if (meta.config && typeof meta.config === 'object') {
    meta.config = { ...meta.config };
    if (meta.config.fields && typeof meta.config.fields === 'object') {
      meta.config.fields = { ...meta.config.fields };
      for (const key of Object.keys(meta.config.fields)) if (isLargeDataUri(meta.config.fields[key])) delete meta.config.fields[key];
    }
    if (meta.config.featuredImages) delete meta.config.featuredImages;
    if (isLargeDataUri(meta.config.coverData)) delete meta.config.coverData;
    if (isLargeDataUri(meta.config.backgroundData)) delete meta.config.backgroundData;
  }
  return meta;
}

function isLargeDataUri(value: any) { return typeof value === 'string' && value.startsWith('data:') && value.length > 4096; }

export async function upsertStudioRecord(db: SQLite.SQLiteDatabase, kind: 'draft' | 'template', row: any) {
  if (!row?.id) return;
  await db.runAsync('INSERT OR REPLACE INTO studio_records (kind,id,name,created_at,updated_at,meta_json,payload_json) VALUES (?,?,?,?,?,?,?)',
    kind, text(row.id), text(row.name || (kind === 'draft' ? 'Bản nháp' : 'Mẫu thiết kế')), text(row.created_at), text(row.updated_at), JSON.stringify(studioMeta(row)), JSON.stringify(row));
}

async function seedDerivedCustomersAndProjects(db: SQLite.SQLiteDatabase, history: any[], state: any) {
  const customerKeys = new Map<string, any>();
  const projectKeys = new Map<string, any>();
  const candidates = history.map((x) => x?.state).filter(Boolean);
  if (state) candidates.push(state);

  for (const s of candidates) {
    const p = object(s?.project);
    const customer = text(p.customer).trim();
    const address = text(p.address || p.project_name).trim();
    const uid = text(p.project_uid).trim();
    const customerCode = text(p.customer_code).trim();
    const projectCode = text(p.project_code).trim();
    if (customer) {
      const key = customer.toLocaleLowerCase('vi');
      if (!customerKeys.has(key)) customerKeys.set(key, { id: `CUS-${hashId(key)}`, name: customer, address, phone: text(p.phone), tax_id: text(p.tax_id) });
    }
    if (uid || customer || address || projectCode) {
      const key = uid || `${customer.toLocaleLowerCase('vi')}|${address.toLocaleLowerCase('vi')}|${projectCode.toLocaleLowerCase('vi')}`;
      if (!projectKeys.has(key)) projectKeys.set(key, { id: `PROJECT-${hashId(key)}`, project_uid: uid || `PRJ-${hashId(key)}`, customer, customer_code: customerCode, name: address || projectCode || customer || 'Công trình', address, project_code: projectCode, status: 'ACTIVE' });
    }
  }

  const now = new Date().toISOString();
  for (const c of customerKeys.values()) {
    await db.runAsync(`INSERT OR IGNORE INTO customers (id,name,phone,tax_id,address,email,note,created_at,updated_at,raw_json) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      c.id,c.name,c.phone || '',c.tax_id || '',c.address || '','','',now,now,JSON.stringify(c));
  }
  for (const p of projectKeys.values()) {
    await db.runAsync(`INSERT OR IGNORE INTO projects (id,project_uid,customer_id,customer,customer_code,name,address,project_code,status,note,created_at,updated_at,raw_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      p.id,p.project_uid,'',p.customer || '',p.customer_code || '',p.name || '',p.address || '',p.project_code || '',p.status || 'ACTIVE','',now,now,JSON.stringify(p));
  }
}

async function bootstrapRetail(db: SQLite.SQLiteDatabase) {
  const exists = await db.getFirstAsync<{ business_id: string }>('SELECT business_id FROM retail_business LIMIT 1');
  if (exists) return;
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync('INSERT INTO retail_business (business_id,name,currency,timezone,active,created_at_utc,updated_at_utc) VALUES (?,?,?,?,?,?,?)', 'LOCAL-BUSINESS', 'QQIVA Business', 'VND', 'Asia/Ho_Chi_Minh', 1, now, now);
    await db.runAsync('INSERT INTO retail_branch (branch_id,business_id,name,code,active,created_at_utc,updated_at_utc) VALUES (?,?,?,?,?,?,?)', 'LOCAL-BRANCH', 'LOCAL-BUSINESS', 'Cửa hàng chính', 'MAIN', 1, now, now);
    await db.runAsync('INSERT INTO retail_warehouse (warehouse_id,business_id,branch_id,name,code,is_default,active,created_at_utc,updated_at_utc) VALUES (?,?,?,?,?,?,?,?,?)', 'LOCAL-WAREHOUSE', 'LOCAL-BUSINESS', 'LOCAL-BRANCH', 'Kho chính', 'MAIN', 1, 1, now, now);
    await db.runAsync('INSERT INTO retail_device (device_id,business_id,branch_id,device_name,device_kind,active,created_at_utc,last_seen_at_utc) VALUES (?,?,?,?,?,?,?,?)', 'ANDROID-DEVICE', 'LOCAL-BUSINESS', 'LOCAL-BRANCH', 'QQIVA Android', 'ANDROID_OFFLINE', 1, now, now);
    await db.runAsync('INSERT OR REPLACE INTO retail_schema_migration (version,applied_at_utc,source_qqiva_version,checksum,note) VALUES (?,?,?,?,?)', 'qqiva.retail.v1', now, SOURCE_SNAPSHOT, 'offline-port', 'Ported from retail_v1_schema.sql');
  });
}

export async function replaceDatabaseFromSeed() {
  const db = await getDatabase();
  await db.execAsync(`
    DELETE FROM app_meta WHERE key='source_snapshot';
    DELETE FROM json_store;
    DELETE FROM documents;
    DELETE FROM product_groups;
    DELETE FROM products;
    DELETE FROM contracts;
    DELETE FROM payments;
    DELETE FROM finance_transactions;
    DELETE FROM customers;
    DELETE FROM projects;
    DELETE FROM attachments;
    DELETE FROM audit_log;
    DELETE FROM studio_records;
    DELETE FROM app_meta WHERE key='studio_storage_v1';
  `);
  await seedFirstInstall(db);
}

export async function upsertDocumentRow(db: SQLite.SQLiteDatabase, entry: any) {
  const meta = object(entry?.meta);
  if (!meta.id) return;
  await db.runAsync(`INSERT OR REPLACE INTO documents
    (id,type,created_at,updated_at,customer,project,document_no,document_date,customer_code,project_code,project_uid,total,advance,remaining,status,raw_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    text(meta.id), text(meta.type || 'UNKNOWN'), text(meta.created_at), text(meta.updated_at), text(meta.customer), text(meta.project), text(meta.document_no),
    text(meta.document_date), text(meta.customer_code), text(meta.project_code), text(meta.project_uid), num(meta.total), num(meta.advance), num(meta.remaining), text(meta.status), JSON.stringify(entry));
}

export async function upsertGroupRow(db: SQLite.SQLiteDatabase, group: any) {
  if (!group?.id) return;
  await db.runAsync('INSERT OR REPLACE INTO product_groups (id,code,name,sort_order,system_kind,raw_json) VALUES (?,?,?,?,?,?)',
    text(group.id), text(group.code), text(group.name || group.code || 'Nhóm'), num(group.sort_order), text(group.system_kind), JSON.stringify(group));
}

export async function upsertProductRow(db: SQLite.SQLiteDatabase, item: any) {
  if (!item?.id) return;
  await db.runAsync(`INSERT OR REPLACE INTO products
    (id,name,group_code,group_id,group_name,catalog_key,image,unit,price,description,favorite,hidden,raw_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, text(item.id), text(item.name || 'Sản phẩm'), text(item.group), text(item.group_id), text(item.group_name), text(item.catalog_key),
    text(item.image), text(item.unit), num(item.price), text(item.description || item.note), item.favorite ? 1 : 0, item.hidden ? 1 : 0, JSON.stringify(item));
}

export async function upsertContractRow(db: SQLite.SQLiteDatabase, item: any) {
  if (!item?.id) return;
  await db.runAsync(`INSERT OR REPLACE INTO contracts
    (id,contract_no,title,category,status,customer,project,value,deposit,remaining,contract_date,created_at,updated_at,raw_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, text(item.id),text(item.contract_no),text(item.title),text(item.category),text(item.status),text(item.customer),text(item.project),num(item.value),num(item.deposit),num(item.remaining),text(item.contract_date),text(item.created_at),text(item.updated_at),JSON.stringify(item));
}

export async function upsertPaymentRow(db: SQLite.SQLiteDatabase, item: any) {
  if (!item?.id) return;
  await db.runAsync(`INSERT OR REPLACE INTO payments
    (id,type,invoice_id,project_uid,customer,project,document_no,amount,date,method,note,reversal_of,created_at,raw_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, text(item.id),text(item.type || 'PAYMENT'),text(item.invoice_id),text(item.project_uid),text(item.customer),text(item.project),text(item.document_no),num(item.amount),text(item.date),text(item.method),text(item.note),text(item.reversal_of),text(item.created_at),JSON.stringify(item));
}

export async function upsertFinanceRow(db: SQLite.SQLiteDatabase, bookType: string, tx: any) {
  if (!tx?.id) return;
  await db.runAsync(`INSERT OR REPLACE INTO finance_transactions
    (id,book_type,transaction_type,amount,date,note,party_name,project_uid,project_name,category_id,account_id,deleted_at,raw_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, text(tx.id),text(bookType),text(tx.transaction_type),num(tx.amount),text(tx.date),text(tx.note),text(tx.party_name),text(tx.project_uid),text(tx.project_name),text(tx.category_id),text(tx.account_id),text(tx.deleted_at),JSON.stringify(tx));
}

export function text(value: unknown) { return value == null ? '' : String(value); }
export function num(value: unknown) { const n = Number(value ?? 0); return Number.isFinite(n) ? n : 0; }
export function array(value: unknown): any[] { return Array.isArray(value) ? value : []; }
export function object(value: unknown): Record<string, any> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}; }

function hashId(value: string) {
  let h = 2166136261;
  for (let i=0;i<value.length;i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36).toUpperCase();
}
