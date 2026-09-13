import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { ProfessionalTemplatePreview, calculateStudioTotals, getStudioPageSize, paginateProfessionalItems, type StudioInfo, type StudioProductItem } from '@/components/ProfessionalTemplatePreview';
import { Screen } from '@/components/Screen';
import { AppButton, Card, Chips, Divider, IconButton, Muted, Row, SectionTitle } from '@/components/ui';
import { colors } from '@/constants/theme';
import { object } from '@/db/database';
import { getContract } from '@/services/contracts';
import { documentLineAmount, effectivePrice, getLiveState, pricingBreakdown, professionalSnapshot, visibleItems } from '@/services/documentEngine';
import { exportAdQuotePdf, exportContractDocx, exportContractPdf, exportCurrentDocumentPdf, exportCurrentDocumentXlsx, exportCurrentStateJson, persistCapturedPng } from '@/services/export';
import { imageSource } from '@/services/media';
import { getBuiltinProfessionalTemplate, type ProfessionalTemplate } from '@/services/adQuotes';
import { getSettings, saveSettings } from '@/services/settings';

const money=(v:any)=>`${Math.round(Number(v||0)).toLocaleString('vi-VN')} đ`;
const qty=(v:any)=>Number(v||0).toLocaleString('vi-VN',{maximumFractionDigits:3});

export default function DocumentPreview(){
  const params=useLocalSearchParams<{contractId?:string}>();
  const [state,setState]=useState<any>(null);
  const [contract,setContract]=useState<any>(null);
  const [settings,setSettings]=useState<any>({});
  const [busy,setBusy]=useState(false);
  const refs=useRef<any[]>([]);

  useEffect(()=>{void (async()=>{const [se,st]=await Promise.all([getSettings(),getLiveState()]);setSettings(se);setState(st);if(params.contractId)setContract(await getContract(String(params.contractId)));})()},[params.contractId]);

  if(params.contractId){if(!contract||!state)return <Screen title="Xem trước hợp đồng"><Card><Text>Đang tải…</Text></Card></Screen>;return <ContractPreview contract={contract} company={object(state.company)} refs={refs} busy={busy} setBusy={setBusy}/>}
  if(!state)return <Screen title="Document Preview"><Card><Text>Đang dựng bản xem trước…</Text></Card></Screen>;
  if(state.professional_studio?.schema){return <ProfessionalSavedPreview state={state} refs={refs} busy={busy} setBusy={setBusy}/>;}

  const rows=visibleItems(state);const p=object(state.project);const c=object(state.company);const totals=pricingBreakdown(state);
  const rowsPerPage=Math.max(4,Math.min(18,Number(settings.preview_rows_per_page||settings.rows_per_page||8)));
  const pages=chunk(rows,rowsPerPage);
  if(!pages.length)pages.push([]);
  const orientation=String(settings.page_orientation||settings.orientation||'portrait');
  const template=String(settings.export_template||'professional');

  const updateSettings=async(patch:any)=>{const next={...settings,...patch};setSettings(next);await saveSettings(patch)};
  const exportPng=async()=>{try{setBusy(true);for(let i=0;i<refs.current.length;i++){const node=refs.current[i];if(!node)continue;const uri=await captureRef(node,{format:'png',quality:1,result:'tmpfile',width:orientation==='landscape'?1754:1240,height:orientation==='landscape'?1240:1754});await persistCapturedPng(uri,`${state.document_mode==='invoice'?'HOA_DON':'BAO_GIA'}_${p.quote_no||Date.now()}_TRANG_${i+1}.png`);}}catch(e:any){Alert.alert('Không xuất được PNG',e.message||String(e))}finally{setBusy(false)}};
  const run=async(fn:()=>Promise<any>)=>{try{setBusy(true);await fn()}catch(e:any){Alert.alert('Xuất file thất bại',e.message||String(e))}finally{setBusy(false)}};

  return <Screen title="Document Preview" subtitle={`${state.document_mode==='invoice'?'Hóa đơn':'Báo giá'} • ${pages.length} trang • offline`} right={<IconButton icon="close" onPress={()=>router.back()}/>}>
    <Card><SectionTitle>Tùy chọn hiển thị</SectionTitle><Chips value={template} onChange={v=>void updateSettings({export_template:v})} options={[{value:'professional',label:'Chuyên nghiệp'},{value:'modern',label:'Hiện đại'},{value:'minimal',label:'Tối giản'},{value:'premium',label:'Cao cấp'}]}/><Chips value={orientation} onChange={v=>void updateSettings({page_orientation:v})} options={[{value:'portrait',label:'Dọc'},{value:'landscape',label:'Ngang'}]}/><Muted>Ảnh/logo/chữ ký/con dấu đọc trực tiếp từ FileSystem hoặc seed asset. Không tải lại qua mạng.</Muted></Card>
    {pages.map((page,i)=><DocumentPage key={i} refNode={(node:any)=>{refs.current[i]=node}} state={state} rows={page} startIndex={i*rowsPerPage} pageNo={i+1} pageCount={pages.length} isLast={i===pages.length-1} totals={totals} template={template} orientation={orientation} imageFit={String(settings.image_fit||'contain')}/>) }
    <SectionTitle>Xuất file</SectionTitle><Row style={{flexWrap:'wrap'}}><AppButton title="PDF" icon="file-pdf-box" disabled={busy} onPress={()=>void run(()=>exportCurrentDocumentPdf(state))}/><AppButton variant="secondary" title="Excel" icon="file-excel" disabled={busy} onPress={()=>void run(()=>exportCurrentDocumentXlsx(state))}/><AppButton variant="secondary" title="JSON" icon="code-json" disabled={busy} onPress={()=>void run(()=>exportCurrentStateJson())}/><AppButton variant="secondary" title={busy?'Đang xuất…':'PNG từng trang'} icon="image-multiple" disabled={busy} onPress={()=>void exportPng()}/></Row>
  </Screen>;
}

