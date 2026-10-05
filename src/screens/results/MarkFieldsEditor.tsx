import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { resultsApi, Subject } from '../../api/client';
import { Button, Field, colors, confirm, showError, styles as ui } from './ui';

/**
 * A subject's graded fields (Oral/Written/...): chips with remove, plus an
 * "Add Field" form. Admin-only -- the backend blocks teachers, so callers
 * don't render this for them.
 */
export default function MarkFieldsEditor({ subject, onChanged, showChips = true }: { subject: Subject; onChanged: () => void; showChips?: boolean }) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [max, setMax] = useState('');
  const [saving, setSaving] = useState(false);
  const components = subject.mark_components || [];
  const maxSum = components.reduce((sum, c) => sum + c.max_marks, 0);
  const mismatch = components.length > 0 && maxSum !== subject.max_marks;

  async function add() {
    const maxMarks = parseInt(max, 10);
    if (!label.trim() || !maxMarks) return;
    setSaving(true);
    try {
      await resultsApi.addSubjectComponent(subject.id, { label: label.trim(), max_marks: maxMarks });
      setAdding(false);
      setLabel('');
      setMax('');
      onChanged();
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  }

  async function remove(key: string, fieldLabel: string) {
    if (!(await confirm('Remove field?', `Remove "${fieldLabel}" from ${subject.name}?`, 'Remove', true))) return;
    try {
      await resultsApi.deleteSubjectComponent(subject.id, key);
      onChanged();
    } catch (err) {
      showError(err);
    }
  }

  return (
    <View>
      {showChips &&
        (components.length === 0 ? (
          <Text style={ui.muted}>No custom fields -- marks are entered as one number out of {subject.max_marks}.</Text>
        ) : (
          <>
            <View style={s.chips}>
              {components.map(c => (
                <View key={c.key} style={s.chip}>
                  <Text style={s.chipText}>
                    {c.label} <Text style={ui.muted}>/{c.max_marks}</Text>
                  </Text>
                  <TouchableOpacity
                    accessibilityLabel={`Remove ${c.label}`}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    onPress={() => remove(c.key, c.label)}
                  >
                    <Text style={s.chipRemove}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            <Text style={[ui.muted, mismatch && { color: colors.warning, fontWeight: '600' }]}>
              Fields total {maxSum} / subject max {subject.max_marks}
              {mismatch ? " -- these don't match, double check the field max marks" : ''}
            </Text>
          </>
        ))}

      {adding ? (
        <View style={{ marginTop: 10 }}>
          <View style={ui.row}>
            <Field label="Field name" placeholder="e.g. Oral" value={label} onChangeText={setLabel} />
            <View style={{ width: 90 }}>
              <Field label="Max" keyboardType="number-pad" value={max} onChangeText={setMax} />
            </View>
          </View>
          <View style={ui.buttonRow}>
            <Button small label="Add" onPress={add} loading={saving} disabled={!label.trim() || !max} />
            <Button small variant="outline" label="Cancel" onPress={() => setAdding(false)} />
          </View>
        </View>
      ) : (
        <View style={{ marginTop: 10, alignSelf: 'flex-start' }}>
          <Button small variant="outline" label="+ Add Field" onPress={() => setAdding(true)} />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 4,
  },
  chipText: { fontSize: 13, color: colors.text },
  chipRemove: { fontSize: 16, color: colors.textMuted, fontWeight: '700' },
});
