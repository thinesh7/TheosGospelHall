import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../../AppText';
import {
  Branch,
  createSingleMember,
  emptyMemberForm,
  getCurrentAdminEmail,
  MemberFormInput,
} from '../../../utils/churchMembers';
import MemberFormFields from './MemberFormFields';
import { DropdownField, styles as shared } from './shared';

interface Props {
  branches: Branch[];
  defaultBranchId?: string;
  onCancel: () => void;
  onSaved: (memberId: string) => void;
}

export default function AddSingleMemberScreen({ branches, defaultBranchId, onCancel, onSaved }: Props) {
  const [branchId, setBranchId] = useState(defaultBranchId ?? '');
  const [form, setForm] = useState<MemberFormInput>(emptyMemberForm());
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!branchId) { Alert.alert('Required', 'Please select a branch.'); return; }
    setSaving(true);
    try {
      const memberId = await createSingleMember(branchId, form, getCurrentAdminEmail());
      onSaved(memberId);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save the member. Check internet.');
    }
    setSaving(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={localStyles.header}>
        <TouchableOpacity onPress={onCancel}>
          <Text style={localStyles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={localStyles.title}>Add Individual Member</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        {defaultBranchId ? (
          <View style={shared.formField}>
            <Text style={shared.formLabel}>Branch *</Text>
            <View style={localStyles.lockedField}>
              <Text style={localStyles.lockedFieldText}>
                {branches.find(b => b.id === defaultBranchId)?.name ?? defaultBranchId}
              </Text>
              <Ionicons name="lock-closed" size={15} color="#999" />
            </View>
          </View>
        ) : (
          <DropdownField
            label="Branch *"
            placeholder="Select branch"
            value={branchId}
            onChange={setBranchId}
            options={branches.map(b => ({ value: b.id, label: b.name }))}
          />
        )}

        <MemberFormFields value={form} onChange={u => setForm(prev => ({ ...prev, ...u }))} showAddress />

        <TouchableOpacity style={[localStyles.saveBtn, saving && { opacity: 0.6 }]} disabled={saving} onPress={handleSave}>
          <Text style={localStyles.saveBtnText}>{saving ? 'Saving...' : 'Save Member'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const localStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, backgroundColor: '#f5f5f5' },
  backText: { color: '#0f3460', fontWeight: '600', fontSize: 15 },
  title: { fontSize: 15, fontWeight: 'bold', color: '#1a1a2e' },
  saveBtn: { backgroundColor: '#0f3460', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 24, elevation: 3 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  lockedField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f2f2f2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  lockedFieldText: { fontSize: 15, color: '#555', fontWeight: '600' },
});
