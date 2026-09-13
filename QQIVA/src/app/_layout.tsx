import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useState } from 'react';
import { getDatabase } from '@/db/database';
import { colors } from '@/constants/theme';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { void getDatabase().then(() => setReady(true)).catch((e) => { setError(String(e?.message || e)); setReady(true); }); }, []);
  if (!ready) return <View style={s.loading}><ActivityIndicator size="large" color={colors.primary}/><Text style={s.text}>Đang khởi tạo dữ liệu QQIVA offline…</Text></View>;
  return <><StatusBar style="dark"/><Stack screenOptions={{ headerShown:false, contentStyle:{backgroundColor:colors.bg} }} />{error ? <Text style={s.error}>{error}</Text> : null}</>;
}
const s=StyleSheet.create({loading:{flex:1,alignItems:'center',justifyContent:'center',gap:12,backgroundColor:colors.bg},text:{color:colors.textSoft,fontWeight:'700'},error:{position:'absolute',bottom:0,left:0,right:0,backgroundColor:'#FDECEE',color:colors.danger,padding:4,fontSize:9}});
