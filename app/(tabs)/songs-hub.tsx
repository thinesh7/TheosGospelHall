import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { THEMES, ThemeName, getStoredTheme } from '../../utils/songsTheme';
import OtherSongsScreen from './other-songs';
import SongsScreen from './songs';

type CollectionTab = 'geethangalum' | 'other';

const OPTIONS: { id: CollectionTab; label: string }[] = [
  { id: 'geethangalum', label: 'Geethangalum Keerthanaigalum' },
  { id: 'other', label: 'Other Songs' },
];

export default function SongsHubScreen() {
  const [activeCollection, setActiveCollection] = useState<CollectionTab>('geethangalum');
  const [theme, setTheme] = useState<ThemeName>('dark');

  useEffect(() => {
    getStoredTheme().then(setTheme);
  }, []);

  const c = THEMES[theme];

  const segmentedToggle = (
    <View style={[styles.segmentedToggle, { backgroundColor: c.searchBg, borderColor: c.titleColor }]}>
      {OPTIONS.map(opt => {
        const isActive = activeCollection === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            style={[styles.segment, isActive && { backgroundColor: c.titleColor }]}
            onPress={() => setActiveCollection(opt.id)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.segmentText,
                { color: isActive ? '#fff' : c.titleColor },
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <View style={styles.container}>
      {activeCollection === 'geethangalum' ? (
        <SongsScreen headerTitle={segmentedToggle} onThemeChange={setTheme} />
      ) : (
        <OtherSongsScreen headerTitle={segmentedToggle} onThemeChange={setTheme} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  segmentedToggle: {
    flexDirection: 'row',
    borderRadius: 24,
    borderWidth: 2,
    padding: 3,
    alignSelf: 'flex-start',
  },
  segment: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    maxWidth: 150,
  },
  segmentText: { fontSize: 14, fontWeight: '700', textAlign: 'center', flexWrap: 'wrap' },
});
