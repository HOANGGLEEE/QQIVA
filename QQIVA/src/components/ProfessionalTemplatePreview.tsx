import { Image, StyleSheet, Text, View } from 'react-native';

import type { ProfessionalTemplate } from '@/services/adQuotes';
import { imageSource } from '@/services/media';
import { documentLineAmount, effectivePrice, pricingBreakdown, studioDocumentItem, studioPricing } from '@/services/documentEngine';

export type StudioProductItem={
  id:string;
  productId?:string;
  name:string;
  description?:string;
  image?:string;
  unit?:string;
  qty:number;
  price:number;
  discount?:number;
  group?:string;
};

export type StudioInfo={
  documentKind:'QUOTE'|'INVOICE';
  companyName:string;
  companyAddress:string;
  companyPhone:string;
  companyWebsite?:string;
  customerName:string;
  customerPhone:string;
  projectName:string;
  address:string;
  documentNo:string;
  documentDate:string;
  note:string;
};

export type StudioTotals={subtotal:number;discount:number;surcharge:number;vat:number;grandTotal:number};

export type StudioPageSize={width:number;height:number;orientation:'portrait'|'landscape'|'square'|'phone'};
export function getStudioPageSize(config:any):StudioPageSize{
  const format=String(config?.format||'A4').toUpperCase();
  if(format==='PHONE')return{width:1080,height:1920,orientation:'phone'};
  if(format==='LANDSCAPE')return{width:1754,height:1240,orientation:'landscape'};
  if(format==='SQUARE')return{width:1240,height:1240,orientation:'square'};
  return{width:1240,height:1754,orientation:'portrait'};
}

export function lineAmount(item:StudioProductItem){
  return documentLineAmount(studioDocumentItem(item));
}

export function calculateStudioTotals(items:StudioProductItem[],config:any):StudioTotals{
  const totals=pricingBreakdown({project:{pricing:studioPricing(config)},floors:[{rooms:[{items:items.map(studioDocumentItem)}]}]});
  return {subtotal:totals.subtotal,discount:totals.discount,surcharge:totals.surcharge,vat:totals.vat,grandTotal:totals.grand_total};
}

export function rowsPerProfessionalPage(config:any){
  const density=String(config.density||'COMFORT').toUpperCase();
  const base=density==='COMPACT'?9:density==='LARGE'?6:density==='XLARGE'?4:7;
  const format=String(config.format||'A4').toUpperCase();
  return Math.max(3,base+(format==='LANDSCAPE'?2:0)-(format==='PHONE'?2:0));
}

export function paginateProfessionalItems(items:StudioProductItem[],config:any){
  if(String(config.format||'A4').toUpperCase()==='PHONE'){
    if(items.length<=3)return[items];
    const pageCount=1+Math.ceil((items.length-3)/5),base=Math.floor(items.length/pageCount),extra=items.length%pageCount;
    const out:StudioProductItem[][]=[];let offset=0;
    for(let page=0;page<pageCount;page++){const size=base+(page<extra?1:0);out.push(items.slice(offset,offset+size));offset+=size;}
    return out;
  }
  const size=rowsPerProfessionalPage(config);const out:StudioProductItem[][]=[];
  for(let i=0;i<items.length;i+=size)out.push(items.slice(i,i+size));
  if(!out.length)out.push([]);
  return out;
}

