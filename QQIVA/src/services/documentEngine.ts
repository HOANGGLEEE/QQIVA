import { getDatabase, object, array, num, text, upsertDocumentRow } from '@/db/database';
import { getJson, setJson } from '@/db/jsonStore';
import { clone, makeId, nowIso, today } from '@/services/id';

export type QQIVAState = Record<string, any>;

export async function getLiveState(): Promise<QQIVAState> {
  const state = await getJson<QQIVAState>('state', {});
  return state.professional_studio?.schema ? normalizeState(state) : state;
}

export async function saveLiveState(state: QQIVAState) {
  await setJson('state', normalizeState(state));
}

export function isInvoice(state: QQIVAState) {
  return String(state?.document_mode || 'quote').toLowerCase() === 'invoice';
}

export function visibleItems(state: QQIVAState) {
  const out: { floor: string; room: string; item: any }[] = [];
  for (const floor of array(state?.floors)) {
    for (const room of array(floor?.rooms)) {
      for (const item of array(room?.items)) {
        if (item?.hidden || item?.deleted) continue;
        out.push({ floor: text(floor?.name || floor?.floor), room: text(room?.name || room?.room), item });
      }
    }
  }
  return out;
}

export function prepareSmartDocument(stateInput: QQIVAState, mode: 'quote' | 'invoice') {
  const state = normalizeState(stateInput);
  state.document_mode = mode;
  state.quote_mode = 'PROJECT';
  state.quick_quote_active = false;
  state.project_quote = null;
  const rows = visibleItems(state);
  const usable = rows.filter(({ item }) => text(item?.name).trim() && num(item?.qty) > 0);
  if (!usable.length) throw new Error(mode === 'invoice' ? 'Chưa có dữ liệu để tạo hóa đơn' : 'Chưa có dữ liệu để tạo báo giá');
  return state;
}

export function effectivePrice(item: any) {
  const base = num(item?.unit_price ?? item?.price);
  const multiplier = item?.price_multiplier == null ? 1 : Math.max(0, num(item.price_multiplier));
  return base * multiplier;
}

export function documentLineAmount(item: any) {
  return Math.max(0, num(item?.qty)) * effectivePrice(item);
}

export function studioDocumentItem(item: any) {
  const price = Math.max(0, num(item.price ?? item.unit_price));
  const discount = Math.min(100, Math.max(0, num(item.discount ?? item.discount_percent)));
  return { ...item, qty: Math.max(0, num(item.qty)), price, base_unit_price: price,
    unit_price: price * (1 - discount / 100), discount_percent: discount, price_multiplier: 1 };
}

export function studioPricing(config: any) {
  return {
    discount_enabled: !!config.discountEnabled, discount_type: config.discountType || 'percent', discount_value: num(config.discountValue),
    surcharge_enabled: !!config.surchargeEnabled, surcharge_label: config.surchargeLabel || 'Phụ phí', surcharge_type: config.surchargeType || 'fixed', surcharge_value: num(config.surchargeValue),
    vat_enabled: !!config.vatEnabled, vat_rate: num(config.vatRate ?? 10),
  };
}

