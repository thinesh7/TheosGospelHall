import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
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
  OtherSongIndexEntry,
  addOtherSong,
  extractEnglishTitle,
  getOtherSongById,
  getOtherSongsIndex,
  setOtherSongVisibility,
  syncOtherSongs,
  updateOtherSong,
} from '../../utils/otherSongsSync';
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
      Alert.alert('Error', 'Could not load song details.');
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
      Alert.alert('Required', 'Title (Tamil) cannot be empty.');
      return;
    }
    if (!form.titleEnglish.trim()) {
      Alert.alert('Required', 'Title (English) cannot be empty.');
      return;
    }
    if (!form.lyricsTamil.trim()) {
      Alert.alert('Required', 'Tamil lyrics cannot be empty.');
      return;
    }
    if (!form.lyricsEnglish.trim()) {
      Alert.alert('Required', 'English lyrics cannot be empty.');
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
        });
        if (form.isVisible !== undefined) {
          await setOtherSongVisibility(form.songId, form.isVisible);
        }
      } else {
        await addOtherSong({
          title: form.title,
          lyrics: { tamil: form.lyricsTamil, english: form.lyricsEnglish },
          isVisible: form.isVisible,
          titleEnglish: finalTitleEnglish,
        });
      }
      await loadIndex();
      Alert.alert('✅ Saved', form.songId ? 'Song updated successfully.' : 'Song added successfully.');
      setShowForm(false);
    } catch (e) {
      Alert.alert('Error', 'Could not save. Check internet.');
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
      Alert.alert('Error', 'Could not update visibility.');
    }
  };

  if (showForm) {
    return (
      <View style={styles.formContainer}>
        <View style={styles.formHeader}>
          <TouchableOpacity onPress={() => setShowForm(false)}>
            <Text style={styles.formBackText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.formTitle}>
            {form.songId ? `Edit Special Song #${form.songNumber}` : 'New Special Song'}
          </Text>
        </View>

        <FlatList
          data={[1]}
          keyExtractor={() => 'form'}
          renderItem={() => (
            <View style={{ padding: 16 }}>
              <Text style={styles.fieldLabel}>Title (Tamil) *</Text>
              <TextInput
                style={styles.input}
                value={form.title}
                onChangeText={v => setForm(prev => ({ ...prev, title: v }))}
                placeholder="e.g. உமது முகம் நோக்கிப் பார்த்தவர்கள்"
                placeholderTextColor="#999"
              />

              <Text style={styles.fieldLabel}>Title (English) *</Text>
              <TextInput
                style={styles.input}
                value={form.titleEnglish}
                onChangeText={v => setForm(prev => ({ ...prev, titleEnglish: v }))}
                placeholder="e.g. Umathu mukam Nnokkip paarththavarkal"
                placeholderTextColor="#999"
              />

              <Text style={styles.fieldLabel}>Lyrics (Tamil) *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={form.lyricsTamil}
                onChangeText={v => setForm(prev => ({ ...prev, lyricsTamil: v }))}
                placeholder="Tamil lyrics"
                placeholderTextColor="#999"
                multiline
                textAlignVertical="top"
              />

              <Text style={styles.fieldLabel}>Lyrics (English) *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={form.lyricsEnglish}
                onChangeText={v => setForm(prev => ({ ...prev, lyricsEnglish: v }))}
                placeholder="English transliteration of lyrics"
                placeholderTextColor="#999"
                multiline
                textAlignVertical="top"
              />

              <View style={styles.toggleRow}>
                <Text style={styles.fieldLabel}>Show to users</Text>
                <Switch
                  value={form.isVisible}
                  onValueChange={v => setForm(prev => ({ ...prev, isVisible: v }))}
                  trackColor={{ true: '#0f3460', false: '#ccc' }}
                />
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
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
          <TouchableOpacity style={styles.addBtn} onPress={openAddForm}>
            <Text style={styles.addBtnText}>＋ Add New Song</Text>
          </TouchableOpacity>
          <View style={styles.syncSlot}>
            {syncing && <ActivityIndicator size="small" color="#0f3460" />}
          </View>
        </View>
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by song number or title"
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#0f3460" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.songId}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          initialNumToRender={20}
          renderItem={({ item }) => {
            const isVisible = item.isVisible !== false;
            return (
              <View style={styles.songRow}>
                <TouchableOpacity
                  style={styles.songRowMain}
                  onPress={() => openEditForm(item)}
                  disabled={loadingSong}
                >
                  <View style={[styles.songNumberBadge, !isVisible && { backgroundColor: '#ccc' }]}>
                    <Text style={styles.songNumberText}>{item.songNumber}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.songTitle} numberOfLines={2}>{item.title}</Text>
                    <Text style={[styles.visibilityText, { color: isVisible ? '#25d366' : '#999' }]}>
                      {isVisible ? '● Visible to users' : '● Hidden'}
                    </Text>
                  </View>
                </TouchableOpacity>
                <Switch
                  value={isVisible}
                  onValueChange={() => toggleVisibility(item)}
                  trackColor={{ true: '#0f3460', false: '#ccc' }}
                />
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.emptyText}>No songs yet. Tap above to add one.</Text>}
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
    backgroundColor: '#0f3460',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    elevation: 4,
    flex: 1,
  },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  searchBar: { marginTop: 12 },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#eee',
    color: '#1a1a2e',
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
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
    backgroundColor: '#0f3460',
    alignItems: 'center',
    justifyContent: 'center',
  },
  songNumberText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  songTitle: { fontSize: 14, color: '#1a1a2e', lineHeight: 19, marginBottom: 4 },
  visibilityText: { fontSize: 11, fontWeight: '600' },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 40, fontStyle: 'italic' },
  formContainer: { flex: 1 },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    backgroundColor: '#fff',
    elevation: 2,
  },
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
  textArea: { minHeight: 140 },
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
