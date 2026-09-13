import professionalTemplateCatalog from '../../assets/seed/data/professional_template_catalog.json';
import { getDatabase, upsertStudioRecord } from '@/db/database';
import { getJson, setJson } from '@/db/jsonStore';
import { makeId, nowIso } from '@/services/id';

export type ProfessionalTemplateCategory='INTERIOR'|'CONSTRUCTION'|'RETAIL'|'SERVICE';
export type ProfessionalTemplate={
  id:string;
  cat:ProfessionalTemplateCategory;
  name:string;
  style:string;
  theme:string;
  layout:string;
  hero:string;
  cols:string;
  ratio:string;
  table:string;
  title:string;
  sub:string;
  source:'builtin'|'saved';
  savedId?:string;
  config?:any;
};

// Catalog template thật được port nguyên vẹn từ `static/app.js` của QQIVA Web V1.5.93.77.
// Dữ liệu nằm trong asset local để renderer dùng offline; không tải từ server/Internet.
export const PROFESSIONAL_TEMPLATE_CATALOG:ProfessionalTemplate[]=(professionalTemplateCatalog as ProfessionalTemplate[]).map(x=>({...x,source:'builtin'}));

export const PROFESSIONAL_TEMPLATE_FILTERS=[
  {value:'ALL',label:'Tất cả'},
  {value:'INTERIOR',label:'Nội thất'},
  {value:'CONSTRUCTION',label:'Xây dựng'},
  {value:'RETAIL',label:'Bán hàng'},
  {value:'SERVICE',label:'Dịch vụ'},
] as const;

export function getBuiltinProfessionalTemplate(id:string){return PROFESSIONAL_TEMPLATE_CATALOG.find(x=>x.id===id)||null;}

export async function listProfessionalTemplates():Promise<ProfessionalTemplate[]> {
  const saved=await listAdTemplates();
  const savedRows:ProfessionalTemplate[]=saved.map((row:any)=>{
    const cfg=row?.config&&typeof row.config==='object'?row.config:{};
    const base=getBuiltinProfessionalTemplate(String(cfg.template||''))||PROFESSIONAL_TEMPLATE_CATALOG[0];
    const fields=cfg.fields&&typeof cfg.fields==='object'?cfg.fields:{};
    return {
      ...base,
      id:`saved:${row.id}`,
      name:String(row.name||base.name||'Mẫu đã lưu'),
      theme:String(fields.theme||base.theme),layout:String(fields.layout||base.layout),hero:String(fields.heroStyle||base.hero),
      cols:String(fields.productColumns||base.cols),ratio:String(fields.imageRatio||base.ratio),table:String(fields.tableStyle||base.table),
      title:String(fields.title||base.title),sub:String(fields.subtitle||base.sub),source:'saved' as const,savedId:String(row.id||''),config:cfg,
    };
  });
  return [...PROFESSIONAL_TEMPLATE_CATALOG,...savedRows];
}

export function templateInitialConfig(template:ProfessionalTemplate,preference:any={}){
  const prefFields=preference?.default_customize?.fields&&typeof preference.default_customize.fields==='object'?preference.default_customize.fields:{};
  const prefChecks=preference?.default_customize?.checks&&typeof preference.default_customize.checks==='object'?preference.default_customize.checks:{};
  const savedFields=template.config?.fields&&typeof template.config.fields==='object'?template.config.fields:{};
  const savedChecks=template.config?.checks&&typeof template.config.checks==='object'?template.config.checks:{};
  const fields={
    documentKind:'QUOTE',category:categoryFromTemplate(template),customCategory:'',documentNo:'',documentDate:'',company:'',companyAddress:'',customerName:'',customerPhone:'',customerAddress:'',
    title:template.title,subtitle:template.sub,slogan:'Uy tín • Chất lượng • Tận tâm',theme:template.theme,layout:template.layout,format:'A4',density:'COMFORT',phone:'',website:'',
    imageSize:'MEDIUM',productColumns:template.cols,imageRatio:template.ratio,imageFit:'cover',backgroundOverlay:'0.35',longMode:'AUTO',heroStyle:template.hero,
    productGap:'NORMAL',cardRadius:'MEDIUM',blockPadding:'NORMAL',tableStyle:template.table,fontFamily:'SYSTEM',
    vatEnabled:false,vatRate:10,discountEnabled:false,discountType:'percent',discountValue:0,surchargeEnabled:false,surchargeLabel:'Phụ phí',surchargeType:'fixed',surchargeValue:0,
    termsText:'',logoOverride:'',signatureOverride:'',stampOverride:'',
    ...prefFields,...savedFields,
  };
  const checks={
    adShowCompany:true,adShowImages:true,adShowTable:true,adShowTableImages:true,adShowDescription:true,adShowUnit:true,adShowQty:true,adShowPrice:true,adShowTotal:true,
    adShowContact:true,adMissingAsContact:true,adShowPaymentInfo:true,
    ...prefChecks,...savedChecks,
  };
  return {schema:'qqiva.professional.customize.v1',template:template.source==='saved'?String(template.config?.template||'style-01-luxury-gold'):template.id,filter:'ALL',fields,checks};
}

