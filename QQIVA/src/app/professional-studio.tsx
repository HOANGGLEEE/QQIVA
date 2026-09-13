import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { ProfessionalTemplatePreview, calculateStudioTotals, getStudioPageSize, lineAmount, paginateProfessionalItems, type StudioInfo, type StudioProductItem } from '@/components/ProfessionalTemplatePreview';
import { Screen } from '@/components/Screen';
import { AppButton, Card, Chips, Divider, Field, IconButton, ImageThumb, Muted, Row, SectionTitle, ToggleRow } from '@/components/ui';
import { colors } from '@/constants/theme';
import { clone, today } from '@/services/id';
import {
  PROFESSIONAL_TEMPLATE_FILTERS,
  clearProfessionalWork,
  getAdDraft,
  getAdPreferences,
  getProfessionalWork,
  listAdDrafts,
  listProfessionalTemplates,
  saveAdDefaultCustomize,
  saveAdDraft,
  saveAdTemplate,
  saveProfessionalWork,
  templateInitialConfig,
  type ProfessionalTemplate,
} from '@/services/adQuotes';
import { getLiveState, saveDocument, studioDocumentItem, studioPricing } from '@/services/documentEngine';
import { generateStudioPdf, persistCapturedPng, saveVisiblePdf, shareLocalFile } from '@/services/export';
import { imageSource, pickImages } from '@/services/media';
import { listProductGroups, listProducts } from '@/services/products';

const STEPS=[
  {n:1,label:'Chọn mẫu'},
  {n:2,label:'Chọn sản phẩm'},
  {n:3,label:'Thông tin'},
  {n:4,label:'Tùy chỉnh'},
  {n:5,label:'Xem trước & Xuất'},
] as const;
const CHECK_KEYS=['adShowCompany','adShowImages','adShowTable','adShowTableImages','adShowDescription','adShowUnit','adShowQty','adShowPrice','adShowTotal','adShowContact','adMissingAsContact','adShowPaymentInfo'];
const money=(v:any)=>`${Math.round(Number(v||0)).toLocaleString('vi-VN')} đ`;

