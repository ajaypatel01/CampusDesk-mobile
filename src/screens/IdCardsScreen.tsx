import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSchool } from '../school/SchoolContext';
import { studentsApi, idCardsApi, Student } from '../api/client';
import { downloadAndShare } from '../utils/downloadAndShare';

export default function IdCardsScreen() {
  const { currentSchool, currentYear, loading: schoolLoading } = useSchool();
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!currentSchool) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern
    setLoading(true);
    studentsApi
      .list({ school_id: currentSchool.id, limit: 500 })
      .then((res: { items?: Student[] }) => setStudents(res.items || []))
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
  }, [currentSchool]);

  const filtered = students.filter(
    s => !search || `${s.first_name} ${s.last_name} ${s.student_code}`.toLowerCase().includes(search.toLowerCase())
  );

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleGenerate() {
    if (!currentYear || selected.size === 0) {
      Alert.alert('Select at least one student');
      return;
    }
    setGenerating(true);
    try {
      const blob = await idCardsApi.generateStudents({ student_ids: Array.from(selected), academic_year_id: currentYear.id });
      await downloadAndShare(blob, 'student_id_cards.pdf');
    } catch (err: any) {
      Alert.alert('Failed to generate', err.message);
    } finally {
      setGenerating(false);
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
        <TextInput style={styles.searchInput} placeholder="Search students..." value={search} onChangeText={setSearch} />
      </View>

      <View style={styles.headerRow}>
        <Text style={styles.count}>{selected.size} selected</Text>
        <TouchableOpacity style={styles.generateBtn} onPress={handleGenerate} disabled={generating || selected.size === 0}>
          {generating ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.generateBtnText}>Generate ID Cards</Text>}
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={s => s.id}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          ListEmptyComponent={<Text style={styles.emptyText}>No students found</Text>}
          renderItem={({ item }) => {
            const checked = selected.has(item.id);
            return (
              <TouchableOpacity style={styles.row} onPress={() => toggle(item.id)}>
                <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={22} color={checked ? '#4f46e5' : '#cbd5e1'} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.name}>
                    {item.first_name} {item.last_name}
                  </Text>
                  <Text style={styles.code}>{item.student_code}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
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
  generateBtn: { backgroundColor: '#4f46e5', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  generateBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
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
  code: { color: '#94a3b8', fontSize: 12, marginTop: 1 },
});
