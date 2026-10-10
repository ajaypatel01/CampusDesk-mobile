import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { usersApi } from '../api/client';
import { APP_VARIANT, APP_AUDIENCE, OTP_AUDIENCE } from '../config/appVariant';

export default function LoginScreen() {
  const { login, loginWithOtp } = useAuth();
  const [mode, setMode] = useState<'password' | 'otp'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  async function run(action: () => Promise<void>, fallback: string) {
    setError('');
    setNotice('');
    setLoading(true);
    try {
      await action();
    } catch (err: any) {
      setError(err.message || fallback);
    } finally {
      setLoading(false);
    }
  }

  function handlePassword() {
    if (!email.trim() || !password) {
      setError(APP_VARIANT === 'parent' ? 'Enter your mobile number and password' : 'Enter your email or mobile number and password');
      return;
    }
    run(() => login(email.trim().toLowerCase(), password), 'Login failed');
  }

  function sendOtp() {
    if (phone.replace(/\D/g, '').length < 10) {
      setError('Enter your 10-digit mobile number');
      return;
    }
    run(async () => {
      await usersApi.sendLoginOtp(phone, OTP_AUDIENCE[APP_VARIANT]);
      setOtpSent(true);
      setOtp('');
      setNotice('We sent a 6-digit code to this number on WhatsApp.');
    }, 'Could not send the code');
  }

  function verifyOtp() {
    if (otp.trim().length !== 6) {
      setError('Enter the 6-digit code');
      return;
    }
    run(() => loginWithOtp(phone, otp.trim()), 'Invalid or expired code');
  }

  function switchMode(next: 'password' | 'otp') {
    setMode(next);
    setError('');
    setNotice('');
    setOtpSent(false);
    setOtp('');
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text style={styles.logo}>CampusDesk</Text>
        <Text style={styles.subtitle}>
          {APP_VARIANT === 'dev' ? 'Sign in' : `${APP_AUDIENCE[APP_VARIANT]} · Sign in`}
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        {mode === 'password' ? (
          <>
            {/* An email or a mobile number: parents use the number the school has. */}
            <Text style={styles.label}>{APP_VARIANT === 'parent' ? 'Mobile number' : 'Email or mobile number'}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={APP_VARIANT === 'parent' ? 'phone-pad' : 'email-address'}
              autoComplete={APP_VARIANT === 'parent' ? 'tel' : 'username'}
              placeholder={APP_VARIANT === 'parent' ? '98765 43210' : 'you@example.com or 98765 43210'}
              editable={!loading}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              editable={!loading}
            />

            <TouchableOpacity style={styles.button} onPress={handlePassword} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.label}>WhatsApp number</Text>
            <TextInput
              style={[styles.input, otpSent && styles.inputDone]}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              placeholder="98765 43210"
              maxLength={16}
              editable={!loading && !otpSent}
            />

            {otpSent ? (
              <>
                <Text style={styles.label}>Code</Text>
                <TextInput
                  style={[styles.input, styles.codeInput]}
                  value={otp}
                  onChangeText={t => setOtp(t.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  autoComplete="sms-otp"
                  textContentType="oneTimeCode"
                  placeholder="6-digit code"
                  maxLength={6}
                  autoFocus
                  editable={!loading}
                />
                <TouchableOpacity style={styles.button} onPress={verifyOtp} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify & sign in</Text>}
                </TouchableOpacity>
                <View style={styles.row}>
                  <TouchableOpacity onPress={() => switchMode('otp')} disabled={loading}>
                    <Text style={styles.link}>Change number</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={sendOtp} disabled={loading}>
                    <Text style={styles.link}>Resend code</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <TouchableOpacity style={styles.button} onPress={sendOtp} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send code on WhatsApp</Text>}
              </TouchableOpacity>
            )}
          </>
        )}

        <TouchableOpacity onPress={() => switchMode(mode === 'otp' ? 'password' : 'otp')} disabled={loading}>
          <Text style={[styles.link, styles.switch]}>
            {mode === 'otp' ? 'Sign in with email and password' : 'Sign in with WhatsApp OTP'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          {mode === 'otp'
            ? APP_VARIANT === 'parent'
              ? 'Use the mobile number you gave the school. If it doesn\u2019t work, ask the school office to update it.'
              : 'Use the WhatsApp number you verified in Settings.'
            : APP_VARIANT === 'parent'
              ? 'Use the mobile number you gave the school. Ask the school office for your password.'
              : 'Don\u2019t have an account? Register on the CampusDesk website and wait for your school to approve it.'}
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  logo: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4f46e5',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#4f46e5',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  inputDone: {
    backgroundColor: '#f1f5f9',
    color: '#475569',
  },
  codeInput: {
    fontSize: 20,
    letterSpacing: 6,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  link: {
    color: '#4f46e5',
    fontSize: 13,
    fontWeight: '600',
  },
  switch: {
    textAlign: 'center',
    marginTop: 18,
  },
  notice: {
    color: '#166534',
    backgroundColor: '#f0fdf4',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 13,
  },
  error: {
    color: '#dc2626',
    backgroundColor: '#fef2f2',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 13,
  },
  hint: {
    marginTop: 20,
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
  },
});