export default function ProfessionalStudio(){
  const {width}=useWindowDimensions();
  const [step,setStep]=useState(1);
  const [baseState,setBaseState]=useState<any>(null);
  const [templates,setTemplates]=useState<ProfessionalTemplate[]>([]);
  const [drafts,setDrafts]=useState<any[]>([]);
  const [preferences,setPreferences]=useState<any>({});
  const [selectedTemplateId,setSelectedTemplateId]=useState('');
  const [templateFilter,setTemplateFilter]=useState('ALL');
  const [device,setDevice]=useState<'PHONE'|'DESKTOP'|'A4'>('PHONE');
  const [products,setProducts]=useState<any[]>([]);
  const [groups,setGroups]=useState<any[]>([]);
  const [productSearch,setProductSearch]=useState('');
  const [productGroup,setProductGroup]=useState('ALL');
  const [items,setItems]=useState<StudioProductItem[]>([]);
  const [info,setInfo]=useState<StudioInfo>({documentKind:'QUOTE',companyName:'',companyAddress:'',companyPhone:'',companyWebsite:'',customerName:'',customerPhone:'',projectName:'',address:'',documentNo:'',documentDate:today(),note:''});
  const [config,setConfig]=useState<any>({});
  const [templateName,setTemplateName]=useState('Mẫu chuyên nghiệp');
  const [busy,setBusy]=useState(false);
  const [hydrated,setHydrated]=useState(false);
  const [productEditorOpen,setProductEditorOpen]=useState(false);
  const previewRefs=useRef<any[]>([]);
  const exportRefs=useRef<any[]>([]);

  useEffect(()=>{void (async()=>{
    const [st,t,d,p,prod,grp,work]=await Promise.all([getLiveState(),listProfessionalTemplates(),listAdDrafts(),getAdPreferences(),listProducts(),listProductGroups(),getProfessionalWork()]);
    setBaseState(st);setTemplates(t);setDrafts(d);setPreferences(p);setProducts(prod);setGroups(grp);
    const project=st?.project||{},company=st?.company||{};
    const defaultInfo:StudioInfo={
      documentKind:String(st?.document_mode||'quote').toLowerCase()==='invoice'?'INVOICE':'QUOTE',
      companyName:String(company.name||'NHÀ ĐẸP QUYỀN QUÝ'),companyAddress:String(company.address||''),companyPhone:String(company.phone||''),companyWebsite:String(company.website||''),
      customerName:String(project.customer||''),customerPhone:String(project.phone||''),projectName:String(project.project_name||''),address:String(project.address||project.project_name||''),
      documentNo:String(project.quote_no||''),documentDate:String(project.quote_date||today()),note:String(project.quote_note||''),
    };
    setInfo(defaultInfo);
    if(work&&typeof work==='object'&&work.schema==='qqiva.professional.rn.work.v2'){
      if(work.selectedTemplateId)setSelectedTemplateId(String(work.selectedTemplateId));
      if(work.templateFilter)setTemplateFilter(String(work.templateFilter));
      if(Array.isArray(work.items))setItems(work.items.map(normalizeStudioItem));
      if(work.info&&typeof work.info==='object')setInfo({...defaultInfo,...work.info});
      if(work.config&&typeof work.config==='object')setConfig(work.config);
      if(work.templateName)setTemplateName(String(work.templateName));
    }
    setStep(1);setHydrated(true);
  })()},[]);

  useEffect(()=>{
    if(!hydrated)return;
    const timer=setTimeout(()=>{void saveProfessionalWork({schema:'qqiva.professional.rn.work.v2',selectedTemplateId,templateFilter,items,info,config,templateName,updated_at:new Date().toISOString()});},250);
    return()=>clearTimeout(timer);
  },[hydrated,selectedTemplateId,templateFilter,items,info,config,templateName]);

  const selectedTemplate=useMemo(()=>templates.find(t=>t.id===selectedTemplateId)||null,[templates,selectedTemplateId]);
  const filteredTemplates=useMemo(()=>templates.filter(t=>templateFilter==='ALL'||t.cat===templateFilter),[templates,templateFilter]);
  const filteredProducts=useMemo(()=>{
    const q=productSearch.trim().toLocaleLowerCase('vi');
    return products
      .map((p,index)=>({p,index}))
      .filter(({p})=>{
        const groupCode=String(p.group_code||p.group||p.group_name||'');
        if(productGroup!=='ALL'&&groupCode!==productGroup)return false;
        if(!q)return true;
        return [p.name,p.catalog_key,p.description,p.group_name,p.group_code].some(v=>String(v||'').toLocaleLowerCase('vi').includes(q));
      })
      .sort((a,b)=>{
        const aHasPrice=productPriceFromRow(a.p)>0?1:0;
        const bHasPrice=productPriceFromRow(b.p)>0?1:0;
        if(aHasPrice!==bHasPrice)return bHasPrice-aHasPrice;
        return a.index-b.index;
      })
      .map(({p})=>p);
  },[products,productSearch,productGroup]);
  const pages=useMemo(()=>paginateProfessionalItems(items,config),[items,config]);
  const totals=useMemo(()=>calculateStudioTotals(items,config),[items,config]);
  const company=baseState?.company||{};

  const pickTemplate=(tpl:ProfessionalTemplate)=>{
    const initial=templateInitialConfig(tpl,preferences);const fields=initial.fields||{},checks=initial.checks||{};
    setSelectedTemplateId(tpl.id);setTemplateName(tpl.source==='saved'?tpl.name:`${tpl.name} • QQIVA`);
    setConfig((old:any)=>({...fields,...checks,...keepFinancialAndMedia(old)}));
    setInfo(old=>({...old,
      documentKind:fields.documentKind==='INVOICE'?'INVOICE':old.documentKind,
      documentNo:fields.documentNo||old.documentNo,documentDate:fields.documentDate||old.documentDate,
      companyName:fields.company||old.companyName,companyAddress:fields.companyAddress||old.companyAddress,
      customerName:fields.customerName||old.customerName,customerPhone:fields.customerPhone||old.customerPhone,address:fields.customerAddress||old.address,
    }));
  };

  const go=(target:number)=>{
    if(target>1&&!selectedTemplate){Alert.alert('Chưa chọn mẫu','Hãy chọn một template ở Bước 1 trước khi tiếp tục.');setStep(1);return;}
    if(target>2&&!items.length){Alert.alert('Chưa chọn sản phẩm','Hãy thêm ít nhất một sản phẩm ở Bước 2.');setStep(2);return;}
    setStep(Math.max(1,Math.min(5,target)));
  };

  const addProduct=(p:any)=>{
    const id=String(p.id||p.catalog_key||Date.now());
    setItems(old=>{
      const found=old.find(x=>x.productId===id||x.id===`studio-${id}`);
      if(found)return old.map(x=>x===found?{...x,qty:Number(x.qty||0)+1}:x);
      return [...old,{id:`studio-${id}`,productId:id,name:String(p.name||'Sản phẩm'),description:String(p.description||''),image:String(p.image||''),unit:String(p.unit||''),qty:1,price:productPriceFromRow(p),discount:0,group:String(p.group_name||p.group_code||p.group||'')}];
    });
  };
  const patchItem=(id:string,patch:Partial<StudioProductItem>)=>setItems(old=>old.map(x=>x.id===id?{...x,...patch}:x));
  const removeItem=(id:string)=>setItems(old=>old.filter(x=>x.id!==id));

  const setCfg=(patch:any)=>setConfig((old:any)=>({...old,...patch}));
  const selectMedia=async(key:'logoOverride'|'signatureOverride'|'stampOverride')=>{try{const a=await pickImages({ownerType:'PROFESSIONAL_STUDIO',ownerId:selectedTemplateId||'work',multiple:false});if(a[0])setCfg({[key]:a[0].uri});}catch(e:any){Alert.alert('Không chọn được ảnh',e.message||String(e))}};

  const serializeTemplateConfig=()=>{
    const fields:any={},checks:any={};
    for(const [k,v] of Object.entries(config)){if(CHECK_KEYS.includes(k))checks[k]=v;else fields[k]=v;}
    fields.documentKind=info.documentKind;fields.documentNo=info.documentNo;fields.documentDate=info.documentDate;fields.company=info.companyName;fields.companyAddress=info.companyAddress;fields.customerName=info.customerName;fields.customerPhone=info.customerPhone;fields.customerAddress=info.address;
    const sourceTemplate=selectedTemplate?.source==='saved'?String(selectedTemplate.config?.template||'style-01-luxury-gold'):String(selectedTemplate?.id||'style-01-luxury-gold');
    return {template:sourceTemplate,filter:templateFilter,fields,checks};
  };

  const buildDocumentState=()=>{
    if(!baseState||!selectedTemplate)throw new Error('Studio chưa sẵn sàng');
    const st=clone(baseState);const c={...(st.company||{})};const p={...(st.project||{})};
    st.document_mode=info.documentKind==='INVOICE'?'invoice':'quote';
    c.name=info.companyName||c.name;c.address=info.companyAddress;c.phone=info.companyPhone;c.website=info.companyWebsite;
    if(config.logoOverride)c.logo=config.logoOverride;if(config.signatureOverride)c.signature=config.signatureOverride;if(config.stampOverride)c.stamp=config.stampOverride;st.company=c;
    p.customer=info.customerName;p.phone=info.customerPhone;p.project_name=info.projectName||info.address;p.address=info.address||info.projectName;p.quote_no=info.documentNo;p.quote_date=info.documentDate||today();p.quote_note=info.note;
    p.pricing={...(p.pricing||{}),...studioPricing(config)};
    p.payment_terms={...(p.payment_terms||{}),enabled:!!String(config.termsText||'').trim(),terms_text:String(config.termsText||'')};st.project=p;
    st.floors=[{id:'STUDIO-FLOOR',name:'Hạng mục',rooms:[{id:'STUDIO-ROOM',name:info.projectName||'Thiết kế chuyên nghiệp',items:items.map((x,index)=>({id:x.id||`STUDIO-${index+1}`,name:x.name,description:x.description,image:x.image,unit:x.unit,...studioDocumentItem(x),status:'PROFESSIONAL_STUDIO',category:x.group||''}))}]}];
    st.professional_studio={schema:'qqiva.professional.studio.rn.v2',template:selectedTemplate,template_id:selectedTemplate.id,config:{...config},info:{...info},items:items.map(x=>({...x})),saved_at:new Date().toISOString()};
    return st;
  };

  const saveDraft=async()=>{try{if(!selectedTemplate)throw new Error('Chưa chọn template');const row=await saveAdDraft({name:`${info.documentKind==='INVOICE'?'Hóa đơn':'Báo giá'} • ${info.customerName||templateName}`,config:serializeTemplateConfig(),work:{schema:'qqiva.professional.rn.work.v2',selectedTemplateId:selectedTemplate.id,templateFilter,items,info,config,step,device}});setDrafts(await listAdDrafts());Alert.alert('Đã lưu bản nháp',row.name);}catch(e:any){Alert.alert('Không lưu được bản nháp',e.message||String(e))}};
  const saveTemplate=async()=>{try{if(!selectedTemplate)throw new Error('Chưa chọn template');const row=await saveAdTemplate({name:templateName,config:serializeTemplateConfig()});await saveAdDefaultCustomize({schema:'qqiva.professional.customize.v1',fields:serializeTemplateConfig().fields,checks:serializeTemplateConfig().checks});setTemplates(await listProfessionalTemplates());Alert.alert('Đã lưu mẫu',`${row.name} đã được lưu offline và sẽ xuất hiện ở Bước 1.`);}catch(e:any){Alert.alert('Không lưu được mẫu',e.message||String(e))}};
  const restoreDraft=async(draft:any)=>{try{const full=await getAdDraft(String(draft.id));const source=full||draft,w=source?.work||{},cfg=source?.config||{};const baseId=String(w.selectedTemplateId||cfg.template||'');const found=templates.find(t=>t.id===baseId)||templates.find(t=>t.id===`saved:${draft.id}`)||templates.find(t=>t.id===cfg.template);if(found)setSelectedTemplateId(found.id);else if(baseId)setSelectedTemplateId(baseId);const fields=cfg.fields||{},checks=cfg.checks||{};setConfig({...fields,...checks,...(w.config||{})});if(w.info)setInfo(old=>({...old,...w.info}));else setInfo(old=>({...old,documentKind:fields.documentKind==='INVOICE'?'INVOICE':old.documentKind,documentNo:fields.documentNo||old.documentNo,documentDate:fields.documentDate||old.documentDate,companyName:fields.company||old.companyName,companyAddress:fields.companyAddress||old.companyAddress,customerName:fields.customerName||old.customerName,customerPhone:fields.customerPhone||old.customerPhone,address:fields.customerAddress||old.address}));const restored=Array.isArray(w.items)?w.items:[];if(restored.length)setItems(restored.map(normalizeStudioItem));setStep(1);Alert.alert('Đã mở bản nháp','Dữ liệu đã được phục hồi. Luồng vẫn bắt đầu tại Bước 1 để bạn kiểm tra template.');}catch(e:any){Alert.alert('Không mở được bản nháp',e.message||String(e))}};

  const exportPng=async()=>{try{if(!selectedTemplate)throw new Error('Chưa chọn template');setBusy(true);const size=getStudioPageSize(config);let saved=0;for(let i=0;i<pages.length;i++){const node=exportRefs.current[i];if(!node)throw new Error(`Trang ${i+1} chưa sẵn sàng. Vui lòng thử lại.`);const format=String(config.format||'A4').toUpperCase(),device=format==='PHONE'?'PHONE':'A4';if(typeof __DEV__!=='undefined'&&__DEV__)console.log('[QQIVA PNG]',{format,device,width:size.width,height:size.height,pageNo:i+1,pageCount:pages.length,itemsOnPage:pages[i].length});const uri=await captureRef(node,{format:'png',quality:1,result:'tmpfile',width:size.width,height:size.height});await persistCapturedPng(uri,`QQIVA_${info.documentNo||Date.now()}_page-${String(i+1).padStart(2,'0')}.png`);saved++;}Alert.alert('Đã lưu PNG',`${saved} ảnh đã được lưu vào Gallery/QQIVA.`);}catch(e:any){Alert.alert('Không xuất được PNG',e.message||String(e))}finally{setBusy(false)}};
  const exportPdf=async()=>{try{if(!selectedTemplate)throw new Error('Chưa chọn template');setBusy(true);const pdf=await generateStudioPdf(buildDocumentState(),{...config,template:selectedTemplate});await saveVisiblePdf(pdf);Alert.alert('Đã xuất PDF',`Đã lưu ${pdf.filename} • ${pdf.numberOfPages} trang`);}catch(e:any){Alert.alert('Không xuất được PDF',e.message||String(e))}finally{setBusy(false)}};
  const shareExport=async()=>{try{if(!selectedTemplate)throw new Error('Chưa chọn template');setBusy(true);const pdf=await generateStudioPdf(buildDocumentState(),{...config,template:selectedTemplate});await shareLocalFile(pdf.uri,'application/pdf');}catch(e:any){Alert.alert('Không chia sẻ được',e.message||String(e))}finally{setBusy(false)}};
  const saveFinalDocument=async()=>{try{setBusy(true);const entry=await saveDocument(buildDocumentState());setBaseState(entry.state);setInfo(old=>({...old,documentNo:String(entry.state?.project?.quote_no||old.documentNo)}));await clearProfessionalWork();Alert.alert('Đã lưu chứng từ',`${entry.meta?.document_no||entry.state?.project?.quote_no||''} đã được lưu vào SQLite.`);}catch(e:any){Alert.alert('Không lưu được chứng từ',e.message||String(e))}finally{setBusy(false)}};

  if(!baseState)return <Screen title="Hóa đơn - Báo giá chuyên nghiệp"><Card><Text>Đang tải dữ liệu offline…</Text></Card></Screen>;

  return <Screen
    title="Hóa đơn - Báo giá chuyên nghiệp"
    subtitle="Chọn mẫu đẹp • Tạo nhanh • PNG • PDF • Chia sẻ • Offline"
    right={<IconButton icon="close" onPress={()=>router.back()}/>}
    footer={step===2?<ProductStepFooter items={items} onBack={()=>go(1)} onEdit={()=>setProductEditorOpen(true)} onNext={()=>go(3)}/>:undefined}
  >
    <StepBar step={step} onStep={go}/>
    {step===1?<StepTemplates templates={filteredTemplates} filter={templateFilter} setFilter={setTemplateFilter} selectedId={selectedTemplateId} onPick={pickTemplate} selected={selectedTemplate} config={config} info={info} company={company} items={items} device={device} setDevice={setDevice} wide={width>=900} drafts={drafts} restoreDraft={restoreDraft}/>:null}
    {step===2?<StepProducts products={filteredProducts} search={productSearch} setSearch={setProductSearch} groups={groups} group={productGroup} setGroup={setProductGroup} items={items} addProduct={addProduct}/>:null}
    {step===3?<StepInfo info={info} setInfo={setInfo}/>:null}
    {step===4&&selectedTemplate?<StepCustomize config={config} setCfg={setCfg} company={company} selectMedia={selectMedia} template={selectedTemplate} info={info} items={items} device={device} setDevice={setDevice}/>:null}
    {step===5&&selectedTemplate?<StepPreview template={selectedTemplate} config={config} info={info} company={company} items={items} pages={pages} totals={totals} device={device} setDevice={setDevice} refs={previewRefs} exportRefs={exportRefs} busy={busy} exportPng={exportPng} exportPdf={exportPdf} shareExport={shareExport} saveFinalDocument={saveFinalDocument} saveDraft={saveDraft} saveTemplate={saveTemplate} templateName={templateName} setTemplateName={setTemplateName}/>:null}
    {step!==2?<NavButtons step={step} selectedTemplate={!!selectedTemplate} hasItems={items.length>0} onBack={()=>go(step-1)} onNext={()=>go(step+1)}/>:null}
    <SelectedProductsModal visible={productEditorOpen} items={items} onClose={()=>setProductEditorOpen(false)} patchItem={patchItem} removeItem={removeItem}/>
  </Screen>;
}

