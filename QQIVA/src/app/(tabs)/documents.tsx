import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { AppButton, Card, Chips, Divider, Muted, Row, SectionTitle, confirm } from '@/components/ui';
import { colors } from '@/constants/theme';
import { convertQuoteToInvoice, deleteDocument, duplicateDocument, listDocuments, openDocument } from '@/services/documentEngine';

const money=(v:any)=>`${Number(v||0).toLocaleString('vi-VN')} đ`;
export default function Documents(){const [items,setItems]=useState<any[]>([]);const [filter,setFilter]=useState('ALL');const [loading,setLoading]=useState(false);
const load=useCallback(async()=>{setLoading(true);try{setItems(await listDocuments())}finally{setLoading(false)}},[]);useEffect(()=>{void load()},[load]);const rows=items.filter(x=>filter==='ALL'||String(x.type||'').includes(filter));
const edit=async(id:string)=>{await openDocument(id);router.push('/document-editor')};
return <Screen title="Chứng từ" subtitle="Báo giá • hóa đơn • lịch sử offline" refreshing={loading} onRefresh={load} right={<TouchableOpacity onPress={()=>router.push({pathname:'/document-editor',params:{mode:'quote',new:'1'}})}><MaterialCommunityIcons name="plus-circle" size={30} color={colors.primary}/></TouchableOpacity>}>
<Chips value={filter} onChange={setFilter} options={[{value:'ALL',label:`Tất cả (${items.length})`},{value:'QUOTE',label:'Báo giá'},{value:'INVOICE',label:'Hóa đơn'}]}/>
{rows.length?rows.map(x=><Card key={x.id}><Row><View style={{flex:1}}><Text style={s.no}>{x.doc_no||x.quote_no||x.id}</Text><Text style={s.title}>{x.customer||'Khách lẻ'} • {x.project||x.address||'Chưa có công trình'}</Text><Muted>{x.type||'DOCUMENT'} • {x.doc_date||x.date||''} • {x.status||'Đã lưu'}</Muted></View><Text style={s.total}>{money(x.total)}</Text></Row><Divider/><Row style={{flexWrap:'wrap'}}><AppButton compact title="Mở" icon="pencil-outline" onPress={()=>void edit(x.id)}/><AppButton compact variant="secondary" title="Nhân bản" icon="content-copy" onPress={()=>void duplicateDocument(x.id).then(load).catch(e=>Alert.alert('Lỗi',String(e.message||e)))}/>{String(x.type||'').includes('QUOTE')?<AppButton compact variant="secondary" title="→ Hóa đơn" icon="swap-horizontal" onPress={()=>void convertQuoteToInvoice(x.id).then(async r=>{if(r?.id)await edit(r.id);else await load()}).catch(e=>Alert.alert('Lỗi',String(e.message||e)))}/>:null}<AppButton compact variant="danger" title="Xóa" icon="trash-can-outline" onPress={()=>confirm('Xóa chứng từ','Dữ liệu chứng từ sẽ bị xóa khỏi máy.',()=>void deleteDocument(x.id).then(load))}/></Row></Card>):<Card><Text style={s.empty}>Chưa có chứng từ.</Text><AppButton title="Tạo báo giá đầu tiên" icon="file-plus-outline" onPress={()=>router.push({pathname:'/document-editor',params:{mode:'quote',new:'1'}})}/></Card>}
<SectionTitle>Công cụ</SectionTitle><AppButton variant="secondary" title="Báo giá nhanh" icon="lightning-bolt" onPress={()=>router.push({pathname:'/quick-document',params:{kind:'quote'}})}/><AppButton variant="secondary" title="Hóa đơn nhanh" icon="lightning-bolt" onPress={()=>router.push({pathname:'/quick-document',params:{kind:'invoice'}})}/><AppButton variant="secondary" title="Nhập từ ảnh/PDF/JSON" icon="creation-outline" onPress={()=>router.push('/smart-document')}/>
</Screen>}
const s=StyleSheet.create({no:{fontWeight:'900',fontSize:14,color:colors.primary},title:{fontWeight:'800',fontSize:13,color:colors.text,marginTop:3},total:{fontWeight:'900',color:colors.text},empty:{textAlign:'center',color:colors.textSoft,padding:16}});
