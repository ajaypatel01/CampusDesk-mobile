import { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { useSchool } from '../school/SchoolContext';
import { usersApi } from '../api/client';
import { ROLE_LABELS } from '../utils/roleLabels';

type PendingUser = { id: string; first_name: string; last_name: string; email: string; role: string; created_at: string };

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { currentSchool } = useSchool();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'school_admin';

  const [pending, setPending] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!isAdmin) return Promise.resolve();
    return usersApi
      .listPending(currentSchool ? { school_id: currentSchool.id } : {})
      .then((res: { items?: PendingUser[] }) => setPending(res.items || []))
      .catch(() => setPending([]));
  }, [isAdmin, currentSchool]);

  useEffect(() => {
    if (!isAdmin) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [isAdmin, load]);

  async function handleApprove(id: string) {
    setBusyId(id);
    try {
      await usersApi.approve(id);
      setPending(list => list.filter(u => u.id !== id));
    } catch (err: any) {
      Alert.alert('Failed', err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string) {
    Alert.alert('Reject registration?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          setBusyId(id);
          try {
            await usersApi.reject(id);
            setPending(list => list.filter(u => u.id !== id));
          } catch (err: any) {
            Alert.alert('Failed', err.message);
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Text style={styles.roleValue}>{ROLE_LABELS[user?.role || ''] || user?.role}</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutBtnText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <ChangePasswordCard />

      {/* Parents log in with the number the school has for them. */}
      {user?.role !== 'parent' && <WhatsAppLoginCard />}

      {isAdmin && (
        <>
          <Text style={styles.sectionTitle}>Pending Registrations</Text>
          <View style={styles.card}>
            {loading ? (
              <ActivityIndicator color="#4f46e5" />
            ) : pending.length === 0 ? (
              <Text style={styles.emptyInline}>No pending registration requests</Text>
            ) : (
              pending.map(u => (
                <View key={u.id} style={styles.pendingRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pendingName}>
                      {u.first_name} {u.last_name}
                    </Text>
                    <Text style={styles.pendingMeta}>
                      {u.email} · {ROLE_LABELS[u.role] || u.role}
                    </Text>
                  </View>
                  {busyId === u.id ? (
                    <ActivityIndicator color="#4f46e5" />
                  ) : (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(u.id)}>
                        <Text style={styles.approveBtnText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(u.id)}>
                        <Text style={styles.rejectBtnText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

/** Change your own password; other devices are signed out. */
function ChangePasswordCard() {
  const { replaceSession } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function save() {
    setError('');
    setDone(false);
    if (next.length < 6) return setError('The new password must be at least 6 characters');
    if (next !== confirm) return setError('The new passwords do not match');
    setBusy(true);
    try {
      const res = await usersApi.changePassword(current, next);
      await replaceSession(res.token);
      setCurrent('');
      setNext('');
      setConfirm('');
      setDone(true);
    } catch (err: any) {
      setError(err.message || 'Could not change the password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Text style={styles.sectionTitle}>Change password</Text>
      <View style={styles.card}>
        {error ? <Text style={styles.waError}>{error}</Text> : null}
        {done ? <Text style={styles.waDone}>Password changed. Other devices have been signed out.</Text> : null}
        <TextInput style={styles.waInput} value={current} onChangeText={setCurrent} secureTextEntry placeholder="Current password" editable={!busy} />
        <TextInput style={styles.waInput} value={next} onChangeText={setNext} secureTextEntry placeholder="New password (at least 6 characters)" editable={!busy} />
        <TextInput style={styles.waInput} value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="Confirm new password" editable={!busy} />
        <TouchableOpacity style={styles.waBtn} onPress={save} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.waBtnText}>Change password</Text>}
        </TouchableOpacity>
      </View>
    </>
  );
}

/** Verify a WhatsApp number so this account can log in with an OTP. */
function WhatsAppLoginCard() {
  const [verified, setVerified] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    usersApi.me().then(me => setVerified(me.phone_number || null)).catch(() => {});
  }, []);

  async function send() {
    setError('');
    setBusy(true);
    try {
      await usersApi.requestPhoneVerification(phone);
      setSent(true);
      setOtp('');
    } catch (err: any) {
      setError(err.message || 'Could not send the code');
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setError('');
    setBusy(true);
    try {
      const me = await usersApi.confirmPhoneVerification(phone, otp.trim());
      setVerified(me.phone_number || phone);
      setSent(false);
      setPhone('');
    } catch (err: any) {
      setError(err.message || 'Invalid or expired code');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Text style={styles.sectionTitle}>WhatsApp login</Text>
      <View style={styles.card}>
        {verified && !sent ? (
          <>
            <Text style={styles.waText}>
              Verified: <Text style={styles.waStrong}>{verified}</Text>. You can sign in with a WhatsApp code sent to this
              number.
            </Text>
            <TouchableOpacity onPress={() => setVerified(null)}>
              <Text style={styles.waLink}>Change number</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.waText}>Verify your WhatsApp number to sign in with a code instead of your password.</Text>
            {error ? <Text style={styles.waError}>{error}</Text> : null}
            <TextInput
              style={styles.waInput}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="98765 43210"
              maxLength={16}
              editable={!busy && !sent}
            />
            {sent && (
              <TextInput
                style={styles.waInput}
                value={otp}
                onChangeText={t => setOtp(t.replace(/\D/g, ''))}
                keyboardType="number-pad"
                autoComplete="sms-otp"
                textContentType="oneTimeCode"
                placeholder="6-digit code from WhatsApp"
                maxLength={6}
                autoFocus
                editable={!busy}
              />
            )}
            <TouchableOpacity style={styles.waBtn} onPress={sent ? confirm : send} disabled={busy}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.waBtnText}>{sent ? 'Verify' : 'Send code on WhatsApp'}</Text>
              )}
            </TouchableOpacity>
            {sent && (
              <TouchableOpacity onPress={() => setSent(false)} disabled={busy}>
                <Text style={styles.waLink}>Change number</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#334155', marginBottom: 8 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 20 },
  roleValue: { fontSize: 14, color: '#64748b', marginBottom: 16, textTransform: 'capitalize' },
  logoutBtn: { backgroundColor: '#fef2f2', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  logoutBtnText: { color: '#dc2626', fontWeight: '600' },
  emptyInline: { color: '#94a3b8', fontSize: 13 },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  pendingName: { fontWeight: '600', color: '#0f172a', fontSize: 14 },
  pendingMeta: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  approveBtn: { backgroundColor: '#16a34a', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  approveBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  rejectBtn: { backgroundColor: '#fef2f2', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  rejectBtnText: { color: '#dc2626', fontSize: 12, fontWeight: '600' },
  waText: { fontSize: 13, color: '#475569', lineHeight: 19 },
  waStrong: { fontWeight: '700', color: '#0f172a' },
  waError: { color: '#dc2626', backgroundColor: '#fef2f2', padding: 8, borderRadius: 6, marginTop: 10, fontSize: 12 },
  waInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginTop: 10,
  },
  waDone: { color: '#166534', backgroundColor: '#f0fdf4', padding: 8, borderRadius: 6, marginBottom: 4, fontSize: 12 },
  waBtn: { backgroundColor: '#4f46e5', borderRadius: 8, paddingVertical: 11, alignItems: 'center', marginTop: 12 },
  waBtnText: { color: '#fff', fontWeight: '600' },
  waLink: { color: '#4f46e5', fontSize: 13, fontWeight: '600', marginTop: 12, textAlign: 'center' },
});