function StepBar({step,onStep}:{step:number;onStep:(n:number)=>void}){return <View style={s.stepBar}>{STEPS.map(x=><Pressable key={x.n} onPress={()=>onStep(x.n)} style={[s.step,x.n===step&&s.stepActive]}><View style={[s.stepNo,x.n===step&&s.stepNoActive]}><Text style={[s.stepNoText,x.n===step&&{color:'#fff'}]}>{x.n}</Text></View><Text style={[s.stepText,x.n===step&&s.stepTextActive]}>{x.label}</Text></Pressable>)}</View>}

function StepTemplates({templates,filter,setFilter,selectedId,onPick,selected,config,info,company,items,device,setDevice,wide,drafts,restoreDraft}:{templates:ProfessionalTemplate[];filter:string;setFilter:(v:string)=>void;selectedId:string;onPick:(t:ProfessionalTemplate)=>void;selected:ProfessionalTemplate|null;config:any;info:StudioInfo;company:any;items:StudioProductItem[];device:'PHONE'|'DESKTOP'|'A4';setDevice:(v:'PHONE'|'DESKTOP'|'A4')=>void;wide:boolean;drafts:any[];restoreDraft:(d:any)=>void}){
  const samplePages=selected?paginateProfessionalItems(items,config):[[] as StudioProductItem[]];
  return <View style={wide?s.workspaceWide:undefined}>
    <Card style={wide?s.workspaceLeft:undefined}><SectionTitle>1. CHỌN MẪU THIẾT KẾ</SectionTitle><Chips value={filter} onChange={setFilter} options={PROFESSIONAL_TEMPLATE_FILTERS.map(x=>({value:x.value,label:x.label}))}/>
      <View style={s.templateGrid}>{templates.map(t=><TemplateCard key={t.id} tpl={t} selected={t.id===selectedId} onPress={()=>onPick(t)}/>)}</View>{selected?<View style={s.selectedTemplateBanner}><MaterialCommunityIcons name="check-circle" size={18} color="#7445E8"/><Text style={s.selectedTemplateText}>Đang chọn: {selected.name}</Text></View>:null}
      {drafts.length?<><Divider/><SectionTitle>Bản nháp đã lưu</SectionTitle>{drafts.slice(0,6).map(d=><TouchableOpacity key={d.id} style={s.draftRow} onPress={()=>restoreDraft(d)}><MaterialCommunityIcons name="content-save-edit-outline" size={20} color={colors.primary}/><View style={{flex:1}}><Text style={s.draftName}>{d.name||'Bản nháp'}</Text><Muted>{String(d.updated_at||'').replace('T',' ').slice(0,16)}</Muted></View><MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSoft}/></TouchableOpacity>)}</>:null}
    </Card>
    <Card style={wide?s.workspaceRight:undefined}><SectionTitle>XEM TRƯỚC THIẾT KẾ</SectionTitle><Chips value={device} onChange={v=>setDevice(v as any)} options={[{value:'PHONE',label:'Điện thoại'},{value:'DESKTOP',label:'Máy tính'},{value:'A4',label:'A4'}]}/>
      {selected?<ProfessionalTemplatePreview template={selected} config={config} info={info} company={company} items={items} pageItems={samplePages[0]||[]} pageNo={1} pageCount={samplePages.length} isLast={samplePages.length===1} device={device}/>:<View style={s.emptyPreview}><MaterialCommunityIcons name="palette-outline" size={44} color={colors.textSoft}/><Text style={s.emptyPreviewTitle}>Chọn một template để xem trước</Text><Muted>Catalog 12 mẫu này được port trực tiếp từ QQIVA Web V1.5.93.77.</Muted></View>}
    </Card>
  </View>;
}

