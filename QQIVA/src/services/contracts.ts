import { getDatabase, num, object, text, upsertContractRow } from '@/db/database';
import { getJson, setJson } from '@/db/jsonStore';
import { makeId, nowIso, today } from '@/services/id';

export const BUILTIN_CONTRACT_TEMPLATES = [
  {id:'builtin-construction',name:'Hợp đồng thi công / nội thất',category:'CONSTRUCTION',builtin:true,content:'ĐIỀU 1. PHẠM VI CÔNG VIỆC\nHai bên thống nhất phạm vi công việc theo nội dung và phụ lục đính kèm.\n\nĐIỀU 2. GIÁ TRỊ HỢP ĐỒNG\nGiá trị hợp đồng theo thỏa thuận và/hoặc báo giá được hai bên xác nhận.\n\nĐIỀU 3. TIẾN ĐỘ THỰC HIỆN\nTiến độ theo kế hoạch thi công và điều kiện thực tế.\n\nĐIỀU 4. THANH TOÁN\nThanh toán theo các đợt hai bên thống nhất.\n\nĐIỀU 5. NGHIỆM THU, BẢO HÀNH\nNghiệm thu theo khối lượng thực tế; bảo hành theo thỏa thuận.\n\nĐIỀU 6. TRÁCH NHIỆM VÀ CAM KẾT\nHai bên phối hợp và thực hiện đúng nghĩa vụ.'},
  {id:'builtin-sale',name:'Hợp đồng mua bán hàng hóa',category:'RETAIL',builtin:true,content:'ĐIỀU 1. HÀNG HÓA\nTên hàng, số lượng, đơn giá và thành tiền theo phụ lục.\n\nĐIỀU 2. GIÁ TRỊ HỢP ĐỒNG\nTheo bảng hàng hóa được xác nhận.\n\nĐIỀU 3. GIAO NHẬN\nTheo thời gian, địa điểm và phương thức thỏa thuận.\n\nĐIỀU 4. THANH TOÁN\nTheo phương thức và thời hạn hai bên thống nhất.\n\nĐIỀU 5. BẢO HÀNH / ĐỔI TRẢ\nTheo chính sách và điều kiện ghi trong hợp đồng.'},
  {id:'builtin-service',name:'Hợp đồng dịch vụ',category:'SERVICE',builtin:true,content:'ĐIỀU 1. NỘI DUNG DỊCH VỤ\nBên cung cấp thực hiện công việc theo phạm vi thống nhất.\n\nĐIỀU 2. THỜI GIAN THỰC HIỆN\nTheo các mốc bàn giao.\n\nĐIỀU 3. PHÍ DỊCH VỤ VÀ THANH TOÁN\nTheo thỏa thuận.\n\nĐIỀU 4. TRÁCH NHIỆM CÁC BÊN\nMỗi bên thực hiện nghĩa vụ liên quan.\n\nĐIỀU 5. NGHIỆM THU / CHẤM DỨT\nTheo thỏa thuận.'},
  {id:'builtin-deposit',name:'Hợp đồng đặt cọc',category:'DEPOSIT',builtin:true,content:'ĐIỀU 1. ĐỐI TƯỢNG ĐẶT CỌC\nHai bên xác nhận đối tượng và mục đích đặt cọc.\n\nĐIỀU 2. GIÁ TRỊ ĐẶT CỌC\nTheo thỏa thuận.\n\nĐIỀU 3. THỜI HẠN VÀ NGHĨA VỤ\nHai bên thực hiện nghĩa vụ trong thời hạn đã thống nhất.\n\nĐIỀU 4. XỬ LÝ TIỀN ĐẶT CỌC\nTheo thỏa thuận và quy định áp dụng.'},
  {id:'builtin-principle',name:'Hợp đồng nguyên tắc',category:'PRINCIPLE',builtin:true,content:'ĐIỀU 1. NGUYÊN TẮC HỢP TÁC\nHai bên thống nhất nguyên tắc chung.\n\nĐIỀU 2. PHẠM VI\nTheo từng đơn hàng, báo giá hoặc phụ lục.\n\nĐIỀU 3. GIÁ VÀ THANH TOÁN\nTheo từng giao dịch.\n\nĐIỀU 4. HIỆU LỰC VÀ CHẤM DỨT\nTheo thỏa thuận.'},
  {id:'builtin-blank',name:'Mẫu trống / Tự soạn',category:'GENERAL',builtin:true,content:''},
];