export function professionalPalette(template:ProfessionalTemplate|undefined,config:any){
  const theme=String(config.theme||template?.theme||'GOLD').toUpperCase();
  if(theme==='BLUE')return{bg:'#071927',surface:'#0D263A',accent:'#47A8FF',accent2:'#90CAF9',text:'#F7FBFF',muted:'#B7C9D8',line:'#23445E'};
  if(theme==='GREEN')return{bg:'#071B16',surface:'#0D2C23',accent:'#69C68C',accent2:'#B6E8C8',text:'#FAFFFC',muted:'#BBD0C5',line:'#285144'};
  if(theme==='ORANGE')return{bg:'#19110A',surface:'#2B1C10',accent:'#F59A3B',accent2:'#FFD09A',text:'#FFFDF9',muted:'#D8C2AA',line:'#5A3820'};
  if(theme==='PURPLE')return{bg:'#140B24',surface:'#23123E',accent:'#A878FF',accent2:'#D6C0FF',text:'#FEFCFF',muted:'#C9BCE0',line:'#49306F'};
  if(theme==='LIGHT')return{bg:'#F7F4EE',surface:'#FFFFFF',accent:'#8A6A45',accent2:'#C5A77D',text:'#201A14',muted:'#74695D',line:'#DED2C4'};
  return{bg:'#07131B',surface:'#0B1B24',accent:'#DDAA39',accent2:'#F7D77F',text:'#FFFFFF',muted:'#C8D0D5',line:'#6B5420'};
}