function TemplateCard({tpl,selected,onPress}:{tpl:ProfessionalTemplate;selected:boolean;onPress:()=>void}){const palette=miniPalette(tpl.theme);return <TouchableOpacity onPress={onPress} style={[s.templateCard,selected&&s.templateCardActive]}><View style={[s.templateMini,{backgroundColor:palette.bg,borderColor:palette.accent}]}><View style={[s.miniLine,{backgroundColor:palette.accent}]}/><Text style={[s.miniTitle,{color:palette.text}]} numberOfLines={3}>{tpl.title}</Text><Text style={[s.miniSub,{color:palette.accent}]} numberOfLines={1}>{tpl.name}</Text></View><View style={{flex:1}}><Text style={s.templateName}>{tpl.name}</Text><Muted>{tpl.source==='saved'?'Mẫu của tôi':tpl.style.toLowerCase().replaceAll('_',' ')}</Muted></View>{selected?<MaterialCommunityIcons name="check-circle" size={22} color="#7445E8"/>:null}</TouchableOpacity>}

function StepProducts({products,search,setSearch,groups,group,setGroup,items,addProduct}:{products:any[];search:string;setSearch:(v:string)=>void;groups:any[];group:string;setGroup:(v:string)=>void;items:StudioProductItem[];addProduct:(p:any)=>void}){
  const groupOptions=[{value:'ALL',label:'Tất cả'},...groups.map(g=>({value:String(g.code||g.id),label:String(g.name||g.code)}))];
  const pricedCount=products.filter(p=>productPriceFromRow(p)>0).length;
  const noPriceCount=products.length-pricedCount;
  return <><Card><SectionTitle>2. CHỌN SẢN PHẨM</SectionTitle><Field label="Tìm kiếm" value={search} onChangeText={setSearch} placeholder="Tên, mã catalog, mô tả…"/><Chips value={group} onChange={setGroup} options={groupOptions}/><Muted>{products.length} sản phẩm phù hợp • {pricedCount} có giá{noPriceCount?` • ${noPriceCount} chưa có giá được xếp cuối`:''}.</Muted>{items.length?<View style={s.selectedSummary}><MaterialCommunityIcons name="check-circle" size={18} color={colors.success}/><Text style={s.selectedSummaryText}>Đã chọn {items.length} sản phẩm • Dùng thanh cố định bên dưới để sửa hoặc tiếp tục.</Text></View>:null}</Card>
    <View style={s.productGrid}>{products.map(p=><ProductCard key={p.id} p={p} selected={items.some(x=>x.productId===String(p.id))} onAdd={()=>addProduct(p)}/>)}</View>
  </>;
}

