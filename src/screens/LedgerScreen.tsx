import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, ActivityIndicator } from 'react-native';
import { useSchool } from '../school/SchoolContext';
import { feesApi } from '../api/client';

type Payment = {
  id: string;
  fee_type: string;
  amount: number;
  payment_date: string;
  payment_mode: string;
  student_name: string;
  student_code: string;
};

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}
function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export default function LedgerScreen() {
  const { currentSchool, currentYear, loading: schoolLoading } = useSchool();
  const [date, setDate] = useState(todayISO());
  const [payments, setPayments] = useState<Payment[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentSchool || !currentYear) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern
    setLoading(true);
    feesApi
      .listAccounts({ school_id: currentSchool.id, academic_year_id: currentYear.id, limit: 2000 })
      .then((res: { items?: { id: string; student_name: string; student_code: string }[] }) => {
        const accounts = res.items || [];
        return Promise.all(
          accounts.map(a =>
            feesApi
              .listPayments(a.id)
              .then((r: { items?: Payment[] }) =>
                (r.items || []).map(p => ({ ...p, student_name: a.student_name, student_code: a.student_code }))
              )
              .catch(() => [] as Payment[])
          )
        );
      })
      .then(results => setPayments(results.flat().filter(p => p.payment_date.startsWith(date))))
      .catch(() => setPayments([]))
      .finally(() => setLoading(false));
  }, [currentSchool, currentYear, date]);

  const filtered = payments.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.student_name.toLowerCase().includes(q) || p.student_code.toLowerCase().includes(q);
  });
  const total = filtered.reduce((sum, p) => sum + p.amount, 0);

  if (schoolLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.headerCard}>
        <TextInput style={styles.dateInput} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
        <Text style={styles.total}>{inr(total)}</Text>
      </View>
      <TextInput style={styles.searchInput} placeholder="Search student..." value={search} onChangeText={setSearch} />

      {loading ? (
        <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={p => p.id}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          ListEmptyComponent={<Text style={styles.emptyText}>No payments on this date</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.student_name}</Text>
                <Text style={styles.meta}>
                  {item.student_code} · {item.fee_type} · {item.payment_mode}
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
  headerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dateInput: { fontSize: 14, flex: 1 },
  total: { fontSize: 16, fontWeight: '700', color: '#16a34a' },
  searchInput: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    fontSize: 14,
  },
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
  meta: { color: '#94a3b8', fontSize: 12, marginTop: 1, textTransform: 'capitalize' },
  amount: { fontWeight: '700', color: '#16a34a', fontSize: 14 },
});