export function ProfessionalTemplatePreview({template,config,info,company,items,pageItems,pageNo,pageCount,isLast,refNode,device='PHONE',exportMode=false}:{
  template:ProfessionalTemplate;config:any;info:StudioInfo;company:any;items:StudioProductItem[];pageItems:StudioProductItem[];pageNo:number;pageCount:number;isLast:boolean;refNode?:(node:View|null)=>void;device?:'PHONE'|'DESKTOP'|'A4';exportMode?:boolean;
}){
  const p=professionalPalette(template,config);const totals=calculateStudioTotals(items,config);
  const title=String(config.title||template.title||'NHẬP TÊN SẢN PHẨM');const subtitle=String(config.subtitle||template.sub||'');const slogan=String(config.slogan||'Uy tín • Chất lượng • Tận tâm');
  const logo=String(config.logoOverride||company?.logo||'');const signature=String(config.signatureOverride||company?.signature||'');const stamp=String(config.stampOverride||company?.stamp||'');
  const fit=String(config.imageFit||'cover')==='contain'?'contain':'cover';const layout=String(config.layout||template.layout||'LUX').toUpperCase();
  const fontFamily=String(config.fontFamily||'SYSTEM');const font=fontFamily==='SERIF'?'serif':fontFamily==='MONO'?'monospace':undefined;
  const deviceScale=device==='PHONE'?0.96:device==='DESKTOP'?1:1;
  const format=String(config.format||'A4').toUpperCase();const phone=format==='PHONE'&&device==='PHONE'&&exportMode,landscape=format==='LANDSCAPE',square=format==='SQUARE';
  const showCompany=config.adShowCompany!==false,showTable=config.adShowTable!==false,showTableImages=config.adShowTableImages!==false,showDescription=config.adShowDescription!==false,showUnit=config.adShowUnit!==false,showQty=config.adShowQty!==false,showPrice=config.adShowPrice!==false,showTotal=config.adShowTotal!==false;
  const exportSize=exportMode?getStudioPageSize(config):null;
  return <View ref={refNode} collapsable={false} style={[s.page,phone&&s.phonePage,landscape&&s.landscapePage,square&&s.squarePage,{backgroundColor:p.bg,borderColor:p.line,transform:[{scale:deviceScale}]},exportSize&&{position:'absolute',left:-10000,top:0,width:exportSize.width,height:exportSize.height,minHeight:exportSize.height,transform:[]}]}> 
    {showCompany?<View style={[s.brand,phone&&s.phoneBrand,{borderBottomColor:p.line}]}> 
      <View style={s.brandLeft}>{logo&&imageSource(logo)?<Image source={imageSource(logo)} style={[s.logo,phone&&s.phoneLogo]} resizeMode="contain"/>:null}<Text style={[s.company,phone&&s.phoneCompany,{color:p.accent,fontFamily:font}]} numberOfLines={2}>{info.companyName||company?.name||'QQIVA BUSINESS'}</Text></View>
      <Text style={[s.slogan,phone&&s.phoneSlogan,{color:p.text,fontFamily:font}]}>{slogan}</Text>
    </View>:null}

    {pageNo===1?<>
      <View style={[s.hero,phone&&s.phoneHero,landscape&&s.landscapeHero,layout==='BOLD'&&s.heroBold,{borderBottomColor:p.line}]}> 
        <View style={{flex:1}}><Text style={[s.docLabel,phone&&s.phoneDocLabel,{color:p.accent,fontFamily:font}]}>{info.documentKind==='INVOICE'?'HÓA ĐƠN':'BÁO GIÁ'} • {categoryLabel(config.category)}</Text><Text style={[s.title,phone&&s.phoneTitle,{color:p.text,fontFamily:font}]}>{title}</Text><Text style={[s.subtitle,phone&&s.phoneSubtitle,{color:p.accent,fontFamily:font}]}>{subtitle}</Text></View>
        {String(config.heroStyle||template.hero)!=='MINIMAL'&&items.find(x=>x.image)?.image&&imageSource(items.find(x=>x.image)?.image)?<Image source={imageSource(items.find(x=>x.image)?.image)} style={[s.heroImage,phone&&s.phoneHeroImage,landscape&&s.landscapeHeroImage,layout==='CATALOG'&&!phone&&{width:120}]} resizeMode={fit}/>:null}
      </View>
      <View style={[s.info,phone&&s.phoneInfo,{borderColor:p.line,backgroundColor:p.surface}]}> 
        <InfoBlock label="ĐƠN VỊ" lines={[info.companyName,info.companyAddress]} p={p} font={font} phone={phone}/>
        <InfoBlock label="KHÁCH HÀNG" lines={[info.customerName,info.customerPhone,info.address||info.projectName]} p={p} font={font} phone={phone}/>
        <InfoBlock label="CHỨNG TỪ" lines={[info.documentNo?`Số: ${info.documentNo}`:'',info.documentDate?`Ngày: ${formatDate(info.documentDate)}`:'']} p={p} font={font} phone={phone}/>
      </View>
      <View style={s.benefits}><Benefit title="THIẾT KẾ" value="Hiện đại" p={p} font={font}/><Benefit title="VẬT LIỆU" value="Cao cấp" p={p} font={font}/><Benefit title="BẢO HÀNH" value="Dài hạn" p={p} font={font}/></View>
    </>:<Text style={[s.continueTitle,{color:p.muted,fontFamily:font}]}>{info.documentKind==='INVOICE'?'HÓA ĐƠN':'BÁO GIÁ'} • {info.documentNo||'QQIVA'} • tiếp theo</Text>}

    {showTable&&phone?<View testID="phone-product-list" style={s.phoneProducts}>{pageItems.map((item,index)=><PhoneProductCard key={item.id||String(index)} item={item} index={index} p={p} font={font} fit={fit} config={config}/>)}</View>:null}
    {showTable&&!phone?<View style={[s.table,{borderColor:p.line}]}> 
      <View style={[s.row,s.headRow,{backgroundColor:p.accent}]}><Text style={[s.hCell,s.nameCol,{fontFamily:font}]}>HẠNG MỤC</Text>{showTableImages?<Text style={[s.hCell,s.imgCol,{fontFamily:font}]}>ẢNH</Text>:null}{showUnit?<Text style={[s.hCell,s.unitCol,{fontFamily:font}]}>ĐVT</Text>:null}{showQty?<Text style={[s.hCell,s.qtyCol,{fontFamily:font}]}>SL</Text>:null}{showPrice?<Text style={[s.hCell,s.priceCol,{fontFamily:font}]}>ĐƠN GIÁ</Text>:null}<Text style={[s.hCell,s.amountCol,{fontFamily:font}]}>THÀNH TIỀN</Text></View>
      {pageItems.length?pageItems.map((item,index)=><View key={item.id||String(index)} style={[s.row,{borderBottomColor:p.line,backgroundColor:index%2?p.bg:p.surface}]}>
        <View style={[s.cellView,s.nameCol]}><Text style={[s.itemName,{color:p.text,fontFamily:font}]} numberOfLines={2}>{item.name}</Text>{showDescription&&item.description?<Text style={[s.desc,{color:p.muted,fontFamily:font}]} numberOfLines={2}>{item.description}</Text>:null}{Number(item.discount||0)>0?<Text style={[s.discount,{color:p.accent,fontFamily:font}]}>CK dòng {Number(item.discount).toLocaleString('vi-VN')}%</Text>:null}</View>
        {showTableImages?<View style={[s.cellView,s.imgCol]}>{item.image&&imageSource(item.image)?<Image source={imageSource(item.image)} style={s.itemImage} resizeMode={fit}/>:null}</View>:null}
        {showUnit?<Text style={[s.cell,s.unitCol,{color:p.text,fontFamily:font}]}>{item.unit||''}</Text>:null}
        {showQty?<Text style={[s.cell,s.qtyCol,{color:p.text,fontFamily:font}]}>{fmtQty(item.qty)}</Text>:null}
        {showPrice?<Text style={[s.cell,s.priceCol,{color:p.text,fontFamily:font}]}>{Number(item.price||0)>0?money(effectivePrice(studioDocumentItem(item))):(config.adMissingAsContact!==false?'Liên hệ':'0')}</Text>:null}
        <Text style={[s.cell,s.amountCol,{color:p.text,fontFamily:font}]}>{money(lineAmount(item))}</Text>
      </View>):<View style={[s.empty,{borderBottomColor:p.line}]}><Text style={{color:p.muted,fontFamily:font}}>Chưa chọn sản phẩm</Text></View>}
    </View>:null}

    {isLast&&showTotal?<View style={[s.totals,phone&&s.phoneTotals,{borderTopColor:p.accent}]}><TotalLine label="Tạm tính" value={totals.subtotal} p={p} font={font} phone={phone}/>{totals.discount>0?<TotalLine label="Chiết khấu" value={-totals.discount} p={p} font={font} phone={phone}/>:null}{totals.surcharge>0?<TotalLine label={String(config.surchargeLabel||'Phụ phí')} value={totals.surcharge} p={p} font={font} phone={phone}/>:null}{totals.vat>0?<TotalLine label={`VAT ${Number(config.vatRate??10).toLocaleString('vi-VN')}%`} value={totals.vat} p={p} font={font} phone={phone}/>:null}<View style={s.grand}><Text style={[s.grandLabel,phone&&s.phoneGrandLabel,{color:p.accent,fontFamily:font}]}>TỔNG CỘNG</Text><Text style={[s.grandValue,phone&&s.phoneGrandValue,{color:p.accent,fontFamily:font}]}>{money(totals.grandTotal)}</Text></View></View>:null}

    {isLast&&String(config.termsText||info.note||'').trim()?<View style={[s.terms,phone&&s.phoneTerms,{borderColor:p.line,backgroundColor:p.surface}]}><Text style={[s.termsTitle,phone&&s.phoneTermsTitle,{color:p.accent,fontFamily:font}]}>ĐIỀU KHOẢN / GHI CHÚ</Text><Text style={[s.termsText,phone&&s.phoneTermsText,{color:p.text,fontFamily:font}]}>{String(config.termsText||info.note)}</Text></View>:null}

    {isLast?<View style={[s.signatures,phone&&s.phoneSignatures]}><View style={[s.signBox,phone&&s.phoneSignBox]}><Text style={[s.signTitle,phone&&s.phoneSignTitle,{color:p.text,fontFamily:font}]}>ĐẠI DIỆN KHÁCH HÀNG</Text><Text style={[s.signName,phone&&s.phoneSignName,{color:p.muted,fontFamily:font}]}>{info.customerName}</Text></View><View style={[s.signBox,phone&&s.phoneSignBox]}><Text style={[s.signTitle,phone&&s.phoneSignTitle,{color:p.text,fontFamily:font}]}>ĐẠI DIỆN ĐƠN VỊ</Text><View style={[s.signMedia,phone&&s.phoneSignMedia]}>{signature&&imageSource(signature)?<Image source={imageSource(signature)} style={[s.signature,phone&&s.phoneSignature]} resizeMode="contain"/>:null}{stamp&&imageSource(stamp)?<Image source={imageSource(stamp)} style={[s.stamp,phone&&s.phoneStamp]} resizeMode="contain"/>:null}</View><Text style={[s.signName,phone&&s.phoneSignName,{color:p.muted,fontFamily:font}]}>{company?.signature_name||company?.representative||info.companyName}</Text></View></View>:null}
    <Text style={[s.pageNo,phone&&s.phonePageNo,{color:p.muted,fontFamily:font}]}>Trang {pageNo}/{pageCount}</Text>
  </View>;
}

