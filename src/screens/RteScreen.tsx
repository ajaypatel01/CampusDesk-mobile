import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useSchool } from '../school/SchoolContext';
import { rteApi, academicApi, GradeLevel } from '../api/client';

type QuotaDetail = {
  id: string;
  grade_level_id: string;
  grade_level_name: string;
  total_seats: number;
  utilized_seats: number;
  available_seats: number;
  govt_reimbursement_per_student: number;
};

type Summary = { total_seats: number; utilized_seats: number; available_seats: number; total_reimbursement: number };

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

export default function RteScreen() {
  const { currentSchool, currentYear, loading: schoolLoading } = useSchool();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [quotas, setQuotas] = useState<QuotaDetail[]>([]);
  const [grades, setGrades] = useState<GradeLevel[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ grade_level_id: '', total_seats: '', govt_reimbursement_per_student: '' });

  const load = useCallback(() => {
    if (!currentSchool || !currentYear) return Promise.resolve();
    const params = { school_id: currentSchool.id, academic_year_id: currentYear.id };
    return Promise.all([
      rteApi.getSummary(params).catch(() => null),
      rteApi.listQuotas(params).catch(() => ({ items: [] })),
      academicApi.listGrades(currentSchool.id).catch(() => ({ items: [] })),
    ]).then(([sum, qts, gds]: [Summary | null, { items?: QuotaDetail[] }, { items?: GradeLevel[] }]) => {
      setSummary(sum);
      setQuotas(qts.items || []);
      setGrades(gds.items || []);
    });
  }, [currentSchool, currentYear]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function handleSaveQuota() {
    if (!currentSchool || !currentYear || !form.grade_level_id || !form.total_seats) {
      Alert.alert('Grade and total seats are required');
      return;
    }
    setSaving(true);
    try {
      await rteApi.upsertQuota({
        school_id: currentSchool.id,
        academic_year_id: currentYear.id,
        grade_level_id: form.grade_level_id,
        total_seats: parseInt(form.total_seats, 10),
        govt_reimbursement_per_student: parseInt(form.govt_reimbursement_per_student, 10) || 0,
      });
      setShowForm(false);
      setForm({ grade_level_id: '', total_seats: '', govt_reimbursement_per_student: '' });
      await load();
    } catch (err: any) {
      Alert.alert('Failed to save', err.message);
    } finally {
      setSaving(false);
    }
  }

  if (schoolLoading || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {summary && (
        <View style={styles.summaryGrid}>
          <SummaryCard label="Total Seats" value={String(summary.total_seats)} />
          <SummaryCard label="Utilized" value={String(summary.utilized_seats)} color="#16a34a" />
          <SummaryCard label="Available" value={String(summary.available_seats)} color="#4f46e5" />
          <SummaryCard label="Reimbursement" value={inr(summary.total_reimbursement)} />
        </View>
      )}

      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Quotas by Grade</Text>
        <TouchableOpacity onPress={() => setShowForm(s => !s)}>
          <Text style={styles.addLink}>{showForm ? 'Cancel' : '+ Set quota'}</Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={styles.card}>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={form.grade_level_id} onValueChange={v => setForm(f => ({ ...f, grade_level_id: v }))}>
              <Picker.Item label="Select grade" value="" />
              {grades.map(g => (
                <Picker.Item key={g.id} label={g.name} value={g.id} />
              ))}
            </Picker>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Total Seats"
            value={form.total_seats}
            onChangeText={v => setForm(f => ({ ...f, total_seats: v }))}
            keyboardType="numeric"
          />
          <TextInput
            style={styles.input}
            placeholder="Govt Reimbursement / Student"
            value={form.govt_reimbursement_per_student}
            onChangeText={v => setForm(f => ({ ...f, govt_reimbursement_per_student: v }))}
            keyboardType="numeric"
          />
          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveQuota} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Quota</Text>}
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.card}>
        {quotas.length === 0 ? (
          <Text style={styles.emptyInline}>No RTE quotas set yet</Text>
        ) : (
          quotas.map(q => (
            <View key={q.id} style={styles.quotaRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.gradeName}>{q.grade_level_name}</Text>
                <Text style={styles.gradeMeta}>
                  {q.utilized_seats}/{q.total_seats} seats used
                </Text>
              </View>
              <Text style={styles.available}>{q.available_seats} open</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={[styles.summaryValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  summaryCard: { flexBasis: '47%', backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  summaryValue: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  summaryLabel: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#334155' },
  addLink: { color: '#4f46e5', fontWeight: '600', fontSize: 13 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16, gap: 8 },
  pickerWrap: { backgroundColor: '#f8fafc', borderRadius: 8 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  saveBtn: { backgroundColor: '#4f46e5', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '600' },
  emptyInline: { color: '#94a3b8', fontSize: 13 },
  quotaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  gradeName: { fontWeight: '600', color: '#0f172a', fontSize: 14 },
  gradeMeta: { color: '#94a3b8', fontSize: 12, marginTop: 1 },
  available: { color: '#4f46e5', fontWeight: '600', fontSize: 13 },
});
