import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSchool } from '../school/SchoolContext';
import { usersApi, feesApi } from '../api/client';

type Stat = { label: string; value: string; icon: string; color: string };

export default function DashboardScreen() {
  const { currentSchool, currentYear, loading: schoolLoading } = useSchool();
  const [stats, setStats] = useState<Stat[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentSchool || !currentYear) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicking off a load spinner for the fetch below
    setLoading(true);
    // usersApi.list has no server-side role filter (matching the web Dashboard's own
    // approach) — fetch a generous page and count teachers client-side.
    Promise.all([
      usersApi.list({ school_id: currentSchool.id, limit: 200 }).catch(() => ({ items: [] })),
      feesApi.schoolSummary({ school_id: currentSchool.id, academic_year_id: currentYear.id }).catch(() => null),
    ])
      .then(([usersRes, feeSummary]) => {
        const teacherCount = (usersRes.items || []).filter((u: { role: string }) => u.role === 'teacher').length;
        setStats([
          {
            label: 'Students',
            value: feeSummary?.total_students != null ? String(feeSummary.total_students) : '-',
            icon: 'school-outline',
            color: '#4f46e5',
          },
          { label: 'Teachers', value: String(teacherCount), icon: 'person-outline', color: '#0ea5e9' },
          {
            label: 'Fees collected',
            value: feeSummary?.total_collected != null ? `₹${Number(feeSummary.total_collected).toLocaleString('en-IN')}` : '-',
            icon: 'cash-outline',
            color: '#16a34a',
          },
          {
            label: 'Fees outstanding',
            value: feeSummary?.total_outstanding != null ? `₹${Number(feeSummary.total_outstanding).toLocaleString('en-IN')}` : '-',
            icon: 'alert-circle-outline',
            color: '#dc2626',
          },
        ]);
      })
      .finally(() => setLoading(false));
  }, [currentSchool, currentYear]);

  if (schoolLoading || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (!currentSchool) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No school found on your account.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{currentSchool.name}</Text>
      <Text style={styles.subtitle}>{currentYear?.name || 'No academic year set'}</Text>

      <View style={styles.grid}>
        {(stats || []).map(s => (
          <View key={s.label} style={styles.card}>
            <Ionicons name={s.icon as never} size={22} color={s.color} />
            <Text style={styles.cardValue}>{s.value}</Text>
            <Text style={styles.cardLabel}>{s.label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 2, marginBottom: 16 },
  emptyText: { color: '#64748b' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    flexBasis: '47%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardValue: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginTop: 8 },
  cardLabel: { fontSize: 13, color: '#64748b', marginTop: 2 },
});
