import { useState } from 'react';
import { Redirect, usePathname } from 'expo-router';
import { Drawer, DrawerContentScrollView, DrawerContentComponentProps } from 'expo-router/drawer';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../auth/AuthContext';
import { useSchool } from '../../school/SchoolContext';
import { visibleNavItems, canOpenPath } from '../../navigation/navItems';
import { ROLE_LABELS } from '../../utils/roleLabels';

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { user, logout } = useAuth();
  const { schools, currentSchool, setCurrentSchool } = useSchool();
  const [choosingSchool, setChoosingSchool] = useState(false);
  const items = visibleNavItems(user?.role);
  const currentRoute = props.state.routes[props.state.index]?.name;
  // Only the owner works across schools; everyone else belongs to one.
  const canSwitchSchool = user?.role === 'super_admin' && schools.length > 1;

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 0 }}>
      <View style={styles.header}>
        <Text style={styles.logo}>CampusDesk</Text>
        <Text style={styles.role}>{ROLE_LABELS[user?.role || ''] || user?.role}</Text>
        {currentSchool &&
          (canSwitchSchool ? (
            <TouchableOpacity
              style={styles.schoolBtn}
              accessibilityRole="button"
              accessibilityLabel={`School: ${currentSchool.name}. Switch school`}
              accessibilityState={{ expanded: choosingSchool }}
              onPress={() => setChoosingSchool(v => !v)}
            >
              <Ionicons name="school-outline" size={16} color="#4f46e5" />
              <Text style={styles.schoolName} numberOfLines={2}>
                {currentSchool.name}
              </Text>
              <Ionicons name={choosingSchool ? 'chevron-up' : 'chevron-down'} size={16} color="#64748b" />
            </TouchableOpacity>
          ) : (
            <View style={styles.schoolStatic}>
              <Ionicons name="school-outline" size={16} color="#64748b" />
              <Text style={styles.schoolName} numberOfLines={2}>
                {currentSchool.name}
              </Text>
            </View>
          ))}
        {canSwitchSchool && choosingSchool && (
          <View style={styles.schoolList}>
            {schools.map(sc => {
              const on = sc.id === currentSchool?.id;
              return (
                <TouchableOpacity
                  key={sc.id}
                  style={[styles.schoolOption, on && styles.schoolOptionOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    setCurrentSchool(sc);
                    setChoosingSchool(false);
                    props.navigation.closeDrawer();
                  }}
                >
                  <Text style={[styles.schoolOptionText, on && styles.schoolOptionTextOn]} numberOfLines={2}>
                    {sc.name}
                  </Text>
                  {on && <Ionicons name="checkmark" size={18} color="#4f46e5" />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
      {items.map(item => {
        const routeName = item.href === '/' ? 'index' : item.href.replace(/^\//, '');
        const active = currentRoute === routeName;
        return (
          <TouchableOpacity
            key={item.href}
            style={[styles.item, active && styles.itemActive]}
            onPress={() => {
              props.navigation.navigate(routeName);
              props.navigation.closeDrawer();
            }}
          >
            <Ionicons name={item.icon as never} size={20} color={active ? '#4f46e5' : '#64748b'} />
            <Text style={[styles.itemLabel, active && styles.itemLabelActive]}>{item.label}</Text>
            {item.status === 'planned' && (
              <View style={styles.soonBadge}>
                <Text style={styles.soonBadgeText}>Soon</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity style={styles.logoutRow} onPress={logout}>
        <Ionicons name="log-out-outline" size={20} color="#dc2626" />
        <Text style={styles.logoutLabel}>Sign out</Text>
      </TouchableOpacity>
    </DrawerContentScrollView>
  );
}

export default function AppLayout() {
  const { user } = useAuth();
  const pathname = usePathname();
  const items = visibleNavItems(user?.role);

  // Hiding a screen from the menu doesn't stop it being opened another way
  // (a deep link, a stale navigation state), so send the user home -- which
  // redirects each role to its own start screen -- same as the web's guard.
  if (user && !canOpenPath(pathname, user.role)) return <Redirect href="/" />;

  return (
    <Drawer drawerContent={props => <CustomDrawerContent {...props} />} screenOptions={{ headerTintColor: '#0f172a' }}>
      {items.map(item => {
        const routeName = item.href === '/' ? 'index' : item.href.replace(/^\//, '');
        return <Drawer.Screen key={item.href} name={routeName} options={{ title: item.label, drawerLabel: item.label }} />;
      })}
    </Drawer>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingVertical: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e2e8f0', marginBottom: 8 },
  logo: { fontSize: 18, fontWeight: '700', color: '#4f46e5' },
  role: { fontSize: 12, color: '#94a3b8', marginTop: 2, textTransform: 'capitalize' },
  schoolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    backgroundColor: '#eef2ff',
  },
  schoolStatic: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  schoolName: { flex: 1, fontSize: 13, fontWeight: '600', color: '#0f172a' },
  schoolList: { marginTop: 6, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  schoolOption: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 12, backgroundColor: '#fff' },
  schoolOptionOn: { backgroundColor: '#f8fafc' },
  schoolOptionText: { flex: 1, fontSize: 13, color: '#334155' },
  schoolOptionTextOn: { color: '#4f46e5', fontWeight: '600' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12 },
  itemActive: { backgroundColor: '#eef2ff' },
  itemLabel: { fontSize: 14, color: '#334155', flex: 1 },
  itemLabelActive: { color: '#4f46e5', fontWeight: '600' },
  soonBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  soonBadgeText: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },
  logoutRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, marginTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e2e8f0' },
  logoutLabel: { fontSize: 14, color: '#dc2626', fontWeight: '600' },
});