// floors is authoritative; Studio keeps a compatible presentation snapshot.
export function professionalSnapshot(state: QQIVAState): QQIVAState {
  const studio = object(state.professional_studio), p = object(state.project), c = object(state.company);
  const cfg = { ...studioPricing(object(studio.config)), ...object(p.pricing) };
  const rows = Array.isArray(state.floors) ? visibleItems(state).map(row => row.item) : array(studio.items).map(studioDocumentItem);
  const previous = new Map(array(studio.items).map(item => [text(item.id), item]));
  const items = rows.map(item => {
    const price = effectivePrice(item), base = num(item.base_unit_price ?? item.price ?? item.unit_price);
    const discount = Math.min(100, Math.max(0, num(item.discount_percent)));
    // An editor can override the net price; retain the discount only while it still matches.
    const keepDiscount = price === base * (1 - discount / 100);
    return { ...object(previous.get(text(item.id))), ...item, id: text(item.id), name: text(item.name), qty: Math.max(0, num(item.qty)),
      price: keepDiscount ? base : price, discount: keepDiscount ? discount : 0,
      group: text(item.category ?? item.group) };
  });
  return { ...studio, items,
    config: { ...object(studio.config), discountEnabled: cfg.discount_enabled, discountType: cfg.discount_type, discountValue: cfg.discount_value,
      surchargeEnabled: cfg.surcharge_enabled, surchargeLabel: cfg.surcharge_label, surchargeType: cfg.surcharge_type, surchargeValue: cfg.surcharge_value,
      vatEnabled: cfg.vat_enabled, vatRate: cfg.vat_rate },
    info: { ...object(studio.info), documentKind: isInvoice(state) ? 'INVOICE' : 'QUOTE',
      documentNo: p.quote_no ?? studio.info?.documentNo, documentDate: p.quote_date ?? studio.info?.documentDate,
      customerName: p.customer ?? studio.info?.customerName, customerPhone: p.phone ?? studio.info?.customerPhone,
      projectName: p.project_name ?? studio.info?.projectName, address: p.address ?? studio.info?.address, note: p.quote_note ?? studio.info?.note,
      companyName: c.name ?? studio.info?.companyName, companyAddress: c.address ?? studio.info?.companyAddress,
      companyPhone: c.phone ?? studio.info?.companyPhone, companyWebsite: c.website ?? studio.info?.companyWebsite },
  };
}

export function pricingBreakdown(state: QQIVAState) {
  const subtotal = visibleItems(state).reduce((sum, row) => sum + documentLineAmount(row.item), 0);
  const cfg = object(object(state?.project).pricing);
  let discount = 0;
  if (cfg.discount_enabled && num(cfg.discount_value) > 0) {
    discount = String(cfg.discount_type || 'percent').toLowerCase() === 'fixed'
      ? num(cfg.discount_value)
      : subtotal * num(cfg.discount_value) / 100;
    discount = Math.min(subtotal, Math.max(0, discount));
  }
  const afterDiscount = Math.max(0, subtotal - discount);
  let surcharge = 0;
  if (cfg.surcharge_enabled && num(cfg.surcharge_value) > 0) {
    surcharge = String(cfg.surcharge_type || 'fixed').toLowerCase() === 'percent'
      ? afterDiscount * num(cfg.surcharge_value) / 100
      : num(cfg.surcharge_value);
    surcharge = Math.max(0, surcharge);
  }
  const beforeVat = Math.max(0, afterDiscount + surcharge);
  const vat = cfg.vat_enabled ? beforeVat * Math.max(0, num(cfg.vat_rate ?? 10)) / 100 : 0;
  return { subtotal, discount, after_discount: afterDiscount, surcharge, before_vat: beforeVat, vat, grand_total: beforeVat + vat, config: cfg };
}

export function totalAdvance(state: QQIVAState) {
  const p = object(state?.project);
  const advances = array(p.advances);
  if (advances.length) return advances.reduce((sum, x) => sum + Math.max(0, num(x?.amount)), 0);
  return Math.max(0, num(p.advance));
}

export async function allocateDocumentNo(mode: 'quote' | 'invoice') {
  const sequences = await getJson<Record<string, number>>('document_sequences', {});
  const year = new Date().getFullYear(); const prefix = mode === 'invoice' ? 'INV' : 'QUO'; const key = `${prefix}-${year}`;
  let current = Math.max(0, Number(sequences[key] || 0));
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ document_no: string }>('SELECT document_no FROM documents');
  const rx = new RegExp(`^${prefix}-${year}-(\\d+)$`, 'i');
  for (const row of rows) { const m = String(row.document_no || '').match(rx); if (m) current = Math.max(current, Number(m[1] || 0)); }
  current += 1; sequences[key] = current; await setJson('document_sequences', sequences);
  return `${prefix}-${year}-${String(current).padStart(4, '0')}`;
}

