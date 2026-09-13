import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
type ToolTone = 'blue' | 'cyan' | 'orange' | 'purple' | 'slate' | 'red' | 'pink' | 'brown' | 'green' | 'indigo' | 'teal';

type Tool = {
  title: string;
  subtitle: string;
  icon: IconName;
  tone: ToolTone;
  badge?: string;
  onPress: () => void;
};

const toneMap: Record<ToolTone, { bg: string; fg: string }> = {
  blue: { bg: '#E6F4FF', fg: '#0797E8' },
  cyan: { bg: '#E5FBF7', fg: '#08B6A8' },
  orange: { bg: '#FFF3DB', fg: '#FF9518' },
  purple: { bg: '#F3E8FF', fg: '#9A42E9' },
  slate: { bg: '#EEF3F9', fg: '#6A7F9A' },
  red: { bg: '#FFF0F1', fg: '#F05C68' },
  pink: { bg: '#FFF0F7', fg: '#E44796' },
  brown: { bg: '#FFF2E7', fg: '#C9731E' },
  green: { bg: '#EAF8EE', fg: '#2C9C5A' },
  indigo: { bg: '#EDF0FF', fg: '#5E72D8' },
  teal: { bg: '#E7F8F6', fg: '#1D9B8A' },
};

export default function Home() {
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const scrollRef = useRef<ScrollView>(null);
  const toolsAnchorY = useRef(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const quickTools: Tool[] = [
    {
      title: 'Hóa đơn - Báo giá chuyên nghiệp',
      subtitle: '5 bước • Đầy đủ thông tin\n• Xuất đẹp',
      icon: 'file-document-outline',
      tone: 'blue',
      onPress: () => router.push('/professional-studio'),
    },
    {
      title: 'Đo trực tiếp',
      subtitle: 'Đo tại công trình\n• Xuất hóa đơn',
      icon: 'ruler-square',
      tone: 'cyan',
      onPress: () => router.push('/measurements'),
    },
    {
      title: 'Hóa đơn nhanh',
      subtitle: 'Tạo nhanh qua\nthư viện có sẵn',
      icon: 'lightning-bolt-outline',
      tone: 'orange',
      onPress: () => router.push({ pathname: '/quick-document', params: { kind: 'invoice' } }),
    },
    {
      title: 'Báo giá nhanh',
      subtitle: 'Tạo nhanh qua\nthư viện có sẵn',
      icon: 'tag-outline',
      tone: 'purple',
      onPress: () => router.push({ pathname: '/quick-document', params: { kind: 'quote' } }),
    },
  ];

  const mainTools: Tool[] = [
    {
      title: 'Hóa đơn thông minh',
      subtitle: 'Ảnh bảng đo → AI hỗ trợ\n→ Hóa đơn',
      icon: 'file-document-edit-outline',
      tone: 'blue',
      badge: 'AI',
      onPress: () => router.push({ pathname: '/smart-document', params: { mode: 'invoice', new: '1' } }),
    },
    {
      title: 'Báo giá thông minh',
      subtitle: 'Bản vẽ/3D → AI hỗ trợ\n→ Báo giá',
      icon: 'file-document-edit-outline',
      tone: 'purple',
      badge: 'AI',
      onPress: () => router.push({ pathname: '/smart-document', params: { mode: 'quote', new: '1' } }),
    },
    {
      title: 'Hợp đồng',
      subtitle: 'Mẫu • Tải lên • Tự soạn',
      icon: 'file-document-outline',
      tone: 'slate',
      onPress: () => router.push('/contracts'),
    },
    {
      title: 'Sản phẩm',
      subtitle: 'Mẫu • Ảnh • Đơn giá',
      icon: 'briefcase-outline',
      tone: 'red',
      onPress: () => router.push('/products'),
    },
    {
      title: 'Sổ thu chi cá nhân',
      subtitle: 'Thu • Chi • Báo cáo',
      icon: 'wallet-outline',
      tone: 'pink',
      onPress: () => router.push({ pathname: '/finance', params: { book: 'PERSONAL' } }),
    },
    {
      title: 'Sổ thu chi công việc',
      subtitle: 'Thu • Chi • Theo dự án',
      icon: 'briefcase-outline',
      tone: 'brown',
      onPress: () => router.push({ pathname: '/finance', params: { book: 'BUSINESS' } }),
    },
  ];

  const manageTools: Tool[] = [
    { title: 'Công trình', subtitle: 'Khách hàng • Hồ sơ • Tiến độ', icon: 'office-building-outline', tone: 'teal', onPress: () => router.push('/customers-projects') },
    { title: 'Chứng từ', subtitle: 'Báo giá • Hóa đơn đã lưu', icon: 'file-document-multiple-outline', tone: 'indigo', onPress: () => router.push('/documents') },
    { title: 'Công nợ', subtitle: 'Thanh toán • Còn phải thu', icon: 'cash-multiple', tone: 'green', onPress: () => router.push('/payments') },
    { title: 'Thu ngân / POS', subtitle: 'Quét hàng • Giỏ • Thanh toán', icon: 'cash-register', tone: 'orange', onPress: () => router.push('/retail') },
    { title: 'Cửa hàng / Kho', subtitle: 'SKU • Barcode • Tồn kho', icon: 'storefront-outline', tone: 'cyan', onPress: () => router.push('/inventory') },
    { title: 'Tổng quan', subtitle: 'Doanh thu • Công nợ • Công trình', icon: 'chart-bar', tone: 'blue', onPress: () => router.push('/reports') },
  ];

  return (
    <SafeAreaView edges={['top']} style={s.safe}>
      <View style={s.headerShell}>
        <View style={s.headerInner}>
          <View style={s.wordmark}>
            <QQIVALogo />
            <Text style={s.wordmarkText}>QQIVA</Text>
          </View>
          <View style={s.systemActions}>
            <View style={s.languageButton}><Text style={s.languageText}>VI⌄</Text></View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Mở menu" onPress={() => setMenuOpen(true)} style={s.menuButton}>
              <MaterialCommunityIcons name="menu" size={24} color="#49627D" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={s.scroll}
        contentContainerStyle={[s.content, wide && s.contentWide]}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.welcome}>
          <View style={{ flex: 1 }}>
            <Text style={s.welcomeTitle}>Xin chào!</Text>
            <Text style={s.welcomeText}>Hôm nay là một ngày tuyệt vời để tạo thêm{wide ? ' ' : '\n'}giá trị cho doanh nghiệp của bạn.</Text>
          </View>
          <View style={s.welcomeArt}>
            <MaterialCommunityIcons name="chart-box-outline" size={50} color="#0797E8" />
            <MaterialCommunityIcons name="arrow-top-right-thick" size={25} color="#0797E8" style={s.welcomeArrow} />
          </View>
        </View>

        <SectionHeader
          title="Làm việc nhanh"
          action="Xem tất cả"
          onAction={() => scrollRef.current?.scrollTo({ y: toolsAnchorY.current, animated: true })}
        />
        <View style={[s.quickGrid, wide && s.twoColumns]}>
          {quickTools.map(tool => <HomeToolCard key={tool.title} tool={tool} wide={wide} />)}
        </View>

        <View onLayout={e => { toolsAnchorY.current = e.nativeEvent.layout.y; }}>
          <SectionHeader title="Công cụ khác" />
        </View>
        <View style={[s.toolGrid, wide && s.twoColumns]}>
          {mainTools.map(tool => <HomeToolCard key={tool.title} tool={tool} compact wide={wide} />)}
        </View>

        <SectionHeader title="Quản lý" />
        <View style={[s.toolGrid, wide && s.twoColumns]}>
          {manageTools.map(tool => <HomeToolCard key={tool.title} tool={tool} compact wide={wide} />)}
        </View>
      </ScrollView>

      <MenuSheet visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </SafeAreaView>
  );
}

