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
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useAppDialog } from '../AppDialog';
import { Text } from '../AppText';
import { TextInput } from '../AppTextInput';
import { db } from '../../firebaseConfig';
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
import { AdminScreenHandle } from './SpecialMeetingsAdmin';

interface EditForm {
  id: string | null;
  key: string;
  label: string;
  isActive: boolean;
}

const EMPTY_FORM: EditForm = { id: null, key: '', label: '', isActive: true };

const STATUS_META: Record<ApiKeyStatus | 'checking', { label: string; color: string }> = {
  checking: { label: 'Checking...', color: '#999' },
  ok: { label: '● Working', color: '#25d366' },
  quotaExceeded: { label: '● Quota Exceeded', color: '#e05c5c' },
  invalid: { label: '● Invalid Key', color: '#e65100' },
  error: { label: '● Check Failed', color: '#999' },
};

function maskKey(key: string): string {
  if (key.length <= 8) return key;
  return `${key.slice(0, 4)}${'•'.repeat(Math.max(key.length - 8, 4))}${key.slice(-4)}`;
}

const ApiKeysAdmin = forwardRef<AdminScreenHandle, {}>((_props, ref) => {
  const dialog = useAppDialog();
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
        await updateApiKey(form.id, { key: form.key.trim(), label: form.label.trim(), isActive: form.isActive, order: pendingOrder });
        await updateDoc(doc(db, 'YoutubeApiKeys', form.id), {
          modifiedBy: currentUser,
          modifiedAt: serverTimestamp(),
        });
      } else {
        const newId = await addApiKey({ key: form.key.trim(), label: form.label.trim(), isActive: form.isActive, order: pendingOrder });
        await updateDoc(doc(db, 'YoutubeApiKeys', newId), {
          createdBy: currentUser,
          modifiedBy: currentUser,
          modifiedAt: serverTimestamp(),
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
        <View style={styles.formHeader}>
          <TouchableOpacity onPress={() => setShowForm(false)}>
            <Text style={styles.formBackText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.formTitle}>{form.id ? 'Edit API Key' : 'New API Key'}</Text>
        </View>

        <View style={{ padding: 16 }}>
          <Text style={styles.fieldLabel}>Label *</Text>
          <TextInput
            style={styles.input}
            value={form.label}
            onChangeText={v => setForm(prev => ({ ...prev, label: v }))}
            placeholder="e.g. Backup Key 1"
            placeholderTextColor="#999"
          />

          <Text style={styles.fieldLabel}>YouTube Data API Key *</Text>
          <Text style={styles.fieldHint}>Must be from a separate Google Cloud project to provide extra quota.</Text>
          <TextInput
            style={styles.input}
            value={form.key}
            onChangeText={v => setForm(prev => ({ ...prev, key: v }))}
            placeholder="AIzaSy..."
            placeholderTextColor="#999"
            autoCapitalize="none"
          />

          <View style={styles.toggleRow}>
            <Text style={styles.fieldLabel}>Active</Text>
            <Switch
              value={form.isActive}
              onValueChange={v => setForm(prev => ({ ...prev, isActive: v }))}
              trackColor={{ true: '#0f3460', false: '#ccc' }}
            />
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
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

  const primaryMeta = STATUS_META[primaryStatus];

  return (
    <View style={styles.container}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <View style={styles.primaryCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.primaryLabel}>Primary Key (from app config)</Text>
            <Text style={styles.rowId}>{maskKey(DEFAULT_API_KEY)}</Text>
          </View>
          {primaryStatus === 'checking'
            ? <ActivityIndicator size="small" color="#0f3460" />
            : <Text style={[styles.statusText, { color: primaryMeta.color }]}>{primaryMeta.label}</Text>}
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={openAddForm}>
          <Text style={styles.addBtnText}>＋ Add Backup API Key</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.recheckBtn} onPress={() => checkAllStatuses(keys)}>
          <Text style={styles.recheckBtnText}>🔄 Recheck Status</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#0f3460" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={keys}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          renderItem={({ item }) => {
            const meta = STATUS_META[statusMap[item.id] || 'checking'];
            return (
              <View style={styles.row}>
                <TouchableOpacity style={styles.rowMain} onPress={() => openEditForm(item)}>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  <Text style={styles.rowId} numberOfLines={1}>{maskKey(item.key)}</Text>
                  {statusMap[item.id] === 'checking'
                    ? <ActivityIndicator size="small" color="#999" style={{ alignSelf: 'flex-start', marginTop: 4 }} />
                    : <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>}
                </TouchableOpacity>
                <Switch
                  value={item.isActive}
                  onValueChange={() => toggleActive(item)}
                  trackColor={{ true: '#0f3460', false: '#ccc' }}
                />
                <TouchableOpacity style={styles.deleteBtn} onPress={() => removeKey(item)}>
                  <Text style={styles.deleteBtnText}>🗑</Text>
                </TouchableOpacity>
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No backup keys yet. Tap above to add one.</Text>
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
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#eef2fb', borderRadius: 12, padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: '#dbe3f5', gap: 10,
  },
  primaryLabel: { fontSize: 13, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 2 },
  addBtn: { backgroundColor: '#0f3460', borderRadius: 14, padding: 16, alignItems: 'center', elevation: 4 },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  recheckBtn: { alignItems: 'center', padding: 10, marginTop: 4 },
  recheckBtnText: { color: '#0f3460', fontWeight: '600', fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
    gap: 10,
  },
  rowMain: { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 2 },
  rowId: { fontSize: 11, color: '#888', marginBottom: 4 },
  statusText: { fontSize: 11, fontWeight: '600' },
  deleteBtn: { backgroundColor: '#fdecea', borderRadius: 10, padding: 10, alignItems: 'center', width: 44 },
  deleteBtnText: { color: '#c62828', fontWeight: '600', fontSize: 13 },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 40, fontStyle: 'italic' },
  formContainer: { flex: 1 },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, backgroundColor: '#fff', elevation: 2 },
  formBackText: { color: '#0f3460', fontWeight: '600', fontSize: 15 },
  formTitle: { fontSize: 16, fontWeight: 'bold', color: '#1a1a2e' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 14 },
  fieldHint: { fontSize: 11, color: '#999', marginBottom: 6, fontStyle: 'italic' },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#eee',
    color: '#1a1a2e',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    marginTop: 16,
    elevation: 2,
  },
  saveBtn: {
    backgroundColor: '#0f3460',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    elevation: 4,
  },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
