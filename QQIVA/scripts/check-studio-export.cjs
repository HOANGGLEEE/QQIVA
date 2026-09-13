// Run: node scripts/check-studio-export.cjs (native I/O mocked; not an Android test).
/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const compile = code => ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function extract(file, name, scope) {
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true);
  let code;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) code = node.initializer.getText(source);
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) code = node.getText(source).replace(/^export /, '');
    ts.forEachChild(node, visit);
  }
  visit(source); assert.ok(code, name);
  return new Function(...Object.keys(scope), compile(`return (${code});`))(...Object.values(scope));
}
const getStudioPageSize = extract('src/components/ProfessionalTemplatePreview.tsx', 'getStudioPageSize', {});
const rowsPerProfessionalPage = extract('src/components/ProfessionalTemplatePreview.tsx', 'rowsPerProfessionalPage', {});
const paginateProfessionalItems = extract('src/components/ProfessionalTemplatePreview.tsx', 'paginateProfessionalItems', { rowsPerProfessionalPage });
const calls = [];
let granted = true, album = null, printResult = { uri: 'file:///tmp.pdf' }, fileInfo = { exists: true, size: 100 };
const mocks = {
  'expo-file-system/legacy': { copyAsync: async value => calls.push(['copy', value]), getInfoAsync: async () => fileInfo, readAsStringAsync: async () => 'PDF', writeAsStringAsync: async (...args) => calls.push(['write', ...args]), EncodingType: { Base64: 'base64' }, StorageAccessFramework: { requestDirectoryPermissionsAsync: async () => ({ granted: true, directoryUri: 'content://folder/' }), createFileAsync: async () => 'content://folder/test.pdf' } },
  'expo-print': { printToFileAsync: async options => { calls.push(['print', options]); return printResult; } },
  'expo-sharing': { isAvailableAsync: async () => true, shareAsync: async uri => calls.push(['share', uri]) },
  'expo-media-library/legacy': {
    requestPermissionsAsync: async (...args) => { assert.deepEqual(args, [false, ['photo']]); return { granted }; },
    createAssetAsync: async uri => { calls.push(['asset', uri]); return { uri }; },
    getAlbumAsync: async () => album,
    createAlbumAsync: async (name, asset, copy) => { assert.equal(copy, false); album = { id: name }; },
    addAssetsToAlbumAsync: async (assets, target, copy) => assert.equal(copy, false),
  },
  '@/db/database': { object: value => value || {}, text: value => String(value || ''), num: value => Number(value || 0) },
  '@/services/documentEngine': { visibleItems: () => [], pricingBreakdown: () => ({ subtotal: 0, grand_total: 0 }) },
  '@/services/media': { getExportDirectory: async () => 'file:///exports/' },
  '@/db/jsonStore': { getJson: async () => '', setJson: async () => {} },
  '@/components/ProfessionalTemplatePreview': { getStudioPageSize, rowsPerProfessionalPage },
};
const mod = { exports: {} };
new Function('require', 'module', 'exports', compile(read('src/services/export.ts')))(name => mocks[name] || {}, mod, mod.exports);
const exporter = mod.exports;
async function main() {
  const items = Array.from({ length: 9 }, (_, id) => ({ id: String(id) }));
  assert.deepEqual(paginateProfessionalItems(items, { format: 'PHONE' }).map(x => x.length), [3, 3, 3]);
  assert.deepEqual(paginateProfessionalItems(items, { format: 'A4' }).map(x => x.length), [7, 2]);
  const previewSource = read('src/components/ProfessionalTemplatePreview.tsx');
  assert.match(previewSource, /testID="phone-product-list"/);
  assert.match(previewSource, /showTable&&!phone/);
  granted = false;
  await assert.rejects(exporter.persistCapturedPng('file:///tmp.png', 'test.png'), /Gallery/);
  granted = true;
  await exporter.persistCapturedPng('file:///tmp.png', 'test.png');
  assert.equal(calls.filter(x => x[0] === 'asset').length, 1);
  assert.equal(calls.filter(x => x[0] === 'share').length, 0);
  for (const file of ['src/app/professional-studio.tsx', 'src/app/document-preview.tsx']) {
    // In document-preview the last exportPng belongs to ContractPreview: select the Studio component.
    const source = read(file);
    const studioSource = file.includes('document-preview') ? source.slice(source.indexOf('function ProfessionalSavedPreview'), source.indexOf('function ContractPreview')) : source;
    const ast = ts.createSourceFile(file, studioSource, ts.ScriptTarget.Latest, true);
    let handler;
    function visit(node) { if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'exportPng') handler = node.initializer.getText(ast); ts.forEachChild(node, visit); }
    visit(ast); assert.ok(handler);
    for (const format of ['A4', 'PORTRAIT', 'LANDSCAPE', 'SQUARE', 'PHONE']) {
      const captures = [], saved = [], alerts = [], refs = { current: [1, 2, 3] };
      const scope = { selectedTemplate: {}, config: { format }, pages: [[], [], []], exportRefs: refs, info: { documentNo: 'TEST' }, getStudioPageSize, setBusy: () => {}, Alert: { alert: (...args) => alerts.push(args) }, captureRef: async (node, options) => { captures.push(options); return `file:///${node}.png`; }, persistCapturedPng: async (uri, name) => saved.push(name) };
      const run = new Function(...Object.keys(scope), compile(`return (${handler});`))(...Object.values(scope));
      await run();
      assert.equal(saved.length, 3); assert.equal(new Set(saved).size, 3);
      const size = getStudioPageSize({ format });
      captures.forEach(options => { assert.equal(options.width, size.width); assert.equal(options.height, size.height); });
      if (format === 'PHONE') { assert.deepEqual(size, { width: 1080, height: 1920, orientation: 'phone' }); assert.notDeepEqual([size.width, size.height], [1240, 1754]); }
      refs.current = [null]; alerts.length = 0;
      await run(); assert.match(alerts[0][0], /Không xuất/);
    }
  }
  calls.length = 0;
  const uri = await exporter.exportAdQuotePdf({ project: { quote_no: 'TEST' } });
  assert.equal(calls.filter(x => x[0] === 'print').length, 1);
  assert.equal(calls.find(x => x[0] === 'print')[1].base64, false);
  assert.equal(calls.filter(x => x[0] === 'share').length, 0);
  await exporter.shareLocalFile(uri, 'application/pdf');
  assert.equal(calls.filter(x => x[0] === 'share').length, 1);
  await exporter.saveVisiblePdf({ uri, filename: 'TEST_STUDIO.pdf' });
  assert.equal(calls.filter(x => x[0] === 'write').length, 1);
  for (const [format, width, height] of [['A4', 595, 842], ['PORTRAIT', 595, 842], ['LANDSCAPE', 842, 595], ['SQUARE', 595, 595], ['PHONE', 540, 960]]) {
    calls.length = 0;
    await exporter.exportAdQuotePdf({}, { format });
    const options = calls.find(x => x[0] === 'print')[1];
    assert.equal(options.width, width); assert.equal(options.height, height);
  }
  for (const file of ['src/app/professional-studio.tsx', 'src/app/document-preview.tsx']) assert.match(read(file), /device=\{String\(config\.format\)\.toUpperCase\(\)===['"]PHONE['"]\?['"]PHONE['"]:['"]A4['"]\} exportMode/);
  printResult = {};
  await assert.rejects(exporter.exportAdQuotePdf({}), /URI PDF/);
  printResult = { uri: 'file:///tmp.pdf' }; fileInfo = { exists: true, size: 0 };
  await assert.rejects(exporter.exportAdQuotePdf({}), /PDF rỗng/);
  console.log('PASS (mock I/O): Gallery/no share, permission retry, 3 unique PNGs in all formats in both Studio screens, missing-page error, PDF/no share, explicit share, invalid PDF rejection.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