function PhoneProductCard({item,index,p,font,fit,config}:{item:StudioProductItem;index:number;p:any;font:any;fit:'cover'|'contain';config:any}){return <View style={[s.phoneCard,{borderColor:p.line,backgroundColor:index%2?p.bg:p.surface}]}>{item.image&&imageSource(item.image)?<Image source={imageSource(item.image)} style={s.phoneCardImage} resizeMode={fit}/>:<View style={[s.phoneCardImage,s.phoneImageEmpty,{borderColor:p.line}]}/>}<View style={s.phoneCardBody}><Text style={[s.phoneItemName,{color:p.text,fontFamily:font}]} numberOfLines={2}>{item.name}</Text>{config.adShowDescription!==false&&item.description?<Text style={[s.phoneDescription,{color:p.muted,fontFamily:font}]} numberOfLines={2}>{item.description}</Text>:null}<View style={s.phoneMeta}><Text style={[s.phoneMetaText,{color:p.muted,fontFamily:font}]}>{item.unit||'—'}  •  SL {fmtQty(item.qty)}</Text><Text style={[s.phonePrice,{color:p.text,fontFamily:font}]}>{Number(item.price||0)>0?money(effectivePrice(studioDocumentItem(item))):'Liên hệ'}</Text></View><View style={[s.phoneAmount,{borderTopColor:p.line}]}><Text style={[s.phoneAmountLabel,{color:p.muted,fontFamily:font}]}>THÀNH TIỀN</Text><Text style={[s.phoneAmountValue,{color:p.accent,fontFamily:font}]}>{money(lineAmount(item))}</Text></View></View></View>}
function InfoBlock({label,lines,p,font,phone=false}:{label:string;lines:string[];p:any;font:any;phone?:boolean}){const clean=lines.filter(Boolean);if(!clean.length)return <View style={s.infoBlock}/>;return <View style={s.infoBlock}><Text style={[s.infoLabel,phone&&s.phoneInfoLabel,{color:p.accent,fontFamily:font}]}>{label}</Text>{clean.map((line,i)=><Text key={i} style={[i===0?s.infoStrong:s.infoSmall,phone&&(i===0?s.phoneInfoStrong:s.phoneInfoSmall),{color:i===0?p.text:p.muted,fontFamily:font}]}>{line}</Text>)}</View>}
function Benefit({title,value,p,font}:{title:string;value:string;p:any;font:any}){return <View style={[s.benefit,{borderColor:p.accent}]}><Text style={[s.benefitTitle,{color:p.accent,fontFamily:font}]}>✦ {title}</Text><Text style={[s.benefitValue,{color:p.text,fontFamily:font}]}>{value}</Text></View>}
function TotalLine({label,value,p,font,phone=false}:{label:string;value:number;p:any;font:any;phone?:boolean}){return <View style={s.totalLine}><Text style={[s.totalText,phone&&s.phoneTotalText,{color:p.muted,fontFamily:font}]}>{label}</Text><Text style={[s.totalMoney,phone&&s.phoneTotalMoney,{color:p.text,fontFamily:font}]}>{money(value)}</Text></View>}
function categoryLabel(value:any){const x=String(value||'INTERIOR').toUpperCase();return x==='PHAO'?'PHÀO CHỈ':x==='CEILING'?'TRẦN':x==='MIXED'?'TRẦN + PHÀO':x==='MATERIAL'?'VẬT LIỆU':x==='RETAIL'?'BÁN HÀNG':x==='SERVICE'?'DỊCH VỤ':x==='OTHER'?'KHÁC':'NỘI THẤT'}
function formatDate(v:string){const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:v}
function fmtQty(v:any){return Number(v||0).toLocaleString('vi-VN',{maximumFractionDigits:3})}
function money(v:any){return `${Math.round(Number(v||0)).toLocaleString('vi-VN')} đ`}