export async function newDocument(mode: 'quote' | 'invoice') {
  const old = await getLiveState();
  const base = normalizeState({
    company: clone(object(old.company)), settings: clone(object(old.settings)), document_language: old.document_language || 'vi',
    document_mode: mode, invoice_mode: old.invoice_mode || 'phao', quote_mode: 'PROJECT',
    project: clone(object(old.project)), floors: [], materials: [], ceiling_materials: [], mam_sets: [],
    new_document: { workflow_version: '2.0.0-rn', created_at: nowIso(), sources: [], scope_note: '' },
    direct_measurement: clone(object(old.direct_measurement)), quick_flow: clone(object(old.quick_flow)), quick_quote: { items: [], quote_state: null }, quick_invoice: { items: [], quote_state: null },
  });
  const project = object(base.project);
  project.quote_no = await allocateDocumentNo(mode); project.quote_date = today(); project.valid_until = mode === 'quote' ? addDays(today(), num(project.validity_days || 30)) : '';
  project.advance = 0; project.advances = []; base.project = project;
  delete base.history_document_id; delete base.history_saved_at; delete base.conversion;
  await saveLiveState(base); return base;
}

export async function saveDocument(stateInput?: QQIVAState, status = 'Đã lưu') {
  const state = normalizeState(stateInput || await getLiveState());
  const project = object(state.project); const mode = isInvoice(state) ? 'invoice' : 'quote';
  if (!text(project.quote_no).trim()) project.quote_no = await allocateDocumentNo(mode);
  if (!text(project.quote_date).trim()) project.quote_date = today();
  if (mode === 'quote' && !text(project.valid_until).trim()) project.valid_until = addDays(project.quote_date, num(project.validity_days || 30));
  state.project = project;
  if (state.professional_studio?.schema) state.professional_studio = professionalSnapshot(state);
  const history = await getJson<any[]>('document_history', []);
  const existingId = text(state.history_document_id).trim();
  const existing = history.find((x) => text(x?.meta?.id) === existingId);
  const now = nowIso();
  const meta = makeSummary(state, existingId || undefined, existing?.meta?.created_at, now, existing?.meta?.status || status);
  state.history_document_id = meta.id; state.history_saved_at = now;
  const entry = { meta, state: clone(state) };
  if (existing) { existing.meta = meta; existing.state = clone(state); }
  else history.push(entry);
  await setJson('document_history', history);
  await saveLiveState(state);
  const db = await getDatabase(); await upsertDocumentRow(db, entry);
  await syncCustomerProjectFromState(state);
  await logAudit('SAVE_DOCUMENT', 'document', meta.id, existing || null, entry);
  return entry;
}

export async function listDocuments() {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>('SELECT * FROM documents ORDER BY COALESCE(updated_at,created_at,document_date) DESC');
  return rows.map((r) => ({ ...r, raw: safeJson(r.raw_json, {}) }));
}

export async function getDocument(id: string) {
  const db = await getDatabase(); const row = await db.getFirstAsync<any>('SELECT raw_json FROM documents WHERE id=?', id);
  return row ? safeJson<any>(row.raw_json, null) : null;
}

export async function openDocument(id: string) {
  const entry = await getDocument(id); if (!entry) throw new Error('Không tìm thấy chứng từ');
  const state = normalizeState(entry.state || {}); state.history_document_id = id; await saveLiveState(state); return state;
}

export async function deleteDocument(id: string) {
  const db = await getDatabase(); const before = await getDocument(id);
  await db.runAsync('DELETE FROM documents WHERE id=?', id);
  const history = (await getJson<any[]>('document_history', [])).filter((x) => text(x?.meta?.id) !== id);
  await setJson('document_history', history); await logAudit('DELETE_DOCUMENT', 'document', id, before, null);
}

