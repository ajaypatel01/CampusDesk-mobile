import { ReactNode } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Platform, Alert, TextInputProps } from 'react-native';
import { Picker } from '@react-native-picker/picker';

export const colors = {
  primary: '#4f46e5',
  primarySoft: '#eef2ff',
  text: '#0f172a',
  textMuted: '#64748b',
  textFaint: '#94a3b8',
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
  bg: '#f8fafc',
  card: '#fff',
  success: '#16a34a',
  danger: '#dc2626',
  warning: '#b45309',
};

/** Yes/no confirmation. Alert buttons don't work on react-native-web, so fall back to window.confirm there. */
export function confirm(title: string, message: string, confirmLabel = 'OK', destructive = false): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise(resolve => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]);
  });
}

export function showError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  if (Platform.OS === 'web') window.alert(message);
  else Alert.alert('Something went wrong', message);
}

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={[styles.input, props.editable === false && styles.inputDisabled]} placeholderTextColor={colors.textFaint} {...props} />
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'danger';
  small?: boolean;
  disabled?: boolean;
  loading?: boolean;
};

export function Button({ label, onPress, variant = 'primary', small, disabled, loading }: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.btn,
        small && styles.btnSmall,
        variant === 'primary' && styles.btnPrimary,
        variant === 'outline' && styles.btnOutline,
        variant === 'danger' && styles.btnDanger,
        isDisabled && styles.btnDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' ? '#fff' : colors.primary} />
      ) : (
        <Text
          style={[
            styles.btnText,
            small && styles.btnTextSmall,
            variant === 'primary' && { color: '#fff' },
            variant === 'outline' && { color: colors.primary },
            variant === 'danger' && { color: colors.danger },
          ]}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export function Badge({ label, tone = 'muted' }: { label: string; tone?: 'muted' | 'success' | 'danger' | 'primary' }) {
  const toneStyle = {
    muted: { backgroundColor: '#f1f5f9', color: colors.textMuted },
    success: { backgroundColor: '#dcfce7', color: colors.success },
    danger: { backgroundColor: '#fee2e2', color: colors.danger },
    primary: { backgroundColor: colors.primarySoft, color: colors.primary },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: toneStyle.backgroundColor }]}>
      <Text style={[styles.badgeText, { color: toneStyle.color }]}>{label}</Text>
    </View>
  );
}

export function Message({ text }: { text: string }) {
  if (!text) return null;
  const isError = text.startsWith('Error');
  return <Text style={[styles.message, { color: isError ? colors.danger : colors.success }]}>{text}</Text>;
}

export function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

export function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View style={styles.pickerWrap}>
        <Picker selectedValue={value} onValueChange={v => onChange(String(v))}>
          {placeholder !== undefined && <Picker.Item label={placeholder} value="" color={colors.textFaint} />}
          {options.map(o => (
            <Picker.Item key={o.value} label={o.label} value={o.value} />
          ))}
        </Picker>
      </View>
    </View>
  );
}

export const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, flexShrink: 1 },
  field: { marginBottom: 10, flex: 1 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 15,
    color: colors.text,
    backgroundColor: '#fff',
  },
  inputDisabled: { backgroundColor: '#f1f5f9', color: colors.textFaint },
  row: { flexDirection: 'row', gap: 10 },
  pickerWrap: { backgroundColor: colors.bg, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  btn: { borderRadius: 8, paddingVertical: 11, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  btnSmall: { paddingVertical: 6, paddingHorizontal: 12, minHeight: 34 },
  btnPrimary: { backgroundColor: colors.primary },
  btnOutline: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.primary },
  btnDanger: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#fecaca' },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: 15, fontWeight: '600' },
  btnTextSmall: { fontSize: 13 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  message: { marginTop: 8, fontSize: 13, fontWeight: '600' },
  empty: { color: colors.textFaint, fontSize: 13, paddingVertical: 8 },
  muted: { color: colors.textMuted, fontSize: 12 },
  buttonRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 10 },
});
