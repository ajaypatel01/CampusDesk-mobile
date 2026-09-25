import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useSchool } from '../school/SchoolContext';
import { feesApi } from '../api/client';

type GradeSummary = {
  grade_level_name: string;
  student_count: number;
  total_due: number;
  total_collected: number;
  outstanding: number;
};

type Summary = {
  total_students: number;
  grand_total_due: number;
  total_collected: number;
  total_outstanding: number;
  by_grade?: GradeSummary[];
};

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

export default function FeeReportScreen() {
  const { currentSchool, currentYear, loading: schoolLoading } = useSchool();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentSchool || !currentYear) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern
    setLoading(true);
    feesApi
      .schoolSummary({ school_id: currentSchool.id, academic_year_id: currentYear.id })
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, [currentSchool, currentYear]);

  if (schoolLoading || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }
  if (!summary) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No fee data for this year</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.summaryGrid}>
        <SummaryCard label="Students" value={String(summary.total_students)} />
        <SummaryCard label="Total Due" value={inr(summary.grand_total_due)} />
        <SummaryCard label="Collected" value={inr(summary.total_collected)} color="#16a34a" />
        <SummaryCard label="Outstanding" value={inr(summary.total_outstanding)} color="#dc2626" />
      </View>

      <Text style={styles.sectionTitle}>By Grade</Text>
      <View style={styles.card}>
        {(summary.by_grade || []).length === 0 ? (
          <Text style={styles.emptyInline}>No grade-wise data</Text>
        ) : (
          summary.by_grade!.map(g => (
            <View key={g.grade_level_name} style={styles.gradeRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.gradeName}>{g.grade_level_name}</Text>
                <Text style={styles.gradeMeta}>{g.student_count} students</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.gradeCollected}>{inr(g.total_collected)}</Text>
                <Text style={styles.gradeOutstanding}>{inr(g.outstanding)} due</Text>
              </View>
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
  emptyText: { color: '#64748b' },
  emptyInline: { color: '#94a3b8', fontSize: 13 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  summaryCard: { flexBasis: '47%', backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  summaryValue: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  summaryLabel: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#334155', marginBottom: 8 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  gradeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  gradeName: { fontWeight: '600', color: '#0f172a', fontSize: 14 },
  gradeMeta: { color: '#94a3b8', fontSize: 12, marginTop: 1 },
  gradeCollected: { color: '#16a34a', fontWeight: '600', fontSize: 13 },
  gradeOutstanding: { color: '#dc2626', fontSize: 11, marginTop: 1 },
});
