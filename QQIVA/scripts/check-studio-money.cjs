// Run: node scripts/check-studio-money.cjs
// Exercise the real TS modules; only native I/O is replaced with memory stubs.
/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const XLSX = require('xlsx');
const root = path.resolve(__dirname, '..');
const cache = new Map(), json = new Map(), documents = new Map(), files = new Map();
let printedHtml = '';
const mocks = {
  'expo-sqlite': {},
  '@/data/seed/seedJsonAssets': { seedJsonAssets: {} },
  'react-native': { StyleSheet: { create: value => value }, Image: 'Image', Text: 'Text', View: 'View' },
  '@/services/media': { imageSource: () => undefined, resolveImageUri: async () => '', getExportDirectory: async () => 'memory/' },
  'expo-file-system/legacy': { EncodingType: { Base64: 'base64', UTF8: 'utf8' }, copyAsync: async () => {}, getInfoAsync: async () => ({ exists: true, size: 128 }), writeAsStringAsync: async (name, value) => files.set(name, value) },
  'expo-print': { printToFileAsync: async ({ html }) => { printedHtml = html; return { uri: 'memory/print.pdf' }; } },
  'expo-sharing': { isAvailableAsync: async () => false },
  'expo-media-library/legacy': { requestPermissionsAsync: async () => ({ granted: true }), createAssetAsync: async uri => ({ uri }), getAlbumAsync: async () => null, createAlbumAsync: async () => ({}) },
};
function load(name) {
  if (mocks[name]) return mocks[name];
  if (!name.startsWith('@/')) return require(name);
  if (cache.has(name)) return cache.get(name).exports;
  const base = path.join(root, 'src', name.slice(2));
  const filename = fs.existsSync(base + '.ts') ? base + '.ts' : base + '.tsx';
  const module = { exports: {} }; cache.set(name, module);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(load, module, module.exports);
  return module.exports;
}
const database = load('@/db/database');
database.getDatabase = async () => ({
  getFirstAsync: async (sql, key) => sql.includes('FROM json_store') ? (json.has(key) ? { json: json.get(key) } : null) : sql.includes('FROM documents') ? { raw_json: documents.get(key) } : null,
  getAllAsync: async () => [],
  runAsync: async (sql, ...args) => {
    if (sql.includes('INTO json_store')) json.set(args[0], args[1]);
    if (sql.includes('INTO documents')) documents.set(args[0], args.at(-1));
  },
});
const engine = load('@/services/documentEngine');
const preview = load('@/components/ProfessionalTemplatePreview');
const exporter = load('@/services/export');

assert.deepEqual(preview.getStudioPageSize({ format: 'A4' }), { width: 1240, height: 1754, orientation: 'portrait' });
assert.deepEqual(preview.getStudioPageSize({ format: 'PORTRAIT' }), { width: 1240, height: 1754, orientation: 'portrait' });
assert.deepEqual(preview.getStudioPageSize({ format: 'LANDSCAPE' }), { width: 1754, height: 1240, orientation: 'landscape' });
assert.deepEqual(preview.getStudioPageSize({ format: 'SQUARE' }), { width: 1240, height: 1240, orientation: 'square' });
const studioSource = fs.readFileSync(path.join(root, 'src/app/professional-studio.tsx'), 'utf8');
assert.equal(studioSource.includes('onPress={()=>void shareExport()}'), true);
assert.equal(studioSource.includes('onPress={()=>void exportPdf()}'), true);
assert.equal(fs.readFileSync(path.join(root, 'src/services/export.ts'), 'utf8').includes('await share(dest,\'image/png\')'), false);

