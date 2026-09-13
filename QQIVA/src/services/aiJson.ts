import { evaluateFormula } from '@/services/formula';
import { makeId } from '@/services/id';

export const AI_SCHEMA_VERSION = 'INVOICE_JSON_SCHEMA_V1';

const COMMON_PROMPT = `
KHÓA CỨNG BẮT BUỘC:
1. Không được dùng trí nhớ về công trình cũ để điền dữ liệu còn thiếu. Chỉ dùng nguồn tôi gửi trong lượt làm việc hiện tại.
2. Giữ cấu trúc Tầng → Phòng/Khu vực → Hạng mục. Không gán phép đo của phòng này sang phòng khác.
3. Giữ nguyên phép đo/công thức gốc ở formula và/hoặc measurements. KHÔNG tự đặt qty độc lập: qty phải đúng bằng kết quả của formula/measurements; QQIVA sẽ tính lại và đánh dấu NEED_CHECK nếu lệch.
4. Phép tính số học phải được thực hiện bằng calculation engine/code, không nhẩm cảm tính.
5. Không chắc ký tự/số/phòng/hạng mục: KHÔNG ĐOÁN. Đặt status=NEED_CHECK hoặc NEED_USER_CONFIRMATION và confidence=LOW.
6. Không đưa ảnh sản phẩm, đơn giá, khối lượng, khách hàng hay phòng/tầng của file/template/công trình cũ sang công trình mới nếu tôi không yêu cầu.
7. unit_price/price mặc định 0 nếu nguồn hiện tại không cung cấp. Giá sẽ do phần mềm điền sau.
8. JSON phải khai báo schema_version="${AI_SCHEMA_VERSION}".
9. KẾT QUẢ CHÍNH phải là JSON thuần hợp lệ để người dùng có thể sao chép trực tiếp về QQIVA. Không markdown, không code fence, không giải thích chen vào giữa JSON.
10. Nếu môi trường hỗ trợ tạo file, có thể đính kèm thêm FILE .json với tên HOA_DON_<TEN_CONG_TRINH>_ACTUAL_MEASUREMENT.json cho hóa đơn hoặc DU_TOAN_<TEN_CONG_TRINH>.json cho dự toán, nhưng vẫn phải hiển thị JSON thuần để sao chép.
11. Không yêu cầu người dùng tự sửa JSON bằng tay. Nếu dữ liệu chưa chắc chắn, giữ dòng đó và dùng NEED_CHECK / NEED_USER_CONFIRMATION.
12. Mỗi floor bắt buộc có floor_order là số thứ tự logic (1,2,3...). Không sắp tầng theo thứ tự ảnh hoặc thứ tự AI phát hiện. Tầng phải theo floor_order tăng dần.
13. Với cùng một nguồn đầu vào, không được tự thêm/bớt phòng, hạng mục hoặc thay đổi phép đo giữa các lần chạy. Nếu phát hiện mâu thuẫn, giữ dữ liệu đọc được và đánh dấu NEED_CHECK thay vì chọn ngẫu nhiên.
14. note chỉ dành cho dữ liệu nội bộ. Trên chứng từ QQIVA chỉ xuất 'Phép đo: <formula/measurements>'. Không nhét giải thích OCR, suy luận, nguồn ảnh, 'giống tầng...', mã nội bộ vào note hiển thị.
15. validator_status toàn tài liệu: PASS nếu mọi dòng đủ chắc chắn; NEED_USER_CONFIRMATION nếu còn ít nhất một dòng cần người dùng xác nhận.
16. qty phải là số khi phép đo đọc/tính chắc chắn. Nếu ký tự số chưa đọc chắc và formula/measurements chưa thể tính an toàn, BẮT BUỘC giữ qty=null, status=NEED_USER_CONFIRMATION hoặc NEED_CHECK, confidence=LOW. Không được điền 0 hoặc đoán số chỉ để JSON hợp lệ. QQIVA chấp nhận qty=null ở dòng cần xác nhận và sẽ chặn xuất chứng từ cho đến khi người dùng sửa/xác nhận.

CẤU TRÚC TỐI THIỂU MỖI ITEM:
name, category, unit, qty (number hoặc null khi NEED_CHECK/NEED_USER_CONFIRMATION), formula hoặc measurements, note, status, confidence, product_key.
`;