export async function duplicateDocument(id: string) {
  const src = await getDocument(id); if (!src) throw new Error('Không tìm thấy chứng từ');
  const st = clone(src.state || {}); delete st.history_document_id; delete st.history_saved_at;
  const mode = isInvoice(st) ? 'invoice' : 'quote';
  st.project = object(st.project); st.project.quote_no = await allocateDocumentNo(mode); st.project.quote_date = today(); st.project.valid_until = mode === 'quote' ? addDays(today(), num(st.project.validity_days || 30)) : '';
  await saveLiveState(st); return saveDocument(st, 'Bản sao');
}

export async function convertQuoteToInvoice(id: string) {
  const src = await getDocument(id); if (!src) throw new Error('Không tìm thấy báo giá nguồn');
  const st = clone(src.state || {}); if (isInvoice(st)) throw new Error('Chỉ có thể tạo hóa đơn từ báo giá');
  const p = object(st.project); const sourceNo = text(p.quote_no); const sourceDate = text(p.quote_date); const sourceNote = text(p.quote_note);
  delete st.history_document_id; delete st.history_saved_at;
  st.document_mode = 'invoice'; st.quote_mode = 'PROJECT'; st.quick_quote_active = false; st.project_quote = null;
  p.quote_no = await allocateDocumentNo('invoice'); p.quote_date = today(); p.valid_until = ''; p.quote_note = ''; p.advance = 0; p.advances = []; st.project = p;
  for (const floor of array(st.floors)) for (const room of array(floor.rooms)) for (const item of array(room.items)) if (String(item.status || '').toUpperCase() === 'QUICK_QUOTE') item.status = 'QUOTE_TO_INVOICE';
  st.conversion = { type: 'QUOTE_TO_INVOICE', source_history_id: text(src.meta?.id), source_type: text(src.meta?.type || 'QUOTE'), source_quote_no: sourceNo, source_quote_date: sourceDate, source_quote_note: sourceNote, source_saved_at: text(src.meta?.updated_at), converted_at: nowIso(), note: 'Hóa đơn được tạo từ báo giá; báo giá gốc được giữ nguyên trong lịch sử.' };
  await saveLiveState(st); return st;
}

export async function importAiPayload(payload: any) {
  const old = await getLiveState(); const normalized = Array.isArray(payload) ? { floors: payload } : payload;
  const project = { ...object(old.project), ...object(normalized?.project) };
  project.customer = normalized?.project?.customer || normalized?.project?.name || project.customer || '';
  project.address = normalized?.project?.address || normalized?.project?.location || project.address || '';
  const next = normalizeState({ ...old, project, floors: clone(array(normalized?.floors)), quote_mode: 'PROJECT' });
  next.project_quote = { invoice_mode: next.invoice_mode, materials: clone(array(next.materials)), ceiling_materials: clone(array(next.ceiling_materials)), mam_sets: clone(array(next.mam_sets)), floors: clone(array(next.floors)) };
  await saveLiveState(next); return next;
}

export function makeSummary(state: QQIVAState, id?: string, createdAt?: string, updatedAt?: string, status = 'Đã lưu') {
  const p = object(state.project); const total = pricingBreakdown(state).grand_total; const advance = isInvoice(state) ? totalAdvance(state) : 0;
  return {
    id: id || makeId('DOC'), type: isInvoice(state) ? 'INVOICE' : (String(state.quote_mode || '').toUpperCase() === 'QUICK' ? 'QUICK_QUOTE' : 'QUOTE'),
    created_at: createdAt || nowIso(), updated_at: updatedAt || nowIso(), customer: text(p.customer), project: text(p.project_name || p.address),
    document_no: text(p.quote_no), document_date: text(p.quote_date), customer_code: text(p.customer_code), project_code: text(p.project_code), project_uid: text(p.project_uid),
    total, advance, remaining: isInvoice(state) ? Math.max(0, total - advance) : total,
    source_quote_id: text(object(state.conversion).source_history_id), converted_from_quote: object(state.conversion).type === 'QUOTE_TO_INVOICE', status,
  };
}

