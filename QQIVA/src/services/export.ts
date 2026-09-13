import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library/legacy';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';

import { num, object, text } from '@/db/database';
import { getJson, setJson } from '@/db/jsonStore';
import { documentLineAmount, effectivePrice, getLiveState, pricingBreakdown, professionalSnapshot, visibleItems } from '@/services/documentEngine';
import { getExportDirectory, resolveImageUri } from '@/services/media';
import { getSettings } from '@/services/settings';
import { formatDateVi, resolvedContractContent } from '@/services/contracts';
import { getStudioPageSize, rowsPerProfessionalPage } from '@/components/ProfessionalTemplatePreview';

const STUDIO_PDF_DIRECTORY_KEY='studio_pdf_directory_uri';

export async function exportCurrentDocumentPdf(stateInput?:any){const state=stateInput||await getLiveState();const html=await renderDocumentHtml(state);const out=await Print.printToFileAsync({html,base64:false});const dir=await getExportDirectory();const name=fileStem(state)+'.pdf';const dest=`${dir}${name}`;await FileSystem.copyAsync({from:out.uri,to:dest});await share(dest,'application/pdf');return dest;}

export async function exportCurrentDocumentXlsx(stateInput?:any){const state=stateInput||await getLiveState();const rows=visibleItems(state).map((x,index)=>({STT:index+1,Tầng:x.floor,Phòng:x.room,'Sản phẩm / Hạng mục':text(x.item.name||x.item.category),ĐVT:text(x.item.unit),'Khối lượng':num(x.item.qty),'Đơn giá':num(x.item.unit_price??x.item.price),'Hệ số':Math.max(0,num(x.item.price_multiplier??1)),'Thành tiền':documentLineAmount(x.item),'Công thức':text(x.item.formula),'Ghi chú':text(x.item.note)}));const wb=XLSX.utils.book_new();const ws=XLSX.utils.json_to_sheet(rows);XLSX.utils.book_append_sheet(wb,ws,'Chứng từ');const summary=pricingBreakdown(state);const p=object(state.project);const meta=XLSX.utils.aoa_to_sheet([['QQIVA BUSINESS'],['Số chứng từ',text(p.quote_no)],['Ngày',text(p.quote_date)],['Khách hàng',text(p.customer)],['Công trình',text(p.address||p.project_name)],['Tạm tính',summary.subtotal],['Chiết khấu',summary.discount],['Phụ phí',summary.surcharge],['VAT',summary.vat],['Tổng cộng',summary.grand_total]]);XLSX.utils.book_append_sheet(wb,meta,'Thông tin');const base64=XLSX.write(wb,{type:'base64',bookType:'xlsx'});const dir=await getExportDirectory();const dest=`${dir}${fileStem(state)}.xlsx`;await FileSystem.writeAsStringAsync(dest,base64,{encoding:FileSystem.EncodingType.Base64});await share(dest,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');return dest;}


export async function persistCapturedPng(tempUri:string, fileName:string){
  const dir=await getExportDirectory();
  const dest=`${dir}${safeName(fileName.replace(/\.png$/i,''))}.png`;
  await FileSystem.copyAsync({from:tempUri,to:dest});
  const permission=await MediaLibrary.requestPermissionsAsync(false,['photo']);
  if(!permission.granted)throw new Error('QQIVA cần quyền lưu ảnh vào Gallery.');
  const asset=await MediaLibrary.createAssetAsync(dest);
  const album=await MediaLibrary.getAlbumAsync('QQIVA');
  if(album)await MediaLibrary.addAssetsToAlbumAsync([asset],album,false);
  else await MediaLibrary.createAlbumAsync('QQIVA',asset,false);
  return dest;
}

export async function shareLocalFile(path:string,mime='application/octet-stream'){
  await share(path,mime);
  return path;
}
export async function generateStudioPdf(stateInput:any,config:any={}){
  const state=stateInput||await getLiveState();
  const html=await renderAdQuoteHtml(state,config);
  const size=getStudioPageSize(config);
  const filename=`${fileStem(state)}_STUDIO.pdf`;
  const pdfSize=size.orientation==='phone'?{width:540,height:960}:size.orientation==='landscape'?{width:842,height:595}:size.orientation==='portrait'?{width:595,height:842}:{width:595,height:595};
  const uri=await printHtml(html,filename,false,pdfSize);
  const numberOfPages=Math.max(1,Math.ceil(visibleItems(state).length/rowsPerProfessionalPage(config)));
  return {uri,filename,numberOfPages};
}

export async function exportAdQuotePdf(stateInput:any,config:any={}){return (await generateStudioPdf(stateInput,config)).uri;}

export async function saveVisiblePdf(pdf:{uri:string;filename:string}){
  let directoryUri=await getJson(STUDIO_PDF_DIRECTORY_KEY,'');
  if(!directoryUri){
    const permission=await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if(!permission.granted)throw new Error('Bạn chưa chọn thư mục lưu PDF.');
    directoryUri=permission.directoryUri;
    await setJson(STUDIO_PDF_DIRECTORY_KEY,directoryUri);
  }
  try{
    const target=await FileSystem.StorageAccessFramework.createFileAsync(directoryUri,pdf.filename.replace(/\.pdf$/i,''),'application/pdf');
    const base64=await FileSystem.readAsStringAsync(pdf.uri,{encoding:FileSystem.EncodingType.Base64});
    await FileSystem.writeAsStringAsync(target,base64,{encoding:FileSystem.EncodingType.Base64});
    return target;
  }catch(error){
    await setJson(STUDIO_PDF_DIRECTORY_KEY,'');
    throw error;
  }
}

export async function renderAdQuoteHtml(state:any,config:any={}){
  const p=object(state.project),c=object(state.company),rows=visibleItems(state),summary=pricingBreakdown(state);
  const template=config?.template&&typeof config.template==='object'?config.template:object(state.professional_studio?.template);
  const studio=state.professional_studio?.schema?professionalSnapshot(state):{};
  const studioInfo=object(studio.info);
  const theme=text(config.theme||template.theme||'GOLD').toUpperCase();
  const layout=text(config.layout||template.layout||'LUX').toUpperCase();
  const showCompany=config.adShowCompany!==false,showImages=config.adShowImages!==false,showTable=config.adShowTable!==false,showTableImages=config.adShowTableImages!==false,showDescription=config.adShowDescription!==false,showUnit=config.adShowUnit!==false,showQty=config.adShowQty!==false,showPrice=config.adShowPrice!==false,showTotal=config.adShowTotal!==false;
  const fit=text(config.imageFit||'cover')==='contain'?'contain':'cover';
  const imageCache=new Map<string,string>();let imageReads=0;
  const getImage=async(path:string)=>{if(!path)return'';if(imageCache.has(path))return imageCache.get(path)!;imageReads+=1;const value=await imageData(path);imageCache.set(path,value);return value;};
  const [logo,signature,stamp]=await Promise.all([getImage(text(config.logoOverride||c.logo)),getImage(text(config.signatureOverride||c.signature)),getImage(text(config.stampOverride||c.stamp))]);
  const title=text(config.title||template.title||'NHẬP TÊN SẢN PHẨM');
  const subtitle=text(config.subtitle||template.sub||'');
  const slogan=text(config.slogan||'Uy tín • Chất lượng • Tận tâm');
  const accent=theme==='BLUE'?'#1167b1':theme==='GREEN'?'#2b8a57':theme==='ORANGE'?'#d56b14':theme==='PURPLE'?'#7a45c8':theme==='LIGHT'?'#8a6a45':'#c89428';
  const bg=theme==='LIGHT'?'#f8f5ee':'#07131b',surface=theme==='LIGHT'?'#ffffff':'#0b1b24',fg=theme==='LIGHT'?'#201a14':'#ffffff',muted=theme==='LIGHT'?'#74695d':'#b9c5cc';
  const columns=Math.max(1,Math.min(4,num(config.productColumns||template.cols||3)));
  const cards=[] as string[];
  for(let i=0;i<rows.length;i++){
    const x=rows[i],it=x.item||{},src=showImages?await getImage(text(it.image)):'';
    const price=effectivePrice(it),amount=documentLineAmount(it);
    cards.push(`<article class="adCard">${src?`<img src="${src}">`:''}<div class="adBody"><h3>${esc(it.name||it.category||`Hạng mục ${i+1}`)}</h3>${showDescription?`<p>${esc(it.description||it.note||[x.floor,x.room].filter(Boolean).join(' • '))}</p>`:''}<div class="adMeta">${showUnit?`<span>${esc(it.unit||'')}</span>`:''}${showQty?`<span>KL ${fmt(num(it.qty))}</span>`:''}${showPrice?`<b>${(price>0||num(studio.items?.[i]?.price)>0)?money(price):(config.adMissingAsContact!==false?'Liên hệ':money(0))}</b>`:''}</div>${showTotal?`<strong>${money(amount)}</strong>`:''}</div></article>`);
  }
  const terms=text(config.termsText||p.payment_terms?.terms_text||'');
  const totalBlock=showTotal?`<section class="totals"><div><span>Tạm tính</span><b>${money(summary.subtotal)}</b></div>${summary.discount?`<div><span>Chiết khấu</span><b>−${money(summary.discount)}</b></div>`:''}${summary.surcharge?`<div><span>${esc(summary.config?.surcharge_label||config.surchargeLabel||'Phụ phí')}</span><b>${money(summary.surcharge)}</b></div>`:''}${summary.vat?`<div><span>VAT</span><b>${money(summary.vat)}</b></div>`:''}<div class="grand"><span>TỔNG CỘNG</span><b>${money(summary.grand_total)}</b></div></section>`:'';
  const signatureBlock=(signature||stamp)?`<section class="signatures"><div><b>ĐẠI DIỆN KHÁCH HÀNG</b><div class="signSpace"></div><b>${esc(studioInfo.customerName||p.customer||'')}</b></div><div class="companySign"><b>ĐẠI DIỆN ĐƠN VỊ</b><div class="signSpace">${signature?`<img class="sig" src="${signature}">`:''}${stamp?`<img class="stamp" src="${stamp}">`:''}</div><b>${esc(c.signature_name||c.representative||'')}</b></div></section>`:'';
  const pageSize=getStudioPageSize(config);const pageCss=pageSize.orientation==='phone'?'108mm 192mm':pageSize.orientation==='square'?'210mm 210mm':pageSize.orientation==='landscape'?'A4 landscape':'A4 portrait';
  const perPage=rowsPerProfessionalPage(config);
  const formatCss=pageSize.orientation==='phone'?`.adBrand{padding:10px 14px}.adHero{min-height:210px;padding:18px 14px;align-items:center;background:${surface}}.adHero h1{font-size:34px;max-width:100%}.info{margin:10px 14px;padding:12px;grid-template-columns:1fr}.adGrid{grid-template-columns:1fr;padding:0 14px 12px;gap:8px}.adCard{display:grid;grid-template-columns:42% 1fr}.adCard>img{height:150px}.adBody{padding:12px}.adBody p{min-height:0}.totals{width:auto;margin:8px 14px 12px;padding:12px;background:${surface};border-radius:10px}.signatures{margin:12px 14px}.signSpace{height:58px}.adCard:nth-child(${perPage}n + 1):not(:first-child){break-before:page}`:pageSize.orientation==='landscape'?`.adHero{padding:12px 18px}.adHero h1{font-size:30px}.info{margin:10px 18px}.adGrid{grid-template-columns:repeat(${Math.max(3,columns)},1fr);padding:0 18px 10px}.adCard>img{height:105px}.totals{width:38%}`:pageSize.orientation==='square'?`.adHero{padding:16px}.adGrid{grid-template-columns:repeat(2,1fr)}.adCard>img{height:130px}.totals{width:56%}`:'';
  cards.unshift(`<style>${formatCss}</style>`);
  const html=`<!doctype html><html><head><meta charset="utf-8"><style>${baseCss()}@page{size:${pageCss};margin:10mm}body{background:${bg};color:${fg};padding:0}.studio{background:${bg};min-height:100vh}.adBrand{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid ${accent};padding:14px 16px}.adBrandLeft{display:flex;align-items:center;gap:12px}.adBrand img{width:72px;height:54px;object-fit:contain}.adBrand h2{color:${accent};margin:0}.adHero{display:flex;justify-content:space-between;gap:18px;padding:22px 16px;border-bottom:1px solid ${accent};background:${layout==='BOLD'?surface:bg}}.adHero h1{font-size:${layout==='BOLD'?'42':'34'}px;color:${fg};max-width:70%;margin:8px 0}.adHero .label,.adHero .sub{color:${accent};font-weight:700}.info{margin:14px 16px;border:1px solid ${accent};border-radius:12px;padding:10px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;background:${surface}}.info b{display:block;color:${accent};font-size:9px}.info span{display:block;color:${muted};font-size:10px;margin-top:3px}.adGrid{display:grid;grid-template-columns:repeat(${columns},1fr);gap:${text(config.productGap||'NORMAL')==='LARGE'?'16':'10'}px;padding:0 16px 16px}.adCard{border:1px solid ${accent}55;border-radius:${text(config.cardRadius||'MEDIUM')==='LARGE'?'18':'12'}px;overflow:hidden;break-inside:avoid;background:${surface}}.adCard>img{width:100%;height:${text(config.imageSize||'MEDIUM')==='HERO'?'240':text(config.imageSize||'MEDIUM')==='LARGE'?'190':text(config.imageSize||'MEDIUM')==='SMALL'?'105':'145'}px;object-fit:${fit}}.adBody{padding:10px}.adBody h3{font-size:14px;color:${fg}}.adBody p{font-size:10px;color:${muted};min-height:26px}.adMeta{display:flex;gap:7px;flex-wrap:wrap;font-size:10px;color:${muted}}.adMeta b{color:${accent}}.adBody>strong{display:block;margin-top:8px;font-size:16px;color:${accent}}.tableTitle{margin:0 16px 8px;color:${accent}}.totals{margin:0 16px 16px auto;width:48%;border-top:2px solid ${accent};padding-top:8px}.totals>div{display:flex;justify-content:space-between;padding:4px 0}.totals .grand{font-size:18px;color:${accent};border-top:1px solid ${accent};margin-top:4px;padding-top:8px}.terms{margin:0 16px 16px;border:1px solid ${accent}55;border-radius:10px;padding:10px;white-space:pre-wrap;background:${surface}}.signatures{display:flex;justify-content:space-between;text-align:center;margin:20px 16px}.signatures>div{width:46%;position:relative}.signSpace{height:80px;position:relative}.sig{width:130px;height:70px;object-fit:contain}.stamp{position:absolute;width:78px;height:78px;right:12px;top:0;object-fit:contain;opacity:.78}</style></head><body><main class="studio">${showCompany?`<section class="adBrand"><div class="adBrandLeft">${logo?`<img src="${logo}">`:''}<div><h2>${esc(studioInfo.companyName||c.name||'QQIVA BUSINESS')}</h2><small>${esc(studioInfo.companyAddress||c.address||'')}</small></div></div><b>${esc(slogan)}</b></section>`:''}<section class="adHero"><div><div class="label">${state.document_mode==='invoice'?'HÓA ĐƠN':'BÁO GIÁ'}</div><h1>${esc(title)}</h1><div class="sub">${esc(subtitle)}</div></div></section><section class="info"><div><b>ĐƠN VỊ</b><span>${esc(studioInfo.companyName||c.name||'')}</span><span>${esc(studioInfo.companyAddress||c.address||'')}</span></div><div><b>KHÁCH HÀNG</b><span>${esc(studioInfo.customerName||p.customer||'')}</span><span>${esc(studioInfo.customerPhone||p.phone||'')}</span><span>${esc(studioInfo.address||p.address||p.project_name||'')}</span></div><div><b>CHỨNG TỪ</b><span>${esc(studioInfo.documentNo||p.quote_no||'')}</span><span>${esc(studioInfo.documentDate||p.quote_date||'')}</span></div></section>${showTable?`<h3 class="tableTitle">BẢNG ${state.document_mode==='invoice'?'HÓA ĐƠN':'BÁO GIÁ'}</h3><div class="adGrid">${cards.join('')}</div>`:''}${totalBlock}${terms?`<section class="terms"><b>ĐIỀU KHOẢN</b><br>${esc(terms)}</section>`:''}${signatureBlock}</main></body></html>`;
  if(typeof __DEV__!=='undefined'&&__DEV__){const uris=(html.match(/data:[^"']+/g)||[]);const pageCount=Math.max(1,Math.ceil(rows.length/Math.max(1,num(config.rowsPerPage||8))));console.log('[QQIVA export] html',html.length,'pages',pageCount,'dataUris',uris.length,'base64Chars',uris.reduce((n,x)=>n+x.length,0),'uniqueImages',imageCache.size,'imageReads',imageReads,'largeUris',uris.filter(x=>x.length>100000).map(x=>x.length));}
  return html;
}

export async function exportCurrentStateJson(){const state=await getLiveState();const dir=await getExportDirectory();const dest=`${dir}${fileStem(state)}.json`;await FileSystem.writeAsStringAsync(dest,JSON.stringify(state,null,2),{encoding:FileSystem.EncodingType.UTF8});await share(dest,'application/json');return dest;}

export async function exportMeasurementPdf(dm:any){const rows:any[]=[];for(const f of dm?.floors||[])for(const r of f.rooms||[])for(const i of r.items||[])rows.push({floor:f.name,room:r.name,item:i});const html=`<!doctype html><html><head><meta charset="utf-8"><style>${baseCss()} table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:6px;font-size:11px}th{background:#eee}</style></head><body><h1>BẢNG ĐO THỰC TẾ</h1><p>${esc(dm?.meta?.project_name||'')} • ${esc(dm?.meta?.measure_date||'')}</p><table><thead><tr><th>Tầng</th><th>Phòng</th><th>Hạng mục</th><th>Công thức</th><th>KL</th><th>ĐVT</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.floor)}</td><td>${esc(x.room)}</td><td>${esc(x.item.name||x.item.category)}</td><td>${esc(x.item.formula)}</td><td style="text-align:right">${num(x.item.qty)}</td><td>${esc(x.item.unit)}</td></tr>`).join('')}</tbody></table>${signatureHtml(dm?.confirmation)}</body></html>`;return printHtml(html,`QQIVA_BANG_DO_${Date.now()}.pdf`);}

export async function exportMeasurementXlsx(dm:any){const rows:any[]=[];for(const f of dm?.floors||[])for(const r of f.rooms||[])for(const i of r.items||[])rows.push({Tầng:f.name,Phòng:r.name,Hạng_mục:i.name||i.category,Công_thức:i.formula,Khối_lượng:num(i.qty),ĐVT:i.unit,Đơn_giá:num(i.price),Ghi_chú:i.note});const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'Bảng đo');const base64=XLSX.write(wb,{type:'base64',bookType:'xlsx'});const dir=await getExportDirectory();const dest=`${dir}QQIVA_BANG_DO_${Date.now()}.xlsx`;await FileSystem.writeAsStringAsync(dest,base64,{encoding:FileSystem.EncodingType.Base64});await share(dest,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');return dest;}

export async function exportContractPdf(contract:any){const state=await getLiveState();const html=await renderContractHtml(contract,object(state.company));return printHtml(html,`${safeName(contract.contract_no||'HOP_DONG')}.pdf`);}

export async function exportContractDocx(contract:any){
  const state=await getLiveState();
  const company=object(state.company),a=object(contract.parties?.a),b=object(contract.parties?.b);
  const resolved=resolvedContractContent(contract);
  const lines:any[]=[
    contract.title||'HỢP ĐỒNG',`Số: ${contract.contract_no||''}`,`Ngày: ${formatDateVi(contract.contract_date||'')}`,
    contract.variables?.work_title||'',contract.variables?.project_name?`CÔNG TRÌNH: ${contract.variables.project_name}`:'',contract.variables?.project_address?`ĐỊA CHỈ: ${contract.variables.project_address}`:'','',
    `BÊN A: ${a.name||contract.party_a||''}`,a.representative?`Đại diện: ${a.representative}${a.title?` • ${a.title}`:''}`:'',a.address?`Địa chỉ: ${a.address}`:'',a.tax_code||a.tax_id?`MST: ${a.tax_code||a.tax_id}`:'','',
    `BÊN B: ${b.name||contract.party_b||''}`,b.representative?`Đại diện: ${b.representative}${b.title?` • ${b.title}`:''}`:'',b.address?`Địa chỉ: ${b.address}`:'',b.tax_code||b.tax_id?`MST: ${b.tax_code||b.tax_id}`:'','',
    resolved,'',`Giá trị trước VAT: ${money(num(contract.base_value??contract.value))}`,`VAT: ${fmt(num(contract.vat_percent))}%`,`Chiết khấu: ${money(num(contract.discount))}`,`GIÁ TRỊ HỢP ĐỒNG: ${money(num(contract.value))}`,`Tạm ứng/đặt cọc: ${money(num(contract.deposit))}`,`Còn lại: ${money(num(contract.remaining))}`,'',
    `ĐẠI DIỆN BÊN A: ${a.representative||a.name||''}`,`ĐẠI DIỆN BÊN B: ${company.signature_name||company.representative||b.representative||b.name||''}`
  ];
  const zip=new JSZip();
  zip.file('[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.folder('_rels')!.file('.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  const paras=lines.filter(x=>String(x??'').length).flatMap(x=>String(x).split(/\n/)).map((line:string)=>`<w:p><w:r><w:t xml:space="preserve">${xml(line)}</w:t></w:r></w:p>`).join('');
  zip.folder('word')!.file('document.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paras}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`);
  const base64=await zip.generateAsync({type:'base64',compression:'DEFLATE'});const dir=await getExportDirectory();const dest=`${dir}${safeName(contract.contract_no||'HOP_DONG')}.docx`;await FileSystem.writeAsStringAsync(dest,base64,{encoding:FileSystem.EncodingType.Base64});await share(dest,'application/vnd.openxmlformats-officedocument.wordprocessingml.document');return dest;
}

export async function renderDocumentHtml(state:any){
  const p=object(state.project),c=object(state.company),summary=pricingBreakdown(state),rows=visibleItems(state);
  const savedSettings=await getSettings();
  const settings={...object(state.settings),...object(savedSettings)};
  const images=new Map<string,string>();
  for(const row of rows){const path=text(row.item.image);if(path&&!images.has(path))images.set(path,await imageData(path));}
  const [logo,companySignature,companyStamp,customerSignature]=await Promise.all([
    imageData(text(c.logo)),imageData(text(c.signature)),imageData(text(c.stamp)),imageData(text(p.signing?.customer_signature)),
  ]);
  const template=text(settings.export_template||'professional');
  const orientation=text(settings.page_orientation||settings.orientation||'portrait')==='landscape'?'landscape':'portrait';
  const fit=text(settings.image_fit||'contain')==='cover'?'cover':'contain';
  const density=Math.max(5,Math.min(18,num(settings.preview_rows_per_page||settings.rows_per_page||8)));
  const mediaCss=`@page{size:A4 ${orientation};margin:12mm} td img{object-fit:${fit}} tbody tr{page-break-inside:avoid;break-inside:avoid} ${density>=12?'th,td{padding:4px;font-size:10px}td img{width:48px;height:48px}':density<=5?'th,td{padding:8px;font-size:12px}td img{width:72px;height:72px}':''}`;
  const signature=signatureDocumentHtml(state,{companySignature,companyStamp,customerSignature});
  return`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${baseCss()}${templateCss(template)}${mediaCss}</style></head><body>
  <header><div class="brand">${logo?`<img class="brandLogo" src="${logo}">`:''}<div><h3>${esc(c.name||'QQIVA BUSINESS')}</h3><div class="muted">${esc(c.description)}</div><div>${esc(c.address)} ${c.phone?`• ${esc(c.phone)}`:''}</div>${c.email?`<div>${esc(c.email)}</div>`:''}</div></div><div class="doc"><h1>${state.document_mode==='invoice'?'HÓA ĐƠN':'BÁO GIÁ'}</h1><b>${esc(p.quote_no)}</b><div>${esc(p.quote_date)}</div></div></header>
  ${settings.studio_hero_image?`<div class="hero"><img src="${await imageData(text(settings.studio_hero_image))}"><b>${esc(settings.studio_title||'')}</b></div>`:''}
  <section class="info"><b>Khách hàng:</b> ${esc(p.customer)}<br><b>Công trình:</b> ${esc(p.address||p.project_name)}<br>${p.customer_code?`<b>Mã khách:</b> ${esc(p.customer_code)}<br>`:''}${p.project_code?`<b>Mã công trình:</b> ${esc(p.project_code)}<br>`:''}${p.quote_note?`<b>Ghi chú:</b> ${esc(p.quote_note)}`:''}</section>
  <table><thead><tr><th>STT</th>${template!=='minimal'?'<th>Hình ảnh</th>':''}<th>Hạng mục</th><th>ĐVT</th><th>KL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>${rows.map((x,i)=>{const price=effectivePrice(x.item);const amount=documentLineAmount(x.item);const img=images.get(text(x.item.image));return`<tr><td>${i+1}</td>${template!=='minimal'?`<td>${img?`<img src="${img}">`:''}</td>`:''}<td><b>${esc(x.item.name||x.item.category)}</b><div class="muted">${esc([x.floor,x.room,x.item.description,x.item.note].filter(Boolean).join(' • '))}</div></td><td>${esc(x.item.unit)}</td><td class="num">${fmt(num(x.item.qty))}</td><td class="num">${money(price)}</td><td class="num"><b>${money(amount)}</b></td></tr>`}).join('')}</tbody></table>
  <div class="totals"><div>Tạm tính <b>${money(summary.subtotal)}</b></div>${summary.discount?`<div>Chiết khấu <b>−${money(summary.discount)}</b></div>`:''}${summary.surcharge?`<div>${esc(summary.config.surcharge_label||'Phụ phí')} <b>${money(summary.surcharge)}</b></div>`:''}${summary.vat?`<div>VAT <b>${money(summary.vat)}</b></div>`:''}<div class="grand">TỔNG CỘNG <b>${money(summary.grand_total)}</b></div></div>
  ${paymentTermsHtml(p.payment_terms)}${signature}</body></html>`;
}

async function renderContractHtml(c:any,company:any={}){
  const [logo,signature,stamp]=await Promise.all([imageData(text(company.logo)),imageData(text(company.signature)),imageData(text(company.stamp))]);
  return`<!doctype html><html><head><meta charset="utf-8"><style>${baseCss()} body{font-family:serif;line-height:1.55}h1{text-align:center}.contractBrand{display:flex;align-items:center;gap:10px;margin-bottom:12px}.contractBrand img{width:70px;height:55px;object-fit:contain}.party{margin:16px 0;padding:12px;border:1px solid #ddd}.content{white-space:pre-wrap}.contractSign{display:flex;justify-content:space-between;text-align:center;margin-top:28px}.contractSign>div{width:46%;position:relative;min-height:140px}.contractSign img.sig{width:130px;height:70px;object-fit:contain}.contractSign img.stamp{width:82px;height:82px;object-fit:contain;position:absolute;right:16px;top:30px;opacity:.8}</style></head><body>
  ${logo?`<div class="contractBrand"><img src="${logo}"><b>${esc(company.name||'QQIVA BUSINESS')}</b></div>`:''}<h1>${esc(c.title||'HỢP ĐỒNG')}</h1><p style="text-align:center"><b>Số ${esc(c.contract_no)}</b> • ${esc(c.contract_date)}</p>
  <div class="party"><b>BÊN A:</b> ${esc(c.party_a||c.parties?.a?.name)}<br>${esc(c.parties?.a?.address)}<br>${esc(c.parties?.a?.phone)}</div><div class="party"><b>BÊN B:</b> ${esc(c.party_b||c.parties?.b?.name)}<br>${esc(c.parties?.b?.address)}<br>${esc(c.parties?.b?.phone)}</div>
  <div class="content">${esc(resolvedContractContent(c))}</div><h3>Giá trị hợp đồng: ${money(num(c.value))}</h3><p>Đặt cọc: ${money(num(c.deposit))} • Còn lại: ${money(num(c.remaining))}</p>${contractPaymentTermsHtml(c.payment_terms)}
  <div class="contractSign"><div><b>ĐẠI DIỆN BÊN A</b><br><br><br>${esc(c.parties?.a?.representative||c.party_a||'')}</div><div><b>ĐẠI DIỆN BÊN B</b><br>${signature?`<img class="sig" src="${signature}">`:'<br><br><br>'}${stamp?`<img class="stamp" src="${stamp}">`:''}<br><b>${esc(company.signature_name||company.representative||c.parties?.b?.representative||'')}</b></div></div>
  </body></html>`;
}

async function imageData(path:string){try{const uri=await resolveImageUri(path);if(!uri)return'';if(uri.startsWith('data:'))return uri;const base64=await FileSystem.readAsStringAsync(uri,{encoding:FileSystem.EncodingType.Base64});const ext=(path.split('.').pop()||'jpg').toLowerCase();const mime=ext==='png'?'image/png':ext==='webp'?'image/webp':'image/jpeg';return`data:${mime};base64,${base64}`;}catch{return''}}
async function printHtml(html:string,name:string,shouldShare=true,size?:{width:number;height:number}){const out=await Print.printToFileAsync({html,base64:false,...size});if(!out?.uri)throw new Error('ExpoPrint không trả về URI PDF.');const source=await FileSystem.getInfoAsync(out.uri);if(!source.exists||Number(source.size||0)<=0)throw new Error('ExpoPrint tạo PDF rỗng hoặc không thể đọc.');const dir=await getExportDirectory();const dest=`${dir}${safeName(name.replace(/\.pdf$/i,''))}.pdf`;await FileSystem.copyAsync({from:out.uri,to:dest});const saved=await FileSystem.getInfoAsync(dest);if(!saved.exists||Number(saved.size||0)<=0)throw new Error('Không lưu được file PDF vào bộ nhớ thiết bị.');if(shouldShare)await share(dest,'application/pdf');return dest;}
async function share(path:string,mime:string){if(await Sharing.isAvailableAsync())await Sharing.shareAsync(path,{mimeType:mime,dialogTitle:'QQIVA • Chia sẻ file'});}
function contractPaymentTermsHtml(v:any){const rows=Array.isArray(v)?v:(Array.isArray(v?.stages)?v.stages:[]);if(!rows.length)return'';return`<section><h3>TIẾN ĐỘ / GIAI ĐOẠN THANH TOÁN</h3><table><thead><tr><th>Giai đoạn</th><th>%</th><th>Số tiền</th><th>Hạn</th><th>Ghi chú</th></tr></thead><tbody>${rows.map((x:any)=>`<tr><td>${esc(x.name)}</td><td class="num">${fmt(num(x.percent))}%</td><td class="num">${money(num(x.amount))}</td><td>${esc(x.due_date)}</td><td>${esc(x.note)}</td></tr>`).join('')}</tbody></table></section>`;}
function paymentTermsHtml(v:any){const p=object(v);if(!p.enabled&&!p.terms_text&&!p.transfer_note)return'';return`<section><h3>Thanh toán</h3><div>${esc(p.terms_text||'')}</div><div>${esc(p.transfer_note||'')}</div><div>${p.due_date?`Hạn thanh toán: ${esc(p.due_date)}`:''}</div></section>`;}
function signatureDocumentHtml(state:any,media:{companySignature?:string;companyStamp?:string;customerSignature?:string}={}){const p=object(state.project),c=object(state.company);if(!p.signing?.enabled&&!c.signature_name&&!media.companySignature&&!media.companyStamp)return'';return`<div class="sign"><div class="signBox"><b>ĐẠI DIỆN KHÁCH HÀNG</b><br>${media.customerSignature?`<img class="signatureImg" src="${media.customerSignature}">`:'<br><br><br>'}<br><b>${esc(p.signing?.customer_name||'')}</b></div><div class="signBox"><b>ĐẠI DIỆN ĐƠN VỊ</b><br>${p.signing?.show_company_signature!==false&&media.companySignature?`<img class="signatureImg" src="${media.companySignature}">`:'<br><br><br>'}${p.signing?.show_company_stamp!==false&&media.companyStamp?`<img class="stampImg" src="${media.companyStamp}">`:''}<br><b>${esc(c.signature_name||c.representative||'')}</b></div></div>`;}
function signatureHtml(c:any){if(!c||c.status!=='CONFIRMED')return'';return`<section><b>Đã xác nhận:</b> ${esc(c.signer_name)} • ${esc(c.confirmed_at)}<br>${esc(c.note)}</section>`;}
function baseCss(){return`@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#152033;margin:0;font-size:12px}header{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #1167b1;padding-bottom:12px;margin-bottom:12px}h1,h2,h3{margin:0 0 6px}.doc{text-align:right}.info,section{padding:10px 0}.muted{color:#65758a;font-size:10px}.num{text-align:right;white-space:nowrap}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #d6dde5;padding:6px;vertical-align:top}th{background:#eef4fa}td img{width:58px;height:58px;object-fit:contain}.totals{margin-left:auto;margin-top:12px;width:48%}.totals>div{display:flex;justify-content:space-between;padding:5px}.grand{font-size:16px;border-top:2px solid #1167b1;color:#0a477d}.brand{display:flex;align-items:flex-start;gap:10px}.brandLogo{width:72px;height:56px;object-fit:contain}.hero{display:flex;align-items:center;gap:12px;border:1px solid #d6dde5;padding:8px;margin:8px 0}.hero img{width:120px;height:72px;object-fit:cover}.sign{display:flex;justify-content:space-between;text-align:center;margin-top:30px}.signBox{width:45%;position:relative;min-height:130px}.signatureImg{width:130px;height:70px;object-fit:contain}.stampImg{position:absolute;width:82px;height:82px;right:10px;top:22px;object-fit:contain;opacity:.8}`;}
function templateCss(t:string){if(t==='minimal')return'td img,th:nth-child(2),td:nth-child(2){display:none}';if(t==='modern')return'h1{color:#1167b1} th{background:#1167b1;color:white}';if(t==='premium')return'body{font-family:Georgia,serif} header{border-color:#8a6a2f}.grand{color:#6f521f;border-color:#8a6a2f}';if(t==='mobile')return'body{font-size:14px}th,td{padding:8px}';return'';}
function fileStem(state:any){const p=object(state.project);return safeName(`${state.document_mode==='invoice'?'HOA_DON':'BAO_GIA'}_${p.quote_no||Date.now()}`);}
function safeName(v:string){return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').replace(/[^A-Za-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,80)||`QQIVA_${Date.now()}`;}
function esc(v:any){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}function xml(v:any){return esc(v).replace(/'/g,'&apos;');}function money(v:number){return new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0}).format(Math.round(v||0))+' đ';}function fmt(v:number){return new Intl.NumberFormat('vi-VN',{maximumFractionDigits:3}).format(v||0);}
