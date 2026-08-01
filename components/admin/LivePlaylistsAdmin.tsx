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
  LivePlaylist,
  addLivePlaylist,
  deleteLivePlaylist,
  getCachedLivePlaylists,
  setLivePlaylistActive,
  syncLivePlaylists,
  updateLivePlaylist,
} from '../../utils/livePlaylistsSync';
import { useTheme } from '../../utils/ThemeContext';
import { AdminScreenHandle } from './SpecialMeetingsAdmin';

interface EditForm {
  id: string | null;
  playlistId: string;
  label: string;
  isActive: boolean;
}

const EMPTY_FORM: EditForm = { id: null, playlistId: '', label: '', isActive: true };

const LivePlaylistsAdmin = forwardRef<AdminScreenHandle, {}>((_props, ref) => {
  const dialog = useAppDialog();
  const { colors } = useTheme();
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
    if (!form.label.trim()) {
      dialog.alert('Required', 'Please enter a label.');
      return;
    }
    if (!form.playlistId.trim()) {
      dialog.alert('Required', 'Please enter a playlist ID.');
      return;
    }
    setSaving(true);
    const currentUser = getAuth().currentUser?.email ?? 'unknown';
    try {
      if (form.id) {
        await updateLivePlaylist(form.id, {
          playlistId: form.playlistId.trim(),
          label: form.label.trim(),
          isActive: form.isActive,
          modifiedBy: currentUser,
        });
      } else {
        await addLivePlaylist({
          playlistId: form.playlistId.trim(),
          label: form.label.trim(),
          isActive: form.isActive,
          createdBy: currentUser,
        });
      }
      const fresh = await getCachedLivePlaylists();
      setPlaylists(fresh);
      dialog.alert('✅ Saved', form.id ? 'Playlist updated.' : 'Playlist added.');
      setShowForm(false);
    } catch (e) {
      dialog.alert('Error', `Could not save: ${(e as any)?.message || 'Unknown error'}`);
    }
    setSaving(false);
  };

  const deletePlaylist = (item: LivePlaylist) => {
    dialog.alert('Delete Playlist', `Delete "${item.label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteLivePlaylist(item.id);
            setPlaylists(prev => prev.filter(p => p.id !== item.id));
            dialog.alert('Deleted', 'Playlist removed.');
          } catch (e) {
            dialog.alert('Error', 'Could not delete.');
          }
        },
      },
    ]);
  };

  const toggleActive = async (item: LivePlaylist) => {
    setPlaylists(prev => prev.map(p => (p.id === item.id ? { ...p, isActive: !p.isActive } : p)));
    try {
      await setLivePlaylistActive(item.id, !item.isActive);
    } catch (e) {
      setPlaylists(prev => prev.map(p => (p.id === item.id ? { ...p, isActive: item.isActive } : p)));
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
          <Text style={[styles.formTitle, { color: colors.text }]}>{form.id ? 'Edit Playlist' : 'New Playlist'}</Text>
        </View>

        <View style={{ padding: 16 }}>
          <Text style={[styles.fieldLabel, { color: colors.subtext }]}>Label *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider, color: colors.text }]}
            value={form.label}
            onChangeText={v => setForm(prev => ({ ...prev, label: v }))}
            placeholder="e.g. Sunday Sermons"
            placeholderTextColor={colors.subtext}
          />

          <Text style={[styles.fieldLabel, { color: colors.subtext }]}>YouTube Playlist ID *</Text>
          <Text style={[styles.fieldHint, { color: colors.subtext }]}>Found in the playlist URL after "list="</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider, color: colors.text }]}
            value={form.playlistId}
            onChangeText={v => setForm(prev => ({ ...prev, playlistId: v }))}
            placeholder="e.g. PLZISpWbe8RUidyhPJNs5xa8-WOnHq-NLj"
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
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.accent }]} onPress={openAddForm}>
          <Text style={styles.addBtnText}>＋ Add New Playlist</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={playlists}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          renderItem={({ item }) => (
            <View style={[styles.row, { backgroundColor: colors.surface }]}>
              <TouchableOpacity style={styles.rowMain} onPress={() => openEditForm(item)}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>{item.label}</Text>
                <Text style={[styles.rowId, { color: colors.subtext }]} numberOfLines={1}>{item.playlistId}</Text>
                <Text style={[styles.statusText, { color: item.isActive ? '#25d366' : colors.subtext }]}>
                  {item.isActive ? '● Active' : '● Inactive'}
                </Text>
              </TouchableOpacity>
              <Switch
                value={item.isActive}
                onValueChange={() => toggleActive(item)}
                trackColor={{ true: colors.accent, false: colors.divider }}
              />
              <TouchableOpacity style={styles.deleteBtn} onPress={() => deletePlaylist(item)}>
                <Text style={styles.deleteBtnText}>🗑</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.subtext }]}>No playlists yet. Tap above to add one.</Text>
          }
        />
      )}
    </View>
  );
});

export default LivePlaylistsAdmin;

const styles = StyleSheet.create({
  container: { flex: 1 },
  addBtn: { borderRadius: 14, padding: 16, alignItems: 'center', elevation: 4 },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
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
