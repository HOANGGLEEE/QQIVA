import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { AppButton, Card, IconButton, Muted, Row } from '@/components/ui';
import { colors } from '@/constants/theme';
import { getSale, listSales } from '@/services/retail';
const money=(v:any)=>`${Number(v||0).toLocaleString('vi-VN')} đ`;
export default function Sales(){const [rows,setRows]=useState<any[]>([]),[details,setDetails]=useState<Record<string,any>>({});useEffect(()=>{void listSales().then(setRows)},[]);return <Screen title="Lịch sử bán hàng" subtitle="Giao dịch POS đã hoàn tất" right={<IconButton icon="close" onPress={()=>router.back()}/>}>{rows.map(s=><Card key={s.sale_id}><Row><View style={{flex:1}}><Text style={st.no}>{s.sale_no}</Text><Muted>{s.customer_name||'Khách lẻ'} • {s.payment_status} • {s.created_at_utc}</Muted></View><Text style={st.total}>{money(s.total_minor)}</Text></Row><AppButton compact variant="secondary" title={details[s.sale_id]?'Ẩn chi tiết':'Chi tiết'} icon="receipt-text-outline" onPress={()=>details[s.sale_id]?setDetails({...details,[s.sale_id]:null}):void getSale(s.sale_id).then(d=>setDetails({...details,[s.sale_id]:d}))}/>{details[s.sale_id]?.items?.map((x:any)=><Row key={x.sale_item_id}><Muted>{x.product_name_snapshot} × {Number(x.qty_micros||0)/1000000}</Muted><Text style={{marginLeft:'auto',fontWeight:'800'}}>{money(x.line_total_minor)}</Text></Row>)}</Card>)}</Screen>}
const st=StyleSheet.create({no:{fontWeight:'900',color:colors.primary},total:{fontWeight:'900',color:colors.text}});