export async function listContracts(search=''){const db=await getDatabase();const q=`%${search.trim()}%`;return search.trim()?db.getAllAsync<any>('SELECT * FROM contracts WHERE contract_no LIKE ? OR title LIKE ? OR customer LIKE ? OR project LIKE ? ORDER BY updated_at DESC',q,q,q,q):db.getAllAsync<any>('SELECT * FROM contracts ORDER BY updated_at DESC');}
export async function getContract(id:string){const db=await getDatabase();const row=await db.getFirstAsync<any>('SELECT raw_json FROM contracts WHERE id=?',id);if(!row)return null;try{return JSON.parse(row.raw_json)}catch{return null}}
export async function listContractTemplates(){const custom=await getJson<any[]>('contract_templates',[]);return [...BUILTIN_CONTRACT_TEMPLATES,...custom];}

export async function saveContract(input:any){const db=await getDatabase();const id=text(input.id).trim()||makeId('con');const old=await getContract(id);let contractNo=text(input.contract_no).trim();if(!contractNo){const year=new Date().getFullYear();const rows=await db.getAllAsync<{contract_no:string}>('SELECT contract_no FROM contracts');let max=0;for(const r of rows){const m=String(r.contract_no||'').match(new RegExp(`^CON-${year}-(\\d+)$`));if(m)max=Math.max(max,Number(m[1]));}contractNo=`CON-${year}-${String(max+1).padStart(4,'0')}`;}
  const parties=object(input.parties);const pa=cleanParty(parties.a||{name:input.party_a});const pb=cleanParty(parties.b||{name:input.party_b});const sections=cleanSections(input.sections,input.content);const content=sections.map((s:any)=>`${text(s.title).trim()}\n${text(s.content).trim()}`.trim()).filter(Boolean).join('\n\n');const base=Math.max(0,num(input.base_value??input.value));const vat=Math.max(0,num(input.vat_percent));const discount=Math.max(0,num(input.discount));const computed=Math.max(0,Math.round(base+base*vat/100-discount));const value=input.base_value!=null?computed:Math.max(0,num(input.value??computed));const deposit=Math.max(0,num(input.deposit));const now=nowIso();const row={schema_version:'contract-1.1.0-rn',id,contract_no:contractNo,title:text(input.title||'HỢP ĐỒNG').trim(),category:text(input.category||'GENERAL'),template_id:text(input.template_id),status:text(input.status||'DRAFT'),customer:text(input.customer).trim(),project:text(input.project).trim(),contract_date:text(input.contract_date||today()),sign_place:text(input.sign_place).trim(),start_date:text(input.start_date).trim(),end_date:text(input.end_date).trim(),party_a:pa.name||'',party_b:pb.name||'',parties:{a:pa,b:pb},sections,content,base_value:base,vat_percent:vat,discount,value,deposit,remaining:Math.max(0,value-deposit),payment_terms:cleanPaymentTerms(input.payment_terms),variables:object(input.variables),links:object(input.links),business_id:text(input.business_id||old?.business_id),branch_id:text(input.branch_id||old?.branch_id),created_by:text(input.created_by||old?.created_by),updated_by:text(input.updated_by),created_at:old?.created_at||now,updated_at:now};await upsertContractRow(db,row);await syncContracts();return row;}

export async function deleteContract(id:string){const db=await getDatabase();await db.runAsync('DELETE FROM contracts WHERE id=?',id);await syncContracts();}
export async function duplicateContract(id:string){const src=await getContract(id);if(!src)throw new Error('Không tìm thấy hợp đồng');const copy={...src,id:'',contract_no:'',title:`${src.title||'Hợp đồng'} - Bản sao`,status:'DRAFT',created_at:'',updated_at:''};return saveContract(copy);}

export async function saveContractTemplate(input:any){const rows=await getJson<any[]>('contract_templates',[]);const id=text(input.id).trim()||makeId('tpl');let row=rows.find(x=>String(x.id)===id);const now=nowIso();const next={...(row||{}),...input,id,name:text(input.name||'Mẫu hợp đồng').trim(),category:text(input.category||'GENERAL'),builtin:false,content:text(input.content),created_at:row?.created_at||now,updated_at:now};if(row)Object.assign(row,next);else rows.push(next);await setJson('contract_templates',rows);return next;}
export async function deleteContractTemplate(id:string){let rows=await getJson<any[]>('contract_templates',[]);rows=rows.filter(x=>String(x.id)!==id);await setJson('contract_templates',rows);}