function ProductStepFooter({items,onBack,onEdit,onNext}:{items:StudioProductItem[];onBack:()=>void;onEdit:()=>void;onNext:()=>void}){
  const total=items.reduce((sum,item)=>sum+lineAmount(item),0);
  return <View style={s.productFooter}>
    <View style={s.productFooterSummary}><Text style={s.productFooterCount}>Đã chọn {items.length} sản phẩm</Text><Text style={s.productFooterTotal}>{money(total)}</Text></View>
    <View style={s.productFooterActions}>
      <AppButton compact variant="secondary" title="Quay lại" icon="arrow-left" onPress={onBack}/>
      <AppButton compact variant="secondary" title={`Sửa (${items.length})`} icon="pencil" disabled={!items.length} onPress={onEdit}/>
      <AppButton compact title="Tiếp tục" icon="arrow-right" disabled={!items.length} onPress={onNext}/>
    </View>
  </View>;
}

function SelectedProductsModal({visible,items,onClose,patchItem,removeItem}:{visible:boolean;items:StudioProductItem[];onClose:()=>void;patchItem:(id:string,p:Partial<StudioProductItem>)=>void;removeItem:(id:string)=>void}){
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <View style={s.editorModal}>
      <View style={s.editorModalHeader}><View style={{flex:1}}><Text style={s.editorModalTitle}>Sản phẩm đã chọn</Text><Muted>{items.length} sản phẩm • chỉnh KL/SL, đơn giá, chiết khấu và ĐVT</Muted></View><IconButton icon="close" onPress={onClose}/></View>
      <ScrollView contentContainerStyle={s.editorModalContent} keyboardShouldPersistTaps="handled">
        {items.length?items.map(item=><SelectedProductEditor key={item.id} item={item} patch={p=>patchItem(item.id,p)} remove={()=>removeItem(item.id)}/>):<Card><Muted>Chưa có sản phẩm nào được chọn.</Muted></Card>}
      </ScrollView>
      <View style={s.editorModalFooter}><AppButton title="Xong" icon="check" onPress={onClose}/></View>
    </View>
  </Modal>;
}

function ProductCard({p,selected,onAdd}:{p:any;selected:boolean;onAdd:()=>void}){const price=productPriceFromRow(p);return <Card style={s.productCard}><Row><ImageThumb path={p.image} size={74}/><View style={{flex:1}}><Text style={s.productName}>{p.name||'Sản phẩm'}</Text><Muted>{[p.catalog_key,p.unit].filter(Boolean).join(' • ')}</Muted><Text style={[s.productPrice,!price&&{color:colors.textSoft}]}>{price?money(price):'Chưa có giá'}</Text></View><IconButton icon={selected?'plus-circle':'plus-circle-outline'} onPress={onAdd} color={colors.primary}/></Row></Card>}
function SelectedProductEditor({item,patch,remove}:{item:StudioProductItem;patch:(p:Partial<StudioProductItem>)=>void;remove:()=>void}){const amount=lineAmount(item);const changeQty=(delta:number)=>patch({qty:Math.max(0,Number(item.qty||0)+delta)});return <View style={s.selectedProduct}><Row><ImageThumb path={item.image} size={58}/><View style={{flex:1}}><Text style={s.productName}>{item.name}</Text><Muted>{[item.group,item.unit].filter(Boolean).join(' • ')}</Muted></View><View style={s.qtyButtons}><IconButton icon="minus-circle-outline" onPress={()=>changeQty(-1)} color={colors.primary}/><Text style={s.qtyValue}>{Number(item.qty||0).toLocaleString('vi-VN',{maximumFractionDigits:3})}</Text><IconButton icon="plus-circle-outline" onPress={()=>changeQty(1)} color={colors.primary}/></View><IconButton icon="delete-outline" onPress={remove} color={colors.danger}/></Row><View style={s.editorGrid}><Field label="Khối lượng / SL" value={item.qty} keyboardType="decimal-pad" onChangeText={v=>patch({qty:nonNegative(v)})}/><Field label="Đơn giá" value={item.price} keyboardType="number-pad" onChangeText={v=>patch({price:nonNegative(v)})}/><Field label="Chiết khấu dòng (%)" value={item.discount||0} keyboardType="decimal-pad" onChangeText={v=>patch({discount:Math.min(100,nonNegative(v))})}/><Field label="ĐVT" value={item.unit||''} onChangeText={v=>patch({unit:v})}/></View><Field label="Mô tả" value={item.description||''} onChangeText={v=>patch({description:v})}/><Text style={s.lineAmount}>Thành tiền: {money(amount)}</Text></View>}

function StepInfo({info,setInfo}:{info:StudioInfo;setInfo:(fn:any)=>void}){const patch=(p:Partial<StudioInfo>)=>setInfo((old:StudioInfo)=>({...old,...p}));return <Card><SectionTitle>3. THÔNG TIN</SectionTitle><Chips value={info.documentKind} onChange={v=>patch({documentKind:v==='INVOICE'?'INVOICE':'QUOTE'})} options={[{value:'QUOTE',label:'Báo giá'},{value:'INVOICE',label:'Hóa đơn'}]}/><View style={s.formGrid}><Field label="Tên đơn vị" value={info.companyName} onChangeText={v=>patch({companyName:v})}/><Field label="Điện thoại đơn vị" value={info.companyPhone} keyboardType="phone-pad" onChangeText={v=>patch({companyPhone:v})}/><Field label="Địa chỉ đơn vị" value={info.companyAddress} onChangeText={v=>patch({companyAddress:v})}/><Field label="Website" value={info.companyWebsite||''} onChangeText={v=>patch({companyWebsite:v})}/><Field label="Khách hàng" value={info.customerName} onChangeText={v=>patch({customerName:v})}/><Field label="Số điện thoại khách hàng" value={info.customerPhone} keyboardType="phone-pad" onChangeText={v=>patch({customerPhone:v})}/><Field label="Công trình" value={info.projectName} onChangeText={v=>patch({projectName:v})}/><Field label="Địa chỉ / công trình" value={info.address} onChangeText={v=>patch({address:v})}/><Field label="Mã chứng từ" value={info.documentNo} onChangeText={v=>patch({documentNo:v})} placeholder="Để trống để QQIVA tự cấp khi lưu"/><Field label="Ngày" value={info.documentDate} onChangeText={v=>patch({documentDate:v})} placeholder="YYYY-MM-DD"/></View><Field label="Ghi chú / mô tả" value={info.note} multiline onChangeText={v=>patch({note:v})}/><Muted>Thông tin được giữ trong state của Studio khi bạn quay lại các bước trước.</Muted></Card>}

