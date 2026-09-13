import { getDatabase, text, num, upsertGroupRow, upsertProductRow } from '@/db/database';
import { getJson, setJson } from '@/db/jsonStore';
import { makeId, nowIso } from '@/services/id';

export async function listProducts(search = '', groupId = '') {
  const db = await getDatabase(); const params: any[] = []; let where = 'WHERE hidden=0';
  if (search.trim()) { where += ' AND (name LIKE ? OR description LIKE ? OR catalog_key LIKE ?)'; const q=`%${search.trim()}%`; params.push(q,q,q); }
  if (groupId) { where += ' AND group_id=?'; params.push(groupId); }
  const rows=await db.getAllAsync<any>(`SELECT * FROM products ${where} ORDER BY favorite DESC,name COLLATE NOCASE`, ...params);
  return rows.map((row:any)=>{
    const raw=safeJson(row.raw_json,{});
    const rawPrice=num(raw.price ?? raw.unit_price ?? raw.selling_price);
    const dbPrice=num(row.price);
    return {
      ...raw,
      ...row,
      price: dbPrice>0?dbPrice:rawPrice,
      unit:text(row.unit||raw.unit),
      image:text(row.image||raw.image),
      group_code:text(row.group_code||raw.group||raw.group_code),
      group_name:text(row.group_name||raw.group_name),
      catalog_key:text(row.catalog_key||raw.catalog_key),
    };
  });
}

export async function getProduct(id: string) {
  const db = await getDatabase(); const row=await db.getFirstAsync<any>('SELECT * FROM products WHERE id=?',id); if(!row)return null;
  return { ...row, raw: safeJson(row.raw_json,{}) };
}

export async function saveProduct(input: any) {
  const db=await getDatabase(); const groups=await listProductGroups(); const id=text(input.id).trim()||makeId('PROD'); const old=await getProduct(id);
  const groupId=text(input.group_id || old?.group_id).trim(); const group=groups.find((g:any)=>String(g.id)===groupId);
  const item={ ...(old?.raw||{}), ...input, id, name:text(input.name||old?.name||'Sản phẩm').trim(), group_id:groupId, group: text(group?.code || input.group || old?.group_code), group_name:text(group?.name || input.group_name || old?.group_name), price:Math.max(0,num(input.price ?? old?.price)), unit:text(input.unit ?? old?.unit), image:text(input.image ?? old?.image), description:text(input.description ?? old?.description), updated_at:nowIso() };
  await upsertProductRow(db,item); await syncProductStore(); return item;
}

export async function deleteProduct(id:string) {
  const db=await getDatabase(); await db.runAsync('DELETE FROM products WHERE id=?',id); await syncProductStore();
}

export async function setProductHidden(id:string,hidden:boolean){ const db=await getDatabase(); await db.runAsync('UPDATE products SET hidden=? WHERE id=?',hidden?1:0,id); const p=await getProduct(id); if(p){p.raw.hidden=hidden;await db.runAsync('UPDATE products SET raw_json=? WHERE id=?',JSON.stringify(p.raw),id);} await syncProductStore(); }
export async function setProductFavorite(id:string,favorite:boolean){ const db=await getDatabase(); await db.runAsync('UPDATE products SET favorite=? WHERE id=?',favorite?1:0,id); const p=await getProduct(id); if(p){p.raw.favorite=favorite;await db.runAsync('UPDATE products SET raw_json=? WHERE id=?',JSON.stringify(p.raw),id);} await syncProductStore(); }

export async function moveProducts(ids:string[],groupId:string){ const db=await getDatabase();const groups=await listProductGroups();const group=groups.find((g:any)=>String(g.id)===groupId);if(!group)throw new Error('Nhóm sản phẩm không tồn tại');
  await db.withTransactionAsync(async()=>{for(const id of ids){const p=await getProduct(id);if(!p)continue;const raw={...p.raw,group_id:group.id,group:group.code,group_name:group.name};await db.runAsync('UPDATE products SET group_id=?,group_code=?,group_name=?,raw_json=? WHERE id=?',group.id,group.code,group.name,JSON.stringify(raw),id);}});await syncProductStore();return ids.length; }

export async function listProductGroups(){ const db=await getDatabase(); return db.getAllAsync<any>('SELECT * FROM product_groups ORDER BY sort_order,name'); }

export async function saveProductGroup(input:any){ const db=await getDatabase(); const id=text(input.id).trim()||makeId('GRP'); const old=await db.getFirstAsync<any>('SELECT raw_json FROM product_groups WHERE id=?',id); const count=await db.getFirstAsync<{n:number}>('SELECT COUNT(*) n FROM product_groups');
  const group={...safeJson(old?.raw_json,{}),...input,id,code:text(input.code||input.name||'GROUP').trim().toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_|_$/g,'')||'GROUP',name:text(input.name||'Nhóm sản phẩm').trim(),sort_order:num(input.sort_order || ((count?.n||0)+1)*10),system_kind:text(input.system_kind)};await upsertGroupRow(db,group);await syncGroupStore();return group; }

export async function deleteProductGroup(id:string,moveToGroupId=''){ const db=await getDatabase(); const used=await db.getFirstAsync<{n:number}>('SELECT COUNT(*) n FROM products WHERE group_id=?',id);if((used?.n||0)>0 && !moveToGroupId)throw new Error('Nhóm đang có sản phẩm. Hãy chuyển sản phẩm sang nhóm khác trước.');if(moveToGroupId)await moveProducts((await db.getAllAsync<{id:string}>('SELECT id FROM products WHERE group_id=?',id)).map((x:{id:string})=>x.id),moveToGroupId);await db.runAsync('DELETE FROM product_groups WHERE id=?',id);await syncGroupStore(); }

async function syncProductStore(){ const db=await getDatabase(); const rows=await db.getAllAsync<any>('SELECT raw_json FROM products ORDER BY name'); await setJson('product_library',rows.map((x:any)=>safeJson(x.raw_json,{}))); }
async function syncGroupStore(){ const db=await getDatabase(); const rows=await db.getAllAsync<any>('SELECT raw_json FROM product_groups ORDER BY sort_order,name'); await setJson('product_groups',rows.map((x:any)=>safeJson(x.raw_json,{}))); }
function safeJson(raw:string|undefined,fallback:any){try{return raw?JSON.parse(raw):fallback}catch{return fallback}}