function cleanParty(v:any){
  const p=object(v);
  const out:any={
    role:text(p.role).trim(),name:text(p.name).trim(),representative:text(p.representative).trim(),title:text(p.title).trim(),
    tax_code:text(p.tax_code||p.tax_id).trim(),tax_id:text(p.tax_id||p.tax_code).trim(),id_no:text(p.id_no).trim(),
    id_issue_date:text(p.id_issue_date||p.issue_date).trim(),issue_date:text(p.issue_date||p.id_issue_date).trim(),
    id_issue_place:text(p.id_issue_place||p.issue_place).trim(),issue_place:text(p.issue_place||p.id_issue_place).trim(),
    address:text(p.address).trim(),phone:text(p.phone).trim(),email:text(p.email).trim(),
    bank:text(p.bank||p.bank_name).trim(),bank_name:text(p.bank_name||p.bank).trim(),bank_account:text(p.bank_account).trim(),
    bank_account_name:text(p.bank_account_name).trim(),bank_details:text(p.bank_details).trim(),note:text(p.note).trim(),
  };
  return out;
}
function cleanSections(v:any,content:any){if(Array.isArray(v)&&v.length)return v.map((s:any,i:number)=>({id:text(s.id)||`sec-${i+1}`,title:text(s.title),content:text(s.content),sort_order:num(s.sort_order||i+1)}));const raw=text(content).trim();return raw?[{id:'sec-1',title:'',content:raw,sort_order:1}]:[];}
function cleanPaymentTerms(v:any){const rows=Array.isArray(v)?v:(Array.isArray(v?.stages)?v.stages:[]);return rows.map((x:any,i:number)=>({id:text(x.id)||`pay-${i+1}`,name:text(x.name||`Giai đoạn ${i+1}`).trim(),amount:Math.max(0,num(x.amount)),percent:Math.max(0,num(x.percent)),due_date:text(x.due_date),method:text(x.method||'TRANSFER'),note:text(x.note)}));}
async function syncContracts(){const db=await getDatabase();const rows=await db.getAllAsync<any>('SELECT raw_json FROM contracts ORDER BY updated_at DESC');await setJson('contracts',rows.map(x=>{try{return JSON.parse(x.raw_json)}catch{return{}}}));}
export function parseContractContentToSections(content:any){
  const raw=text(content).replace(/\r/g,'').trim();
  if(!raw)return [{id:makeId('SEC'),title:'ĐIỀU 1. NỘI DUNG HỢP ĐỒNG',content:'',sort_order:1}];
  const lines=raw.split('\n');const out:any[]=[];let cur:any=null;const pre:string[]=[];const re=/^(ĐIỀU|Điều)\s*([0-9IVXLC]+)?\s*[.\-:]?\s*(.*)$/;
  for(const line of lines){const m=line.trim().match(re);if(m){if(cur)out.push(cur);else if(pre.join('\n').trim())out.push({id:makeId('SEC'),title:'NỘI DUNG CHUNG',content:pre.join('\n').trim()});cur={id:makeId('SEC'),title:line.trim(),content:'',sort_order:out.length+1};}else if(cur)cur.content+=(cur.content?'\n':'')+line;else pre.push(line);}
  if(cur)out.push(cur);else if(pre.join('\n').trim())out.push({id:makeId('SEC'),title:'NỘI DUNG HỢP ĐỒNG',content:pre.join('\n').trim(),sort_order:1});
  return out.length?out:[{id:makeId('SEC'),title:'ĐIỀU 1. NỘI DUNG HỢP ĐỒNG',content:'',sort_order:1}];
}

export function contractPaymentScheduleText(contract:any){
  const rows=Array.isArray(contract?.payment_terms)?contract.payment_terms:(Array.isArray(contract?.payment_terms?.stages)?contract.payment_terms.stages:[]);
  const lines=['Bên A thanh toán cho Bên B bằng tiền mặt hoặc chuyển khoản theo các giai đoạn hai bên thống nhất:'];
  rows.forEach((x:any,i:number)=>{const amount=num(x.amount)||((num(x.percent)&&num(contract?.base_value))?Math.round(num(contract.base_value)*num(x.percent)/100):0);const detail:string[]=[];if(text(x.note).trim())detail.push(text(x.note).trim());if(num(x.percent))detail.push(`tương ứng ${fmtNumber(num(x.percent))}% giá trị hợp đồng`);if(amount)detail.push(`giá trị ${fmtNumber(amount)} VNĐ (Bằng chữ: ${moneyWordsVi(amount)})`);if(text(x.due_date).trim())detail.push(`hạn ${formatDateVi(text(x.due_date))}`);lines.push(`- ${text(x.name||`Giai đoạn ${i+1}`)}: ${detail.join('; ')||'Theo thỏa thuận của hai bên'}.`);});
  const days=num(contract?.variables?.final_payment_days);if(days&&!rows.some((x:any)=>/còn lại|hoàn thiện|cuối/i.test(text(x.name))))lines.push(`- Thanh toán còn lại: Sau khi Bên B hoàn thiện và hai bên ký nghiệm thu, Bên A thanh toán giá trị còn lại không quá ${fmtNumber(days)} ngày, sau khi trừ các khoản tạm ứng, thanh toán trước, giảm trừ và phát sinh nếu có.`);
  return lines.join('\n');
}

