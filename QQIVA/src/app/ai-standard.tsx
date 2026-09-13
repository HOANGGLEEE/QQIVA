import { useState } from 'react';
import { Alert, Text } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { AppButton, Card, Field, IconButton, Muted, SectionTitle } from '@/components/ui';
import { AI_JSON_SCHEMA, AI_SCHEMA_VERSION, extractJsonPayload, normalizeAiPayload, validateAiJson } from '@/services/aiJson';
import { importSmartText, setPastedJson } from '@/services/sources';

export default function AIStandard(){
  const [raw,setRaw]=useState('');
  const [result,setResult]=useState<any>(null);
  const check=()=>{try{const payload=extractJsonPayload(raw);const validation=validateAiJson(payload);const normalized=validation.errors.length?null:normalizeAiPayload(payload);setResult({validation,normalized_preview:normalized?{schema_version:normalized.schema_version,validator_status:normalized.validator_status,invoice_mode:normalized.invoice_mode,stats:normalized.validation?.stats}:null})}catch(e:any){setResult({validation:{errors:[e.message||String(e)],warnings:[],stats:{floors:0,rooms:0,items:0,need_check:0}}})}};
  const importToSmart=async()=>{try{if(!raw.trim())throw new Error('Chưa có JSON để nhập.');await setPastedJson(raw);const r=await importSmartText(raw);Alert.alert('Đã nạp offline',`${r.validation?.stats?.items||0} hạng mục đã được chuẩn hóa.`,[{text:'Mở Chứng từ thông minh',onPress:()=>router.push('/smart-document')},{text:'Ở lại'}])}catch(e:any){Alert.alert('Không nạp được',e.message||String(e))}};
  return <Screen title="Chuẩn AI / Prompt JSON" subtitle={`${AI_SCHEMA_VERSION} • xử lý 100% offline`} right={<IconButton icon="close" onPress={()=>router.back()}/>}>
    <Card><SectionTitle>Giới hạn offline</SectionTitle><Muted>QQIVA không gọi API AI, OCR cloud hoặc server. Màn này chỉ nhận JSON bạn đã có, kiểm tra cấu trúc và chuẩn hóa ngay trên thiết bị. Ảnh/PDF nguồn vẫn được lưu offline để đối chiếu nhưng chưa tự OCR nếu chưa tích hợp model OCR chạy local.</Muted></Card>
    <Card><SectionTitle>Schema đầu vào QQIVA</SectionTitle><Muted>{JSON.stringify(AI_JSON_SCHEMA,null,2)}</Muted></Card>
    <Card><Field label="Dán JSON hoặc khối ```json ... ```" multiline value={raw} onChangeText={setRaw}/><AppButton title="Kiểm tra & chuẩn hóa offline" icon="check-decagram-outline" onPress={check}/><AppButton variant="secondary" title="Nạp vào Chứng từ thông minh" icon="file-import-outline" onPress={()=>void importToSmart()}/>{result?<><Text style={{fontWeight:'900',marginTop:12}}>Kết quả</Text><Muted>{JSON.stringify(result,null,2)}</Muted></>:null}</Card>
  </Screen>;
}
