import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { getAuth } from 'firebase/auth';
import { useAppDialog } from '../AppDialog';
import { Text } from '../AppText';
import { TextInput } from '../AppTextInput';
import { EMPTY_HOME_CONTENT, HomeContent, subscribeHomeContent, updateHomeContent } from '../../utils/homeContentSync';
import { useTheme } from '../../utils/ThemeContext';
import { AdminScreenHandle } from './SpecialMeetingsAdmin';

const HomeContentAdmin = forwardRef<AdminScreenHandle, {}>((_props, ref) => {
  const dialog = useAppDialog();
  const { colors } = useTheme();
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
    if (!form.pastorName.trim()) { dialog.alert('Required', 'Pastor Name cannot be empty.'); return; }
    if (!form.pastorDesignation.trim()) { dialog.alert('Required', 'Designation cannot be empty.'); return; }
    if (!form.aboutPastorEnglish.trim()) { dialog.alert('Required', 'About Pastor (English) cannot be empty.'); return; }
    if (!form.aboutPastorTamil.trim()) { dialog.alert('Required', 'About Pastor (Tamil) cannot be empty.'); return; }
    if (!form.aboutMinistryEnglish.trim()) { dialog.alert('Required', 'About Ministry (English) cannot be empty.'); return; }
    if (!form.aboutMinistryTamil.trim()) { dialog.alert('Required', 'About Ministry (Tamil) cannot be empty.'); return; }
    setSaving(true);
    try {
      const currentUser = getAuth().currentUser?.email ?? 'unknown';
      const { lastModifiedTimestamp, ...payload } = form;
      await updateHomeContent({ ...payload, modifiedBy: currentUser } as any);
      dialog.alert('✅ Saved', 'Home screen content updated. Changes will appear immediately for users.');
    } catch (e) {
      dialog.alert('Error', 'Could not save. Check internet.');
    }
    setSaving(false);
  };

  if (loading) {
    return <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 60 }} />;
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <Text style={[styles.sectionHeader, { color: colors.text }]}>👤 Pastor Section</Text>

      <View style={styles.formField}>
        <Text style={[styles.formLabel, { color: colors.subtext }]}>Pastor Photo URL</Text>
        <Text style={[styles.fieldHint, { color: colors.subtext }]}>Leave blank to use the default app photo</Text>
        <TextInput
          style={[styles.formInput, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider, color: colors.text }]}
          placeholder="https://..."
          placeholderTextColor={colors.subtext}
          value={form.pastorPhotoUrl}
          onChangeText={v => F('pastorPhotoUrl', v)}
          autoCapitalize="none"
        />
      </View>

      <View style={styles.formField}>
        <Text style={[styles.formLabel, { color: colors.subtext }]}>Pastor Name *</Text>
        <TextInput
          style={[styles.formInput, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider, color: colors.text }]}
          placeholder="e.g. Bro. Salaman Tirupur"
          placeholderTextColor={colors.subtext}
          value={form.pastorName}
          onChangeText={v => F('pastorName', v)}
        />
      </View>

      <View style={styles.formField}>
        <Text style={[styles.formLabel, { color: colors.subtext }]}>Designation *</Text>
        <TextInput
          style={[styles.formInput, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider, color: colors.text }]}
          placeholder="e.g. Pastor & Founder"
          placeholderTextColor={colors.subtext}
          value={form.pastorDesignation}
          onChangeText={v => F('pastorDesignation', v)}
        />
      </View>

      <View style={styles.formField}>
        <Text style={[styles.formLabel, { color: colors.subtext }]}>About Pastor (English) *</Text>
        <Text style={[styles.fieldHint, { color: colors.subtext }]}>Line breaks and paragraph spacing are preserved exactly as typed</Text>
        <TextInput
          style={[styles.formInput, styles.formInputMulti, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider, color: colors.text }]}
          placeholder="About the Pastor, in English..."
          placeholderTextColor={colors.subtext}
          value={form.aboutPastorEnglish}
          onChangeText={v => F('aboutPastorEnglish', v)}
          multiline
          textAlignVertical="top"
        />
      </View>

      <View style={styles.formField}>
        <Text style={[styles.formLabel, { color: colors.subtext }]}>About Pastor (Tamil) *</Text>
        <TextInput
          style={[styles.formInput, styles.formInputMulti, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider, color: colors.text }]}
          placeholder="போதகரைப் பற்றி, தமிழில்..."
          placeholderTextColor={colors.subtext}
          value={form.aboutPastorTamil}
          onChangeText={v => F('aboutPastorTamil', v)}
          multiline
          textAlignVertical="top"
        />
      </View>

      <View style={[styles.divider, { backgroundColor: colors.divider }]} />

      <Text style={[styles.sectionHeader, { color: colors.text }]}>⛪ About Ministry Section</Text>

      <View style={styles.formField}>
        <Text style={[styles.formLabel, { color: colors.subtext }]}>About Ministry (English) *</Text>
        <Text style={[styles.fieldHint, { color: colors.subtext }]}>Line breaks and paragraph spacing are preserved exactly as typed</Text>
        <TextInput
          style={[styles.formInput, styles.formInputMulti, { minHeight: 160 }, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider, color: colors.text }]}
          placeholder="About the ministry, in English..."
          placeholderTextColor={colors.subtext}
          value={form.aboutMinistryEnglish}
          onChangeText={v => F('aboutMinistryEnglish', v)}
          multiline
          textAlignVertical="top"
        />
      </View>

      <View style={styles.formField}>
        <Text style={[styles.formLabel, { color: colors.subtext }]}>About Ministry (Tamil) *</Text>
        <TextInput
          style={[styles.formInput, styles.formInputMulti, { minHeight: 160 }, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider, color: colors.text }]}
          placeholder="ஊழியத்தைப் பற்றி, தமிழில்..."
          placeholderTextColor={colors.subtext}
          value={form.aboutMinistryTamil}
          onChangeText={v => F('aboutMinistryTamil', v)}
          multiline
          textAlignVertical="top"
        />
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: colors.accent }, saving && { opacity: 0.6 }]}
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
  sectionHeader: { fontSize: 16, fontWeight: 'bold', marginBottom: 12, marginTop: 4 },
  divider: { height: 1, marginVertical: 20 },
  formField: { marginBottom: 16 },
  formLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  fieldHint: { fontSize: 11, marginBottom: 6, fontStyle: 'italic' },
  formInput: {
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    elevation: 2,
    borderWidth: 1,
  },
  formInputMulti: { minHeight: 100 },
  saveBtn: {
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
    elevation: 4,
  },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
