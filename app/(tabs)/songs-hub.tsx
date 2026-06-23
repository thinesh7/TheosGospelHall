import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../utils/ThemeContext';
import OtherSongsScreen from './other-songs';
import SongsScreen from './songs';

type CollectionTab = 'geethangalum' | 'other';

const OPTIONS: { id: CollectionTab; label: string }[] = [
  { id: 'geethangalum', label: 'Geethangalum Keerthanaigalum' },
  { id: 'other', label: 'Special Songs' },
];

export default function SongsHubScreen() {
  const { colors: c } = useTheme();

  const [activeCollection, setActiveCollection] = useState<CollectionTab>('geethangalum');

  const segmentedToggle = (
    <View style={[styles.segmentedToggle, { backgroundColor: c.surfaceAlt, borderColor: c.accent }]}>
      {OPTIONS.map(opt => {
        const isActive = activeCollection === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            style={[styles.segment, isActive && { backgroundColor: c.accent }]}
            onPress={() => setActiveCollection(opt.id)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.segmentText,
                { color: isActive ? '#fff' : c.accent },
              ]}
              numberOfLines={2}
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
      <View style={{ flex: 1, display: activeCollection === 'geethangalum' ? 'flex' : 'none' }}>
        <SongsScreen headerTitle={segmentedToggle} />
      </View>
      <View style={{ flex: 1, display: activeCollection === 'other' ? 'flex' : 'none' }}>
        <OtherSongsScreen headerTitle={segmentedToggle} />
      </View>
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
    flex: 1,
    marginRight: 12,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
