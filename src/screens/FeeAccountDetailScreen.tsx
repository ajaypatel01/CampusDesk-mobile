import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { feesApi } from '../api/client';

type FeeAccount = {
  id: string;
  student_name: string;
  student_code: string;
  grade_level_name: string;
  tuition_fee: number;
  discount_amount: number;
  van_fee: number;
  previous_year_dues: number;
  total_due: number;
  total_paid: number;
  balance_remaining: number;
};

type Payment = {
  id: string;
  fee_type: string;
  amount: number;
  payment_date: string;
  payment_mode: string;
};

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

export default function FeeAccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [account, setAccount] = useState<FeeAccount | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ fee_type: 'tuition', amount: '', payment_mode: 'cash' });

  const load = useCallback(() => {
    if (!id) return Promise.resolve();
    return Promise.all([
      feesApi.getAccount(id).then(setAccount).catch(() => setAccount(null)),
      feesApi
        .listPayments(id)
        .then((res: { items?: Payment[] }) => setPayments(res.items || []))
        .catch(() => setPayments([])),
    ]);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function handleRecordPayment() {
    if (!id) return;
    const amount = parseInt(form.amount, 10);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid payment amount');
      return;
    }
    setSaving(true);
    try {
      await feesApi.recordPayment({
        student_fee_account_id: id,
        fee_type: form.fee_type,
        amount,
        payment_mode: form.payment_mode,
      });
      setShowForm(false);
      setForm({ fee_type: 'tuition', amount: '', payment_mode: 'cash' });
      await load();
    } catch (err: any) {
      Alert.alert('Payment failed', err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }
  if (!account) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Fee account not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.name}>{account.student_name}</Text>
        <Text style={styles.code}>
          {account.student_code} · {account.grade_level_name}
        </Text>
        <View style={styles.summaryGrid}>
          <SummaryItem label="Total Due" value={inr(account.total_due)} />
          <SummaryItem label="Total Paid" value={inr(account.total_paid)} color="#16a34a" />
          <SummaryItem label="Balance" value={inr(account.balance_remaining)} color={account.balance_remaining > 0 ? '#dc2626' : '#16a34a'} />
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Payments</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(s => !s)}>
          <Text style={styles.addBtnText}>{showForm ? 'Cancel' : '+ Record payment'}</Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Fee Type</Text>
          <TextInput
            style={styles.input}
            value={form.fee_type}
            onChangeText={v => setForm(f => ({ ...f, fee_type: v }))}
            placeholder="tuition / van / previous_dues"
          />
          <Text style={styles.fieldLabel}>Amount</Text>
          <TextInput style={styles.input} value={form.amount} onChangeText={v => setForm(f => ({ ...f, amount: v }))} keyboardType="numeric" placeholder="0" />
          <Text style={styles.fieldLabel}>Payment Mode</Text>
          <TextInput
            style={styles.input}
            value={form.payment_mode}
            onChangeText={v => setForm(f => ({ ...f, payment_mode: v }))}
            placeholder="cash / online / cheque"
          />
          <TouchableOpacity style={styles.saveBtn} onPress={handleRecordPayment} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Payment</Text>}
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.card}>
        {payments.length === 0 ? (
          <Text style={styles.emptyInline}>No payments recorded yet</Text>
        ) : (
          payments.map(p => (
            <View key={p.id} style={styles.paymentRow}>
              <View>
                <Text style={styles.paymentType}>{p.fee_type}</Text>
                <Text style={styles.paymentDate}>
                  {new Date(p.payment_date).toLocaleDateString('en-IN')} · {p.payment_mode}
                </Text>
              </View>
              <Text style={styles.paymentAmount}>{inr(p.amount)}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function SummaryItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={[styles.summaryValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  emptyText: { color: '#64748b' },
  emptyInline: { color: '#94a3b8', fontSize: 13 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 },
  name: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  code: { color: '#94a3b8', fontSize: 12, marginTop: 2, marginBottom: 12 },
  summaryGrid: { flexDirection: 'row', gap: 12 },
  summaryItem: { flex: 1 },
  summaryValue: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  summaryLabel: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#334155' },
  addBtn: { paddingVertical: 4 },
  addBtnText: { color: '#4f46e5', fontWeight: '600', fontSize: 13 },
  fieldLabel: { fontSize: 12, color: '#94a3b8', marginBottom: 4, marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  saveBtn: { backgroundColor: '#4f46e5', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 12 },
  saveBtnText: { color: '#fff', fontWeight: '600' },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  paymentType: { fontWeight: '600', color: '#0f172a', fontSize: 13, textTransform: 'capitalize' },
  paymentDate: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  paymentAmount: { fontWeight: '700', color: '#16a34a' },
});
