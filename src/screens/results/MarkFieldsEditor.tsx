import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { resultsApi, Subject } from '../../api/client';
import { Button, Field, colors, confirm, showError, styles as ui } from './ui';

/**
 * A subject's graded fields (Oral/Written/...): tap a chip to rename it or
 * change its max marks, × to remove it, plus an "Add Field" form. Admin-only
 * -- the backend blocks teachers, so callers don't render this for them.
 */
export default function MarkFieldsEditor({ subject, onChanged, showChips = true }: { subject: Subject; onChanged: () => void; showChips?: boolean }) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [max, setMax] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<{ key: string; label: string; max: string } | null>(null);
  const [editSaving, setEditSaving] = useState(false);
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

  async function saveEdit() {
    if (!editing) return;
    const maxMarks = parseInt(editing.max, 10);
    if (!editing.label.trim() || !maxMarks) return;
    setEditSaving(true);
    try {
      await resultsApi.updateSubjectComponent(subject.id, editing.key, { label: editing.label.trim(), max_marks: maxMarks });
      setEditing(null);
      onChanged();
    } catch (err) {
      showError(err);
    } finally {
      setEditSaving(false);
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
                <View key={c.key} style={[s.chip, editing?.key === c.key && s.chipEditing]}>
                  <TouchableOpacity
                    accessibilityLabel={`Edit ${c.label}`}
                    onPress={() => {
                      setAdding(false);
                      setEditing({ key: c.key, label: c.label, max: String(c.max_marks) });
                    }}
                  >
                    <Text style={s.chipText}>
                      {c.label} <Text style={ui.muted}>/{c.max_marks}</Text> <Text style={s.chipEdit}>✎</Text>
                    </Text>
                  </TouchableOpacity>
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

      {editing && (
        <View style={{ marginTop: 10 }}>
          <View style={ui.row}>
            <Field label="Field name" value={editing.label} onChangeText={label => setEditing({ ...editing, label })} />
            <View style={{ width: 90 }}>
              <Field label="Max" keyboardType="number-pad" value={editing.max} onChangeText={max => setEditing({ ...editing, max })} />
            </View>
          </View>
          <View style={ui.buttonRow}>
            <Button small label="Save" onPress={saveEdit} loading={editSaving} disabled={!editing.label.trim() || !editing.max} />
            <Button small variant="outline" label="Cancel" onPress={() => setEditing(null)} />
          </View>
        </View>
      )}

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
          <Button
            small
            variant="outline"
            label="+ Add Field"
            onPress={() => {
              setEditing(null);
              setAdding(true);
            }}
          />
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
  chipEditing: { borderWidth: 1, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.text },
  chipEdit: { fontSize: 12, color: colors.primary },
  chipRemove: { fontSize: 16, color: colors.textMuted, fontWeight: '700' },
});