function QQIVALogo() {
  return (
    <View style={s.logoMark}>
      <View style={[s.logoRing, s.logoRingBlue]} />
      <View style={[s.logoRing, s.logoRingPurple]} />
      <View style={s.logoStar}><MaterialCommunityIcons name="star-four-points" size={14} color="#A855F7" /></View>
    </View>
  );
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={s.sectionHead}>
      <Text style={s.sectionTitle}>{title}</Text>
      {action ? (
        <TouchableOpacity onPress={onAction} style={s.sectionAction}>
          <Text style={s.sectionActionText}>{action}</Text>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#0797E8" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function HomeToolCard({ tool, compact = false, wide = false }: { tool: Tool; compact?: boolean; wide?: boolean }) {
  const tone = toneMap[tool.tone];
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={tool.onPress}
      activeOpacity={0.78}
      style={[
        s.toolCard,
        compact ? s.toolCardCompact : s.toolCardQuick,
        wide && s.toolCardWide,
      ]}
    >
      {tool.badge ? <Text style={[s.badge, { color: tone.fg, backgroundColor: tone.bg }]}>{tool.badge}</Text> : null}
      <View style={[s.toolIcon, compact && s.toolIconCompact, { backgroundColor: tone.bg }]}>
        <MaterialCommunityIcons name={tool.icon} size={compact ? 27 : 31} color={tone.fg} />
      </View>
      <View style={s.toolCopy}>
        <Text style={[s.toolTitle, compact && s.toolTitleCompact]}>{tool.title}</Text>
        <Text style={s.toolSubtitle}>{tool.subtitle}</Text>
      </View>
      {compact ? <MaterialCommunityIcons name="chevron-right" size={24} color="#9AA8B9" /> : null}
    </TouchableOpacity>
  );
}

function MenuSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const go = (path: '/company' | '/backup' | '/audit' | '/settings' | '/profile') => {
    onClose();
    router.push(path);
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.modalBackdrop} onPress={onClose}>
        <Pressable style={s.menuSheet} onPress={() => {}}>
          <View style={s.menuSheetHead}><Text style={s.menuSheetTitle}>Menu QQIVA</Text><TouchableOpacity onPress={onClose}><MaterialCommunityIcons name="close" size={24} color={colors.text} /></TouchableOpacity></View>
          <MenuRow icon="office-building-cog-outline" title="Hồ sơ công ty" onPress={() => go('/company')} />
          <MenuRow icon="database-sync-outline" title="Sao lưu / khôi phục" onPress={() => go('/backup')} />
          <MenuRow icon="stethoscope" title="Kiểm tra hệ thống" onPress={() => go('/audit')} />
          <MenuRow icon="cog-outline" title="Cài đặt" onPress={() => go('/settings')} />
          <MenuRow icon="account-cog-outline" title="Cá nhân" onPress={() => go('/profile')} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MenuRow({ icon, title, onPress }: { icon: IconName; title: string; onPress: () => void }) {
  return <TouchableOpacity onPress={onPress} style={s.menuRow}><MaterialCommunityIcons name={icon} size={22} color={colors.primary} /><Text style={s.menuRowText}>{title}</Text><MaterialCommunityIcons name="chevron-right" size={22} color={colors.textSoft} /></TouchableOpacity>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F9FD' },
  headerShell: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5EBF2' },
  headerInner: { minHeight: 74, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 1080, alignSelf: 'center' },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  wordmarkText: { fontSize: 25, fontWeight: '900', letterSpacing: 2.5, color: '#07172B' },
  logoMark: { width: 66, height: 42, position: 'relative' },
  logoRing: { position: 'absolute', top: 7, width: 34, height: 34, borderRadius: 17, borderWidth: 8, backgroundColor: 'transparent' },
  logoRingBlue: { left: 0, borderColor: '#13B7E4' },
  logoRingPurple: { left: 25, borderColor: '#7659FF' },
  logoStar: { position: 'absolute', right: 1, top: 0 },
  systemActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  languageButton: { minWidth: 58, height: 48, borderRadius: 15, borderWidth: 1, borderColor: '#DFE7F0', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  languageText: { fontSize: 14, fontWeight: '900', color: '#526A84' },
  menuButton: { width: 48, height: 48, borderRadius: 15, borderWidth: 1, borderColor: '#DFE7F0', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 22, paddingBottom: 135, gap: 20, width: '100%', maxWidth: 1080, alignSelf: 'center' },
  contentWide: { paddingHorizontal: 28 },
  welcome: { minHeight: 150, borderRadius: 28, backgroundColor: '#F0F8FF', overflow: 'hidden', paddingHorizontal: 22, paddingVertical: 24, flexDirection: 'row', alignItems: 'center', gap: 12 },
  welcomeTitle: { fontSize: 30, fontWeight: '900', color: '#07172B', marginBottom: 8 },
  welcomeText: { fontSize: 17, lineHeight: 25, fontWeight: '600', color: '#7B8BA1' },
  welcomeArt: { width: 102, height: 102, borderRadius: 26, backgroundColor: '#FFFFFFAA', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  welcomeArrow: { position: 'absolute', right: 15, top: 19 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  sectionTitle: { color: '#07172B', fontSize: 26, fontWeight: '900' },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionActionText: { color: '#0797E8', fontSize: 15, fontWeight: '900' },
  quickGrid: { gap: 12 },
  toolGrid: { gap: 12 },
  twoColumns: { flexDirection: 'row', flexWrap: 'wrap' },
  toolCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DEE6EF', borderRadius: 22, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 14, shadowColor: '#23344A', shadowOpacity: 0.055, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2, position: 'relative' },
  toolCardQuick: { minHeight: 128 },
  toolCardCompact: { minHeight: 104 },
  toolCardWide: { width: '49.35%' },
  toolIcon: { width: 76, height: 76, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  toolIconCompact: { width: 58, height: 58, borderRadius: 16 },
  toolCopy: { flex: 1, minWidth: 0 },
  toolTitle: { color: '#07172B', fontSize: 18, fontWeight: '900', lineHeight: 24 },
  toolTitleCompact: { fontSize: 16, lineHeight: 21 },
  toolSubtitle: { color: '#8A98AA', fontSize: 14, fontWeight: '600', lineHeight: 20, marginTop: 3 },
  badge: { position: 'absolute', right: 10, top: 8, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontWeight: '900' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(9,24,40,.36)', justifyContent: 'flex-end' },
  menuSheet: { backgroundColor: '#F7F9FD', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 34, gap: 10 },
  menuSheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  menuSheetTitle: { fontSize: 20, fontWeight: '900', color: colors.text },
  menuRow: { minHeight: 58, borderRadius: 15, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuRowText: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.text },
});
