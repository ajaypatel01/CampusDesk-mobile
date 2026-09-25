import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, FlatList, Alert } from 'react-native';
import { useSchool } from '../school/SchoolContext';
import { studentsApi, documentsApi, Student } from '../api/client';
import { downloadAndShare } from '../utils/downloadAndShare';

type Tab = 'bonafide' | 'tc';

function StudentPicker({ onSelect }: { onSelect: (s: Student) => void }) {
  const { currentSchool } = useSchool();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);

  function search(q: string) {
    setQuery(q);
    setSelected(null);
    if (!currentSchool || q.trim().length < 2) {
      setResults([]);
      return;
    }
    studentsApi
      .list({ school_id: currentSchool.id, search: q, limit: 10 })
      .then((res: { items?: Student[] }) => setResults(res.items || []))
      .catch(() => setResults([]));
  }

  return (
    <View>
      <TextInput style={styles.input} placeholder="Search student by name or scholar no..." value={query} onChangeText={search} />
      {results.length > 0 && !selected && (
        <FlatList
          data={results}
          keyExtractor={s => s.id}
          style={{ maxHeight: 160, marginTop: 6 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.resultRow}
              onPress={() => {
                setSelected(item);
                setQuery(`${item.first_name} ${item.last_name} (${item.student_code})`);
                setResults([]);
                onSelect(item);
              }}
            >
              <Text>
                {item.first_name} {item.last_name} ({item.student_code})
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

export default function DocumentsScreen() {
  const { currentYear } = useSchool();
  const [tab, setTab] = useState<Tab>('bonafide');

  const [bStudent, setBStudent] = useState<Student | null>(null);
  const [bBusy, setBBusy] = useState(false);

  const [tcStudent, setTcStudent] = useState<Student | null>(null);
  const [tcDate, setTcDate] = useState('');
  const [tcReason, setTcReason] = useState('');
  const [tcBusy, setTcBusy] = useState(false);

  async function handleBonafide() {
    if (!bStudent || !currentYear) return;
    setBBusy(true);
    try {
      const blob = await documentsApi.downloadBonafide(bStudent.id, currentYear.id);
      await downloadAndShare(blob, `bonafide_${bStudent.student_code}.pdf`);
    } catch (err: any) {
      Alert.alert('Failed', err.message);
    } finally {
      setBBusy(false);
    }
  }

  async function handleTC() {
    if (!tcStudent) return;
    setTcBusy(true);
    try {
      const params: Record<string, string> = { student_id: tcStudent.id };
      if (tcDate) params.date_of_leaving = tcDate;
      if (tcReason) params.reason = tcReason;
      const blob = await documentsApi.downloadTC(params);
      await downloadAndShare(blob, `tc_${tcStudent.student_code}.pdf`);
    } catch (err: any) {
      Alert.alert('Failed', err.message);
    } finally {
      setTcBusy(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, tab === 'bonafide' && styles.tabActive]} onPress={() => setTab('bonafide')}>
          <Text style={[styles.tabText, tab === 'bonafide' && styles.tabTextActive]}>Bonafide</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'tc' && styles.tabActive]} onPress={() => setTab('tc')}>
          <Text style={[styles.tabText, tab === 'tc' && styles.tabTextActive]}>Transfer Certificate</Text>
        </TouchableOpacity>
      </View>

      {tab === 'bonafide' && (
        <View style={styles.card}>
          <Text style={styles.label}>Student</Text>
          <StudentPicker onSelect={setBStudent} />
          <TouchableOpacity style={styles.actionBtn} onPress={handleBonafide} disabled={!bStudent || bBusy}>
            {bBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>Download Bonafide Certificate</Text>}
          </TouchableOpacity>
        </View>
      )}

      {tab === 'tc' && (
        <View style={styles.card}>
          <Text style={styles.label}>Student</Text>
          <StudentPicker onSelect={setTcStudent} />
          <Text style={styles.label}>Date of Leaving (YYYY-MM-DD)</Text>
          <TextInput style={styles.input} value={tcDate} onChangeText={setTcDate} placeholder="Optional" />
          <Text style={styles.label}>Reason</Text>
          <TextInput style={styles.input} value={tcReason} onChangeText={setTcReason} placeholder="Optional" />
          <TouchableOpacity style={styles.actionBtn} onPress={handleTC} disabled={!tcStudent || tcBusy}>
            {tcBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>Download Transfer Certificate</Text>}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 40 },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  tabActive: { backgroundColor: '#eef2ff', borderColor: '#4f46e5' },
  tabText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  tabTextActive: { color: '#4f46e5' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  label: { fontSize: 12, color: '#94a3b8', marginBottom: 4, marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  resultRow: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e2e8f0' },
  actionBtn: { backgroundColor: '#4f46e5', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  actionBtnText: { color: '#fff', fontWeight: '600' },
});
