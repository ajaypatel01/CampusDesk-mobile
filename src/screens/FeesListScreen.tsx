import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSchool } from '../school/SchoolContext';
import { feesApi } from '../api/client';

type FeeAccount = {
  id: string;
  student_name: string;
  student_code: string;
  grade_level_name: string;
  total_due: number;
  total_paid: number;
  balance_remaining: number;
};

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

export default function FeesListScreen() {
  const router = useRouter();
  const { currentSchool, currentYear, loading: schoolLoading } = useSchool();
  const [accounts, setAccounts] = useState<FeeAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    if (!currentSchool || !currentYear) return Promise.resolve();
    return feesApi
      .listAccounts({ school_id: currentSchool.id, academic_year_id: currentYear.id, search: search || undefined, limit: 50 })
      .then((res: { items?: FeeAccount[]; total?: number }) => {
        setAccounts(res.items || []);
        setTotal(res.total || 0);
      })
      .catch(() => setAccounts([]));
  }, [currentSchool, currentYear, search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount/on-search-change
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (schoolLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color="#94a3b8" />
        <TextInput style={styles.searchInput} placeholder="Search student..." value={search} onChangeText={setSearch} />
      </View>
      <Text style={styles.count}>{total} fee accounts</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={accounts}
          keyExtractor={a => a.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ padding: 16, paddingTop: 0 }}
          ListEmptyComponent={<Text style={styles.emptyText}>No fee accounts found</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => router.push(`/fees/${item.id}`)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.student_name}</Text>
                <Text style={styles.code}>
                  {item.student_code} · {item.grade_level_name}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.balance, { color: item.balance_remaining > 0 ? '#dc2626' : '#16a34a' }]}>
                  {inr(item.balance_remaining)}
                </Text>
                <Text style={styles.dueLabel}>balance</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: { flex: 1, fontSize: 14 },
  count: { color: '#94a3b8', fontSize: 12, marginLeft: 16, marginBottom: 8 },
  emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  name: { fontWeight: '600', color: '#0f172a', fontSize: 14 },
  code: { color: '#94a3b8', fontSize: 12, marginTop: 1 },
  balance: { fontWeight: '700', fontSize: 14 },
  dueLabel: { color: '#94a3b8', fontSize: 11 },
});
