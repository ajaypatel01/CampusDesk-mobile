import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSchool } from '../school/SchoolContext';
import { studentsApi, Student } from '../api/client';

export default function StudentsListScreen() {
  const router = useRouter();
  const { currentSchool, currentYear, loading: schoolLoading } = useSchool();
  const [students, setStudents] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    if (!currentSchool) return Promise.resolve();
    return studentsApi
      .list({ school_id: currentSchool.id, academic_year_id: currentYear?.id, search: search || undefined, limit: 50 })
      .then((res: { items?: Student[]; total?: number }) => {
        setStudents(res.items || []);
        setTotal(res.total || 0);
      })
      .catch(() => setStudents([]));
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
        <TextInput
          style={styles.searchInput}
          placeholder="Search name or scholar no..."
          value={search}
          onChangeText={setSearch}
        />
      </View>
      <Text style={styles.count}>{total} students</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={students}
          keyExtractor={s => s.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ padding: 16, paddingTop: 0 }}
          ListEmptyComponent={<Text style={styles.emptyText}>No students found</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => router.push(`/students/${item.id}`)}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {item.first_name[0]}
                  {item.last_name[0]}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {item.first_name} {item.last_name}
                </Text>
                <Text style={styles.code}>{item.student_code}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: item.status === 'active' ? '#dcfce7' : '#f1f5f9' }]}>
                <Text style={[styles.badgeText, { color: item.status === 'active' ? '#16a34a' : '#64748b' }]}>{item.status}</Text>
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
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#4f46e5', fontWeight: '700', fontSize: 13 },
  name: { fontWeight: '600', color: '#0f172a', fontSize: 14 },
  code: { color: '#94a3b8', fontSize: 12, marginTop: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginRight: 4 },
  badgeText: { fontSize: 11, fontWeight: '600' },
});