export function resolveContractText(input:any,contract:any){
  const v=object(contract?.variables),base=num(contract?.base_value),vat=num(contract?.vat_percent),copies=Math.max(0,Math.trunc(num(v.contract_copies)));
  const map:any={
    work_scope:text(v.work_scope)||'…………',materials:text(v.materials)||'…………',contract_value_before_vat:base?`${fmtNumber(base)} VNĐ`:'…………',contract_value_before_vat_words:base?moneyWordsVi(base):'…………',
    vat_text:vat?`Giá trên chưa bao gồm ${fmtNumber(vat)}% thuế VAT.`:'Thuế VAT theo thỏa thuận và quy định áp dụng.',payment_schedule_text:contractPaymentScheduleText(contract),extra_day_rate:v.extra_day_rate?fmtNumber(num(v.extra_day_rate)):'…………',
    start_date_vi:contract?.start_date?formatDateVi(text(contract.start_date)):'… / … / ……',duration_days:text(v.duration_days)||'……',warranty_months:text(v.warranty_months)||'……',late_payment_notice_days:text(v.late_payment_notice_days)||'……',late_payment_rate:text(v.late_payment_rate)||'……',termination_overdue_days:text(v.termination_overdue_days)||'……',final_payment_days:text(v.final_payment_days)||'……',
    contract_copies_text:copies===2?'Hợp đồng làm thành 02 bản bằng tiếng Việt, có giá trị pháp lý như nhau, mỗi bên giữ 01 bản.':(copies?`Hợp đồng làm thành ${copies} bản bằng tiếng Việt, có giá trị pháp lý như nhau và được các bên lưu giữ theo thỏa thuận.`:'Hợp đồng được lập thành số bản theo thỏa thuận của hai bên.'),
    work_title:text(v.work_title),project_name:text(v.project_name||contract?.project),project_address:text(v.project_address),contract_value:fmtNumber(num(contract?.value)),remaining:fmtNumber(num(contract?.remaining)),
  };
  return text(input).replace(/\{\{([a-zA-Z0-9_]+)\}\}/g,(m:string,k:string)=>Object.prototype.hasOwnProperty.call(map,k)?text(map[k]):m);
}

export function resolvedContractSections(contract:any){const rows=Array.isArray(contract?.sections)&&contract.sections.length?contract.sections:parseContractContentToSections(contract?.content);return rows.map((s:any,i:number)=>({...s,title:resolveContractText(s.title||`ĐIỀU ${i+1}`,contract),content:resolveContractText(s.content,contract)}));}
export function resolvedContractContent(contract:any){return resolvedContractSections(contract).map((s:any)=>`${text(s.title).trim()}\n${text(s.content).trim()}`.trim()).filter(Boolean).join('\n\n');}

export function formatDateVi(v:string){const s=text(v).trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return s||'……';const [y,m,d]=s.split('-');return `${d}/${m}/${y}`;}
export function moneyWordsVi(value:any){let n=Math.round(Math.abs(num(value)));if(!n)return'Không đồng';const d=['không','một','hai','ba','bốn','năm','sáu','bảy','tám','chín'];const read3=(x:number,full=false)=>{const h=Math.floor(x/100),t=Math.floor((x%100)/10),u=x%10,a:string[]=[];if(h||full){a.push(`${d[h]} trăm`);if(t===0&&u)a.push('lẻ');}if(t>1){a.push(`${d[t]} mươi`);if(u===1)a.push('mốt');else if(u===5)a.push('lăm');else if(u)a.push(d[u]);}else if(t===1){a.push('mười');if(u===5)a.push('lăm');else if(u)a.push(d[u]);}else if(u&&!h)a.push(d[u]);else if(u&&h)a.push(d[u]);return a.join(' ');};const units=['','nghìn','triệu','tỷ','nghìn tỷ','triệu tỷ','tỷ tỷ'];const groups:number[]=[];while(n>0){groups.push(n%1000);n=Math.floor(n/1000);}const out:string[]=[];for(let i=groups.length-1;i>=0;i--){const g=groups[i];if(!g)continue;out.push(read3(g,i<groups.length-1&&g<100));if(units[i])out.push(units[i]);}const result=`${out.join(' ').replace(/\s+/g,' ').trim()} đồng`;return result.charAt(0).toUpperCase()+result.slice(1);}
function fmtNumber(v:any){return Number(v||0).toLocaleString('vi-VN',{maximumFractionDigits:2});}

