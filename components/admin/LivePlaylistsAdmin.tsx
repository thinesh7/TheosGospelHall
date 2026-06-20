import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  LivePlaylist,
  addLivePlaylist,
  getCachedLivePlaylists,
  setLivePlaylistActive,
  syncLivePlaylists,
  updateLivePlaylist,
} from '../../utils/livePlaylistsSync';
import { AdminScreenHandle } from './SpecialMeetingsAdmin';

interface EditForm {
  id: string | null;
  playlistId: string;
  label: string;
  isActive: boolean;
}

const EMPTY_FORM: EditForm = { id: null, playlistId: '', label: '', isActive: true };

const LivePlaylistsAdmin = forwardRef<AdminScreenHandle, {}>((_props, ref) => {
  const [playlists, setPlaylists] = useState<LivePlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<EditForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

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
    const cached = await getCachedLivePlaylists();
    if (cached.length > 0) {
      setPlaylists(cached);
      setLoading(false);
    }
    const fresh = await syncLivePlaylists();
    setPlaylists(fresh);
    setLoading(false);
  };

  const openAddForm = () => {
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEditForm = (item: LivePlaylist) => {
    setForm({ id: item.id, playlistId: item.playlistId, label: item.label, isActive: item.isActive });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.playlistId.trim()) {
      Alert.alert('Required', 'Please enter a playlist ID.');
      return;
    }
    if (!form.label.trim()) {
      Alert.alert('Required', 'Please enter a label.');
      return;
    }
    setSaving(true);
    try {
      if (form.id) {
        await updateLivePlaylist(form.id, { playlistId: form.playlistId.trim(), label: form.label.trim() });
      } else {
        await addLivePlaylist({ playlistId: form.playlistId.trim(), label: form.label.trim(), isActive: form.isActive });
      }
      const fresh = await getCachedLivePlaylists();
      setPlaylists(fresh);
      Alert.alert('✅ Saved', form.id ? 'Playlist updated.' : 'Playlist added.');
      setShowForm(false);
    } catch (e) {
      console.error('[LivePlaylistsAdmin] save failed:', e);
      Alert.alert('Error', `Could not save: ${(e as any)?.message || 'Unknown error'}`);
    }
    setSaving(false);
  };

  const toggleActive = async (item: LivePlaylist) => {
    setPlaylists(prev => prev.map(p => (p.id === item.id ? { ...p, isActive: !p.isActive } : p)));
    try {
      await setLivePlaylistActive(item.id, !item.isActive);
    } catch (e) {
      setPlaylists(prev => prev.map(p => (p.id === item.id ? { ...p, isActive: item.isActive } : p)));
      Alert.alert('Error', 'Could not update.');
    }
  };

  if (showForm) {
    return (
      <View style={styles.formContainer}>
        <View style={styles.formHeader}>
          <TouchableOpacity onPress={() => setShowForm(false)}>
            <Text style={styles.formBackText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.formTitle}>{form.id ? 'Edit Playlist' : 'New Playlist'}</Text>
        </View>

        <View style={{ padding: 16 }}>
          <Text style={styles.fieldLabel}>Label (for your reference)</Text>
          <TextInput
            style={styles.input}
            value={form.label}
            onChangeText={v => setForm(prev => ({ ...prev, label: v }))}
            placeholder="e.g. Sunday Sermons"
            placeholderTextColor="#999"
          />

          <Text style={styles.fieldLabel}>YouTube Playlist ID</Text>
          <Text style={styles.fieldHint}>Found in the playlist URL after "list="</Text>
          <TextInput
            style={styles.input}
            value={form.playlistId}
            onChangeText={v => setForm(prev => ({ ...prev, playlistId: v }))}
            placeholder="e.g. PLZISpWbe8RUidyhPJNs5xa8-WOnHq-NLj"
            placeholderTextColor="#999"
            autoCapitalize="none"
          />

          {!form.id && (
            <View style={styles.toggleRow}>
              <Text style={styles.fieldLabel}>Active</Text>
              <Switch
                value={form.isActive}
                onValueChange={v => setForm(prev => ({ ...prev, isActive: v }))}
                trackColor={{ true: '#0f3460', false: '#ccc' }}
              />
            </View>
          )}

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={save}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>
              {saving ? 'Saving...' : form.id ? '💾 Update Playlist' : '💾 Add Playlist'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <TouchableOpacity style={styles.addBtn} onPress={openAddForm}>
          <Text style={styles.addBtnText}>＋ Add New Playlist</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#0f3460" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={playlists}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <TouchableOpacity style={styles.rowMain} onPress={() => openEditForm(item)}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Text style={styles.rowId} numberOfLines={1}>{item.playlistId}</Text>
                <Text style={[styles.statusText, { color: item.isActive ? '#25d366' : '#999' }]}>
                  {item.isActive ? '● Active' : '● Inactive'}
                </Text>
              </TouchableOpacity>
              <Switch
                value={item.isActive}
                onValueChange={() => toggleActive(item)}
                trackColor={{ true: '#0f3460', false: '#ccc' }}
              />
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No playlists yet. Tap above to add one.</Text>
          }
        />
      )}
    </View>
  );
});

export default LivePlaylistsAdmin;

const styles = StyleSheet.create({
  container: { flex: 1 },
  addBtn: { backgroundColor: '#0f3460', borderRadius: 14, padding: 16, alignItems: 'center', elevation: 4 },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
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