export const SMART_INVOICE_PROMPT = `WORKFLOW = ACTUAL_MEASUREMENT_IMAGE_TO_INVOICE_JSON
SOURCE TRUTH = ẢNH BẢNG ĐO THỰC TẾ tôi sẽ gửi.

Hãy nhìn trực tiếp ảnh bằng Vision, hiểu bố cục chứ không chỉ OCR. Tách đúng Tầng → Phòng/Khu vực → Hạng mục → phép đo. Giữ nguyên công thức gốc, tính qty bằng code/calculation engine. Ảnh đo thực tế là nguồn khối lượng; Excel/template nếu có chỉ là bố cục, không phải nguồn khối lượng.
${COMMON_PROMPT}
ROOT JSON bắt buộc có: schema_version, workflow, validator_status, project, floors[]. Mỗi floor có name, floor_order và rooms[]. Mỗi room có name và items[].
KẾT QUẢ CUỐI: hiển thị JSON thuần hợp lệ để người dùng sao chép vào QQIVA; có thể đính kèm thêm file .json nếu hỗ trợ.`;

export const SMART_QUOTE_PROMPT = `WORKFLOW = DRAWING_3D_TO_ESTIMATE_JSON
SOURCE TRUTH = PDF/BẢN VẼ + ẢNH 3D hiện tại.

Ưu tiên độ tin cậy: VECTOR_EXACT > DRAWING_DIMENSION > DRAWING_GEOMETRY > SCALED_ESTIMATE > 3D_ESTIMATE. Không tạo độ chính xác giả. Giữ rõ status/source/confidence của từng dòng. Tầng → Phòng/Khu vực → Hạng mục phải được bảo toàn.
${COMMON_PROMPT}
ROOT JSON bắt buộc có: schema_version, workflow, validator_status, project, floors[].`;

export const AI_JSON_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'ndqq://schemas/invoice-json-v1',
  title: AI_SCHEMA_VERSION,
  type: 'object',
  required: ['floors'],
  properties: {
    schema_version: { type: 'string' }, workflow: { type: 'string' },
    validator_status: { type: 'string', enum: ['PASS', 'NEED_USER_CONFIRMATION', 'NEED_CHECK'] },
    project: { type: 'object' }, floors: { type: 'array' },
  },
};

export type AiValidation = { errors: string[]; warnings: string[]; stats: { floors: number; rooms: number; items: number; need_check: number } };

export function extractJsonPayload(input: string): unknown {
  const raw = String(input || '').trim();
  if (!raw) throw new Error('Chưa có nội dung JSON.');
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], raw].filter(Boolean) as string[];
  for (const candidate of candidates) {
    try { return JSON.parse(candidate.trim().replace(/^\uFEFF/, '')); } catch { /* continue */ }
  }
  const firstObject = raw.indexOf('{'); const lastObject = raw.lastIndexOf('}');
  if (firstObject >= 0 && lastObject > firstObject) {
    try { return JSON.parse(raw.slice(firstObject, lastObject + 1)); } catch { /* continue */ }
  }
  const firstArray = raw.indexOf('['); const lastArray = raw.lastIndexOf(']');
  if (firstArray >= 0 && lastArray > firstArray) {
    try { return JSON.parse(raw.slice(firstArray, lastArray + 1)); } catch { /* continue */ }
  }
  throw new Error('Không tìm thấy JSON hợp lệ trong nội dung đã nhập.');
}

