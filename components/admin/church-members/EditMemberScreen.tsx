import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../../AppText';
import { getCurrentAdminEmail, Member, memberToFormInput, MemberFormInput, updateMemberFull } from '../../../utils/churchMembers';
import MemberFormFields from './MemberFormFields';

interface Props {
  member: Member;
  onCancel: () => void;
  onSaved: () => void;
}

export default function EditMemberScreen({ member, onCancel, onSaved }: Props) {
  const [form, setForm] = useState<MemberFormInput>(() => memberToFormInput(member));
  const [saving, setSaving] = useState(false);

  const isFamilyNonHead = member.membershipType === 'FAMILY' && !member.isFamilyHead;
  const isSingle = member.membershipType === 'SINGLE';

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMemberFull(member, form, getCurrentAdminEmail());
      onSaved();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not update the member. Check internet.');
    }
    setSaving(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Edit Member</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <MemberFormFields
          value={form}
          onChange={u => setForm(prev => ({ ...prev, ...u }))}
          showRelationship={isFamilyNonHead}
          showAddress={isSingle}
        />
        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} disabled={saving} onPress={handleSave}>
          <Text style={styles.saveBtnText}>{saving ? 'Updating...' : 'Update Member'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, backgroundColor: '#f5f5f5' },
  backText: { color: '#0f3460', fontWeight: '600', fontSize: 15 },
  title: { fontSize: 15, fontWeight: 'bold', color: '#1a1a2e' },
  saveBtn: { backgroundColor: '#0f3460', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 24, elevation: 3 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});
