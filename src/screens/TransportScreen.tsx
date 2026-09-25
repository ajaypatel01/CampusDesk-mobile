import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSchool } from '../school/SchoolContext';
import { vansApi } from '../api/client';

type Van = { id: string; van_number: string; driver_name: string; driver_phone?: string; capacity: number; route_name?: string };
type VanRoute = { id: string; stop_name: string; stop_order: number; monthly_fee: number };

export default function TransportScreen() {
  const { currentSchool, loading: schoolLoading } = useSchool();
  const [vans, setVans] = useState<Van[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [routes, setRoutes] = useState<VanRoute[]>([]);
  const [routeForm, setRouteForm] = useState({ stop_name: '', monthly_fee: '' });

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ van_number: '', driver_name: '', driver_phone: '', capacity: '20' });

  const load = useCallback(() => {
    if (!currentSchool) return Promise.resolve();
    return vansApi
      .list(currentSchool.id)
      .then((res: { items?: Van[] }) => setVans(res.items || []))
      .catch(() => setVans([]));
  }, [currentSchool]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  function toggleExpand(van: Van) {
    if (expandedId === van.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(van.id);
    vansApi
      .get(van.id)
      .then((detail: { routes?: VanRoute[] }) => setRoutes(detail.routes || []))
      .catch(() => setRoutes([]));
  }

  async function handleAddVan() {
    if (!currentSchool || !form.van_number.trim() || !form.driver_name.trim()) {
      Alert.alert('Van number and driver name are required');
      return;
    }
    setSaving(true);
    try {
      await vansApi.create({ ...form, school_id: currentSchool.id, capacity: parseInt(form.capacity, 10) || 20 });
      setShowForm(false);
      setForm({ van_number: '', driver_name: '', driver_phone: '', capacity: '20' });
      await load();
    } catch (err: any) {
      Alert.alert('Failed to add van', err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddRoute(vanId: string) {
    if (!routeForm.stop_name.trim()) {
      Alert.alert('Stop name is required');
      return;
    }
    try {
      await vansApi.addRoute(vanId, {
        stop_name: routeForm.stop_name,
        stop_order: routes.length + 1,
        monthly_fee: parseInt(routeForm.monthly_fee, 10) || 0,
      });
      setRouteForm({ stop_name: '', monthly_fee: '' });
      const detail = await vansApi.get(vanId);
      setRoutes(detail.routes || []);
    } catch (err: any) {
      Alert.alert('Failed to add stop', err.message);
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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.count}>{vans.length} vans</Text>
        <TouchableOpacity onPress={() => setShowForm(s => !s)}>
          <Text style={styles.addLink}>{showForm ? 'Cancel' : '+ Add van'}</Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={styles.card}>
          <TextInput style={styles.input} placeholder="Van Number *" value={form.van_number} onChangeText={v => setForm(f => ({ ...f, van_number: v }))} />
          <TextInput style={styles.input} placeholder="Driver Name *" value={form.driver_name} onChangeText={v => setForm(f => ({ ...f, driver_name: v }))} />
          <TextInput style={styles.input} placeholder="Driver Phone" value={form.driver_phone} onChangeText={v => setForm(f => ({ ...f, driver_phone: v }))} keyboardType="phone-pad" />
          <TextInput style={styles.input} placeholder="Capacity" value={form.capacity} onChangeText={v => setForm(f => ({ ...f, capacity: v }))} keyboardType="numeric" />
          <TouchableOpacity style={styles.saveBtn} onPress={handleAddVan} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Van</Text>}
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 16 }} />
      ) : vans.length === 0 ? (
        <Text style={styles.emptyText}>No vans added yet</Text>
      ) : (
        vans.map(van => (
          <View key={van.id} style={styles.card}>
            <TouchableOpacity style={styles.vanRow} onPress={() => toggleExpand(van)}>
              <Ionicons name="bus-outline" size={20} color="#4f46e5" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.vanNumber}>{van.van_number}</Text>
                <Text style={styles.vanMeta}>
                  {van.driver_name} · {van.driver_phone || '-'} · {van.capacity} seats
                </Text>
              </View>
              <Ionicons name={expandedId === van.id ? 'chevron-up' : 'chevron-down'} size={18} color="#94a3b8" />
            </TouchableOpacity>

            {expandedId === van.id && (
              <View style={styles.routesBox}>
                {routes.length === 0 ? (
                  <Text style={styles.emptyInline}>No stops added yet</Text>
                ) : (
                  routes.map(r => (
                    <View key={r.id} style={styles.routeRow}>
                      <Text style={styles.routeStop}>
                        {r.stop_order}. {r.stop_name}
                      </Text>
                      <Text style={styles.routeFee}>₹{r.monthly_fee}/mo</Text>
                    </View>
                  ))
                )}
                <View style={styles.addRouteRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Stop name"
                    value={routeForm.stop_name}
                    onChangeText={v => setRouteForm(f => ({ ...f, stop_name: v }))}
                  />
                  <TextInput
                    style={[styles.input, { width: 80 }]}
                    placeholder="Fee"
                    value={routeForm.monthly_fee}
                    onChangeText={v => setRouteForm(f => ({ ...f, monthly_fee: v }))}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity style={styles.addStopBtn} onPress={() => handleAddRoute(van.id)}>
                    <Ionicons name="add" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  count: { color: '#94a3b8', fontSize: 12 },
  addLink: { color: '#4f46e5', fontWeight: '600', fontSize: 13 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12, gap: 8 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  saveBtn: { backgroundColor: '#4f46e5', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '600' },
  emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 24 },
  emptyInline: { color: '#94a3b8', fontSize: 13 },
  vanRow: { flexDirection: 'row', alignItems: 'center' },
  vanNumber: { fontWeight: '700', color: '#0f172a', fontSize: 14 },
  vanMeta: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  routesBox: { marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e2e8f0', gap: 6 },
  routeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  routeStop: { fontSize: 13, color: '#334155' },
  routeFee: { fontSize: 13, color: '#64748b' },
  addRouteRow: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' },
  addStopBtn: { backgroundColor: '#4f46e5', borderRadius: 8, padding: 8 },
});
