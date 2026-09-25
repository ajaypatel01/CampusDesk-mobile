import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSchool } from '../school/SchoolContext';
import { booksApi } from '../api/client';

type Book = { id: string; title: string; author?: string; subject?: string; price: number };

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

export default function BooksScreen() {
  const { currentSchool, loading: schoolLoading } = useSchool();
  const [books, setBooks] = useState<Book[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', author: '', subject: '', price: '' });

  const load = useCallback(() => {
    if (!currentSchool) return Promise.resolve();
    return booksApi
      .listBooks({ school_id: currentSchool.id, limit: 500 })
      .then((res: { items?: Book[] }) => setBooks(res.items || []))
      .catch(() => setBooks([]));
  }, [currentSchool]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const filtered = books.filter(b => !search || b.title.toLowerCase().includes(search.toLowerCase()));

  async function handleAdd() {
    if (!currentSchool || !form.title.trim()) {
      Alert.alert('Title is required');
      return;
    }
    setSaving(true);
    try {
      await booksApi.createBook({ ...form, school_id: currentSchool.id, price: parseInt(form.price, 10) || 0 });
      setShowForm(false);
      setForm({ title: '', author: '', subject: '', price: '' });
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
      <View style={styles.headerRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color="#94a3b8" />
          <TextInput style={styles.searchInput} placeholder="Search books..." value={search} onChangeText={setSearch} />
        </View>
        <TouchableOpacity onPress={() => setShowForm(s => !s)}>
          <Text style={styles.addLink}>{showForm ? 'Cancel' : '+ Add'}</Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={styles.formCard}>
          <TextInput style={styles.input} placeholder="Title *" value={form.title} onChangeText={v => setForm(f => ({ ...f, title: v }))} />
          <TextInput style={styles.input} placeholder="Author" value={form.author} onChangeText={v => setForm(f => ({ ...f, author: v }))} />
          <TextInput style={styles.input} placeholder="Subject" value={form.subject} onChangeText={v => setForm(f => ({ ...f, subject: v }))} />
          <TextInput style={styles.input} placeholder="Price" value={form.price} onChangeText={v => setForm(f => ({ ...f, price: v }))} keyboardType="numeric" />
          <TouchableOpacity style={styles.saveBtn} onPress={handleAdd} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Book</Text>}
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={b => b.id}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          ListEmptyComponent={<Text style={styles.emptyText}>No books found</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.meta}>
                  {item.author || '-'} {item.subject ? `· ${item.subject}` : ''}
                </Text>
              </View>
              <Text style={styles.price}>{inr(item.price)}</Text>
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
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, marginBottom: 8 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  searchInput: { flex: 1, fontSize: 14 },
  addLink: { color: '#4f46e5', fontWeight: '600', fontSize: 13 },
  formCard: { backgroundColor: '#fff', borderRadius: 10, padding: 16, marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', gap: 8 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  saveBtn: { backgroundColor: '#4f46e5', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
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
  },
  title: { fontWeight: '600', color: '#0f172a', fontSize: 14 },
  meta: { color: '#94a3b8', fontSize: 12, marginTop: 1 },
  price: { fontWeight: '700', color: '#0f172a' },
});
