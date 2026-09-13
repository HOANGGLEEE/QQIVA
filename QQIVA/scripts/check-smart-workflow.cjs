// Run: node scripts/check-smart-workflow.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map(), json = new Map(), documents = new Map();
const mocks = { 'expo-sqlite': {}, 'expo-file-system/legacy': {}, '@/data/seed/seedJsonAssets': { seedJsonAssets: {} }, '@/services/media': { deleteAttachment: async () => {} } };
function load(name) {
  if (mocks[name]) return mocks[name];
  if (!name.startsWith('@/')) return require(name);
  if (cache.has(name)) return cache.get(name).exports;
  const file = path.join(root, 'src', name.slice(2) + '.ts');
  const module = { exports: {} }; cache.set(name, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(load, module, module.exports);
  return module.exports;
}
const database = load('@/db/database');
database.getDatabase = async () => ({
  getFirstAsync: async (sql, key) => sql.includes('FROM json_store') ? (json.has(key) ? { json: json.get(key) } : null) : { raw_json: documents.get(key) },
  getAllAsync: async () => [],
  runAsync: async (sql, ...args) => { if (sql.includes('INTO json_store')) json.set(args[0], args[1]); if (sql.includes('INTO documents')) documents.set(args[0], args.at(-1)); },
});
const engine = load('@/services/documentEngine');
const ai = load('@/services/aiJson');
const sources = load('@/services/sources');
const base = { project: {}, floors: [{ name: 'Tầng 1', rooms: [{ name: 'Phòng', items: [
  { id: 'keep', name: 'Giữ', qty: 2, unit: 'm²', price: 150000 },
  { id: 'zero', name: 'Không tính', qty: 0, unit: 'cái', price: 999 },
  { id: 'hidden', name: 'Ẩn', qty: 3, unit: 'm', price: 10, hidden: true },
  { id: 'deleted', name: 'Xóa', qty: 4, unit: 'm', price: 10, deleted: true },
] }] }] };
async function check(mode, expectedType) {
  const built = engine.prepareSmartDocument(base, mode);
  assert.equal(built.document_mode, mode);
  assert.equal(built.quote_mode, 'PROJECT');
  assert.deepEqual(engine.visibleItems(built).map(x => x.item.id), ['keep', 'zero']);
  assert.equal(engine.pricingBreakdown(built).subtotal, 300000);
  assert.deepEqual(built.floors[0].rooms[0].items[0], base.floors[0].rooms[0].items[0]);
  const saved = await engine.saveDocument(built);
  assert.equal(saved.meta.type, expectedType);
  const reopened = await engine.openDocument(saved.meta.id);
  assert.equal(reopened.document_mode, mode);
  assert.deepEqual(engine.visibleItems(reopened).map(x => [x.item.qty, x.item.unit, x.item.price]), [[2, 'm²', 150000], [0, 'cái', 999]]);
}
(async () => {
  const response = JSON.stringify({ schema_version: ai.AI_SCHEMA_VERSION, floors: [{ name: 'Tầng 1', rooms: [{ name: 'Phòng', items: [{ name: 'Phào', qty: 99, unit: 'md', price: 25000, formula: '(2,5 + 3) x 2', status: 'PASS', confidence: 'HIGH' }] }] }] });
  assert.deepEqual(ai.extractJsonPayload(response), ai.extractJsonPayload(`\`\`\`json\n${response}\n\`\`\``));
  assert.deepEqual(ai.extractJsonPayload(`Kết quả:\n${response}\nĐã xong.`), JSON.parse(response));
  assert.throws(() => ai.extractJsonPayload('không có json'), /Không tìm thấy JSON hợp lệ/);
  assert.ok(ai.validateAiJson({ nope: [] }).errors.length);
  const normalized = ai.normalizeAiPayload(JSON.parse(response));
  const measured = normalized.floors[0].rooms[0].items[0];
  assert.equal(measured.original_qty, 99);
  assert.equal(measured.qty, 11);
  assert.equal(measured.formula_mismatch, true);
  assert.equal(measured.status, 'NEED_CHECK');
  const measurementList = ai.normalizeAiPayload({ floors: [{ rooms: [{ items: [{ name: 'Nẹp', qty: 1, measurements: [{ length: '2,5' }, { qty: 3 }] }] }] }] });
  assert.equal(measurementList.floors[0].rooms[0].items[0].qty, 5.5);
  assert.match(ai.SMART_INVOICE_PROMPT, /ACTUAL_MEASUREMENT_IMAGE_TO_INVOICE_JSON/);
  await engine.newDocument('invoice');
  const imported = await sources.importSmartText(`\`\`\`json\n${response}\n\`\`\``);
  assert.equal(imported.state.document_mode, 'invoice');
  assert.equal(imported.state.floors[0].rooms[0].items[0].qty, 11);
  assert.equal(engine.prepareSmartDocument(imported.state, 'invoice').document_mode, 'invoice');
  assert.throws(() => engine.prepareSmartDocument({ floors: [] }, 'quote'), /Chưa có dữ liệu để tạo báo giá/);
  assert.throws(() => engine.prepareSmartDocument({ floors: [{ rooms: [{ items: [{ name: 'Zero', qty: 0 }] }] }] }, 'invoice'), /Chưa có dữ liệu để tạo hóa đơn/);
  await check('quote', 'QUOTE');
  await check('invoice', 'INVOICE');
  const ui = fs.readFileSync(path.join(root, 'src/app/smart-document.tsx'), 'utf8');
  assert.match(ui, /handoff\('\/document-editor'\)/);
  assert.match(ui, /handoff\('\/document-preview'\)/);
  assert.match(ui, /Clipboard\.getStringAsync/);
  assert.match(ui, /Linking\.openURL\('https:\/\/chatgpt\.com\/'\)/);
  console.log('PASS: raw/fenced/surrounded JSON, malformed/schema-invalid data, recalculated measurements, clipboard/link UI, Smart Quote/Invoice save/reopen and editor/preview handoff.');
})().catch(error => { console.error(error); process.exitCode = 1; });