export function normalizeState(input: any): QQIVAState {
  const s = clone(object(input));
  if (s.professional_studio?.schema && !Array.isArray(s.floors)) {
    s.floors = [{ name: 'Hạng mục', rooms: [{ name: '', items: array(s.professional_studio.items).map(studioDocumentItem) }] }];
  }
  s.company = object(s.company); s.project = object(s.project); s.settings = object(s.settings);
  s.document_mode = String(s.document_mode || 'quote').toLowerCase() === 'invoice' ? 'invoice' : 'quote'; s.invoice_mode = s.invoice_mode || 'phao'; s.quote_mode = s.quote_mode || 'PROJECT';
  s.floors = array(s.floors); s.materials = array(s.materials); s.ceiling_materials = array(s.ceiling_materials); s.mam_sets = array(s.mam_sets);
  const p = s.project; p.customer = text(p.customer); p.address = text(p.address || p.project_name); p.customer_code = text(p.customer_code); p.project_code = text(p.project_code); p.project_uid = text(p.project_uid);
  p.quote_no = text(p.quote_no); p.quote_date = text(p.quote_date); p.validity_days = Math.max(1, num(p.validity_days || 30)); p.valid_until = text(p.valid_until); p.quote_note = text(p.quote_note);
  p.pricing = { ...studioPricing(s.professional_studio?.schema ? object(s.professional_studio.config) : {}), ...object(p.pricing) };
  p.payment_terms = { enabled: false, due_days: 0, due_date: '', method: 'bank_transfer', method_other: '', transfer_note: '', deposit_terms: '', installment_terms: '', terms_text: '', ...object(p.payment_terms) };
  p.signing = { enabled: false, customer_name: '', customer_title: '', customer_signature: '', show_company_signature: true, show_company_stamp: true, ...object(p.signing) };
  p.advances = array(p.advances); s.project = p;
  if (s.professional_studio?.schema) s.professional_studio = professionalSnapshot(s);
  return s;
}

export async function updateProjectIdentity(docIds: string[], identity: { customer?: string; customer_code?: string; address?: string; project_code?: string }, projectUid?: string) {
  if (!docIds.length) throw new Error('Chưa chọn chứng từ của công trình');
  if (![identity.customer, identity.address, identity.project_code].some((x) => text(x).trim())) throw new Error('Cần có tên khách hàng, địa chỉ hoặc mã công trình');
  const history = await getJson<any[]>('document_history', []); const uid = projectUid || `PRJ-${makeId('').replace(/[^A-Z0-9]/g, '').slice(-12)}`; const now = nowIso(); let changed = 0;
  const db = await getDatabase();
  for (const entry of history) {
    if (!docIds.includes(text(entry?.meta?.id))) continue;
    const st = normalizeState(entry.state || {}); const p = object(st.project); p.customer = text(identity.customer).trim(); p.customer_code = text(identity.customer_code).trim(); p.address = text(identity.address).trim(); p.project_name = p.address; p.project_code = text(identity.project_code).trim(); p.project_uid = uid; st.project = p;
    entry.state = st; entry.meta = makeSummary(st, entry.meta?.id, entry.meta?.created_at, now, entry.meta?.status || 'Đã lưu'); await upsertDocumentRow(db, entry); changed += 1;
  }
  await setJson('document_history', history); await syncAllProjects();
  const logs = await getJson<any[]>('project_identity_history', []); logs.push({ at: now, action: 'UPDATE_IDENTITY', doc_ids: docIds, project_uid: uid, after: identity }); await setJson('project_identity_history', logs.slice(-500));
  return { updated: changed, project_uid: uid };
}

