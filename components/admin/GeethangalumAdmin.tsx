import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAppDialog } from '../AppDialog';
import { Text } from '../AppText';
import { TextInput } from '../AppTextInput';
import { SongIndexEntry, getSongById, getSongsIndex, syncSongs, updateGeethangalumSong } from '../../utils/songsSync';
import { useTheme } from '../../utils/ThemeContext';
import { AdminScreenHandle } from './SpecialMeetingsAdmin';

interface EditForm {
  songId: string;
  songNumber: number;
  title: string;
  lyricsTamil: string;
  lyricsEnglish: string;
}

const GeethangalumAdmin = forwardRef<AdminScreenHandle, {}>((_props, ref) => {
  const dialog = useAppDialog();
  const { colors } = useTheme();
  const [songsIndex, setSongsIndex] = useState<SongIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [loadingSong, setLoadingSong] = useState(false);
  const [saving, setSaving] = useState(false);

  useImperativeHandle(ref, () => ({
    goBack: () => {
      if (editForm) {
        setEditForm(null);
        return true;
      }
      return false;
    },
  }));

  useEffect(() => {
    loadIndex();
  }, []);

  const loadIndex = async () => {
    const cached = await getSongsIndex();
    if (cached.length > 0) {
      setSongsIndex(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    setSyncing(true);
    const result = await syncSongs();
    setSongsIndex(result.index);
    setLoading(false);
    setSyncing(false);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return songsIndex;
    const isNumeric = /^\d+$/.test(q);
    if (isNumeric) return songsIndex.filter(s => String(s.songNumber).startsWith(q));
    return songsIndex.filter(
      s => s.title.toLowerCase().includes(q) || (s.titleEnglish && s.titleEnglish.toLowerCase().includes(q))
    );
  }, [search, songsIndex]);

  const openEdit = async (entry: SongIndexEntry) => {
    setLoadingSong(true);
    const full = await getSongById(entry.songId);
    setLoadingSong(false);
    if (!full) {
      dialog.alert('Error', 'Could not load song details.');
      return;
    }
    setEditForm({
      songId: full.songId,
      songNumber: full.songNumber,
      title: full.title,
      lyricsTamil: full.lyrics.tamil,
      lyricsEnglish: full.lyrics.english,
    });
  };

  const save = async () => {
    if (!editForm) return;
    if (!editForm.title.trim()) {
      dialog.alert('Required', 'Title cannot be empty.');
      return;
    }
    if (!editForm.lyricsTamil.trim()) {
      dialog.alert('Required', 'Tamil lyrics cannot be empty.');
      return;
    }
    if (!editForm.lyricsEnglish.trim()) {
      dialog.alert('Required', 'English lyrics cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      await updateGeethangalumSong(editForm.songId, {
        title: editForm.title,
        lyrics: { tamil: editForm.lyricsTamil, english: editForm.lyricsEnglish },
      });
      setSongsIndex(prev =>
        prev.map(s => (s.songId === editForm.songId ? { ...s, title: editForm.title } : s))
      );
      dialog.alert('✅ Saved', 'Song updated successfully.');
      setEditForm(null);
    } catch (e) {
      dialog.alert('Error', 'Could not save. Check internet.');
    }
    setSaving(false);
  };

  if (editForm) {
    return (
      <View style={styles.formContainer}>
        <View style={[styles.formHeader, { backgroundColor: colors.surface }]}>
          <TouchableOpacity onPress={() => setEditForm(null)}>
            <Text style={[styles.formBackText, { color: colors.accent }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.formTitle, { color: colors.text }]}>Edit Song #{editForm.songNumber}</Text>
        </View>

        <FlatList
          data={[1]}
          keyExtractor={() => 'form'}
          renderItem={() => (
            <View style={{ padding: 16 }}>
              <Text style={[styles.fieldLabel, { color: colors.subtext }]}>Song Number (locked)</Text>
              <View style={[styles.lockedField, { backgroundColor: colors.raised }]}>
                <Text style={[styles.lockedFieldText, { color: colors.subtext }]}>{editForm.songNumber}</Text>
              </View>

              <Text style={[styles.fieldLabel, { color: colors.subtext }]}>Title *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider, color: colors.text }]}
                value={editForm.title}
                onChangeText={v => setEditForm(prev => prev && { ...prev, title: v })}
                placeholder="Song title (Tamil)"
                placeholderTextColor={colors.subtext}
              />

              <Text style={[styles.fieldLabel, { color: colors.subtext }]}>Lyrics (Tamil) *</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider, color: colors.text }]}
                value={editForm.lyricsTamil}
                onChangeText={v => setEditForm(prev => prev && { ...prev, lyricsTamil: v })}
                placeholder="Tamil lyrics"
                placeholderTextColor={colors.subtext}
                multiline
                textAlignVertical="top"
              />

              <Text style={[styles.fieldLabel, { color: colors.subtext }]}>Lyrics (English) *</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider, color: colors.text }]}
                value={editForm.lyricsEnglish}
                onChangeText={v => setEditForm(prev => prev && { ...prev, lyricsEnglish: v })}
                placeholder="English lyrics"
                placeholderTextColor={colors.subtext}
                multiline
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.accent }, saving && { opacity: 0.6 }]}
                onPress={save}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>{saving ? 'Saving...' : '💾 Save Changes'}</Text>
              </TouchableOpacity>
              <View style={{ height: 30 }} />
            </View>
          )}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider, color: colors.text }]}
          placeholder="Search by song number or title"
          placeholderTextColor={colors.subtext}
          value={search}
          onChangeText={setSearch}
        />
        {syncing && <ActivityIndicator size="small" color={colors.accent} style={{ marginLeft: 8 }} />}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.songId}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          initialNumToRender={20}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.songRow, { backgroundColor: colors.surface }]} onPress={() => openEdit(item)} disabled={loadingSong}>
              <View style={[styles.songNumberBadge, { backgroundColor: colors.accent }]}>
                <Text style={styles.songNumberText}>{item.songNumber}</Text>
              </View>
              <Text style={[styles.songTitle, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
              {loadingSong && <ActivityIndicator size="small" color={colors.accent} />}
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.subtext }]}>No songs found</Text>}
        />
      )}
    </View>
  );
});

export default GeethangalumAdmin;

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBar: { paddingHorizontal: 16, paddingTop: 12, flexDirection: 'row', alignItems: 'center' },
  searchInput: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
    gap: 12,
  },
  songNumberBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  songNumberText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  songTitle: { flex: 1, fontSize: 14, lineHeight: 19 },
  emptyText: { textAlign: 'center', marginTop: 40 },
  formContainer: { flex: 1 },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    elevation: 2,
  },
  formBackText: { fontWeight: '600', fontSize: 15 },
  formTitle: { fontSize: 16, fontWeight: 'bold' },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  fieldHint: { fontSize: 11, color: '#999', marginBottom: 6, fontStyle: 'italic' },
  input: {
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    elevation: 2,
    borderWidth: 1,
  },
  // Tamil and English lyrics fields both use this one style, so they stay
  // the same height as each other on every screen size by construction.
  textArea: { minHeight: 340 },
  lockedField: {
    borderRadius: 10,
    padding: 12,
  },
  lockedFieldText: { fontSize: 15, fontWeight: '600' },
  saveBtn: {
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    elevation: 4,
  },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
