import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../../AppText';
import { addFamilyMember, emptyMemberForm, Family, getCurrentAdminEmail, MemberFormInput } from '../../../utils/churchMembers';
import MemberFormFields from './MemberFormFields';

interface Props {
  family: Family;
  onCancel: () => void;
  onSaved: (memberId: string) => void;
}

export default function AddFamilyMemberScreen({ family, onCancel, onSaved }: Props) {
  const [form, setForm] = useState<MemberFormInput>(() => emptyMemberForm({ relationship: 'SON' }));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const memberId = await addFamilyMember(family, form, getCurrentAdminEmail());
      onSaved(memberId);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not add the member. Check internet.');
    }
    setSaving(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Add Family Member</Text>
      </View>
      <Text style={styles.subtitle}>Adding to &quot;{family.familyName}&quot;</Text>
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <MemberFormFields value={form} onChange={u => setForm(prev => ({ ...prev, ...u }))} showRelationship />
        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} disabled={saving} onPress={handleSave}>
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Member'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, paddingBottom: 4, backgroundColor: '#f5f5f5' },
  backText: { color: '#0f3460', fontWeight: '600', fontSize: 15 },
  title: { fontSize: 15, fontWeight: 'bold', color: '#1a1a2e' },
  subtitle: { fontSize: 12, color: '#777', paddingHorizontal: 16, paddingBottom: 8, backgroundColor: '#f5f5f5', fontStyle: 'italic' },
  saveBtn: { backgroundColor: '#0f3460', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 24, elevation: 3 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});
