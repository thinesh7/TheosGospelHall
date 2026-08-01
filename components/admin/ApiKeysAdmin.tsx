import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from 'react-native';
import { getAuth } from 'firebase/auth';
import { useAppDialog } from '../AppDialog';
import { Text } from '../AppText';
import { TextInput } from '../AppTextInput';
import {
  BackupApiKey,
  addApiKey,
  deleteApiKey,
  getCachedApiKeys,
  setApiKeyActive,
  syncApiKeys,
  updateApiKey,
} from '../../utils/apiKeysSync';
import { ApiKeyStatus, DEFAULT_API_KEY, testApiKey } from '../../utils/youtubeProxy';
import { useTheme } from '../../utils/ThemeContext';
import { AdminScreenHandle } from './SpecialMeetingsAdmin';

interface EditForm {
  id: string | null;
  key: string;
  label: string;
  isActive: boolean;
}

const EMPTY_FORM: EditForm = { id: null, key: '', label: '', isActive: true };

const getStatusMeta = (subtext: string): Record<ApiKeyStatus | 'checking', { label: string; color: string }> => ({
  checking: { label: 'Checking...', color: subtext },
  ok: { label: '● Working', color: '#25d366' },
  quotaExceeded: { label: '● Quota Exceeded', color: '#e05c5c' },
  invalid: { label: '● Invalid Key', color: '#e65100' },
  error: { label: '● Check Failed', color: subtext },
});

function maskKey(key: string): string {
  if (key.length <= 8) return key;
  return `${key.slice(0, 4)}${'•'.repeat(Math.max(key.length - 8, 4))}${key.slice(-4)}`;
}

