import { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { customFieldsApi, CustomFieldValue } from '../../api/client';
import { Button, Card, Empty, Field, SectionHeader, Select, colors, confirm, showError, styles as ui } from './ui';

const FIELD_TYPES = [
  { value: 'string', label: 'Text' },
  { value: 'int', label: 'Whole number' },
  { value: 'float', label: 'Decimal number' },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'enum', label: 'Choice list' },
];

/**
 * super_admin-only "extra fields" for one entity (e.g. one student's result
 * for a year). Callers only render it for super_admin -- every call 403s
 * for anyone else.
 */
export default function CustomFieldsSection({
  entityType,
  entityId,
  schoolId,
  scopeId,
  title = 'Extra Fields',
}: {
  entityType: string;
  entityId: string;
  schoolId: string;
  scopeId?: string;
  title?: string;
}) {
  const [fields, setFields] = useState<CustomFieldValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ label: '', field_type: 'string', enum_options: '' });
  const [addSaving, setAddSaving] = useState(false);

  const load = useCallback(() => {
    if (!schoolId || !entityId) return;
    setLoading(true);
    customFieldsApi
      .listValues(schoolId, entityType, entityId, scopeId)
      .then(r => setFields(r.items || []))
      .catch(() => setFields([]))
      .finally(() => setLoading(false));
  }, [schoolId, entityType, entityId, scopeId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount / when the entity changes
    load();
  }, [load]);

  function setLocal(id: string, value: string) {
    setFields(prev => prev.map(f => (f.id === id ? { ...f, value } : f)));
  }

  async function saveValue(field: CustomFieldValue, value: string) {
    setSavingId(field.id);
    setError('');
    try {
      await customFieldsApi.upsertValue({ definition_id: field.id, entity_id: entityId, scope_id: scopeId, value });
    } catch (err: any) {
      setError(err.message);
      load();
    } finally {
      setSavingId(null);
    }
  }

  async function addField() {
    if (!addForm.label.trim()) return;
    setAddSaving(true);
    setError('');
    try {
      await customFieldsApi.createDefinition({
        school_id: schoolId,
        entity_type: entityType,
        label: addForm.label.trim(),
        field_type: addForm.field_type,
        enum_options:
          addForm.field_type === 'enum'
            ? addForm.enum_options
                .split(',')
                .map(o => o.trim())
                .filter(Boolean)
            : undefined,
      });
      setShowAdd(false);
      setAddForm({ label: '', field_type: 'string', enum_options: '' });
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAddSaving(false);
    }
  }

  async function deleteField(field: CustomFieldValue) {
    const what = entityType.replace('_', ' ');
    if (!(await confirm('Remove field?', `Remove "${field.label}"? This deletes its value for every ${what}, not just this one.`, 'Remove', true))) return;
    try {
      await customFieldsApi.deleteDefinition(field.id);
      load();
    } catch (err) {
      showError(err);
    }
  }

  function renderInput(field: CustomFieldValue) {
    const disabled = savingId === field.id;
    if (field.field_type === 'boolean' || field.field_type === 'enum') {
      const options =
        field.field_type === 'boolean'
          ? [
              { label: 'Yes', value: 'true' },
              { label: 'No', value: 'false' },
            ]
          : (field.enum_options || []).map(o => ({ label: o, value: o }));
      return (
        <Select
          value={field.value || ''}
          placeholder="-"
          options={options}
          onChange={v => {
            setLocal(field.id, v);
            saveValue(field, v);
          }}
        />
      );
    }
    const numeric = field.field_type === 'int' || field.field_type === 'float';
    return (
      <TextInput
        style={[ui.input, disabled && ui.inputDisabled]}
        editable={!disabled}
        keyboardType={field.field_type === 'int' ? 'number-pad' : numeric ? 'decimal-pad' : 'default'}
        value={field.value || ''}
        onChangeText={v => setLocal(field.id, v)}
        onEndEditing={e => saveValue(field, e.nativeEvent.text)}
      />
    );
  }

  return (
    <View style={{ marginTop: 8 }}>
      <SectionHeader title={title} action={!showAdd && <Button small variant="outline" label="+ Add Field" onPress={() => setShowAdd(true)} />} />
      <Card>
        {error ? <Text style={{ color: colors.danger, marginBottom: 8 }}>{error}</Text> : null}

        {showAdd && (
          <View style={{ marginBottom: 12 }}>
            <Field label="Field name *" placeholder="e.g. House" value={addForm.label} onChangeText={label => setAddForm({ ...addForm, label })} />
            <Select label="Type *" value={addForm.field_type} onChange={field_type => setAddForm({ ...addForm, field_type })} options={FIELD_TYPES} />
            {addForm.field_type === 'enum' && (
              <Field
                label="Choices (comma-separated) *"
                placeholder="e.g. Red, Blue, Green"
                value={addForm.enum_options}
                onChangeText={enum_options => setAddForm({ ...addForm, enum_options })}
              />
            )}
            <View style={ui.buttonRow}>
              <Button small label="Save Field" onPress={addField} loading={addSaving} disabled={!addForm.label.trim()} />
              <Button small variant="outline" label="Cancel" onPress={() => setShowAdd(false)} />
            </View>
            <View style={ui.divider} />
          </View>
        )}

        {loading ? (
          <Empty text="Loading..." />
        ) : fields.length === 0 ? (
          <Empty text="No extra fields defined yet." />
        ) : (
          fields.map(field => (
            <View key={field.id} style={s.item}>
              <View style={s.itemHeader}>
                <Text style={ui.fieldLabel}>{field.label}</Text>
                <Button small variant="danger" label="Remove" onPress={() => deleteField(field)} />
              </View>
              {renderInput(field)}
            </View>
          ))
        )}
      </Card>
    </View>
  );
}

const s = StyleSheet.create({
  item: { marginBottom: 12 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
});