export function validateAiJson(input: unknown): AiValidation {
  const errors: string[] = []; const warnings: string[] = [];
  const stats = { floors: 0, rooms: 0, items: 0, need_check: 0 };
  let payload: any = input;
  if (Array.isArray(payload)) {
    warnings.push('JSON dạng danh sách cũ: QQIVA coi danh sách là floors. Nên dùng object có schema_version.');
    payload = { floors: payload };
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    errors.push('ROOT phải là object JSON.'); return { errors, warnings, stats };
  }
  const floors = payload.floors;
  if (!Array.isArray(floors)) { errors.push('Thiếu floors[] theo cấu trúc Tầng → Phòng → Hạng mục.'); return { errors, warnings, stats }; }
  const sv = String(payload.schema_version || '');
  if (sv && sv !== AI_SCHEMA_VERSION) warnings.push(`schema_version=${sv}; phần mềm chuẩn hiện tại là ${AI_SCHEMA_VERSION}.`);
  if (!sv) warnings.push(`JSON chưa khai báo schema_version. Khuyến nghị ${AI_SCHEMA_VERSION}.`);
  stats.floors = floors.length;
  floors.forEach((floor: any, fi: number) => {
    if (!floor || typeof floor !== 'object' || Array.isArray(floor)) { errors.push(`Tầng #${fi + 1} không phải object.`); return; }
    const rooms = floor.rooms;
    if (!Array.isArray(rooms)) { errors.push(`Tầng #${fi + 1} thiếu rooms[].`); return; }
    stats.rooms += rooms.length;
    rooms.forEach((room: any, ri: number) => {
      if (!room || typeof room !== 'object' || Array.isArray(room)) { errors.push(`Tầng #${fi + 1} / phòng #${ri + 1} không phải object.`); return; }
      const items = room.items;
      if (!Array.isArray(items)) { errors.push(`Tầng #${fi + 1} / phòng #${ri + 1} thiếu items[].`); return; }
      stats.items += items.length;
      items.forEach((item: any, ii: number) => {
        const loc = `Tầng #${fi + 1} / phòng #${ri + 1} / dòng #${ii + 1}`;
        if (!item || typeof item !== 'object' || Array.isArray(item)) { errors.push(`${loc} không phải object.`); return; }
        if (!String(item.name || item.item || '').trim()) errors.push(`${loc} thiếu name.`);
        const status = String(item.status || '').toUpperCase(); const conf = String(item.confidence || '').toUpperCase();
        const need = status.includes('NEED') || status.includes('CHECK') || ['LOW', 'UNCERTAIN'].includes(conf);
        if (need) stats.need_check += 1;
        const hasQty = Object.prototype.hasOwnProperty.call(item, 'qty');
        const hasFormula = !!String(item.formula || item.measurement_formula || '').trim();
        const calculated = hasFormula ? evaluateFormula(String(item.formula || item.measurement_formula)) : measurementQuantity(item.measurements);
        if (!hasQty && !hasFormula && calculated == null) errors.push(`${loc} thiếu qty hoặc formula.`);
        if (hasQty) {
          const raw = item.qty; const missing = raw == null || (typeof raw === 'string' && !raw.trim());
          if (missing && need) warnings.push(`${loc} qty chưa xác định; có thể nạp để xác nhận sau.`);
          else if (missing && !hasFormula) errors.push(`${loc} qty chưa có nhưng chưa đánh dấu NEED_CHECK.`);
          else if (!missing && !Number.isFinite(Number(raw))) errors.push(`${loc} qty không phải số.`);
          else if (!missing && Number(raw) < 0) errors.push(`${loc} qty âm.`);
          else if (!missing && calculated != null && Math.abs(Number(raw) - calculated) > Math.max(0.02, Math.abs(calculated) * 0.005)) {
            if (!need) stats.need_check += 1;
            warnings.push(`${loc} qty lệch phép đo tính lại; QQIVA dùng kết quả calculation engine và đánh dấu NEED_CHECK.`);
          }
        }
      });
    });
  });
  return { errors, warnings, stats };
}

