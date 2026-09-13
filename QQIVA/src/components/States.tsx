import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors } from '@/constants/theme';

export function LoadingState({ label = 'Đang tải dữ liệu QQIVA...' }: { label?: string }) {
  return (
    <View style={styles.state}>
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={styles.stateText}>{label}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={[styles.state, styles.errorState]}>
      <MaterialCommunityIcons name="server-network-off" size={28} color={colors.danger} />
      <Text style={styles.errorTitle}>Chưa kết nối được backend</Text>
      <Text style={styles.stateText}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity style={styles.retry} onPress={onRetry}>
          <Text style={styles.retryText}>Thử lại</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <View style={styles.state}>
      <MaterialCommunityIcons name="inbox-outline" size={30} color={colors.textSoft} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.stateText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  state: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  errorState: { borderColor: '#F1C9CE' },
  stateText: { color: colors.textSoft, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  errorTitle: { color: colors.danger, fontSize: 16, fontWeight: '800' },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  retry: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, marginTop: 4 },
  retryText: { color: colors.white, fontWeight: '800' },
});