const s=StyleSheet.create({
  page:{minHeight:720,borderWidth:1,borderRadius:4,padding:20,gap:10,overflow:'hidden'},phonePage:{padding:48,gap:24},landscapePage:{paddingHorizontal:28,gap:8},squarePage:{padding:22,gap:9},
  brand:{minHeight:58,flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10,borderBottomWidth:1,paddingBottom:10},brandLeft:{flexDirection:'row',alignItems:'center',gap:10,flex:1},logo:{width:60,height:44},company:{fontWeight:'900',fontSize:17,flex:1},slogan:{fontSize:9,maxWidth:'38%',textAlign:'right'},
  phoneBrand:{minHeight:100,paddingBottom:18},phoneLogo:{width:112,height:76},phoneCompany:{fontSize:30},phoneSlogan:{fontSize:18,lineHeight:25},
  hero:{minHeight:145,flexDirection:'row',alignItems:'center',gap:18,borderBottomWidth:1,paddingVertical:10},phoneHero:{minHeight:310,alignItems:'stretch'},landscapeHero:{minHeight:120},heroBold:{minHeight:170},docLabel:{fontWeight:'900',fontSize:11},title:{fontWeight:'900',fontSize:34,lineHeight:36,marginTop:5},subtitle:{fontWeight:'700',fontSize:11,fontStyle:'italic',marginTop:6},heroImage:{width:190,height:132,borderRadius:14},phoneHeroImage:{width:'44%',height:260},landscapeHeroImage:{width:260,height:105},
  phoneDocLabel:{fontSize:21},phoneTitle:{fontSize:56,lineHeight:62,marginTop:12},phoneSubtitle:{fontSize:22,lineHeight:29,marginTop:10},
  info:{flexDirection:'row',gap:8,borderWidth:1,borderRadius:12,padding:10},phoneInfo:{padding:16,gap:14},infoBlock:{flex:1,gap:2},infoLabel:{fontSize:8,fontWeight:'900'},infoStrong:{fontSize:9,fontWeight:'900'},infoSmall:{fontSize:8,lineHeight:11},
  phoneInfoLabel:{fontSize:16},phoneInfoStrong:{fontSize:20,lineHeight:27},phoneInfoSmall:{fontSize:17,lineHeight:24},
  benefits:{flexDirection:'row',gap:8},benefit:{flex:1,borderWidth:1,borderRadius:10,paddingVertical:8,paddingHorizontal:5,alignItems:'center'},benefitTitle:{fontSize:8,fontWeight:'900'},benefitValue:{fontSize:7,fontWeight:'700',marginTop:2},continueTitle:{fontSize:9,fontWeight:'800',textAlign:'right'},
  table:{borderWidth:1,borderRadius:10,overflow:'hidden'},phoneTable:{marginTop:4},row:{flexDirection:'row',minHeight:58,borderBottomWidth:1},headRow:{minHeight:34,borderBottomWidth:0},hCell:{color:'#151515',fontSize:7,fontWeight:'900',padding:5,textAlignVertical:'center'},cell:{fontSize:7,padding:5,textAlignVertical:'center'},cellView:{padding:5,justifyContent:'center'},nameCol:{flex:1,minWidth:110},imgCol:{width:60},unitCol:{width:40,textAlign:'center'},qtyCol:{width:42,textAlign:'right'},priceCol:{width:67,textAlign:'right'},amountCol:{width:72,textAlign:'right'},itemImage:{width:48,height:48,borderRadius:7},itemName:{fontSize:8,fontWeight:'900'},desc:{fontSize:7,lineHeight:9,marginTop:2},discount:{fontSize:6,fontWeight:'800',marginTop:2},empty:{height:70,alignItems:'center',justifyContent:'center',borderBottomWidth:1},
  phoneProducts:{flex:1,gap:18},phoneCard:{flex:1,minHeight:238,flexDirection:'row',borderWidth:2,borderRadius:22,padding:16,gap:20},phoneCardImage:{width:245,height:'100%',maxHeight:260,borderRadius:16},phoneImageEmpty:{borderWidth:1},phoneCardBody:{flex:1,justifyContent:'space-between',paddingVertical:3},phoneItemName:{fontSize:28,lineHeight:34,fontWeight:'900'},phoneDescription:{fontSize:18,lineHeight:24},phoneMeta:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12},phoneMetaText:{fontSize:18},phonePrice:{fontSize:20,fontWeight:'800'},phoneAmount:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',borderTopWidth:1,paddingTop:10},phoneAmountLabel:{fontSize:16,fontWeight:'800'},phoneAmountValue:{fontSize:27,fontWeight:'900'},
  totals:{alignSelf:'flex-end',width:'62%',borderTopWidth:2,paddingTop:7,gap:4},totalLine:{flexDirection:'row',justifyContent:'space-between',gap:10},totalText:{fontSize:8},totalMoney:{fontSize:8,fontWeight:'800'},grand:{flexDirection:'row',justifyContent:'space-between',gap:10,paddingTop:5},grandLabel:{fontSize:11,fontWeight:'900'},grandValue:{fontSize:13,fontWeight:'900'},
  phoneTotals:{width:'76%',borderTopWidth:4,paddingTop:16,gap:8},phoneTotalText:{fontSize:20},phoneTotalMoney:{fontSize:21},phoneGrandLabel:{fontSize:27},phoneGrandValue:{fontSize:32},
  terms:{borderWidth:1,borderRadius:10,padding:9,gap:4},termsTitle:{fontSize:8,fontWeight:'900'},termsText:{fontSize:8,lineHeight:12},
  phoneTerms:{padding:18,gap:9},phoneTermsTitle:{fontSize:18},phoneTermsText:{fontSize:18,lineHeight:26},
  signatures:{flexDirection:'row',justifyContent:'space-between',gap:16,paddingTop:8},signBox:{width:'46%',alignItems:'center',minHeight:105},signTitle:{fontSize:8,fontWeight:'900'},signName:{fontSize:8,fontWeight:'700'},signMedia:{height:66,width:'100%',alignItems:'center',justifyContent:'center'},signature:{width:120,height:54},stamp:{position:'absolute',width:66,height:66,right:12,top:0,opacity:.78},pageNo:{fontSize:7,textAlign:'center',marginTop:'auto'},
  phoneSignatures:{paddingTop:12},phoneSignBox:{minHeight:150},phoneSignTitle:{fontSize:17},phoneSignName:{fontSize:18},phoneSignMedia:{height:100},phoneSignature:{width:190,height:90},phoneStamp:{width:100,height:100},phonePageNo:{fontSize:16},
});
