import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { useSchool } from '../school/SchoolContext';
import { usersApi } from '../api/client';

type PendingUser = { id: string; first_name: string; last_name: string; email: string; role: string; created_at: string };

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  school_admin: 'School Admin',
  teacher: 'Teacher',
  registrar: 'Registrar',
  parent: 'Parent',
};

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { currentSchool } = useSchool();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'school_admin';

  const [pending, setPending] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!isAdmin) return Promise.resolve();
    return usersApi
      .listPending(currentSchool ? { school_id: currentSchool.id } : {})
      .then((res: { items?: PendingUser[] }) => setPending(res.items || []))
      .catch(() => setPending([]));
  }, [isAdmin, currentSchool]);

  useEffect(() => {
    if (!isAdmin) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [isAdmin, load]);

  async function handleApprove(id: string) {
    setBusyId(id);
    try {
      await usersApi.approve(id);
      setPending(list => list.filter(u => u.id !== id));
    } catch (err: any) {
      Alert.alert('Failed', err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string) {
    Alert.alert('Reject registration?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          setBusyId(id);
          try {
            await usersApi.reject(id);
            setPending(list => list.filter(u => u.id !== id));
          } catch (err: any) {
            Alert.alert('Failed', err.message);
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Text style={styles.roleValue}>{ROLE_LABELS[user?.role || ''] || user?.role}</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutBtnText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {isAdmin && (
        <>
          <Text style={styles.sectionTitle}>Pending Registrations</Text>
          <View style={styles.card}>
            {loading ? (
              <ActivityIndicator color="#4f46e5" />
            ) : pending.length === 0 ? (
              <Text style={styles.emptyInline}>No pending registration requests</Text>
            ) : (
              pending.map(u => (
                <View key={u.id} style={styles.pendingRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pendingName}>
                      {u.first_name} {u.last_name}
                    </Text>
                    <Text style={styles.pendingMeta}>
                      {u.email} · {ROLE_LABELS[u.role] || u.role}
                    </Text>
                  </View>
                  {busyId === u.id ? (
                    <ActivityIndicator color="#4f46e5" />
                  ) : (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(u.id)}>
                        <Text style={styles.approveBtnText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(u.id)}>
                        <Text style={styles.rejectBtnText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#334155', marginBottom: 8 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 20 },
  roleValue: { fontSize: 14, color: '#64748b', marginBottom: 16, textTransform: 'capitalize' },
  logoutBtn: { backgroundColor: '#fef2f2', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  logoutBtnText: { color: '#dc2626', fontWeight: '600' },
  emptyInline: { color: '#94a3b8', fontSize: 13 },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  pendingName: { fontWeight: '600', color: '#0f172a', fontSize: 14 },
  pendingMeta: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  approveBtn: { backgroundColor: '#16a34a', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  approveBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  rejectBtn: { backgroundColor: '#fef2f2', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  rejectBtnText: { color: '#dc2626', fontSize: 12, fontWeight: '600' },
});
