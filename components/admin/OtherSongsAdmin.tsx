import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAppDialog } from '../AppDialog';
import { Text } from '../AppText';
import { TextInput } from '../AppTextInput';
import {
  OtherSongIndexEntry,
  addOtherSong,
  extractEnglishTitle,
  getOtherSongById,
  getOtherSongsIndex,
  setOtherSongVisibility,
  syncOtherSongs,
  updateOtherSong,
} from '../../utils/otherSongsSync';
import { useTheme } from '../../utils/ThemeContext';
import { AdminScreenHandle } from './SpecialMeetingsAdmin';

interface EditForm {
  songId: string | null;
  songNumber: number | null;
  title: string;
  titleEnglish: string;
  lyricsTamil: string;
  lyricsEnglish: string;
  isVisible: boolean;
}

const EMPTY_FORM: EditForm = {
  songId: null,
  songNumber: null,
  title: '',
  titleEnglish: '',
  lyricsTamil: '',
  lyricsEnglish: '',
  isVisible: true,
};

const OtherSongsAdmin = forwardRef<AdminScreenHandle, {}>((_props, ref) => {
  const dialog = useAppDialog();
  const { colors } = useTheme();
  const [songsIndex, setSongsIndex] = useState<OtherSongIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<EditForm>(EMPTY_FORM);
  const [loadingSong, setLoadingSong] = useState(false);
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
    loadIndex();
  }, []);

  const loadIndex = async () => {
    const cached = await getOtherSongsIndex();
    if (cached.length > 0) {
      setSongsIndex(cached.sort((a, b) => a.songNumber - b.songNumber));
      setLoading(false);
    } else {
      setLoading(true);
    }

    setSyncing(true);
    const result = await syncOtherSongs();
    setSongsIndex(result.index.sort((a, b) => a.songNumber - b.songNumber));
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

  const openAddForm = () => {
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEditForm = async (entry: OtherSongIndexEntry) => {
    setLoadingSong(true);
    const full = await getOtherSongById(entry.songId);
    setLoadingSong(false);
    if (!full) {
      dialog.alert('Error', 'Could not load song details.');
      return;
    }
    setForm({
      songId: full.songId,
      songNumber: full.songNumber,
      title: full.title.replace(/^\d+\.\s*/, '').trim(),
      titleEnglish: full.titleEnglish || '',
      lyricsTamil: full.lyrics.tamil,
      lyricsEnglish: full.lyrics.english,
      isVisible: full.isVisible !== false,
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.title.trim()) {
      dialog.alert('Required', 'Title (Tamil) cannot be empty.');
      return;
    }
    if (!form.titleEnglish.trim()) {
      dialog.alert('Required', 'Title (English) cannot be empty.');
      return;
    }
    if (!form.lyricsTamil.trim()) {
      dialog.alert('Required', 'Tamil lyrics cannot be empty.');
      return;
    }
    if (!form.lyricsEnglish.trim()) {
      dialog.alert('Required', 'English lyrics cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      const finalTitleEnglish = form.titleEnglish.trim() || extractEnglishTitle(form.lyricsEnglish);
      if (form.songId) {
        await updateOtherSong(form.songId, {
          title: form.title,
          lyrics: { tamil: form.lyricsTamil, english: form.lyricsEnglish },
          titleEnglish: finalTitleEnglish,
          ...(form.isVisible !== undefined ? { isVisible: form.isVisible } : {}),
        });
      } else {
        await addOtherSong({
          title: form.title,
          lyrics: { tamil: form.lyricsTamil, english: form.lyricsEnglish },
          isVisible: form.isVisible,
          titleEnglish: finalTitleEnglish,
        });
      }
      await loadIndex();
      dialog.alert('✅ Saved', form.songId ? 'Song updated successfully.' : 'Song added successfully.');
      setShowForm(false);
    } catch (e) {
      dialog.alert('Error', 'Could not save. Check internet.');
    }
    setSaving(false);
  };

  const toggleVisibility = async (entry: OtherSongIndexEntry) => {
    const newValue = !(entry.isVisible !== false);
    setSongsIndex(prev =>
      prev.map(s => (s.songId === entry.songId ? { ...s, isVisible: newValue } : s))
    );
    try {
      await setOtherSongVisibility(entry.songId, newValue);
    } catch (e) {
      setSongsIndex(prev =>
        prev.map(s => (s.songId === entry.songId ? { ...s, isVisible: entry.isVisible } : s))
      );
      dialog.alert('Error', 'Could not update visibility.');
    }
  };

  if (showForm) {
    return (
      <View style={styles.formContainer}>
        <View style={[styles.formHeader, { backgroundColor: colors.surface }]}>
          <TouchableOpacity onPress={() => setShowForm(false)}>
            <Text style={[styles.formBackText, { color: colors.accent }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.formTitle, { color: colors.text }]}>
            {form.songId ? `Edit Special Song #${form.songNumber}` : 'New Special Song'}
          </Text>
        </View>

        <FlatList
          data={[1]}
          keyExtractor={() => 'form'}
          renderItem={() => (
            <View style={{ padding: 16 }}>
              <Text style={[styles.fieldLabel, { color: colors.subtext }]}>Title (Tamil) *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider, color: colors.text }]}
                value={form.title}
                onChangeText={v => setForm(prev => ({ ...prev, title: v }))}
                placeholder="e.g. உமது முகம் நோக்கிப் பார்த்தவர்கள்"
                placeholderTextColor={colors.subtext}
              />

              <Text style={[styles.fieldLabel, { color: colors.subtext }]}>Title (English) *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider, color: colors.text }]}
                value={form.titleEnglish}
                onChangeText={v => setForm(prev => ({ ...prev, titleEnglish: v }))}
                placeholder="e.g. Umathu mukam Nnokkip paarththavarkal"
                placeholderTextColor={colors.subtext}
              />

              <Text style={[styles.fieldLabel, { color: colors.subtext }]}>Lyrics (Tamil) *</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider, color: colors.text }]}
                value={form.lyricsTamil}
                onChangeText={v => setForm(prev => ({ ...prev, lyricsTamil: v }))}
                placeholder="Tamil lyrics"
                placeholderTextColor={colors.subtext}
                multiline
                textAlignVertical="top"
              />

              <Text style={[styles.fieldLabel, { color: colors.subtext }]}>Lyrics (English) *</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider, color: colors.text }]}
                value={form.lyricsEnglish}
                onChangeText={v => setForm(prev => ({ ...prev, lyricsEnglish: v }))}
                placeholder="English transliteration of lyrics"
                placeholderTextColor={colors.subtext}
                multiline
                textAlignVertical="top"
              />

              <View style={[styles.toggleRow, { backgroundColor: colors.surface }]}>
                <Text style={[styles.fieldLabel, { color: colors.subtext }]}>Show to users</Text>
                <Switch
                  value={form.isVisible}
                  onValueChange={v => setForm(prev => ({ ...prev, isVisible: v }))}
                  trackColor={{ true: colors.accent, false: colors.divider }}
                />
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.accent }, saving && { opacity: 0.6 }]}
                onPress={save}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>
                  {saving ? 'Saving...' : form.songId ? '💾 Update Song' : '💾 Add Song'}
                </Text>
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
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <View style={styles.addRow}>
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.accent }]} onPress={openAddForm}>
            <Text style={styles.addBtnText}>＋ Add New Song</Text>
          </TouchableOpacity>
          <View style={styles.syncSlot}>
            {syncing && <ActivityIndicator size="small" color={colors.accent} />}
          </View>
        </View>
        <View style={styles.searchBar}>
          <TextInput
            style={[styles.searchInput, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider, color: colors.text }]}
            placeholder="Search by song number or title"
            placeholderTextColor={colors.subtext}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.songId}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          initialNumToRender={20}
          renderItem={({ item }) => {
            const isVisible = item.isVisible !== false;
            return (
              <View style={[styles.songRow, { backgroundColor: colors.surface }]}>
                <TouchableOpacity
                  style={styles.songRowMain}
                  onPress={() => openEditForm(item)}
                  disabled={loadingSong}
                >
                  <View style={[styles.songNumberBadge, { backgroundColor: isVisible ? colors.accent : colors.divider }]}>
                    <Text style={styles.songNumberText}>{item.songNumber}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.songTitle, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
                    <Text style={[styles.visibilityText, { color: isVisible ? '#25d366' : colors.subtext }]}>
                      {isVisible ? '● Visible to users' : '● Hidden'}
                    </Text>
                  </View>
                </TouchableOpacity>
                <Switch
                  value={isVisible}
                  onValueChange={() => toggleVisibility(item)}
                  trackColor={{ true: colors.accent, false: colors.divider }}
                />
              </View>
            );
          }}
          ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.subtext }]}>No songs yet. Tap above to add one.</Text>}
        />
      )}
    </View>
  );
});

export default OtherSongsAdmin;

const styles = StyleSheet.create({
  container: { flex: 1 },
  addRow: { flexDirection: 'row', alignItems: 'center' },
  syncSlot: { width: 36, alignItems: 'center', justifyContent: 'center' },
  addBtn: {
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    elevation: 4,
    flex: 1,
  },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  searchBar: { marginTop: 12 },
  searchInput: {
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
    gap: 10,
  },
  songRowMain: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  songNumberBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  songNumberText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  songTitle: { fontSize: 14, lineHeight: 19, marginBottom: 4 },
  visibilityText: { fontSize: 11, fontWeight: '600' },
  emptyText: { textAlign: 'center', marginTop: 40, fontStyle: 'italic' },
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
