import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors } from '@/constants/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
      {hint ? <Text style={styles.metricHint}>{hint}</Text> : null}
    </View>
  );
}

export function ModuleCard({ icon, title, subtitle, onPress }: { icon: IconName; title: string; subtitle: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.module} onPress={onPress} activeOpacity={0.78}>
      <View style={styles.moduleIcon}><MaterialCommunityIcons name={icon} size={25} color={colors.primary} /></View>
      <View style={styles.moduleCopy}>
        <Text style={styles.moduleTitle}>{title}</Text>
        <Text style={styles.moduleSubtitle}>{subtitle}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textSoft} />
    </TouchableOpacity>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}><Text style={styles.sectionTitle}>{title}</Text>{action}</View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  metric: {
    flex: 1,
    minWidth: 145,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 15,
  },
  metricLabel: { color: colors.textSoft, fontSize: 12, fontWeight: '700' },
  metricValue: { color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 7 },
  metricHint: { color: colors.textSoft, fontSize: 11, marginTop: 5 },
  module: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  moduleIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: colors.surfaceSoft, alignItems: 'center', justifyContent: 'center' },
  moduleCopy: { flex: 1 },
  moduleTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  moduleSubtitle: { color: colors.textSoft, fontSize: 12, marginTop: 3 },
  section: { gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
});