// Use the actual Studio builder too: this catches a fallback reintroduced in the UI.
const source = ts.createSourceFile('studio.tsx', fs.readFileSync(path.join(root, 'src/app/professional-studio.tsx'), 'utf8'), ts.ScriptTarget.Latest, true);
let builder;
function findBuilder(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'buildDocumentState') builder = node.initializer.getText(source);
  ts.forEachChild(node, findBuilder);
}
findBuilder(source); assert.ok(builder);
function build(items, config) {
  const scope = { ...engine, items, config, baseState: { company: {}, project: {} }, selectedTemplate: { id: 'test', title: 'Test' }, info: { documentKind: 'QUOTE', documentNo: '', documentDate: '2026-09-12' }, clone: value => JSON.parse(JSON.stringify(value)), today: () => '2026-09-12' };
  const code = ts.transpileModule('return (' + builder + ')();', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), code)(...Object.values(scope));
}
const money = value => Math.round(value).toLocaleString('vi-VN') + ' đ';
async function checkOutputs(state, expected) {
  const snapshot = engine.professionalSnapshot(state);
  const canonical = engine.visibleItems(state);
  snapshot.items.forEach((item, i) => {
    assert.equal(item.qty, canonical[i].item.qty);
    assert.equal(engine.effectivePrice(engine.studioDocumentItem(item)), engine.effectivePrice(canonical[i].item));
    assert.equal(preview.lineAmount(item), engine.documentLineAmount(canonical[i].item));
  });
  assert.equal(preview.calculateStudioTotals(snapshot.items, snapshot.config).grandTotal, expected);
  assert.equal(engine.makeSummary(state).total, expected);
  await exporter.exportAdQuotePdf(state, snapshot.config);
  assert.equal(printedHtml.match(/class="grand"[^>]*>[\s\S]*?<b>([^<]*)/)[1], money(expected));
  await exporter.exportCurrentDocumentPdf(state);
  assert.equal(printedHtml.match(/class="grand"[^>]*>[\s\S]*?<b>([^<]*)/)[1], money(expected));
  const uri = await exporter.exportCurrentDocumentXlsx(state);
  const workbook = XLSX.read(files.get(uri), { type: 'base64' });
  const summary = XLSX.utils.sheet_to_json(workbook.Sheets['Thông tin'], { header: 1 });
  assert.equal(summary.find(row => row[0] === 'Tổng cộng')[1], expected);
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Chứng từ']);
  const sourceRows = engine.visibleItems(state);
  assert.equal(rows.length, sourceRows.length);
  rows.forEach((row, i) => {
    assert.equal(row['Thành tiền'], engine.documentLineAmount(sourceRows[i].item));
    assert.equal(row['Khối lượng'], sourceRows[i].item.qty);
    assert.equal(row['Đơn giá'] * row['Hệ số'], engine.effectivePrice(sourceRows[i].item));
  });
}
async function main() {
  const item = { id: 'line-1', name: 'Product', qty: 1, price: 100000, discount: 100 };
  const cases = [
    { items: [item], config: {}, total: 0 },
    { items: [{ ...item, discount: 0 }], config: { vatEnabled: true, vatRate: 0 }, total: 100000 },
    { items: [{ ...item, qty: 2, discount: 10 }], config: { discountEnabled: true, discountValue: 10, surchargeEnabled: true, surchargeValue: 10000, vatEnabled: true, vatRate: 10 }, total: 189200 },
    { items: [{ ...item, discount: 0 }], config: { discountEnabled: true, discountType: 'fixed', discountValue: 20000, surchargeEnabled: true, surchargeType: 'percent', surchargeValue: 10, vatEnabled: true, vatRate: 0 }, total: 88000 },
  ];
  for (const test of cases) {
    assert.equal(preview.calculateStudioTotals(test.items, test.config).grandTotal, test.total);
    const state = build(test.items, test.config);
    await checkOutputs(state, test.total);
    const saved = await engine.saveDocument(state);
    assert.equal(saved.meta.total, test.total);
    assert.equal(saved.state.professional_studio.info.documentNo, saved.meta.document_no);
    assert.equal(JSON.parse(documents.get(saved.meta.id)).meta.total, test.total);
    await checkOutputs(await engine.openDocument(saved.meta.id), test.total);
  }
  assert.equal(engine.effectivePrice({ price: 100000, unit_price: 0 }), 0);
  assert.equal(engine.effectivePrice({ price: 100000, price_multiplier: 0 }), 0);
  assert.equal(engine.effectivePrice({ price: 100000, unit_price: null }), 100000);
  assert.equal(engine.studioPricing({ vatEnabled: true }).vat_rate, 10);

  const edited = build([{ ...item, discount: 20 }], { vatEnabled: true, vatRate: 10 });
  const row = edited.floors[0].rooms[0].items[0];
  row.qty = 3; row.unit_price = 25000; // Document Editor updates the net price only.
  edited.project.pricing.vat_rate = 0;
  const saved = await engine.saveDocument(edited);
  assert.equal(saved.state.professional_studio.items[0].price, 25000);
  assert.equal(saved.state.professional_studio.items[0].discount, 0);
  await checkOutputs(saved.state, 75000);
  row.unit_price = 0;
  await checkOutputs((await engine.saveDocument(edited)).state, 0);
  row.unit_price = 25000; row.price_multiplier = 2;
  await checkOutputs((await engine.saveDocument(edited)).state, 150000);
  row.price_multiplier = 0;
  await checkOutputs((await engine.saveDocument(edited)).state, 0);
  row.price_multiplier = 1;
  row.hidden = true;
  await checkOutputs((await engine.saveDocument(edited)).state, 0);
  delete row.hidden; row.deleted = true;
  await checkOutputs((await engine.saveDocument(edited)).state, 0);
  edited.floors = []; // An empty canonical list must not resurrect snapshot items.
  assert.equal((await engine.saveDocument(edited)).state.professional_studio.items.length, 0);
  edited.floors = [{ rooms: [{ items: [{ id: 'manual', name: 'Manual', qty: 2, price: 5000 }] }] }];
  await checkOutputs((await engine.saveDocument(edited)).state, 10000);

  const legacy = build([item], { vatEnabled: true, vatRate: 0 });
  delete legacy.floors; delete legacy.project.pricing;
  const migrated = engine.normalizeState(legacy);
  assert.equal(engine.visibleItems(migrated).length, 1);
  await checkOutputs(migrated, 0);
  console.log('PASS: zero price/discount/VAT, Studio builder, save/reopen, both PDF paths, Excel, editor changes, hidden/deleted rows, legacy snapshot.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
