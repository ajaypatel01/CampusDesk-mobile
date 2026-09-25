import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSchool } from '../school/SchoolContext';
import { usersApi } from '../api/client';

type UserRow = { id: string; first_name: string; last_name: string; email: string; role: string; status: string };

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  school_admin: 'School Admin',
  teacher: 'Teacher',
  registrar: 'Registrar',
  parent: 'Parent',
};

export default function TeachersScreen() {
  const { currentSchool, loading: schoolLoading } = useSchool();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentSchool) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern
    setLoading(true);
    usersApi
      .list({ school_id: currentSchool.id, limit: 500 })
      .then((res: { items?: UserRow[] }) => setUsers((res.items || []).filter(u => u.role !== 'parent')))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [currentSchool]);

  const filtered = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

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
        <TextInput style={styles.searchInput} placeholder="Search name or email..." value={search} onChangeText={setSearch} />
      </View>
      <Text style={styles.count}>{filtered.length} staff</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={u => u.id}
          contentContainerStyle={{ padding: 16, paddingTop: 0 }}
          ListEmptyComponent={<Text style={styles.emptyText}>No staff found</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
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
                <Text style={styles.email}>{item.email}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{ROLE_LABELS[item.role] || item.role}</Text>
              </View>
            </View>
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
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#4f46e5', fontWeight: '700', fontSize: 13 },
  name: { fontWeight: '600', color: '#0f172a', fontSize: 14 },
  email: { color: '#94a3b8', fontSize: 12, marginTop: 1 },
  badge: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#334155' },
});
