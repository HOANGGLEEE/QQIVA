import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { getDatabase } from '@/db/database';
import { getExportDirectory } from '@/services/media';
import { nowIso } from '@/services/id';

const TABLES=['json_store','documents','product_groups','products','contracts','payments','finance_transactions','customers','projects','attachments','audit_log','retail_business','retail_branch','retail_warehouse','retail_device','retail_product_profile','retail_sku','retail_barcode','stock_transaction','stock_balance','sale','sale_item','sale_payment','retail_audit_log'];
const RESTORE_ORDER=['json_store','documents','product_groups','products','contracts','payments','finance_transactions','customers','projects','attachments','audit_log','retail_product_profile','retail_sku','retail_barcode','stock_transaction','stock_balance','sale','sale_item','sale_payment','retail_audit_log'];

export async function createFullBackup(includeMedia=true){const db=await getDatabase();const tables:Record<string,any[]>={};for(const t of TABLES)tables[t]=await db.getAllAsync<any>(`SELECT * FROM ${t}`);const media:Record<string,string>={};if(includeMedia){for(const row of tables.attachments||[]){if(String(row.uri||'').startsWith('file://')){try{media[row.id]=await FileSystem.readAsStringAsync(row.uri,{encoding:FileSystem.EncodingType.Base64});}catch{}}}}
  const payload={format:'QQIVA_OFFLINE_BACKUP_V2',created_at:nowIso(),tables,media};const dir=await getExportDirectory();const path=`${dir}QQIVA_BACKUP_${Date.now()}.qqivabackup`;await FileSystem.writeAsStringAsync(path,JSON.stringify(payload),{encoding:FileSystem.EncodingType.UTF8});if(await Sharing.isAvailableAsync())await Sharing.shareAsync(path,{dialogTitle:'Sao lưu QQIVA'});return path;}

export async function restoreFullBackup(uri:string){const raw=await FileSystem.readAsStringAsync(uri,{encoding:FileSystem.EncodingType.UTF8});const backup=JSON.parse(raw);if(backup?.format!=='QQIVA_OFFLINE_BACKUP_V2')throw new Error('Không đúng định dạng sao lưu QQIVA V2');const db=await getDatabase();await db.execAsync('PRAGMA foreign_keys=OFF;');try{await db.withTransactionAsync(async()=>{for(const t of [...RESTORE_ORDER].reverse())await db.runAsync(`DELETE FROM ${t}`);for(const t of RESTORE_ORDER){const rows=Array.isArray(backup.tables?.[t])?backup.tables[t]:[];for(const row of rows)await insertRow(db,t,row);}});}finally{await db.execAsync('PRAGMA foreign_keys=ON;');}
  for(const row of backup.tables?.attachments||[]){const b64=backup.media?.[row.id];if(b64&&String(row.uri||'').startsWith('file://')){try{await FileSystem.writeAsStringAsync(row.uri,b64,{encoding:FileSystem.EncodingType.Base64});}catch{}}}return{ok:true};}

async function insertRow(db:any,table:string,row:any){const cols=Object.keys(row);if(!cols.length)return;const placeholders=cols.map(()=>'?').join(',');await db.runAsync(`INSERT OR REPLACE INTO ${table} (${cols.map(c=>`"${c}"`).join(',')}) VALUES (${placeholders})`,...cols.map(c=>row[c]));}