function DocumentPage({state,rows,startIndex,pageNo,pageCount,isLast,totals,template,orientation,imageFit,refNode}:{state:any;rows:any[];startIndex:number;pageNo:number;pageCount:number;isLast:boolean;totals:any;template:string;orientation:string;imageFit:string;refNode:(node:any)=>void}){
  const p=object(state.project),c=object(state.company);const wide=orientation==='landscape';
  return <View ref={refNode} collapsable={false} style={[s.page,wide&&s.pageWide,template==='premium'&&s.pagePremium]}>
    <View style={[s.header,template==='modern'&&s.headerModern]}><Row style={{flex:1,alignItems:'flex-start'}}>{c.logo?<Image source={imageSource(c.logo)} style={s.logo} resizeMode="contain"/>:null}<View style={{flex:1}}><Text style={s.company}>{c.name||'QQIVA BUSINESS'}</Text><Text style={s.small}>{c.description||''}</Text><Text style={s.small}>{[c.address,c.phone,c.email].filter(Boolean).join(' • ')}</Text></View></Row><View style={s.docHead}><Text style={s.docTitle}>{state.document_mode==='invoice'?'HÓA ĐƠN':'BÁO GIÁ'}</Text><Text style={s.docNo}>{p.quote_no||''}</Text><Text style={s.small}>{p.quote_date||''}</Text></View></View>
    <View style={s.info}><Text><Text style={s.bold}>Khách hàng: </Text>{p.customer||'Khách lẻ'}</Text><Text><Text style={s.bold}>Công trình: </Text>{p.address||p.project_name||''}</Text>{p.quote_note?<Text><Text style={s.bold}>Ghi chú: </Text>{p.quote_note}</Text>:null}</View>
    <View style={s.table}><View style={[s.tr,s.th]}><Text style={[s.cell,s.cNo]}>STT</Text>{template!=='minimal'?<Text style={[s.cell,s.cImg]}>Ảnh</Text>:null}<Text style={[s.cell,s.cName]}>Hạng mục</Text><Text style={[s.cell,s.cUnit]}>ĐVT</Text><Text style={[s.cell,s.cQty]}>KL</Text><Text style={[s.cell,s.cPrice]}>Đơn giá</Text><Text style={[s.cell,s.cAmount]}>Thành tiền</Text></View>{rows.map((x:any,idx:number)=>{const it=x.item;const price=effectivePrice(it);return <View key={it.id||idx} style={s.tr}><Text style={[s.cell,s.cNo]}>{startIndex+idx+1}</Text>{template!=='minimal'?<View style={[s.cellView,s.cImg]}>{it.image?<Image source={imageSource(it.image)} style={s.itemImg} resizeMode={imageFit==='cover'?'cover':'contain'}/>:null}</View>:null}<View style={[s.cellView,s.cName]}><Text style={s.itemName}>{it.name||it.category||''}</Text><Text style={s.tiny}>{[x.floor,x.room,it.description,it.note].filter(Boolean).join(' • ')}</Text></View><Text style={[s.cell,s.cUnit]}>{it.unit||''}</Text><Text style={[s.cell,s.cQty]}>{qty(it.qty)}</Text><Text style={[s.cell,s.cPrice]}>{money(price)}</Text><Text style={[s.cell,s.cAmount]}>{money(documentLineAmount(it))}</Text></View>})}</View>
    {isLast?<><View style={s.totals}><Total label="Tạm tính" value={totals.subtotal}/>{totals.discount?<Total label="Chiết khấu" value={-totals.discount}/>:null}{totals.surcharge?<Total label={totals.config?.surcharge_label||'Phụ phí'} value={totals.surcharge}/>:null}{totals.vat?<Total label="VAT" value={totals.vat}/>:null}<View style={s.grand}><Text style={s.grandT}>TỔNG CỘNG</Text><Text style={s.grandV}>{money(totals.grand_total)}</Text></View></View>{p.payment_terms?.enabled||p.payment_terms?.terms_text?<View style={s.terms}><Text style={s.bold}>ĐIỀU KHOẢN THANH TOÁN</Text>{p.payment_terms?.deposit_terms?<Text>{p.payment_terms.deposit_terms}</Text>:null}{p.payment_terms?.installment_terms?<Text>{p.payment_terms.installment_terms}</Text>:null}{p.payment_terms?.terms_text?<Text>{p.payment_terms.terms_text}</Text>:null}</View>:null}<View style={s.signatures}><Sign title="ĐẠI DIỆN KHÁCH HÀNG" image={p.signing?.customer_signature} name={p.signing?.customer_name}/><Sign title="ĐẠI DIỆN ĐƠN VỊ" image={p.signing?.show_company_signature!==false?c.signature:''} stamp={p.signing?.show_company_stamp!==false?c.stamp:''} name={c.signature_name||c.representative}/></View></>:null}
    <Text style={s.pageNo}>Trang {pageNo}/{pageCount}</Text>
  </View>
}