function StepCustomize({config,setCfg,company,selectMedia,template,info,items,device,setDevice}:{config:any;setCfg:(p:any)=>void;company:any;selectMedia:(key:'logoOverride'|'signatureOverride'|'stampOverride')=>Promise<void>;template:ProfessionalTemplate;info:StudioInfo;items:StudioProductItem[];device:'PHONE'|'DESKTOP'|'A4';setDevice:(v:'PHONE'|'DESKTOP'|'A4')=>void}){return <>
  <Card><SectionTitle>4. TÙY CHỈNH STUDIO</SectionTitle><Field label="Tiêu đề chính" value={config.title||''} onChangeText={v=>setCfg({title:v})}/><Field label="Tiêu đề phụ" value={config.subtitle||''} onChangeText={v=>setCfg({subtitle:v})}/><Field label="Slogan" value={config.slogan||''} onChangeText={v=>setCfg({slogan:v})}/>
    <Text style={s.controlLabel}>Màu sắc</Text><Chips value={String(config.theme||'GOLD')} onChange={v=>setCfg({theme:v})} options={[{value:'GOLD',label:'Gold'},{value:'BLUE',label:'Blue'},{value:'GREEN',label:'Green'},{value:'ORANGE',label:'Orange'},{value:'PURPLE',label:'Purple'},{value:'LIGHT',label:'Sáng'}]}/>
    <Text style={s.controlLabel}>Font/chữ</Text><Chips value={String(config.fontFamily||'SYSTEM')} onChange={v=>setCfg({fontFamily:v})} options={[{value:'SYSTEM',label:'Hệ thống'},{value:'SERIF',label:'Serif'},{value:'MONO',label:'Mono'}]}/>
    <Text style={s.controlLabel}>Bố cục</Text><Chips value={String(config.layout||'LUX')} onChange={v=>setCfg({layout:v})} options={[{value:'LUX',label:'Luxury Hero'},{value:'CATALOG',label:'Catalog'},{value:'CLEAN',label:'Tối giản'},{value:'BOLD',label:'Tiêu đề lớn'}]}/>
    <Text style={s.controlLabel}>Hướng / kiểu giấy</Text><Chips value={String(config.format||'A4')} onChange={v=>setCfg({format:v})} options={[{value:'A4',label:'A4 dọc'},{value:'LANDSCAPE',label:'A4 ngang'},{value:'PORTRAIT',label:'Tờ rơi dọc'},{value:'SQUARE',label:'Vuông'},{value:'PHONE',label:'Điện thoại 9:16'}]}/>
    <Text style={s.controlLabel}>Mật độ dòng / cỡ chữ</Text><Chips value={String(config.density||'COMFORT')} onChange={v=>setCfg({density:v})} options={[{value:'COMPACT',label:'Gọn'},{value:'COMFORT',label:'Tiêu chuẩn'},{value:'LARGE',label:'Lớn'},{value:'XLARGE',label:'Rất lớn'}]}/>
    <Text style={s.controlLabel}>Kích thước ảnh</Text><Chips value={String(config.imageSize||'MEDIUM')} onChange={v=>setCfg({imageSize:v})} options={[{value:'SMALL',label:'Nhỏ'},{value:'MEDIUM',label:'Vừa'},{value:'LARGE',label:'Lớn'},{value:'HERO',label:'Rất lớn'}]}/>
    <Text style={s.controlLabel}>Fit ảnh</Text><Chips value={String(config.imageFit||'cover')} onChange={v=>setCfg({imageFit:v})} options={[{value:'cover',label:'Cắt đầy khung'},{value:'contain',label:'Hiện toàn ảnh'}]}/>
  </Card>
  <Card><SectionTitle>Logo • chữ ký • con dấu</SectionTitle><Row style={{alignItems:'flex-start'}}><MediaPicker label="Logo" path={config.logoOverride||company.logo} onPick={()=>void selectMedia('logoOverride')} onReset={()=>setCfg({logoOverride:''})}/><MediaPicker label="Chữ ký" path={config.signatureOverride||company.signature} onPick={()=>void selectMedia('signatureOverride')} onReset={()=>setCfg({signatureOverride:''})}/><MediaPicker label="Con dấu" path={config.stampOverride||company.stamp} onPick={()=>void selectMedia('stampOverride')} onReset={()=>setCfg({stampOverride:''})}/></Row><Muted>Nếu không chọn ảnh riêng, Studio dùng ảnh trong Hồ sơ công ty. Tất cả đường dẫn là FileSystem/seed local.</Muted></Card>
  <Card><SectionTitle>Hiện / ẩn các khối</SectionTitle><ToggleRow label="Logo & công ty" value={config.adShowCompany!==false} onChange={v=>setCfg({adShowCompany:v})}/><ToggleRow label="Ảnh sản phẩm" value={config.adShowImages!==false} onChange={v=>setCfg({adShowImages:v})}/><ToggleRow label="Bảng giá" value={config.adShowTable!==false} onChange={v=>setCfg({adShowTable:v})}/><ToggleRow label="Ảnh trong bảng" value={config.adShowTableImages!==false} onChange={v=>setCfg({adShowTableImages:v})}/><ToggleRow label="Mô tả" value={config.adShowDescription!==false} onChange={v=>setCfg({adShowDescription:v})}/><ToggleRow label="ĐVT" value={config.adShowUnit!==false} onChange={v=>setCfg({adShowUnit:v})}/><ToggleRow label="Số lượng" value={config.adShowQty!==false} onChange={v=>setCfg({adShowQty:v})}/><ToggleRow label="Đơn giá" value={config.adShowPrice!==false} onChange={v=>setCfg({adShowPrice:v})}/><ToggleRow label="Tổng cộng" value={config.adShowTotal!==false} onChange={v=>setCfg({adShowTotal:v})}/><ToggleRow label="Giá trống → Liên hệ" value={config.adMissingAsContact!==false} onChange={v=>setCfg({adMissingAsContact:v})}/></Card>
  <Card><SectionTitle>VAT • chiết khấu • phụ phí</SectionTitle><ToggleRow label="VAT" value={!!config.vatEnabled} onChange={v=>setCfg({vatEnabled:v})}/>{config.vatEnabled?<Field label="VAT (%)" value={config.vatRate??10} keyboardType="decimal-pad" onChangeText={v=>setCfg({vatRate:nonNegative(v)})}/>:null}<ToggleRow label="Chiết khấu toàn chứng từ" value={!!config.discountEnabled} onChange={v=>setCfg({discountEnabled:v})}/>{config.discountEnabled?<><Chips value={String(config.discountType||'percent')} onChange={v=>setCfg({discountType:v})} options={[{value:'percent',label:'%'},{value:'fixed',label:'Số tiền'}]}/><Field label="Giá trị chiết khấu" value={config.discountValue||0} keyboardType="decimal-pad" onChangeText={v=>setCfg({discountValue:nonNegative(v)})}/></>:null}<ToggleRow label="Phụ phí" value={!!config.surchargeEnabled} onChange={v=>setCfg({surchargeEnabled:v})}/>{config.surchargeEnabled?<><Field label="Tên phụ phí" value={config.surchargeLabel||'Phụ phí'} onChangeText={v=>setCfg({surchargeLabel:v})}/><Chips value={String(config.surchargeType||'fixed')} onChange={v=>setCfg({surchargeType:v})} options={[{value:'fixed',label:'Số tiền'},{value:'percent',label:'%'}]}/><Field label="Giá trị phụ phí" value={config.surchargeValue||0} keyboardType="decimal-pad" onChangeText={v=>setCfg({surchargeValue:nonNegative(v)})}/></>:null}<Field label="Điều khoản" value={config.termsText||''} multiline onChangeText={v=>setCfg({termsText:v})}/></Card>
  <Card><SectionTitle>XEM TRƯỚC TRỰC TIẾP</SectionTitle><Chips value={device} onChange={v=>setDevice(v as any)} options={[{value:'PHONE',label:'Điện thoại'},{value:'DESKTOP',label:'Máy tính'},{value:'A4',label:'A4'}]}/><Muted>Mọi thay đổi ở Bước 4 được áp dụng ngay vào renderer offline.</Muted></Card>
  <ProfessionalTemplatePreview template={template} config={config} info={info} company={company} items={items} pageItems={paginateProfessionalItems(items,config)[0]||[]} pageNo={1} pageCount={paginateProfessionalItems(items,config).length} isLast={paginateProfessionalItems(items,config).length===1} device={device}/>
  </>}

