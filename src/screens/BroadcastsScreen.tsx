import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useSchool } from '../school/SchoolContext';
import { broadcastsApi, academicApi, GradeLevel } from '../api/client';

type Broadcast = {
  id: string;
  title: string;
  message: string;
  target: string;
  total_count: number;
  sent_count: number;
  failed_count: number;
  status: string;
};

export default function BroadcastsScreen() {
  const { currentSchool, currentYear, loading: schoolLoading } = useSchool();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [grades, setGrades] = useState<GradeLevel[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ title: '', message: '', target: 'all_parents', grade_level_id: '' });

  const load = useCallback(() => {
    if (!currentSchool) return Promise.resolve();
    return broadcastsApi
      .list(currentSchool.id)
      .then((res: { items?: Broadcast[] }) => setBroadcasts(res.items || []))
      .catch(() => setBroadcasts([]));
  }, [currentSchool]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (!currentSchool) return;
    academicApi
      .listGrades(currentSchool.id)
      .then(res => setGrades(res.items || []))
      .catch(() => setGrades([]));
  }, [currentSchool]);

  async function handleSend() {
    if (!currentSchool || !form.title.trim() || !form.message.trim()) {
      Alert.alert('Title and message are required');
      return;
    }
    setSending(true);
    try {
      await broadcastsApi.send({
        school_id: currentSchool.id,
        academic_year_id: currentYear?.id || '',
        title: form.title,
        message: form.message,
        target: form.target,
        grade_level_id: form.target === 'grade' ? form.grade_level_id : undefined,
      });
      setShowForm(false);
      setForm({ title: '', message: '', target: 'all_parents', grade_level_id: '' });
      await load();
    } catch (err: any) {
      Alert.alert('Failed to send', err.message);
    } finally {
      setSending(false);
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
        <Text style={styles.count}>{broadcasts.length} broadcasts</Text>
        <TouchableOpacity onPress={() => setShowForm(s => !s)}>
          <Text style={styles.addLink}>{showForm ? 'Cancel' : '+ New broadcast'}</Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={styles.formCard}>
          <TextInput style={styles.input} placeholder="Title *" value={form.title} onChangeText={v => setForm(f => ({ ...f, title: v }))} />
          <TextInput
            style={[styles.input, { height: 80 }]}
            placeholder="Message *"
            value={form.message}
            onChangeText={v => setForm(f => ({ ...f, message: v }))}
            multiline
          />
          <View style={styles.pickerWrap}>
            <Picker selectedValue={form.target} onValueChange={v => setForm(f => ({ ...f, target: v }))}>
              <Picker.Item label="All Parents" value="all_parents" />
              <Picker.Item label="All Staff" value="all_staff" />
              <Picker.Item label="Specific Grade" value="grade" />
            </Picker>
          </View>
          {form.target === 'grade' && (
            <View style={styles.pickerWrap}>
              <Picker selectedValue={form.grade_level_id} onValueChange={v => setForm(f => ({ ...f, grade_level_id: v }))}>
                <Picker.Item label="Select grade" value="" />
                {grades.map(g => (
                  <Picker.Item key={g.id} label={g.name} value={g.id} />
                ))}
              </Picker>
            </View>
          )}
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={sending}>
            {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendBtnText}>Send Broadcast</Text>}
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={broadcasts}
          keyExtractor={b => b.id}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          ListEmptyComponent={<Text style={styles.emptyText}>No broadcasts sent yet</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.message}>{item.message}</Text>
              <Text style={styles.meta}>
                {item.sent_count}/{item.total_count} sent {item.failed_count > 0 ? `· ${item.failed_count} failed` : ''} · {item.status}
              </Text>
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', margin: 16, marginBottom: 8 },
  count: { color: '#94a3b8', fontSize: 12 },
  addLink: { color: '#4f46e5', fontWeight: '600', fontSize: 13 },
  formCard: { backgroundColor: '#fff', borderRadius: 10, padding: 16, marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', gap: 8 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  pickerWrap: { backgroundColor: '#f8fafc', borderRadius: 8 },
  sendBtn: { backgroundColor: '#4f46e5', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  sendBtnText: { color: '#fff', fontWeight: '600' },
  emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 24 },
  row: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  title: { fontWeight: '700', color: '#0f172a', fontSize: 14 },
  message: { color: '#334155', fontSize: 13, marginTop: 4 },
  meta: { color: '#94a3b8', fontSize: 11, marginTop: 6 },
});
