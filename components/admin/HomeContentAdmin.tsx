import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { EMPTY_HOME_CONTENT, HomeContent, subscribeHomeContent, updateHomeContent } from '../../utils/homeContentSync';
import { AdminScreenHandle } from './SpecialMeetingsAdmin';

const HomeContentAdmin = forwardRef<AdminScreenHandle, {}>((_props, ref) => {
  const [form, setForm] = useState<HomeContent>(EMPTY_HOME_CONTENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useImperativeHandle(ref, () => ({
    goBack: () => false,
  }));

  useEffect(() => {
    const unsubscribe = subscribeHomeContent(content => {
      setForm(content);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const F = (field: keyof HomeContent, val: string) =>
    setForm(prev => ({ ...prev, [field]: val }));

  const save = async () => {
    setSaving(true);
    try {
      const { lastModifiedTimestamp, ...payload } = form;
      await updateHomeContent(payload);
      Alert.alert('✅ Saved', 'Home screen content updated. Changes will appear immediately for users.');
    } catch (e) {
      Alert.alert('Error', 'Could not save. Check internet.');
    }
    setSaving(false);
  };

  if (loading) {
    return <ActivityIndicator size="large" color="#0f3460" style={{ marginTop: 60 }} />;
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <Text style={styles.sectionHeader}>👤 Pastor Section</Text>

      <View style={styles.formField}>
        <Text style={styles.formLabel}>Pastor Photo URL</Text>
        <Text style={styles.fieldHint}>Leave blank to use the default app photo</Text>
        <TextInput
          style={styles.formInput}
          placeholder="https://..."
          placeholderTextColor="#999"
          value={form.pastorPhotoUrl}
          onChangeText={v => F('pastorPhotoUrl', v)}
          autoCapitalize="none"
        />
      </View>

      <View style={styles.formField}>
        <Text style={styles.formLabel}>Pastor Name</Text>
        <TextInput
          style={styles.formInput}
          placeholder="e.g. Bro. Salaman Tirupur"
          placeholderTextColor="#999"
          value={form.pastorName}
          onChangeText={v => F('pastorName', v)}
        />
      </View>

      <View style={styles.formField}>
        <Text style={styles.formLabel}>Designation</Text>
        <TextInput
          style={styles.formInput}
          placeholder="e.g. Pastor & Founder"
          placeholderTextColor="#999"
          value={form.pastorDesignation}
          onChangeText={v => F('pastorDesignation', v)}
        />
      </View>

      <View style={styles.formField}>
        <Text style={styles.formLabel}>About Pastor (English)</Text>
        <Text style={styles.fieldHint}>Line breaks and paragraph spacing are preserved exactly as typed</Text>
        <TextInput
          style={[styles.formInput, styles.formInputMulti]}
          placeholder="About the Pastor, in English..."
          placeholderTextColor="#999"
          value={form.aboutPastorEnglish}
          onChangeText={v => F('aboutPastorEnglish', v)}
          multiline
          textAlignVertical="top"
        />
      </View>

      <View style={styles.formField}>
        <Text style={styles.formLabel}>About Pastor (Tamil)</Text>
        <TextInput
          style={[styles.formInput, styles.formInputMulti]}
          placeholder="போதகரைப் பற்றி, தமிழில்..."
          placeholderTextColor="#999"
          value={form.aboutPastorTamil}
          onChangeText={v => F('aboutPastorTamil', v)}
          multiline
          textAlignVertical="top"
        />
      </View>

      <View style={styles.divider} />

      <Text style={styles.sectionHeader}>⛪ About Ministry Section</Text>

      <View style={styles.formField}>
        <Text style={styles.formLabel}>About Ministry (English)</Text>
        <Text style={styles.fieldHint}>Line breaks and paragraph spacing are preserved exactly as typed</Text>
        <TextInput
          style={[styles.formInput, styles.formInputMulti, { minHeight: 160 }]}
          placeholder="About the ministry, in English..."
          placeholderTextColor="#999"
          value={form.aboutMinistryEnglish}
          onChangeText={v => F('aboutMinistryEnglish', v)}
          multiline
          textAlignVertical="top"
        />
      </View>

      <View style={styles.formField}>
        <Text style={styles.formLabel}>About Ministry (Tamil)</Text>
        <TextInput
          style={[styles.formInput, styles.formInputMulti, { minHeight: 160 }]}
          placeholder="ஊழியத்தைப் பற்றி, தமிழில்..."
          placeholderTextColor="#999"
          value={form.aboutMinistryTamil}
          onChangeText={v => F('aboutMinistryTamil', v)}
          multiline
          textAlignVertical="top"
        />
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        onPress={save}
        disabled={saving}
      >
        <Text style={styles.saveBtnText}>{saving ? 'Saving...' : '💾 Save Changes'}</Text>
      </TouchableOpacity>
      <View style={{ height: 30 }} />
    </ScrollView>
  );
});

export default HomeContentAdmin;

const styles = StyleSheet.create({
  sectionHeader: { fontSize: 16, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 12, marginTop: 4 },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 20 },
  formField: { marginBottom: 16 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6 },
  fieldHint: { fontSize: 11, color: '#999', marginBottom: 6, fontStyle: 'italic' },
  formInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#eee',
    color: '#1a1a2e',
  },
  formInputMulti: { minHeight: 100 },
  saveBtn: {
    backgroundColor: '#0f3460',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
    elevation: 4,
  },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
