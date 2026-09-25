import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useSchool } from '../school/SchoolContext';
import { payrollApi } from '../api/client';
import { downloadAndShare } from '../utils/downloadAndShare';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

type MonthRow = {
  user_id: string;
  first_name: string;
  last_name: string;
  designation?: string;
  monthly_salary: number;
  deduction: number;
  net_salary: number;
};

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

export default function PayrollScreen() {
  const { currentSchool, currentYear, loading: schoolLoading } = useSchool();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [rows, setRows] = useState<MonthRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!currentSchool || !currentYear) return Promise.resolve();
    return payrollApi
      .computeMonth({ school_id: currentSchool.id, academic_year_id: currentYear.id, year, month })
      .then((res: { items?: MonthRow[] }) => setRows(res.items || []))
      .catch(() => setRows([]));
  }, [currentSchool, currentYear, year, month]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function handleDownloadSlip(userId: string) {
    if (!currentSchool || !currentYear) return;
    try {
      const blob = await payrollApi.downloadSlip({ school_id: currentSchool.id, academic_year_id: currentYear.id, user_id: userId, year, month });
      await downloadAndShare(blob, `salary_slip_${userId.slice(0, 8)}.pdf`);
    } catch (err: any) {
      Alert.alert('Failed to download', err.message);
    }
  }

  const totalNet = rows.reduce((s, r) => s + r.net_salary, 0);

  if (schoolLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.pickerRow}>
        <View style={[styles.pickerWrap, { flex: 2 }]}>
          <Picker selectedValue={month} onValueChange={setMonth}>
            {MONTHS.map((m, i) => (
              <Picker.Item key={m} label={m} value={i + 1} />
            ))}
          </Picker>
        </View>
        <View style={[styles.pickerWrap, { flex: 1 }]}>
          <Picker selectedValue={year} onValueChange={setYear}>
            {[year - 1, year, year + 1].map(y => (
              <Picker.Item key={y} label={String(y)} value={y} />
            ))}
          </Picker>
        </View>
      </View>
      <Text style={styles.total}>Total Net Payroll: {inr(totalNet)}</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={r => r.user_id}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          ListEmptyComponent={<Text style={styles.emptyText}>No staff to compute payroll for</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => handleDownloadSlip(item.user_id)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {item.first_name} {item.last_name}
                </Text>
                <Text style={styles.meta}>{item.designation || '-'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.net}>{inr(item.net_salary)}</Text>
                <Text style={styles.deduction}>-{inr(item.deduction)} deducted</Text>
              </View>
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
  pickerRow: { flexDirection: 'row', gap: 8, margin: 16, marginBottom: 4 },
  pickerWrap: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  total: { marginHorizontal: 16, color: '#16a34a', fontWeight: '700', marginBottom: 8 },
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
  net: { fontWeight: '700', color: '#0f172a', fontSize: 14 },
  deduction: { color: '#dc2626', fontSize: 11, marginTop: 1 },
});
