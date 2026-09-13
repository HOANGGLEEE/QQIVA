import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { documentTypeLabel, money, shortDate } from '@/services/format';
import type { HistoryMeta } from '@/types/qqiva';

export function DocumentRow({ item }: { item: HistoryMeta }) {
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.badge}><Text style={styles.badgeText}>{documentTypeLabel(item.type)}</Text></View>
        <Text style={styles.date}>{shortDate(item.updated_at || item.document_date)}</Text>
      </View>
      <Text style={styles.no}>{item.document_no || 'Chưa có số chứng từ'}</Text>
      <Text style={styles.customer}>{item.customer || 'Chưa có khách hàng'}</Text>
      <Text style={styles.project} numberOfLines={2}>{item.project || 'Chưa có công trình'}</Text>
      <View style={styles.bottom}>
        <Text style={styles.total}>{money(item.total)}</Text>
        <Text style={styles.status}>{item.status || 'Đã lưu'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 15 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { backgroundColor: colors.surfaceSoft, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  badgeText: { color: colors.primaryDark, fontSize: 11, fontWeight: '800' },
  date: { color: colors.textSoft, fontSize: 11 },
  no: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 12 },
  customer: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 5 },
  project: { color: colors.textSoft, fontSize: 12, lineHeight: 18, marginTop: 3 },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 13 },
  total: { color: colors.primaryDark, fontSize: 15, fontWeight: '900' },
  status: { color: colors.success, fontSize: 11, fontWeight: '800' },
});
