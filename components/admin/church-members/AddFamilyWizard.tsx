import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../../AppText';
import { TextInput } from '../../AppTextInput';
import {
  Branch,
  createFamilyWithMembers,
  emptyMemberForm,
  getCurrentAdminEmail,
  MemberFormInput,
  RELATIONSHIP_LABELS,
  validateMemberForm,
  validatePhoneOptional,
} from '../../../utils/churchMembers';
import MemberFormFields from './MemberFormFields';
import { DropdownField, StatusBadge, styles as shared } from './shared';
import { AdminScreenHandle } from '../SpecialMeetingsAdmin';

interface Props {
  branches: Branch[];
  defaultBranchId?: string;
  onCancel: () => void;
  onSaved: (familyId: string) => void;
}

const STEP_TITLES = ['Family Info', 'Family Head', 'Other Members'];

const AddFamilyWizard = forwardRef<AdminScreenHandle, Props>(({ branches, defaultBranchId, onCancel, onSaved }, ref) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);

  const [branchId, setBranchId] = useState(defaultBranchId ?? '');
  const [familyPhone, setFamilyPhone] = useState('');
  const [address, setAddress] = useState('');
  const [mapLink, setMapLink] = useState('');

  const [headInput, setHeadInput] = useState<MemberFormInput>(emptyMemberForm());
  const [otherMembers, setOtherMembers] = useState<MemberFormInput[]>([]);

  const [showMemberForm, setShowMemberForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftMember, setDraftMember] = useState<MemberFormInput>(emptyMemberForm({ relationship: 'SON' }));

  useImperativeHandle(ref, () => ({
    goBack: () => {
      if (showMemberForm) { setShowMemberForm(false); return true; }
      if (step > 1) { setStep(prev => (prev - 1) as 1 | 2); return true; }
      return false;
    },
  }));

  const goBack = () => {
    if (step > 1) setStep(prev => (prev - 1) as 1 | 2);
    else onCancel();
  };

  const handleStep1Next = () => {
    if (!branchId) { Alert.alert('Required', 'Please select a branch.'); return; }
    const phoneErr = validatePhoneOptional(familyPhone);
    if (phoneErr) { Alert.alert('Invalid Phone', phoneErr); return; }
    setStep(2);
  };

  const handleStep2Next = () => {
    const err = validateMemberForm(headInput);
    if (err) { Alert.alert('Required', err); return; }
    setStep(3);
  };

  const openAddMember = () => {
    setEditingIndex(null);
    setDraftMember(emptyMemberForm({ relationship: 'SON' }));
    setShowMemberForm(true);
  };

  const openEditMember = (index: number) => {
    setEditingIndex(index);
    setDraftMember(otherMembers[index]);
    setShowMemberForm(true);
  };

  const saveMemberDraft = () => {
    const err = validateMemberForm(draftMember);
    if (err) { Alert.alert('Required', err); return; }
    if (!draftMember.relationship) { Alert.alert('Required', 'Please select a relationship.'); return; }
    setOtherMembers(prev => {
      if (editingIndex !== null) {
        const next = [...prev];
        next[editingIndex] = draftMember;
        return next;
      }
      return [...prev, draftMember];
    });
    setShowMemberForm(false);
  };

  const removeMember = (index: number) => {
    Alert.alert('Remove Member', `Remove "${otherMembers[index].name}" from this family?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setOtherMembers(prev => prev.filter((_, i) => i !== index)) },
    ]);
  };

  const handleSaveFamily = async () => {
    setSaving(true);
    try {
      const actorEmail = getCurrentAdminEmail();
      const familyId = await createFamilyWithMembers(
        {
          branchId,
          familyPhone,
          address: { addressLine1: address, addressLine2: '', city: '', state: '', pincode: '', mapLink },
          headInput,
          otherMembers,
        },
        actorEmail
      );
      onSaved(familyId);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save the family. Check internet.');
    }
    setSaving(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={localStyles.stepHeader}>
        <TouchableOpacity onPress={goBack}>
          <Text style={localStyles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={localStyles.headerTitle}>Add Family</Text>
      </View>

      <View style={localStyles.stepperRow}>
        {STEP_TITLES.map((title, idx) => {
          const num = idx + 1;
          const isDone = num < step;
          const isActive = num === step;
          return (
            <View key={title} style={localStyles.stepperItem}>
              <View style={localStyles.stepperCircleRow}>
                <View style={[localStyles.stepperCircle, (isDone || isActive) && localStyles.stepperCircleActive]}>
                  <Text style={[localStyles.stepperCircleText, (isDone || isActive) && localStyles.stepperCircleTextActive]}>
                    {isDone ? '✓' : num}
                  </Text>
                </View>
                {num < 3 && <View style={[localStyles.stepperLine, isDone && localStyles.stepperLineActive]} />}
              </View>
              <Text style={[localStyles.stepperLabel, isActive && localStyles.stepperLabelActive]} numberOfLines={1}>
                {title}
              </Text>
            </View>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        {step === 1 && (
          <>
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

            <Text style={localStyles.sectionNote}>
              The family will be named after the Family Head (Step 2) — e.g. &quot;Bro. Kumar Family&quot;.
            </Text>

            <View style={shared.formField}>
              <Text style={shared.formLabel}>Family Address (Optional)</Text>
              <TextInput
                style={[shared.formInput, shared.formInputMulti]}
                placeholder="House, street, city, state, pincode"
                placeholderTextColor="#999"
                value={address}
                onChangeText={setAddress}
                multiline
              />
            </View>

            <View style={shared.formField}>
              <Text style={shared.formLabel}>Google Maps Location Link (Optional)</Text>
              <TextInput
                style={shared.formInput}
                placeholder="https://maps.app.goo.gl/..."
                placeholderTextColor="#999"
                value={mapLink}
                onChangeText={setMapLink}
                autoCapitalize="none"
                keyboardType="url"
              />
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

            <TouchableOpacity style={localStyles.primaryBtn} onPress={handleStep1Next}>
              <Text style={localStyles.primaryBtnText}>Next →</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 2 && (
          <>
            <MemberFormFields
              value={headInput}
              onChange={u => setHeadInput(prev => ({ ...prev, ...u }))}
            />

            <View style={localStyles.navRow}>
              <TouchableOpacity style={localStyles.secondaryBtn} onPress={() => setStep(1)}>
                <Text style={localStyles.secondaryBtnText}>← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[localStyles.primaryBtn, { flex: 1 }]} onPress={handleStep2Next}>
                <Text style={localStyles.primaryBtnText}>Next →</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={localStyles.sectionTitle}>Other Family Members</Text>
            {otherMembers.length === 0 ? (
              <Text style={localStyles.emptyText}>No other members added yet. Members are optional — a family can consist of just the Family Head.</Text>
            ) : (
              otherMembers.map((m, index) => (
                <View key={index} style={localStyles.memberCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={localStyles.memberName}>{m.name}</Text>
                    <Text style={localStyles.memberMeta}>
                      {m.relationship ? RELATIONSHIP_LABELS[m.relationship] : '—'}
                      {m.dateOfBirth ? ` • ${m.dateOfBirth.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}` : ''}
                    </Text>
                    <StatusBadge status={m.membershipStatus} small />
                  </View>
                  <TouchableOpacity style={localStyles.iconBtn} onPress={() => openEditMember(index)}>
                    <Ionicons name="pencil" size={17} color="#0f3460" />
                  </TouchableOpacity>
                  <TouchableOpacity style={localStyles.iconBtn} onPress={() => removeMember(index)}>
                    <Ionicons name="trash" size={17} color="#c62828" />
                  </TouchableOpacity>
                </View>
              ))
            )}

            <TouchableOpacity style={localStyles.addMemberBtn} onPress={openAddMember}>
              <Text style={localStyles.addMemberBtnText}>＋ Add Family Member</Text>
            </TouchableOpacity>

            <View style={localStyles.navRow}>
              <TouchableOpacity style={localStyles.secondaryBtn} onPress={() => setStep(2)}>
                <Text style={localStyles.secondaryBtnText}>← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[localStyles.primaryBtn, { flex: 1 }, saving && { opacity: 0.6 }]} disabled={saving} onPress={handleSaveFamily}>
                <Text style={localStyles.primaryBtnText}>{saving ? 'Saving...' : 'Save Family'}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={showMemberForm} animationType="slide" onRequestClose={() => setShowMemberForm(false)}>
        <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
          <View style={localStyles.modalHeader}>
            <TouchableOpacity onPress={() => setShowMemberForm(false)}>
              <Text style={localStyles.backText}>✕ Close</Text>
            </TouchableOpacity>
            <Text style={localStyles.headerTitle}>{editingIndex !== null ? 'Edit Family Member' : 'Add Family Member'}</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            <MemberFormFields
              value={draftMember}
              onChange={u => setDraftMember(prev => ({ ...prev, ...u }))}
              showRelationship
            />
            <TouchableOpacity style={localStyles.primaryBtn} onPress={saveMemberDraft}>
              <Text style={localStyles.primaryBtnText}>Save Member</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
});

AddFamilyWizard.displayName = 'AddFamilyWizard';

export default AddFamilyWizard;

const localStyles = StyleSheet.create({
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, paddingBottom: 8, backgroundColor: '#f5f5f5' },
  backText: { color: '#0f3460', fontWeight: '600', fontSize: 15 },
  headerTitle: { fontSize: 15, fontWeight: 'bold', color: '#1a1a2e' },
  stepperRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 14, backgroundColor: '#f5f5f5' },
  stepperItem: { flex: 1, alignItems: 'center' },
  stepperCircleRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  stepperCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  stepperCircleActive: { backgroundColor: '#0f3460' },
  stepperCircleText: { fontSize: 12, fontWeight: '700', color: '#999' },
  stepperCircleTextActive: { color: '#fff' },
  stepperLine: { position: 'absolute', left: '50%', right: '-50%', top: 12, height: 2, backgroundColor: '#e0e0e0', zIndex: -1 },
  stepperLineActive: { backgroundColor: '#0f3460' },
  stepperLabel: { fontSize: 10, color: '#999', marginTop: 6, fontWeight: '600' },
  stepperLabelActive: { color: '#0f3460' },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 12 },
  sectionNote: { fontSize: 12, color: '#777', marginBottom: 14, fontStyle: 'italic' },
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
  emptyText: { fontSize: 13, color: '#999', fontStyle: 'italic', marginBottom: 14, lineHeight: 18 },
  memberCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 2, gap: 8 },
  memberName: { fontSize: 14, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 3 },
  memberMeta: { fontSize: 12, color: '#777', marginBottom: 6 },
  iconBtn: { padding: 6 },
  addMemberBtn: { backgroundColor: '#e8f0fe', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 20 },
  addMemberBtnText: { color: '#0f3460', fontWeight: 'bold', fontSize: 14 },
  navRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  primaryBtn: { backgroundColor: '#0f3460', borderRadius: 14, padding: 16, alignItems: 'center', elevation: 3 },
  primaryBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  secondaryBtn: { paddingHorizontal: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ccc' },
  secondaryBtnText: { color: '#555', fontWeight: '600', fontSize: 15 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, paddingTop: 50, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
});