function MediaPicker({label,path,onPick,onReset}:{label:string;path?:string;onPick:()=>void;onReset:()=>void}){return <View style={s.mediaPicker}><ImageThumb path={path} size={72}/><Text style={s.mediaLabel}>{label}</Text><AppButton title="Chọn" compact variant="secondary" icon="image-plus" onPress={onPick}/>{path?<TouchableOpacity onPress={onReset}><Text style={s.resetText}>Dùng hồ sơ</Text></TouchableOpacity>:null}</View>}

function StepPreview({template,config,info,company,items,pages,totals,device,setDevice,refs,exportRefs,busy,exportPng,exportPdf,shareExport,saveFinalDocument,saveDraft,saveTemplate,templateName,setTemplateName}:{template:ProfessionalTemplate;config:any;info:StudioInfo;company:any;items:StudioProductItem[];pages:StudioProductItem[][];totals:any;device:'PHONE'|'DESKTOP'|'A4';setDevice:(v:'PHONE'|'DESKTOP'|'A4')=>void;refs:any;exportRefs:any;busy:boolean;exportPng:()=>Promise<void>;exportPdf:()=>Promise<void>;shareExport:()=>Promise<void>;saveFinalDocument:()=>Promise<void>;saveDraft:()=>Promise<void>;saveTemplate:()=>Promise<void>;templateName:string;setTemplateName:(v:string)=>void}){return <>
  <Card><SectionTitle>5. XEM TRƯỚC & XUẤT</SectionTitle><Chips value={device} onChange={v=>setDevice(v as any)} options={[{value:'PHONE',label:'Điện thoại'},{value:'DESKTOP',label:'Máy tính'},{value:'A4',label:'A4'}]}/><Muted>{template.name} • {items.length} sản phẩm • {pages.length} trang • Tổng {money(totals.grandTotal)}</Muted></Card>
  {pages.map((page,i)=><ProfessionalTemplatePreview key={i} refNode={n=>{refs.current[i]=n}} template={template} config={config} info={info} company={company} items={items} pageItems={page} pageNo={i+1} pageCount={pages.length} isLast={i===pages.length-1} device={device}/>) }
  {pages.map((page,i)=><ProfessionalTemplatePreview key={`export-${i}`} refNode={n=>{exportRefs.current[i]=n}} template={template} config={config} info={info} company={company} items={items} pageItems={page} pageNo={i+1} pageCount={pages.length} isLast={i===pages.length-1} device={String(config.format).toUpperCase()==='PHONE'?'PHONE':'A4'} exportMode/>) }
  <Card><SectionTitle>Lưu mẫu & xuất file</SectionTitle><Field label="Tên mẫu của tôi" value={templateName} onChangeText={setTemplateName}/><Row style={{flexWrap:'wrap'}}><AppButton title="Lưu chứng từ" icon="content-save" disabled={busy} onPress={()=>void saveFinalDocument()}/><AppButton variant="secondary" title="Lưu bản nháp" icon="content-save-edit" disabled={busy} onPress={()=>void saveDraft()}/><AppButton variant="secondary" title="Lưu template" icon="palette-swatch" disabled={busy} onPress={()=>void saveTemplate()}/></Row><Row style={{flexWrap:'wrap'}}><AppButton title={busy?'Đang xuất…':'PNG'} icon="image" disabled={busy} onPress={()=>void exportPng()}/><AppButton variant="danger" title="PDF" icon="file-pdf-box" disabled={busy} onPress={()=>void exportPdf()}/><AppButton variant="secondary" title="Chia sẻ" icon="share-variant" disabled={busy} onPress={()=>void shareExport()}/></Row><Muted>PNG/PDF được dựng từ renderer local và ảnh FileSystem/seed, không gọi Internet.</Muted></Card>
  </>}

function NavButtons({step,selectedTemplate,hasItems,onBack,onNext}:{step:number;selectedTemplate:boolean;hasItems:boolean;onBack:()=>void;onNext:()=>void}){if(step===5)return <Row><AppButton variant="secondary" title="← Quay lại" icon="arrow-left" onPress={onBack}/></Row>;const disabled=(step===1&&!selectedTemplate)||(step===2&&!hasItems);return <Row style={{justifyContent:'space-between'}}>{step>1?<AppButton variant="secondary" title="← Quay lại" icon="arrow-left" onPress={onBack}/>:<View/>}<AppButton title={step===1?'Tiếp tục: Chọn sản phẩm →':step===2?'Tiếp tục: Thông tin →':step===3?'Tiếp tục: Tùy chỉnh →':'Tiếp tục: Xem trước & Xuất →'} icon="arrow-right" disabled={disabled} onPress={onNext}/></Row>}

