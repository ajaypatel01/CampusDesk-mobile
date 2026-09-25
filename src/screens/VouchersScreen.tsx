import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useSchool } from '../school/SchoolContext';
import { vouchersApi } from '../api/client';

type Voucher = { id: string; date: string; account_name: string; payee: string; amount: number; description?: string; mode_of_payment: string };

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN');
}

export default function VouchersScreen() {
  const { currentSchool, loading: schoolLoading } = useSchool();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], account_name: '', payee: '', amount: '', description: '', mode_of_payment: 'Cash' });

  const load = useCallback(() => {
    if (!currentSchool) return Promise.resolve();
    return vouchersApi
      .list({ school_id: currentSchool.id, limit: 500 })
      .then((res: { items?: Voucher[] }) => setVouchers(res.items || []))
      .catch(() => setVouchers([]));
  }, [currentSchool]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const filtered = vouchers.filter(v => {
    if (!search) return true;
    const q = search.toLowerCase();
    return v.account_name.toLowerCase().includes(q) || (v.payee || '').toLowerCase().includes(q);
  });
  const total = filtered.reduce((s, v) => s + (v.amount || 0), 0);

  async function handleAdd() {
    if (!currentSchool || !form.account_name.trim() || !form.amount) {
      Alert.alert('Account name and amount are required');
      return;
    }
    setSaving(true);
    try {
      await vouchersApi.create({ ...form, school_id: currentSchool.id, amount: parseInt(form.amount, 10) });
      setShowForm(false);
      setForm({ date: new Date().toISOString().split('T')[0], account_name: '', payee: '', amount: '', description: '', mode_of_payment: 'Cash' });
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
        <TextInput style={styles.searchInput} placeholder="Search vouchers..." value={search} onChangeText={setSearch} />
        <TouchableOpacity onPress={() => setShowForm(s => !s)}>
          <Text style={styles.addLink}>{showForm ? 'Cancel' : '+ Add'}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.total}>Total: {inr(total)}</Text>

      {showForm && (
        <View style={styles.formCard}>
          <TextInput style={styles.input} placeholder="Account Name *" value={form.account_name} onChangeText={v => setForm(f => ({ ...f, account_name: v }))} />
          <TextInput style={styles.input} placeholder="Payee" value={form.payee} onChangeText={v => setForm(f => ({ ...f, payee: v }))} />
          <TextInput style={styles.input} placeholder="Amount *" value={form.amount} onChangeText={v => setForm(f => ({ ...f, amount: v }))} keyboardType="numeric" />
          <TextInput style={styles.input} placeholder="Description" value={form.description} onChangeText={v => setForm(f => ({ ...f, description: v }))} />
          <TouchableOpacity style={styles.saveBtn} onPress={handleAdd} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Voucher</Text>}
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={v => v.id}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          ListEmptyComponent={<Text style={styles.emptyText}>No vouchers found</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.account_name}</Text>
                <Text style={styles.meta}>
                  {fmtDate(item.date)} · {item.payee || '-'} · {item.mode_of_payment}
                </Text>
              </View>
              <Text style={styles.amount}>{inr(item.amount)}</Text>
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
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, marginBottom: 4 },
  searchInput: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', fontSize: 14 },
  addLink: { color: '#4f46e5', fontWeight: '600', fontSize: 13 },
  total: { marginHorizontal: 16, color: '#16a34a', fontWeight: '700', marginBottom: 8 },
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
  name: { fontWeight: '600', color: '#0f172a', fontSize: 14 },
  meta: { color: '#94a3b8', fontSize: 12, marginTop: 1 },
  amount: { fontWeight: '700', color: '#0f172a' },
});
