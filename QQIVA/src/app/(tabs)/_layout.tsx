import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0797E8',
        tabBarInactiveTintColor: '#93A2B5',
        tabBarHideOnKeyboard: true,
        tabBarStyle: s.tabBar,
        tabBarLabelStyle: s.label,
        tabBarIconStyle: s.icon,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Trang chủ',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="home-outline" color={color} size={size + 2} />,
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          title: 'Chứng từ',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="file-document-outline" color={color} size={size + 1} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Quét QR',
          tabBarIcon: () => (
            <View style={s.qrCircle}>
              <MaterialCommunityIcons name="qrcode-scan" color="#fff" size={27} />
            </View>
          ),
          tabBarItemStyle: s.qrItem,
          tabBarLabelStyle: s.qrLabel,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Báo cáo',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="chart-bar" color={color} size={size + 1} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Cá nhân',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account-outline" color={color} size={size + 2} />,
        }}
      />
    </Tabs>
  );
}

const s = StyleSheet.create({
  tabBar: {
    height: 82,
    paddingTop: 9,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: '#E1E8F0',
    backgroundColor: '#FFFFFF',
    shadowColor: '#1F3349',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  label: { fontSize: 11, fontWeight: '900', marginTop: 2 },
  icon: { marginTop: 1 },
  qrItem: { marginTop: -12 },
  qrCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#0797E8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: '#F7F9FD',
    shadowColor: '#0797E8',
    shadowOpacity: 0.28,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  qrLabel: { fontSize: 11, fontWeight: '900', marginTop: 8 },
});
