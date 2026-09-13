// Run: node scripts/check-studio-storage.cjs
// Storage contract test: metadata never reads payload_json; payload is parsed on demand.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(process.cwd());
const records = new Map();
const fakeDb = {
  async getAllAsync(sql) {
    return [...records.values()].filter(row => sql.includes(`kind='${row.kind}'`)).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))).map(row => ({ meta_json: row.meta_json }));
  },
  async getFirstAsync(sql, id) {
    if (sql.includes('payload_json')) return records.get(sql.includes("kind='draft'") ? `draft:${id}` : `template:${id}`) || null;
    return null;
  },
  async runAsync(sql, ...args) {
    if (sql.startsWith('INSERT OR REPLACE INTO studio_records')) {
      const [kind, id, name, created_at, updated_at, meta_json, payload_json] = args;
      records.set(`${kind}:${id}`, { kind, id, name, created_at, updated_at, meta_json, payload_json });
    }
    if (sql.startsWith('DELETE FROM studio_records')) records.delete(`${sql.includes("kind='draft'") ? 'draft' : 'template'}:${args[0]}`);
  },
};
const mocks = { '@/db/database': { getDatabase: async () => fakeDb, upsertStudioRecord: async (db, kind, row) => fakeDb.runAsync('INSERT OR REPLACE INTO studio_records', kind, row.id, row.name, row.created_at, row.updated_at, JSON.stringify({ id: row.id, name: row.name, created_at: row.created_at, updated_at: row.updated_at, config: { fields: { title: row.config?.fields?.title } } }), JSON.stringify(row)) }, '@/services/id': { makeId: () => 'generated', nowIso: () => '2026-09-12T00:00:00.000Z' }, '@/db/jsonStore': { getJson: async (key, fallback) => fallback, setJson: async () => {} } };
const cache = new Map();
function load(name) {
  if (mocks[name]) return mocks[name];
  if (cache.has(name)) return cache.get(name).exports;
  const file = path.join(root, 'src', name.slice(2) + '.ts');
  const module = { exports: {} }; cache.set(name, module);
  let code = fs.readFileSync(file, 'utf8');
  code = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)((request) => {
    if (request === '@/db/database') return mocks['@/db/database'];
    if (request === '@/services/id') return mocks['@/services/id'];
    if (request === '@/db/jsonStore') return mocks['@/db/jsonStore'];
    if (request.endsWith('assets/seed/data/professional_template_catalog.json')) return require(path.join(root, 'assets/seed/data/professional_template_catalog.json'));
    return require(request);
  }, module, module.exports);
  return module.exports;
}
const storage = load('@/services/adQuotes');
const huge = `data:image/png;base64,${'A'.repeat(1000000)}`;
const parseJson = JSON.parse;
let hugePayloadParses = 0;
JSON.parse = (value, ...args) => {
  if (typeof value === 'string' && value.includes('paymentQrData')) hugePayloadParses += 1;
  return parseJson(value, ...args);
};
function addLegacy(id, name, other) {
  const row = { id, name, created_at: '2026-09-01', updated_at: other ? '2026-09-02' : '2026-09-01', config: { fields: { title: name, paymentQrData: huge } }, work: { items: [{ id: other ? 'other-item' : 'item', qty: 1 }] } };
  records.set(`draft:${id}`, { kind: 'draft', id, name, created_at: row.created_at, updated_at: row.updated_at, meta_json: JSON.stringify({ id, name, created_at: row.created_at, updated_at: row.updated_at, config: { fields: { title: name } } }), payload_json: JSON.stringify(row) });
  return row;
}
async function main() {
  const first = addLegacy('old-1', 'Cũ 1', false);
  addLegacy('old-2', 'Cũ 2', true);
  const listed = await storage.listAdDrafts();
  assert.equal(listed.length, 2);
  assert.deepEqual(listed.map(x => x.name).sort(), ['Cũ 1', 'Cũ 2']);
  assert.equal(listed[0].work, undefined);
  assert.equal(JSON.stringify(listed).includes('paymentQrData'), false);
  assert.equal(hugePayloadParses, 0);
  const full = await storage.getAdDraft(first.id);
  assert.equal(hugePayloadParses, 1);
  assert.equal(full.work.items[0].id, 'item');
  assert.equal(full.config.fields.paymentQrData.length, huge.length);
  const beforeOther = await storage.getAdDraft('old-2');
  await storage.saveAdDraft({ ...full, name: 'Đã sửa', work: { items: [{ id: 'changed', qty: 9 }] } });
  assert.equal((await storage.getAdDraft('old-1')).name, 'Đã sửa');
  assert.equal((await storage.getAdDraft('old-1')).work.items[0].qty, 9);
  assert.deepEqual(await storage.getAdDraft('old-2'), beforeOther);
  const listedAfterReload = await storage.listAdDrafts();
  assert.equal(listedAfterReload.length, 2);
  assert.equal(listedAfterReload.find(x => x.id === 'old-1').name, 'Đã sửa');
  console.log(`PASS: legacy payload readable, metadata list omits payload/base64 (${JSON.stringify(listed).length} metadata bytes), one-draft save isolated, reload preserves records.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { JSON.parse = parseJson; });