function ProfessionalSavedPreview({state,refs,busy,setBusy}:{state:any;refs:any;busy:boolean;setBusy:(v:boolean)=>void}){
  const studio=professionalSnapshot(state);
  const config=studio.config&&typeof studio.config==='object'?studio.config:{};
  const info:StudioInfo={...(studio.info||{}),documentKind:studio.info?.documentKind==='INVOICE'?'INVOICE':'QUOTE'};
  const items:StudioProductItem[]=Array.isArray(studio.items)?studio.items:[];
  const sourceTemplate=studio.template&&typeof studio.template==='object'?studio.template:null;
  const builtin=getBuiltinProfessionalTemplate(String(studio.template_id||sourceTemplate?.id||config.template||''));
  const template:ProfessionalTemplate=sourceTemplate||builtin||({id:'style-01-luxury-gold',cat:'INTERIOR',name:'01 • Luxury Gold',style:'LUXURY_GOLD',theme:'GOLD',layout:'LUX',hero:'SPLIT',cols:'2',ratio:'LANDSCAPE',table:'PANEL',title:'NHẬP TÊN SẢN PHẨM',sub:'Đẳng cấp không gian sống',source:'builtin'} as ProfessionalTemplate);
  const pages=paginateProfessionalItems(items,config);
  const totals=calculateStudioTotals(items,config);
  const company=object(state.company);
  const [device,setDevice]=useState<'PHONE'|'DESKTOP'|'A4'>('A4');
  const exportRefs=useRef<any[]>([]);
  // eslint-disable-next-line react-hooks/purity -- Date.now runs only in the PNG button handler, never during render.
  const exportPng=async()=>{try{setBusy(true);const documentNo=info.documentNo||Date.now();const size=getStudioPageSize(config);for(let i=0;i<pages.length;i++){const node=exportRefs.current[i];if(!node)throw new Error(`Trang ${i+1} chưa sẵn sàng. Vui lòng thử lại.`);const format=String(config.format||'A4').toUpperCase(),device=format==='PHONE'?'PHONE':'A4';if(typeof __DEV__!=='undefined'&&__DEV__)console.log('[QQIVA PNG]',{format,device,width:size.width,height:size.height,pageNo:i+1,pageCount:pages.length,itemsOnPage:pages[i].length});const uri=await captureRef(node,{format:'png',quality:1,result:'tmpfile',width:size.width,height:size.height});await persistCapturedPng(uri,`${info.documentKind==='INVOICE'?'HOA_DON':'BAO_GIA'}_${documentNo}_page-${String(i+1).padStart(2,'0')}.png`);}}catch(e:any){Alert.alert('Không xuất được PNG',e.message||String(e))}finally{setBusy(false)}};
  const exportPdf=async()=>{try{setBusy(true);await exportAdQuotePdf(state,{...config,template});}catch(e:any){Alert.alert('Không xuất được PDF',e.message||String(e))}finally{setBusy(false)}};
  return <Screen title="Document Preview" subtitle={`${template.name} • ${pages.length} trang • offline`} right={<IconButton icon="close" onPress={()=>router.back()}/>}>
    <Card><SectionTitle>Template chuyên nghiệp đã lưu</SectionTitle><Chips value={device} onChange={v=>setDevice(v as any)} options={[{value:'PHONE',label:'Điện thoại'},{value:'DESKTOP',label:'Máy tính'},{value:'A4',label:'A4'}]}/><Muted>{items.length} sản phẩm • Tổng {money(totals.grandTotal)} • Giữ nguyên logo/chữ ký/con dấu và cấu hình Studio.</Muted></Card>
    {pages.map((page,i)=><ProfessionalTemplatePreview key={i} refNode={n=>{refs.current[i]=n}} template={template} config={config} info={info} company={company} items={items} pageItems={page} pageNo={i+1} pageCount={pages.length} isLast={i===pages.length-1} device={device}/>)}
    {pages.map((page,i)=><ProfessionalTemplatePreview key={`export-${i}`} refNode={n=>{exportRefs.current[i]=n}} template={template} config={config} info={info} company={company} items={items} pageItems={page} pageNo={i+1} pageCount={pages.length} isLast={i===pages.length-1} device={String(config.format).toUpperCase()==='PHONE'?'PHONE':'A4'} exportMode/>)}
    <Row style={{flexWrap:'wrap'}}><AppButton title="PDF" icon="file-pdf-box" disabled={busy} onPress={exportPdf}/><AppButton variant="secondary" title={busy?'Đang xuất…':'PNG từng trang'} icon="image-multiple" disabled={busy} onPress={exportPng}/></Row>
  </Screen>;
}