export async function mergeProjects(sourceDocIds: string[], targetDocIds: string[]) {
  const target = (await Promise.all(targetDocIds.map(getDocument))).filter(Boolean).sort((a: any,b: any) => text(b?.meta?.updated_at).localeCompare(text(a?.meta?.updated_at)))[0];
  if (!target || !sourceDocIds.length) throw new Error('Cần chọn đủ công trình nguồn và công trình đích');
  const p = object(target.state?.project); const identity = { customer: text(p.customer), customer_code: text(p.customer_code), address: text(p.address || p.project_name), project_code: text(p.project_code) };
  const uid = text(p.project_uid) || `PRJ-${makeId('').replace(/[^A-Z0-9]/g, '').slice(-12)}`;
  const all = Array.from(new Set([...sourceDocIds, ...targetDocIds])); const result = await updateProjectIdentity(all, identity, uid);
  const db = await getDatabase(); for (const id of all) await db.runAsync('UPDATE payments SET project_uid=?, customer=?, project=? WHERE invoice_id=?', uid, identity.customer, identity.address, id);
  return { ...result, identity };
}

export async function syncAllProjects() {
  const history = await getJson<any[]>('document_history', []); const db = await getDatabase(); const byUid = new Map<string, any>();
  for (const entry of history) {
    const p = object(entry?.state?.project); const uid = text(p.project_uid) || `AUTO-${text(entry?.meta?.customer)}|${text(entry?.meta?.project)}|${text(entry?.meta?.project_code)}`;
    if (!byUid.has(uid)) byUid.set(uid, { project_uid: uid.startsWith('AUTO-') ? '' : uid, customer: text(p.customer || entry?.meta?.customer), customer_code: text(p.customer_code || entry?.meta?.customer_code), name: text(p.project_name || p.address || entry?.meta?.project), address: text(p.address || p.project_name || entry?.meta?.project), project_code: text(p.project_code || entry?.meta?.project_code), status: 'ACTIVE' });
  }
  for (const [key,p] of byUid) {
    const id = `PROJECT-${simpleHash(key)}`; const now = nowIso();
    await db.runAsync(`INSERT OR REPLACE INTO projects (id,project_uid,customer_id,customer,customer_code,name,address,project_code,status,note,created_at,updated_at,raw_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, id,p.project_uid || null,'',p.customer,p.customer_code,p.name,p.address,p.project_code,p.status,'',now,now,JSON.stringify(p));
  }
}

async function syncCustomerProjectFromState(state: QQIVAState) {
  const db = await getDatabase(); const p = object(state.project); const customer = text(p.customer).trim(); const now = nowIso();
  if (customer) {
    const key = customer.toLocaleLowerCase('vi'); const id = `CUS-${simpleHash(key)}`;
    const old = await db.getFirstAsync<any>('SELECT raw_json,created_at FROM customers WHERE id=?', id); const raw:any = { ...safeJson<any>(old?.raw_json, {}), id, name: customer, address: text(p.address), phone: text(p.phone), tax_id: text(p.tax_id), email: text(p.email), note: text(p.customer_note) };
    await db.runAsync(`INSERT OR REPLACE INTO customers (id,name,phone,tax_id,address,email,note,created_at,updated_at,raw_json) VALUES (?,?,?,?,?,?,?,?,?,?)`, id,customer,text(raw.phone),text(raw.tax_id),text(raw.address),text(raw.email),text(raw.note),old?.created_at || now,now,JSON.stringify(raw));
  }
  await syncAllProjects();
}

async function logAudit(action: string, entityType: string, entityId: string, before: any, after: any) {
  const db = await getDatabase(); await db.runAsync('INSERT INTO audit_log (id,action,entity_type,entity_id,before_json,after_json,created_at) VALUES (?,?,?,?,?,?,?)', makeId('AUD'),action,entityType,entityId,before ? JSON.stringify(before) : '',after ? JSON.stringify(after) : '',nowIso());
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00`); if (Number.isNaN(d.getTime())) return ''; d.setDate(d.getDate() + Math.max(1, Math.floor(days || 30))); return d.toISOString().slice(0,10);
}
function safeJson<T>(raw: string | null | undefined, fallback: T): T { try { return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; } }
function simpleHash(value: string) { let h=2166136261; for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);} return (h>>>0).toString(36).toUpperCase(); }
