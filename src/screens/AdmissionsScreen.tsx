import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { useSchool } from '../school/SchoolContext';
import { studentsApi, enrollmentsApi, Student } from '../api/client';

type Row = Student & { enrollment?: { status: string } };

export default function AdmissionsScreen() {
  const router = useRouter();
  const { currentSchool, academicYears, currentYear, loading: schoolLoading } = useSchool();
  const [yearId, setYearId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing local year selection to the school-wide current year once loaded
    if (currentYear && !yearId) setYearId(currentYear.id);
  }, [currentYear, yearId]);

  useEffect(() => {
    if (!currentSchool || !yearId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern
    setLoading(true);
    Promise.all([
      studentsApi.list({ school_id: currentSchool.id, academic_year_id: yearId, limit: 1000 }),
      enrollmentsApi.list({ school_id: currentSchool.id, academic_year_id: yearId, limit: 1000 }),
    ])
      .then(([sRes, eRes]: [{ items?: Student[] }, { items?: { student_id: string; status: string }[] }]) => {
        const enrollMap: Record<string, { status: string }> = {};
        (eRes.items || []).forEach(e => {
          enrollMap[e.student_id] = e;
        });
        setRows((sRes.items || []).map(s => ({ ...s, enrollment: enrollMap[s.id] })));
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [currentSchool, yearId]);

  const filtered = rows.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.first_name.toLowerCase().includes(q) ||
      r.last_name.toLowerCase().includes(q) ||
      r.student_code.toLowerCase().includes(q)
    );
  });

  const boys = rows.filter(r => (r.gender || '').toLowerCase().startsWith('m')).length;
  const girls = rows.filter(r => (r.gender || '').toLowerCase().startsWith('f')).length;

  if (schoolLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={yearId} onValueChange={setYearId}>
          {academicYears.map(y => (
            <Picker.Item key={y.id} label={y.name} value={y.id} />
          ))}
        </Picker>
      </View>

      <View style={styles.statsRow}>
        <Stat label="Total" value={rows.length} />
        <Stat label="Boys" value={boys} />
        <Stat label="Girls" value={girls} />
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color="#94a3b8" />
        <TextInput style={styles.searchInput} placeholder="Search name or scholar no..." value={search} onChangeText={setSearch} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={r => r.id}
          contentContainerStyle={{ padding: 16, paddingTop: 0 }}
          ListEmptyComponent={<Text style={styles.emptyText}>No admissions found for this year</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => router.push(`/students/${item.id}`)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {item.first_name} {item.last_name}
                </Text>
                <Text style={styles.meta}>
                  {item.student_code} · {item.gender || '-'} · {item.category || '-'}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: item.status === 'active' ? '#dcfce7' : '#f1f5f9' }]}>
                <Text style={[styles.badgeText, { color: item.status === 'active' ? '#16a34a' : '#64748b' }]}>{item.status}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  pickerWrap: { backgroundColor: '#fff', margin: 16, marginBottom: 8, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  statsRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 8 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  statValue: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  statLabel: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: { flex: 1, fontSize: 14 },
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
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '600' },
});