function ContractPreview({contract,company,refs,busy,setBusy}:{contract:any;company:any;refs:any;busy:boolean;setBusy:(v:boolean)=>void}){
  const sections=String(contract.content||'').split(/\n\s*\n/).filter(Boolean);
  const pages=chunk(sections,4);if(!pages.length)pages.push([]);
  const exportPng=async()=>{try{setBusy(true);for(let i=0;i<refs.current.length;i++){if(!refs.current[i])continue;const uri=await captureRef(refs.current[i],{format:'png',quality:1,result:'tmpfile',width:1240,height:1754});await persistCapturedPng(uri,`${contract.contract_no||'HOP_DONG'}_TRANG_${i+1}.png`);}}catch(e:any){Alert.alert('Lỗi',e.message||String(e))}finally{setBusy(false)}};
  return <Screen title="Xem trước hợp đồng" subtitle={`${contract.contract_no||''} • ${pages.length} trang`} right={<IconButton icon="close" onPress={()=>router.back()}/>}>
    {pages.map((ss:any[],i:number)=><View key={i} ref={(n:any)=>{refs.current[i]=n}} collapsable={false} style={s.page}>
      {i===0?<View style={s.contractBrand}>{company.logo?<Image source={imageSource(company.logo)} style={s.logo} resizeMode="contain"/>:null}<View style={{flex:1}}><Text style={s.company}>{company.name||'QQIVA BUSINESS'}</Text><Text style={s.small}>{company.address||''}</Text></View></View>:null}
      <Text style={s.contractTitle}>{contract.title||'HỢP ĐỒNG'}</Text><Text style={s.contractNo}>Số {contract.contract_no||''} • {contract.contract_date||''}</Text>
      {i===0?<><View style={s.party}><Text style={s.bold}>BÊN A: {contract.party_a||contract.parties?.a?.name||''}</Text><Text>{contract.parties?.a?.address||''}</Text><Text>{contract.parties?.a?.representative||''}</Text></View><View style={s.party}><Text style={s.bold}>BÊN B: {contract.party_b||contract.parties?.b?.name||''}</Text><Text>{contract.parties?.b?.address||''}</Text><Text>{contract.parties?.b?.representative||''}</Text></View></>:null}
      {ss.map((x,j)=><Text key={j} style={s.contractSection}>{x}</Text>)}
      {i===pages.length-1?<><Divider/><Text style={s.bold}>Giá trị trước VAT: {money(contract.base_value??contract.value)}</Text>{Number(contract.vat_percent||0)?<Text>VAT: {Number(contract.vat_percent||0).toLocaleString('vi-VN')}%</Text>:null}{Number(contract.discount||0)?<Text>Chiết khấu: {money(contract.discount)}</Text>:null}<Text style={s.bold}>Giá trị hợp đồng: {money(contract.value)}</Text><Text>Đặt cọc: {money(contract.deposit)} • Còn lại: {money(contract.remaining)}</Text><ContractPaymentTerms terms={contract.payment_terms}/><View style={s.signatures}><Sign title="ĐẠI DIỆN BÊN A" name={contract.parties?.a?.representative||contract.party_a}/><Sign title="ĐẠI DIỆN BÊN B" image={company.signature} stamp={company.stamp} name={company.signature_name||company.representative||contract.parties?.b?.representative}/></View></>:null}
      <Text style={s.pageNo}>Trang {i+1}/{pages.length}</Text>
    </View>)}
    <Row style={{flexWrap:'wrap'}}><AppButton title="PDF" icon="file-pdf-box" disabled={busy} onPress={()=>void exportContractPdf(contract)}/><AppButton variant="secondary" title="DOCX" icon="file-word" disabled={busy} onPress={()=>void exportContractDocx(contract)}/><AppButton variant="secondary" title="PNG từng trang" icon="image-multiple" disabled={busy} onPress={()=>void exportPng()}/></Row>
  </Screen>
}
function ContractPaymentTerms({terms}:{terms:any}){const rows=Array.isArray(terms)?terms:(Array.isArray(terms?.stages)?terms.stages:[]);const textTerms=!Array.isArray(terms)?String(terms?.terms_text||''):'';if(!rows.length&&!textTerms)return null;return <View style={s.terms}><Text style={s.bold}>TIẾN ĐỘ / GIAI ĐOẠN THANH TOÁN</Text>{rows.map((x:any,i:number)=><View key={x.id||i} style={s.paymentTerm}><Text style={s.bold}>{x.name||`Giai đoạn ${i+1}`}</Text><Text>{Number(x.percent||0)?`${Number(x.percent).toLocaleString('vi-VN')}%`:''}{Number(x.amount||0)?` • ${money(x.amount)}`:''}{x.due_date?` • hạn ${x.due_date}`:''}</Text>{x.note?<Text style={s.small}>{x.note}</Text>:null}</View>)}{textTerms?<Text>{textTerms}</Text>:null}</View>}
function Sign({title,image,stamp,name}:{title:string;image?:string;stamp?:string;name?:string}){return <View style={s.sign}><Text style={s.bold}>{title}</Text><View style={s.signMedia}>{image?<Image source={imageSource(image)} style={s.signImg} resizeMode="contain"/>:null}{stamp?<Image source={imageSource(stamp)} style={s.stamp} resizeMode="contain"/>:null}</View><Text style={s.bold}>{name||''}</Text></View>}
function Total({label,value}:{label:string;value:number}){return <Row><Text style={{flex:1}}>{label}</Text><Text style={s.bold}>{money(value)}</Text></Row>}
function chunk<T>(rows:T[],size:number){const out:T[][]=[];for(let i=0;i<rows.length;i+=size)out.push(rows.slice(i,i+size));return out}

