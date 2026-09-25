import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSchool } from '../school/SchoolContext';
import { tcRecordsApi } from '../api/client';

type TCRecord = {
  id: string;
  scholar_number?: string;
  student_name: string;
  class_passed?: string;
  new_school?: string;
  issue_date?: string;
};

export default function TCRecordsScreen() {
  const { currentSchool, loading: schoolLoading } = useSchool();
  const [records, setRecords] = useState<TCRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ scholar_number: '', student_name: '', class_passed: '', new_school: '' });

  const load = useCallback(() => {
    if (!currentSchool) return Promise.resolve();
    return tcRecordsApi
      .list({ school_id: currentSchool.id, limit: 50 })
      .then((res: { items?: TCRecord[]; total?: number }) => {
        const q = search.trim().toLowerCase();
        const items = q
          ? (res.items || []).filter(r => r.student_name.toLowerCase().includes(q) || (r.scholar_number || '').toLowerCase().includes(q))
          : res.items || [];
        setRecords(items);
        setTotal(res.total || 0);
      })
      .catch(() => setRecords([]));
  }, [currentSchool, search]);

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

  async function handleAdd() {
    if (!currentSchool || !form.student_name.trim()) {
      Alert.alert('Student name is required');
      return;
    }
    setSaving(true);
    try {
      await tcRecordsApi.create({ ...form, school_id: currentSchool.id });
      setShowForm(false);
      setForm({ scholar_number: '', student_name: '', class_passed: '', new_school: '' });
      await load();
    } catch (err: any) {
      Alert.alert('Failed to add', err.message);
    } finally {
      setSaving(false);
    }
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
        <TextInput style={styles.searchInput} placeholder="Search name or scholar no..." value={search} onChangeText={setSearch} />
      </View>
      <View style={styles.headerRow}>
        <Text style={styles.count}>{total} TC records</Text>
        <TouchableOpacity onPress={() => setShowForm(s => !s)}>
          <Text style={styles.addLink}>{showForm ? 'Cancel' : '+ Add TC'}</Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={styles.formCard}>
          <TextInput style={styles.input} placeholder="Scholar Number" value={form.scholar_number} onChangeText={v => setForm(f => ({ ...f, scholar_number: v }))} />
          <TextInput style={styles.input} placeholder="Student Name *" value={form.student_name} onChangeText={v => setForm(f => ({ ...f, student_name: v }))} />
          <TextInput style={styles.input} placeholder="Class Passed" value={form.class_passed} onChangeText={v => setForm(f => ({ ...f, class_passed: v }))} />
          <TextInput style={styles.input} placeholder="New School" value={form.new_school} onChangeText={v => setForm(f => ({ ...f, new_school: v }))} />
          <TouchableOpacity style={styles.saveBtn} onPress={handleAdd} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save TC</Text>}
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={records}
          keyExtractor={r => r.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ padding: 16, paddingTop: 0 }}
          ListEmptyComponent={<Text style={styles.emptyText}>No TC records found</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.student_name}</Text>
                <Text style={styles.meta}>
                  {item.scholar_number || '-'} · {item.class_passed || '-'}
                </Text>
              </View>
              <Text style={styles.school}>{item.new_school || '-'}</Text>
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, marginBottom: 8 },
  count: { color: '#94a3b8', fontSize: 12 },
  addLink: { color: '#4f46e5', fontWeight: '600', fontSize: 13 },
  formCard: { backgroundColor: '#fff', borderRadius: 10, padding: 16, marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', gap: 8 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  saveBtn: { backgroundColor: '#4f46e5', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: '#fff', fontWeight: '600' },
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
  meta: { color: '#94a3b8', fontSize: 12, marginTop: 1 },
  school: { color: '#334155', fontSize: 12, maxWidth: 120, textAlign: 'right' },
});