const ApiKeysAdmin = forwardRef<AdminScreenHandle, {}>((_props, ref) => {
  const dialog = useAppDialog();
  const { colors } = useTheme();
  const [keys, setKeys] = useState<BackupApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<EditForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [statusMap, setStatusMap] = useState<Record<string, ApiKeyStatus | 'checking'>>({});
  const [primaryStatus, setPrimaryStatus] = useState<ApiKeyStatus | 'checking'>('checking');
  const [pendingOrder, setPendingOrder] = useState(1);

  useImperativeHandle(ref, () => ({
    goBack: () => {
      if (showForm) {
        setShowForm(false);
        return true;
      }
      return false;
    },
  }));

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const cached = await getCachedApiKeys();
    if (cached.length > 0) {
      setKeys(cached);
      setLoading(false);
    }
    const fresh = await syncApiKeys();
    setKeys(fresh);
    setLoading(false);
    checkAllStatuses(fresh);
  };

  const checkAllStatuses = (list: BackupApiKey[]) => {
    setPrimaryStatus('checking');
    testApiKey(DEFAULT_API_KEY).then(status => setPrimaryStatus(status));

    const pending: Record<string, ApiKeyStatus | 'checking'> = {};
    list.forEach(k => { pending[k.id] = 'checking'; });
    setStatusMap(pending);

    list.forEach(k => {
      testApiKey(k.key).then(status => {
        setStatusMap(prev => ({ ...prev, [k.id]: status }));
      });
    });
  };

  const openAddForm = () => {
    const maxOrder = keys.length > 0 ? Math.max(...keys.map(k => k.order)) + 1 : 1;
    setForm(EMPTY_FORM);
    setPendingOrder(maxOrder);
    setShowForm(true);
  };

  const openEditForm = (item: BackupApiKey) => {
    setForm({ id: item.id, key: item.key, label: item.label, isActive: item.isActive });
    setPendingOrder(item.order);
    setShowForm(true);
  };

  const save = async () => {
    if (!form.label.trim()) {
      dialog.alert('Required', 'Please enter a label.');
      return;
    }
    if (!form.key.trim()) {
      dialog.alert('Required', 'Please enter an API key.');
      return;
    }
    setSaving(true);
    const currentUser = getAuth().currentUser?.email ?? 'unknown';
    try {
      if (form.id) {
        await updateApiKey(form.id, {
          key: form.key.trim(),
          label: form.label.trim(),
          isActive: form.isActive,
          order: pendingOrder,
          modifiedBy: currentUser,
        });
      } else {
        await addApiKey({
          key: form.key.trim(),
          label: form.label.trim(),
          isActive: form.isActive,
          order: pendingOrder,
          createdBy: currentUser,
        });
      }
      const fresh = await getCachedApiKeys();
      setKeys(fresh);
      dialog.alert('✅ Saved', form.id ? 'API key updated.' : 'API key added.');
      setShowForm(false);
      checkAllStatuses(fresh);
    } catch (e) {
      dialog.alert('Error', `Could not save: ${(e as any)?.message || 'Unknown error'}`);
    }
    setSaving(false);
  };

  const removeKey = (item: BackupApiKey) => {
    dialog.alert('Delete API Key', `Delete "${item.label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteApiKey(item.id);
            setKeys(prev => prev.filter(k => k.id !== item.id));
            dialog.alert('Deleted', 'API key removed.');
          } catch (e) {
            dialog.alert('Error', 'Could not delete.');
          }
        },
      },
    ]);
  };

  const toggleActive = async (item: BackupApiKey) => {
    setKeys(prev => prev.map(k => (k.id === item.id ? { ...k, isActive: !k.isActive } : k)));
    try {
      await setApiKeyActive(item.id, !item.isActive);
    } catch (e) {
      setKeys(prev => prev.map(k => (k.id === item.id ? { ...k, isActive: item.isActive } : k)));
      dialog.alert('Error', 'Could not update.');
    }
  };

  if (showForm) {
    return (
      <View style={styles.formContainer}>
        <View style={[styles.formHeader, { backgroundColor: colors.surface }]}>
          <TouchableOpacity onPress={() => setShowForm(false)}>
            <Text style={[styles.formBackText, { color: colors.accent }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.formTitle, { color: colors.text }]}>{form.id ? 'Edit API Key' : 'New API Key'}</Text>
        </View>

        <View style={{ padding: 16 }}>
          <Text style={[styles.fieldLabel, { color: colors.subtext }]}>Label *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider, color: colors.text }]}
            value={form.label}
            onChangeText={v => setForm(prev => ({ ...prev, label: v }))}
            placeholder="e.g. Backup Key 1"
            placeholderTextColor={colors.subtext}
          />

          <Text style={[styles.fieldLabel, { color: colors.subtext }]}>YouTube Data API Key *</Text>
          <Text style={[styles.fieldHint, { color: colors.subtext }]}>Must be from a separate Google Cloud project to provide extra quota.</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider, color: colors.text }]}
            value={form.key}
            onChangeText={v => setForm(prev => ({ ...prev, key: v }))}
            placeholder="AIzaSy..."
            placeholderTextColor={colors.subtext}
            autoCapitalize="none"
          />

          <View style={[styles.toggleRow, { backgroundColor: colors.surface }]}>
            <Text style={[styles.fieldLabel, { color: colors.subtext }]}>Active</Text>
            <Switch
              value={form.isActive}
              onValueChange={v => setForm(prev => ({ ...prev, isActive: v }))}
              trackColor={{ true: colors.accent, false: colors.divider }}
            />
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.accent }, saving && { opacity: 0.6 }]}
            onPress={save}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>
              {saving ? 'Saving...' : form.id ? '💾 Update Key' : '💾 Add Key'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const statusMeta = getStatusMeta(colors.subtext);
  const primaryMeta = statusMeta[primaryStatus];

  return (
    <View style={styles.container}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <View style={[styles.primaryCard, { backgroundColor: colors.raised, borderColor: colors.divider }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.primaryLabel, { color: colors.text }]}>Primary Key (from app config)</Text>
            <Text style={[styles.rowId, { color: colors.subtext }]}>{maskKey(DEFAULT_API_KEY)}</Text>
          </View>
          {primaryStatus === 'checking'
            ? <ActivityIndicator size="small" color={colors.accent} />
            : <Text style={[styles.statusText, { color: primaryMeta.color }]}>{primaryMeta.label}</Text>}
        </View>

        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.accent }]} onPress={openAddForm}>
          <Text style={styles.addBtnText}>＋ Add Backup API Key</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.recheckBtn} onPress={() => checkAllStatuses(keys)}>
          <Text style={[styles.recheckBtnText, { color: colors.accent }]}>🔄 Recheck Status</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={keys}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          renderItem={({ item }) => {
            const meta = statusMeta[statusMap[item.id] || 'checking'];
            return (
              <View style={[styles.row, { backgroundColor: colors.surface }]}>
                <TouchableOpacity style={styles.rowMain} onPress={() => openEditForm(item)}>
                  <Text style={[styles.rowLabel, { color: colors.text }]}>{item.label}</Text>
                  <Text style={[styles.rowId, { color: colors.subtext }]} numberOfLines={1}>{maskKey(item.key)}</Text>
                  {statusMap[item.id] === 'checking'
                    ? <ActivityIndicator size="small" color={colors.subtext} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
                    : <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>}
                </TouchableOpacity>
                <Switch
                  value={item.isActive}
                  onValueChange={() => toggleActive(item)}
                  trackColor={{ true: colors.accent, false: colors.divider }}
                />
                <TouchableOpacity style={styles.deleteBtn} onPress={() => removeKey(item)}>
                  <Text style={styles.deleteBtnText}>🗑</Text>
                </TouchableOpacity>
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.subtext }]}>No backup keys yet. Tap above to add one.</Text>
          }
        />
      )}
    </View>
  );
});

export default ApiKeysAdmin;

const styles = StyleSheet.create({
  container: { flex: 1 },
  primaryCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 14, marginBottom: 14,
    borderWidth: 1, gap: 10,
  },
  primaryLabel: { fontSize: 13, fontWeight: 'bold', marginBottom: 2 },
  addBtn: { borderRadius: 14, padding: 16, alignItems: 'center', elevation: 4 },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  recheckBtn: { alignItems: 'center', padding: 10, marginTop: 4 },
  recheckBtnText: { fontWeight: '600', fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
    gap: 10,
  },
  rowMain: { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
  rowId: { fontSize: 11, marginBottom: 4 },
  statusText: { fontSize: 11, fontWeight: '600' },
  deleteBtn: { backgroundColor: '#fdecea', borderRadius: 10, padding: 10, alignItems: 'center', width: 44 },
  deleteBtnText: { color: '#c62828', fontWeight: '600', fontSize: 13 },
  emptyText: { textAlign: 'center', marginTop: 40, fontStyle: 'italic' },
  formContainer: { flex: 1 },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, elevation: 2 },
  formBackText: { fontWeight: '600', fontSize: 15 },
  formTitle: { fontSize: 16, fontWeight: 'bold' },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  fieldHint: { fontSize: 11, marginBottom: 6, fontStyle: 'italic' },
  input: {
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    elevation: 2,
    borderWidth: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginTop: 16,
    elevation: 2,
  },
  saveBtn: {
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    elevation: 4,
  },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