const s=StyleSheet.create({
  page: {
    backgroundColor: '#fff',
    borderRadius: 4,
    padding: 18,
    borderWidth: 1,
    borderColor: '#D9E0E8',
    minHeight: 720,
    gap: 10,
    overflow: 'hidden',
  },
  pageWide: { minHeight: 520 },
  pagePremium: { borderColor: '#9B7A3D', borderWidth: 2 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingBottom: 10,
    gap: 12,
  },
  headerModern: { backgroundColor: '#EEF6FD', padding: 10, borderRadius: 8 },
  logo: { width: 70, height: 50 },
  company: { fontWeight: '900', fontSize: 15, color: colors.text },
  small: { fontSize: 9, color: colors.textSoft, lineHeight: 13 },
  docHead: { alignItems: 'flex-end' },
  docTitle: { fontWeight: '900', fontSize: 22, color: colors.primary },
  docNo: { fontWeight: '900', fontSize: 12, color: colors.text },
  info: { gap: 3, paddingVertical: 6 },
  bold: { fontWeight: '900', color: colors.text },
  table: { borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#C9D2DC' },
  tr: { flexDirection: 'row', minHeight: 52 },
  th: { minHeight: 30, backgroundColor: '#EDF3F8' },
  cell: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#C9D2DC',
    padding: 4,
    fontSize: 8,
    color: colors.text,
    textAlignVertical: 'center',
  },
  cellView: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#C9D2DC',
    padding: 4,
    justifyContent: 'center',
  },
  cNo: { width: 28, textAlign: 'center' },
  cImg: { width: 55 },
  cName: { flex: 1, minWidth: 120 },
  cUnit: { width: 38, textAlign: 'center' },
  cQty: { width: 45, textAlign: 'right' },
  cPrice: { width: 72, textAlign: 'right' },
  cAmount: { width: 80, textAlign: 'right' },
  itemImg: { width: 44, height: 44 },
  itemName: { fontSize: 9, fontWeight: '800', color: colors.text },
  tiny: { fontSize: 7, color: colors.textSoft, marginTop: 2 },
  totals: { width: '55%', alignSelf: 'flex-end', gap: 4 },
  grand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 2,
    borderTopColor: colors.primary,
    paddingTop: 6,
  },
  grandT: { fontWeight: '900', color: colors.primary },
  grandV: { fontWeight: '900', color: colors.primary, fontSize: 15 },
  terms: { gap: 4, paddingTop: 8 },
  paymentTerm: { borderBottomWidth: 1, borderBottomColor: '#E1E6EC', paddingVertical: 5 },
  signatures: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 16 },
  sign: { width: '46%', alignItems: 'center', minHeight: 120 },
  signMedia: { height: 70, width: '100%', alignItems: 'center', justifyContent: 'center' },
  signImg: { width: 120, height: 60 },
  stamp: { position: 'absolute', width: 70, height: 70, right: 10, top: 0, opacity: 0.78 },
  pageNo: { fontSize: 8, color: colors.textSoft, textAlign: 'center', marginTop: 'auto' },
  contractTitle: { fontWeight: '900', fontSize: 21, textAlign: 'center', color: colors.text },
  contractNo: { fontWeight: '800', fontSize: 11, textAlign: 'center', color: colors.textSoft },
  contractBrand: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 8 },
  party: { padding: 10, borderWidth: 1, borderColor: colors.border, gap: 4 },
  contractSection: { fontSize: 11, lineHeight: 18, color: colors.text },
});
