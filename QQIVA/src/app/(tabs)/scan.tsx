import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { AppButton, Card, Muted } from '@/components/ui';
import { colors } from '@/constants/theme';
import { findSkuByBarcode } from '@/services/retail';
export default function Scan(){const [permission,requestPermission]=useCameraPermissions();const [locked,setLocked]=useState(false);const [value,setValue]=useState('');const [sku,setSku]=useState<any>(null);
const scanned=async({data}:{data:string})=>{if(locked)return;setLocked(true);setValue(data);setSku(await findSkuByBarcode(data).catch(()=>null));};
return <Screen title="Quét QR / Barcode" subtitle="Quét mã sản phẩm hoặc mã QR bất kỳ">{!permission?.granted?<Card><Text style={s.center}>QQIVA cần quyền camera để quét mã.</Text><AppButton title="Cấp quyền camera" icon="camera" onPress={()=>void requestPermission()}/></Card>:<View style={s.cameraWrap}><CameraView style={s.camera} barcodeScannerSettings={{barcodeTypes:['qr','ean13','ean8','code128','code39','upc_a','upc_e']}} onBarcodeScanned={locked?undefined:scanned}/><View style={s.frame}/></View>}{value?<Card><Text style={s.code}>{value}</Text>{sku?<><Text style={s.name}>{sku.product_name}</Text><Muted>SKU: {sku.sku_code} • Giá: {Number(sku.retail_price_minor||sku.library_price||0).toLocaleString('vi-VN')} đ</Muted><AppButton title="Đưa vào POS" icon="cart-plus" onPress={()=>router.push({pathname:'/retail',params:{barcode:value}})}/></>:<Muted>Mã chưa được gắn với SKU trong kho. Nếu đây là QR khác, bạn vẫn có thể sao chép/đọc giá trị ở trên.</Muted>}<AppButton variant="secondary" title="Quét lại" icon="qrcode-scan" onPress={()=>{setLocked(false);setValue('');setSku(null)}}/></Card>:null}</Screen>}
const s=StyleSheet.create({cameraWrap:{height:390,borderRadius:22,overflow:'hidden',position:'relative',backgroundColor:'#111'},camera:{flex:1},frame:{position:'absolute',top:'25%',left:'15%',right:'15%',height:'45%',borderWidth:3,borderColor:'#fff',borderRadius:20},center:{textAlign:'center',color:colors.text},code:{fontWeight:'900',color:colors.primary,fontSize:16},name:{fontWeight:'900',fontSize:18,color:colors.text}});