function productPriceFromRow(p:any){
  const direct=Number(p?.price);if(Number.isFinite(direct)&&direct>0)return direct;
  try{const raw=typeof p?.raw_json==='string'?JSON.parse(p.raw_json):p?.raw||{};const v=Number(raw?.price??raw?.unit_price??raw?.selling_price??0);return Number.isFinite(v)&&v>0?v:0}catch{return 0}
}
function normalizeStudioItem(x:any):StudioProductItem{return{id:String(x.id||x.manualUid||x.libraryId||`studio-${Math.random().toString(36).slice(2)}`),productId:String(x.productId||x.libraryId||''),name:String(x.name||'Sản phẩm'),description:String(x.description||''),image:String(x.image||''),unit:String(x.unit||''),qty:Math.max(0,Number(x.qty||0)),price:Math.max(0,Number(x.price??x.unit_price??0)),discount:Math.min(100,Math.max(0,Number(x.discount??x.discount_percent??0))),group:String(x.group||x.groupName||x.groupLevel1||'')}}
function keepFinancialAndMedia(old:any){if(!old||typeof old!=='object')return{};const keys=['vatEnabled','vatRate','discountEnabled','discountType','discountValue','surchargeEnabled','surchargeLabel','surchargeType','surchargeValue','termsText','logoOverride','signatureOverride','stampOverride'];return Object.fromEntries(keys.filter(k=>old[k]!==undefined).map(k=>[k,old[k]]));}
function nonNegative(v:any){const n=Number(String(v??'').replace(',','.').replace(/[^0-9.-]/g,''));return Number.isFinite(n)?Math.max(0,n):0}
function miniPalette(theme:string){const t=String(theme||'GOLD').toUpperCase();if(t==='BLUE')return{bg:'#112A43',accent:'#4EA7FF',text:'#fff'};if(t==='GREEN')return{bg:'#17362C',accent:'#72C997',text:'#fff'};if(t==='ORANGE')return{bg:'#2C2118',accent:'#F59A3B',text:'#fff'};if(t==='PURPLE')return{bg:'#2A1745',accent:'#A878FF',text:'#fff'};if(t==='LIGHT')return{bg:'#F5F1E8',accent:'#8A6A45',text:'#24201B'};return{bg:'#09151D',accent:'#DCAA3D',text:'#fff'}}

const s=StyleSheet.create({
  stepBar:{flexDirection:'row',gap:8,flexWrap:'wrap'},step:{flex:1,minWidth:130,minHeight:52,borderWidth:1,borderColor:colors.border,borderRadius:13,padding:9,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:colors.surface},stepActive:{backgroundColor:'#29245C',borderColor:'#8357FF'},stepNo:{width:28,height:28,borderRadius:14,borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center'},stepNoActive:{backgroundColor:'#8057F4',borderColor:'#8057F4'},stepNoText:{fontWeight:'900',color:colors.primary},stepText:{fontWeight:'900',fontSize:12,color:colors.textSoft},stepTextActive:{color:'#fff'},
  workspaceWide:{flexDirection:'row',gap:14,alignItems:'flex-start'},workspaceLeft:{flex:1.08},workspaceRight:{flex:.92},templateGrid:{flexDirection:'row',flexWrap:'wrap',gap:10},templateCard:{width:'48%',minWidth:220,borderWidth:1,borderColor:colors.border,borderRadius:14,padding:9,flexDirection:'row',gap:9,alignItems:'center',backgroundColor:colors.surface},templateCardActive:{borderColor:'#8057F4',borderWidth:2,backgroundColor:'#F5F1FF'},templateMini:{width:82,height:118,borderRadius:10,borderWidth:1,padding:8,justifyContent:'center'},miniLine:{height:3,borderRadius:2,marginBottom:8},miniTitle:{fontWeight:'900',fontSize:14,lineHeight:15},miniSub:{fontWeight:'800',fontSize:7,marginTop:7},templateName:{fontWeight:'900',fontSize:13,color:colors.text},emptyPreview:{minHeight:380,alignItems:'center',justifyContent:'center',gap:8},emptyPreviewTitle:{fontWeight:'900',fontSize:16,color:colors.text},draftRow:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:9,borderBottomWidth:1,borderBottomColor:colors.border},draftName:{fontWeight:'900',color:colors.text},selectedTemplateBanner:{marginTop:10,flexDirection:'row',gap:7,alignItems:'center',padding:9,borderRadius:10,backgroundColor:'#F5F1FF'},selectedTemplateText:{fontWeight:'900',color:'#4C2E9A'},
  productGrid:{gap:10},productCard:{padding:10},productName:{fontSize:14,fontWeight:'900',color:colors.text},productPrice:{marginTop:5,fontWeight:'900',fontSize:14,color:colors.primary},selectedSummary:{marginTop:4,flexDirection:'row',alignItems:'center',gap:7,padding:9,borderRadius:10,backgroundColor:'#EEF8F3'},selectedSummaryText:{flex:1,fontSize:11,fontWeight:'800',color:colors.text},productFooter:{gap:8},productFooterSummary:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},productFooterCount:{fontSize:12,fontWeight:'900',color:colors.text},productFooterTotal:{fontSize:13,fontWeight:'900',color:colors.primary},productFooterActions:{flexDirection:'row',gap:8,justifyContent:'space-between'},editorModal:{flex:1,backgroundColor:colors.bg},editorModalHeader:{padding:16,borderBottomWidth:1,borderBottomColor:colors.border,backgroundColor:colors.surface,flexDirection:'row',alignItems:'center',gap:8},editorModalTitle:{fontSize:20,fontWeight:'900',color:colors.text},editorModalContent:{padding:16,paddingBottom:110,gap:8},editorModalFooter:{padding:12,borderTopWidth:1,borderTopColor:colors.border,backgroundColor:colors.surface},selectedProduct:{gap:9,paddingVertical:12,borderBottomWidth:1,borderBottomColor:colors.border},editorGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},lineAmount:{fontWeight:'900',color:colors.primary,textAlign:'right'},qtyButtons:{flexDirection:'row',alignItems:'center',gap:2},qtyValue:{minWidth:32,textAlign:'center',fontWeight:'900',color:colors.text},
  formGrid:{gap:10},controlLabel:{fontWeight:'900',fontSize:12,color:colors.text,marginTop:3},mediaPicker:{flex:1,alignItems:'center',gap:5},mediaLabel:{fontSize:11,fontWeight:'900',color:colors.text},resetText:{fontSize:10,color:colors.textSoft,textDecorationLine:'underline'},
});