export function normalizeAiPayload(input: unknown) {
  const payload: any = Array.isArray(input) ? { floors: input } : (input && typeof input === 'object' ? input : {});
  const validation = validateAiJson(payload);
  if (validation.errors.length) throw new Error(validation.errors.slice(0, 8).join(' | '));
  const floors = (Array.isArray(payload.floors) ? payload.floors : []).map((floor: any, fi: number) => ({
    ...floor,
    id: String(floor?.id || floor?.uid || makeId('FLR')),
    name: String(floor?.name || floor?.floor || floor?.zone || `Tầng/Khu vực ${fi + 1}`).trim(),
    rooms: (Array.isArray(floor?.rooms) ? floor.rooms : []).map((room: any, ri: number) => ({
      ...room,
      id: String(room?.id || room?.uid || makeId('ROM')),
      name: String(room?.name || room?.room || room?.zone || `Phòng/Khu vực ${ri + 1}`).trim(),
      items: (Array.isArray(room?.items) ? room.items : []).map((item: any) => normalizeItem(item)),
    })),
  }));
  const invoiceMode = String(payload.invoice_mode || inferInvoiceMode(floors));
  return {
    ...payload,
    schema_version: payload.schema_version || AI_SCHEMA_VERSION,
    validator_status: validation.stats.need_check ? 'NEED_CHECK' : 'PASS',
    project: payload.project && typeof payload.project === 'object' ? payload.project : {},
    invoice_mode: invoiceMode,
    floors,
    validation,
  };
}

function normalizeItem(item: any) {
  const formula = String(item?.formula || item?.measurement_formula || '').trim();
  const formulaQty = formula ? evaluateFormula(formula) : measurementQuantity(item?.measurements);
  const rawQty = item?.qty;
  const qtyMissing = rawQty == null || String(rawQty).trim() === '';
  const inputQty = formulaQty ?? Number(rawQty);
  const qty = Number.isFinite(Number(inputQty)) ? Math.max(0, Number(inputQty)) : 0;
  const statusRaw = String(item?.status || '').toUpperCase();
  const confidence = String(item?.confidence || '').toUpperCase();
  const formulaMismatch = !qtyMissing && formulaQty != null && Math.abs(Number(rawQty) - formulaQty) > Math.max(0.02, Math.abs(formulaQty) * 0.005);
  const needCheck = statusRaw.includes('NEED') || statusRaw.includes('CHECK') || ['LOW', 'UNCERTAIN'].includes(confidence) || formulaMismatch || (qtyMissing && formulaQty == null);
  const name = String(item?.name || item?.item || item?.title || 'Hạng mục').trim();
  const price = Number(item?.unit_price ?? item?.price ?? 0);
  return {
    ...item,
    id: String(item?.id || item?.uid || makeId('ITM')),
    name,
    qty,
    original_qty: qtyMissing ? null : Number(rawQty),
    formula,
    formula_qty: formulaQty,
    formula_mismatch: formulaMismatch,
    unit: String(item?.unit || item?.uom || '').trim(),
    unit_price: Number.isFinite(price) ? Math.max(0, price) : 0,
    price: Number.isFinite(price) ? Math.max(0, price) : 0,
    image: String(item?.image || item?.image_path || '').trim(),
    description: String(item?.description || item?.desc || '').trim(),
    note: String(item?.note || '').trim(),
    status: needCheck ? 'NEED_CHECK' : (statusRaw || 'LOCKED'),
    confidence: confidence || (needCheck ? 'LOW' : 'HIGH'),
    source: item?.source || item?.source_ref || '',
  };
}

function measurementQuantity(input: unknown) {
  if (!Array.isArray(input) || !input.length) return null;
  const values = input.map(row => {
    if (typeof row === 'number') return row;
    if (!row || typeof row !== 'object') return NaN;
    const value = ['value', 'qty', 'length', 'result'].map(key => (row as any)[key]).find(v => v != null && String(v).trim() !== '');
    return Number(String(value ?? '').replace(',', '.'));
  }).filter(Number.isFinite);
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) * 10000) / 10000 : null;
}

function inferInvoiceMode(floors: any[]) {
  let ceiling = false; let other = false;
  for (const floor of floors) for (const room of floor.rooms || []) for (const item of room.items || []) {
    const key = String(item.category || item.group || item.product_group || '').toLowerCase();
    if (key.includes('trần') || key.includes('tran') || key.includes('ceiling')) ceiling = true; else other = true;
  }
  return ceiling && other ? 'mixed' : ceiling ? 'ceiling' : 'phao';
}
