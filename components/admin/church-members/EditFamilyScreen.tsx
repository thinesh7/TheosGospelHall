import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../../AppText';
import { TextInput } from '../../AppTextInput';
import { Branch, EMPTY_ADDRESS, Family, getCurrentAdminEmail, updateFamily } from '../../../utils/churchMembers';
import { DropdownField, styles as shared } from './shared';

interface Props {
  family: Family;
  branches: Branch[];
  onCancel: () => void;
  onSaved: () => void;
}

export default function EditFamilyScreen({ family, branches, onCancel, onSaved }: Props) {
  const [branchId, setBranchId] = useState(family.branchId);
  const [familyName, setFamilyName] = useState(family.familyName);
  const [familyPhone, setFamilyPhone] = useState(family.familyPhone ?? '');
  const [addressLine1, setAddressLine1] = useState(family.address?.addressLine1 ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateFamily(
        family,
        { branchId, familyName, familyPhone, address: { ...EMPTY_ADDRESS, ...(family.address ?? {}), addressLine1 } },
        getCurrentAdminEmail()
      );
      onSaved();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not update the family. Check internet.');
    }
    setSaving(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={localStyles.headerRow}>
        <TouchableOpacity onPress={onCancel}>
          <Text style={localStyles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={localStyles.title}>Edit Family</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <DropdownField
          label="Branch *"
          placeholder="Select branch"
          value={branchId}
          onChange={setBranchId}
          options={branches.map(b => ({ value: b.id, label: b.name }))}
        />

        <View style={shared.formField}>
          <Text style={shared.formLabel}>Family Name *</Text>
          <TextInput style={shared.formInput} placeholderTextColor="#999" value={familyName} onChangeText={setFamilyName} />
        </View>

        <View style={shared.formField}>
          <Text style={shared.formLabel}>Family Phone (Optional)</Text>
          <TextInput
            style={shared.formInput}
            placeholder="10-digit mobile number"
            placeholderTextColor="#999"
            value={familyPhone}
            onChangeText={v => setFamilyPhone(v.replace(/[^\d]/g, '').slice(0, 10))}
            keyboardType="number-pad"
            maxLength={10}
          />
        </View>

        <View style={shared.formField}>
          <Text style={shared.formLabel}>Family Address (Optional)</Text>
          <TextInput
            style={[shared.formInput, shared.formInputMulti]}
            placeholder="House, street, city, state, pincode"
            placeholderTextColor="#999"
            value={addressLine1}
            onChangeText={setAddressLine1}
            multiline
          />
        </View>

        <TouchableOpacity style={[localStyles.saveBtn, saving && { opacity: 0.6 }]} disabled={saving} onPress={handleSave}>
          <Text style={localStyles.saveBtnText}>{saving ? 'Updating...' : 'Update Family'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const localStyles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, backgroundColor: '#f5f5f5' },
  backText: { color: '#0f3460', fontWeight: '600', fontSize: 15 },
  title: { fontSize: 15, fontWeight: 'bold', color: '#1a1a2e' },
  saveBtn: { backgroundColor: '#0f3460', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 24, elevation: 3 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});
