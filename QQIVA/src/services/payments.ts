import { getDatabase, num, text, upsertPaymentRow } from '@/db/database';
import { getJson, setJson } from '@/db/jsonStore';
import { makeId, nowIso, today } from '@/services/id';
import { getDocument } from '@/services/documentEngine';

export type InvoicePaymentSnapshot = { id:string; document_no:string; document_date:string; customer:string; project:string; project_code:string; project_uid:string; total:number; advance:number; ledger_net:number; received:number; remaining:number; overpaid:number; status:'PAID'|'OVERPAID'|'PARTIAL'|'UNPAID'; updated_at:string };

export async function listPaymentEntries(invoiceId='') {
  const db=await getDatabase(); return invoiceId ? db.getAllAsync<any>('SELECT * FROM payments WHERE invoice_id=? ORDER BY date DESC,created_at DESC',invoiceId) : db.getAllAsync<any>('SELECT * FROM payments ORDER BY date DESC,created_at DESC');
}

export async function listInvoiceSnapshots():Promise<InvoicePaymentSnapshot[]> {
  const db=await getDatabase(); const docs=await db.getAllAsync<any>("SELECT * FROM documents WHERE type='INVOICE' ORDER BY COALESCE(updated_at,created_at) DESC"); const payments=await listPaymentEntries();
  return docs.map((doc:any)=>{
    const ledgerNet=payments.filter((p:any)=>p.invoice_id===doc.id).reduce((s:number,p:any)=>s+num(p.amount),0); const received=num(doc.advance)+ledgerNet; const total=num(doc.total); const remaining=Math.max(0,total-received); const overpaid=Math.max(0,received-total);
    const status:InvoicePaymentSnapshot['status']=overpaid>0?'OVERPAID':(total>0&&remaining<=0?'PAID':(received>0?'PARTIAL':'UNPAID'));
    return {id:doc.id,document_no:text(doc.document_no),document_date:text(doc.document_date),customer:text(doc.customer),project:text(doc.project),project_code:text(doc.project_code),project_uid:text(doc.project_uid),total,advance:num(doc.advance),ledger_net:ledgerNet,received,remaining,overpaid,status,updated_at:text(doc.updated_at)};
  });
}

export async function addPayment(input:{invoice_id:string;amount:number;date?:string;method?:string;note?:string}){
  const amount=num(input.amount); if(amount<=0)throw new Error('Số tiền thanh toán phải lớn hơn 0'); const rec=await getDocument(input.invoice_id); if(!rec||String(rec.meta?.type)!=='INVOICE')throw new Error('Không tìm thấy hóa đơn'); const m=rec.meta||{};
  const row={id:makeId('PAY'),type:'PAYMENT',invoice_id:input.invoice_id,project_uid:text(m.project_uid),customer:text(m.customer),project:text(m.project),document_no:text(m.document_no),amount:Math.round(amount*100)/100,date:input.date||today(),method:normalizeMethod(input.method),note:text(input.note).trim(),created_at:nowIso(),created_by:'QQIVA_ANDROID_OFFLINE'};
  const db=await getDatabase();await upsertPaymentRow(db,row);const store=await getJson<any[]>('payment_ledger',[]);store.push(row);await setJson('payment_ledger',store);return row;
}

export async function reversePayment(paymentId:string,reason:string,date=today()){
  if(!reason.trim())throw new Error('Cần ghi lý do hủy/điều chỉnh'); const db=await getDatabase(); const src=await db.getFirstAsync<any>('SELECT * FROM payments WHERE id=?',paymentId);if(!src||src.type!=='PAYMENT')throw new Error('Không tìm thấy khoản thanh toán gốc'); const prior=await db.getFirstAsync<any>('SELECT id FROM payments WHERE reversal_of=?',paymentId);if(prior)throw new Error('Khoản này đã được hủy/điều chỉnh trước đó');
  const row={id:makeId('REV'),type:'REVERSAL',invoice_id:src.invoice_id,project_uid:src.project_uid,customer:src.customer,project:src.project,document_no:src.document_no,amount:-Math.abs(num(src.amount)),date,method:src.method,note:`HỦY/ĐIỀU CHỈNH: ${reason.trim()}`,reversal_of:paymentId,created_at:nowIso(),created_by:'QQIVA_ANDROID_OFFLINE'};await upsertPaymentRow(db,row);const store=await getJson<any[]>('payment_ledger',[]);store.push(row);await setJson('payment_ledger',store);return row;
}

function normalizeMethod(v?:string){const x=String(v||'').trim().toUpperCase();if(['CK','CHUYỂN KHOẢN','CHUYEN KHOAN','BANK_TRANSFER'].includes(x))return 'CK';if(['TIỀN MẶT','TIEN MAT','CASH'].includes(x))return 'TIỀN MẶT';return String(v||'KHÁC').trim()||'KHÁC';}
