import { getDatabase, text } from '@/db/database';
import { makeId, nowIso } from '@/services/id';
import { mergeProjects, syncAllProjects, updateProjectIdentity } from '@/services/documentEngine';

export async function listCustomers(search=''){const db=await getDatabase();const q=`%${search.trim()}%`;return search.trim()?db.getAllAsync<any>('SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? OR address LIKE ? ORDER BY name',q,q,q):db.getAllAsync<any>('SELECT * FROM customers ORDER BY name');}
export async function saveCustomer(input:any){const db=await getDatabase();const id=text(input.id).trim()||makeId('CUS');const old=await db.getFirstAsync<any>('SELECT created_at FROM customers WHERE id=?',id);const now=nowIso();const row={id,name:text(input.name).trim(),phone:text(input.phone).trim(),tax_id:text(input.tax_id).trim(),address:text(input.address).trim(),email:text(input.email).trim(),note:text(input.note).trim(),created_at:old?.created_at||now,updated_at:now};if(!row.name)throw new Error('Tên khách hàng không được để trống');await db.runAsync('INSERT OR REPLACE INTO customers (id,name,phone,tax_id,address,email,note,created_at,updated_at,raw_json) VALUES (?,?,?,?,?,?,?,?,?,?)',row.id,row.name,row.phone,row.tax_id,row.address,row.email,row.note,row.created_at,row.updated_at,JSON.stringify(row));return row;}
export async function deleteCustomer(id:string){const db=await getDatabase();await db.runAsync('DELETE FROM customers WHERE id=?',id);}

export async function listProjects(search=''){await syncAllProjects();const db=await getDatabase();const q=`%${search.trim()}%`;const rows=search.trim()?await db.getAllAsync<any>('SELECT * FROM projects WHERE customer LIKE ? OR name LIKE ? OR address LIKE ? OR project_code LIKE ? ORDER BY updated_at DESC',q,q,q,q):await db.getAllAsync<any>('SELECT * FROM projects ORDER BY updated_at DESC');for(const row of rows){row.documents=await db.getAllAsync<any>('SELECT id,type,document_no,document_date,total,remaining,status FROM documents WHERE project_uid=? ORDER BY updated_at DESC',row.project_uid||'');}return rows;}
export async function saveProject(input:any){const db=await getDatabase();const id=text(input.id).trim()||makeId('PROJECT');const uid=text(input.project_uid).trim()||makeId('PRJ');const old=await db.getFirstAsync<any>('SELECT created_at FROM projects WHERE id=?',id);const now=nowIso();const row={id,project_uid:uid,customer_id:text(input.customer_id),customer:text(input.customer).trim(),customer_code:text(input.customer_code).trim(),name:text(input.name||input.address||'Công trình').trim(),address:text(input.address).trim(),project_code:text(input.project_code).trim(),status:text(input.status||'ACTIVE'),note:text(input.note),created_at:old?.created_at||now,updated_at:now};await db.runAsync('INSERT OR REPLACE INTO projects (id,project_uid,customer_id,customer,customer_code,name,address,project_code,status,note,created_at,updated_at,raw_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',row.id,row.project_uid,row.customer_id,row.customer,row.customer_code,row.name,row.address,row.project_code,row.status,row.note,row.created_at,row.updated_at,JSON.stringify(row));return row;}
export async function deleteProject(id:string){const db=await getDatabase();await db.runAsync('DELETE FROM projects WHERE id=?',id);}
export async function mergeProjectRecords(source:any,target:any){
  const sourceIds=Array.isArray(source?.documents)?source.documents.map((d:any)=>text(d.id)).filter(Boolean):[];
  const targetIds=Array.isArray(target?.documents)?target.documents.map((d:any)=>text(d.id)).filter(Boolean):[];
  if(!sourceIds.length)throw new Error('Công trình nguồn không có chứng từ để gộp');
  if(!targetIds.length)throw new Error('Công trình đích không có chứng từ để nhận dữ liệu');
  if(text(source?.id)===text(target?.id))throw new Error('Công trình nguồn và đích phải khác nhau');
  const result=await mergeProjects(sourceIds,targetIds);
  if(source?.id)await deleteProject(text(source.id));
  await syncAllProjects();
  return result;
}
export {updateProjectIdentity,mergeProjects};