function categoryFromTemplate(template:ProfessionalTemplate){return template.cat==='INTERIOR'?'INTERIOR':template.cat==='CONSTRUCTION'?'MATERIAL':template.cat==='RETAIL'?'RETAIL':'SERVICE';}

export async function listAdTemplates(){const db=await getDatabase();const rows=await db.getAllAsync<any>("SELECT meta_json FROM studio_records WHERE kind='template' ORDER BY updated_at DESC");return rows.map(x=>safeJson(x.meta_json,{}));}
export async function getAdTemplate(id:string){const db=await getDatabase();const row=await db.getFirstAsync<any>("SELECT payload_json FROM studio_records WHERE kind='template' AND id=?",id);return row?safeJson(row.payload_json,null):null;}
export async function saveAdTemplate(input:any){const db=await getDatabase();const id=String(input.id||'').trim()||makeId('ad-tpl');const old=await getAdTemplate(id);const now=nowIso();const row={id,name:String(input.name||'Mẫu thiết kế').trim().slice(0,80),config:input.config&&typeof input.config==='object'?input.config:{},created_at:old?.created_at||now,updated_at:now};await upsertStudioRecord(db,'template',row);return row;}
export async function deleteAdTemplate(id:string){const db=await getDatabase();await db.runAsync("DELETE FROM studio_records WHERE kind='template' AND id=?",id);}
export async function listAdDrafts(){const db=await getDatabase();const rows=await db.getAllAsync<any>("SELECT meta_json FROM studio_records WHERE kind='draft' ORDER BY updated_at DESC");return rows.map(x=>safeJson(x.meta_json,{}));}
export async function getAdDraft(id:string){const db=await getDatabase();const row=await db.getFirstAsync<any>("SELECT payload_json FROM studio_records WHERE kind='draft' AND id=?",id);return row?safeJson(row.payload_json,null):null;}
export async function saveAdDraft(input:any){const db=await getDatabase();const id=String(input.id||'').trim()||makeId('ad-draft');const old=await getAdDraft(id);const now=nowIso();const row={id,name:String(input.name||'Bản nháp chưa đặt tên').trim().slice(0,100),config:input.config&&typeof input.config==='object'?input.config:{},work:input.work&&typeof input.work==='object'?input.work:{},created_at:old?.created_at||now,updated_at:now};await upsertStudioRecord(db,'draft',row);return row;}
export async function deleteAdDraft(id:string){const db=await getDatabase();await db.runAsync("DELETE FROM studio_records WHERE kind='draft' AND id=?",id);}
export async function getAdPreferences(){return getJson<any>('ad_quote_preferences',{schema_version:'qqiva.professional.preferences.v1',default_customize:{},updated_at:''});}
export async function saveAdDefaultCustomize(config:any){const value={schema_version:'qqiva.professional.preferences.v1',default_customize:config&&typeof config==='object'?config:{},updated_at:nowIso()};await setJson('ad_quote_preferences',value);return value;}

// Trạng thái làm việc riêng của RN. Không đụng vào seed template/draft gốc và không cần server.
export async function getProfessionalWork(){return getJson<any>('professional_studio_work',null);}
export async function saveProfessionalWork(value:any){await setJson('professional_studio_work',value&&typeof value==='object'?value:{});return value;}
export async function clearProfessionalWork(){await setJson('professional_studio_work',{});}

function safeJson(raw:string|undefined,fallback:any){try{return raw?JSON.parse(raw):fallback}catch{return fallback}}
