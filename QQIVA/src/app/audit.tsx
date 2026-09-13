import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { AppButton, Card, IconButton, Muted, SectionTitle } from '@/components/ui';
import { colors } from '@/constants/theme';
import { runSystemAudit } from '@/services/audit';
import { stockIntegrity } from '@/services/retail';
export default function Audit(){const [a,setA]=useState<any>(null),[stock,setStock]=useState<any>(null),[loading,setLoading]=useState(false);const load=async()=>{setLoading(true);try{setA(await runSystemAudit());setStock(await stockIntegrity())}finally{setLoading(false)}};useEffect(()=>{void load()},[]);return <Screen title="Kiểm tra hệ thống" subtitle="Audit dữ liệu offline" refreshing={loading} onRefresh={load} right={<IconButton icon="close" onPress={()=>router.back()}/>}><Card><Text style={{fontWeight:'900',fontSize:17,color:a?.ok!==false?colors.success:colors.danger}}>{a?.ok!==false?'Dữ liệu lõi ổn':'Phát hiện vấn đề dữ liệu'}</Text><Muted>{JSON.stringify(a?.summary||a||{},null,2)}</Muted></Card><Card><Text style={{fontWeight:'900',fontSize:17,color:stock?.ok?colors.success:colors.danger}}>{stock?.ok?'Sổ kho khớp':'Sổ kho có chênh lệch'}</Text><Muted>{stock?.ok?'Tổng ledger bằng số dư tồn cho các SKU đã phát sinh.':JSON.stringify(stock?.errors||[],null,2)}</Muted></Card><AppButton title="Kiểm tra lại" icon="refresh" onPress={()=>void load()}/></Screen>}
