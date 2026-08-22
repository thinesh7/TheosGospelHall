import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../../AppText';
import { Toast, useToast } from '../../Toast';
import {
  Branch,
  computeAgeFromTimestamp,
  deactivateMember,
  Family,
  formatAddressMultiline,
  formatDateOnly,
  GENDER_LABELS,
  getCurrentAdminEmail,
  MARITAL_STATUS_LABELS,
  Member,
  MEMBERSHIP_STATUS_LABELS,
  nameWithHonorific,
  RELATIONSHIP_LABELS,
  updateMemberStatus,
} from '../../../utils/churchMembers';
import { Avatar, DetailRow, PhoneRow, StatusBadge } from './shared';

interface Props {
  member: Member;
  family?: Family;
  branch?: Branch;
  onBack: () => void;
  onEdit: () => void;
  onOpenFamily?: (familyId: string) => void;
}

export default function MemberDetailsScreen({ member, family, branch, onBack, onEdit, onOpenFamily }: Props) {
  const [busy, setBusy] = useState(false);
  const { message, opacity, showToast } = useToast();

  const isFamily = member.membershipType === 'FAMILY';
  const address = isFamily ? family?.address : member.address;

  const handleDeactivate = () => {
    Alert.alert('Deactivate Member?', 'Member records are preserved for historical purposes.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await deactivateMember(member, getCurrentAdminEmail());
            showToast('🚫 Member deactivated');
          } catch {
            Alert.alert('Error', 'Could not deactivate. Check internet.');
          }
          setBusy(false);
        },
      },
    ]);
  };

  const handleActivate = async () => {
    setBusy(true);
    try {
      await updateMemberStatus(member, 'ACTIVE', getCurrentAdminEmail());
      showToast('✅ Member activated');
    } catch {
      Alert.alert('Error', 'Could not activate. Check internet.');
    }
    setBusy(false);
  };

  const handleCopyDetails = async () => {
    const lines = [
      `Name: ${member.name}`,
      `Gender: ${GENDER_LABELS[member.gender]}`,
      ...(isFamily ? [`Relationship: ${member.relationship ? RELATIONSHIP_LABELS[member.relationship] : '—'}`, `Family: ${family?.familyName ?? '—'}`] : []),
      `Branch: ${branch?.name ?? member.branchId}`,
      `Date of Birth: ${formatDateOnly(member.dateOfBirth)}`,
      `Phone: ${member.phoneNumber ?? '—'}`,
      `Baptism Date: ${formatDateOnly(member.baptismDate)}`,
      `Member Since: ${formatDateOnly(member.memberSince)}`,
      ...(isFamily ? [] : [`Marital Status: ${member.maritalStatus ? MARITAL_STATUS_LABELS[member.maritalStatus] : '—'}`]),
      `Marriage Date: ${formatDateOnly(member.marriageDate)}`,
      ...(isFamily ? [] : [`Address: ${formatAddressMultiline(address ?? null) || '—'}`]),
      `Membership Status: ${MEMBERSHIP_STATUS_LABELS[member.membershipStatus]}`,
    ];
    await Clipboard.setStringAsync(lines.join('\n'));
    showToast('📋 Member details copied');
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { flex: 1 }]}>{isFamily ? 'Family Member Details' : 'Single Member Details'}</Text>
          <TouchableOpacity onPress={handleCopyDetails} style={styles.copyBtn}>
            <Ionicons name="copy-outline" size={20} color="#0f3460" />
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.nameRow}>
            <Avatar name={member.name} />
            <Text style={styles.memberName}>{nameWithHonorific(member.name, member.gender)}</Text>
            <StatusBadge status={member.membershipStatus} />
          </View>

          <Text style={styles.sectionLabel}>Personal Information</Text>

          <DetailRow label="Gender" value={GENDER_LABELS[member.gender]} />
          {isFamily && (
            <>
              <DetailRow label="Relationship" value={member.relationship ? RELATIONSHIP_LABELS[member.relationship] : '—'} />
              {family && onOpenFamily ? (
                <View style={{ marginBottom: 14 }}>
                  <Text style={styles.detailLabelSmall}>FAMILY</Text>
                  <TouchableOpacity onPress={() => onOpenFamily(family.id)}>
                    <Text style={styles.familyLink}>{family.familyName} →</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <DetailRow label="Family" value={family?.familyName ?? '—'} />
              )}
            </>
          )}
          <DetailRow label="Branch" value={branch?.name ?? member.branchId} />
          <DetailRow label="Date of Birth" value={`${formatDateOnly(member.dateOfBirth)}${computeAgeFromTimestamp(member.dateOfBirth) !== null ? ` (${computeAgeFromTimestamp(member.dateOfBirth)} yrs)` : ''}`} />
          <PhoneRow label="Phone Number" phone={member.phoneNumber} onCopied={() => showToast('📋 Phone number copied')} />
          <DetailRow label="Baptism Date" value={formatDateOnly(member.baptismDate)} />
          {!isFamily && <DetailRow label="Marital Status" value={member.maritalStatus ? MARITAL_STATUS_LABELS[member.maritalStatus] : '—'} />}
          <DetailRow label="Marriage Date" value={formatDateOnly(member.marriageDate)} />
          <DetailRow label="Member Since" value={formatDateOnly(member.memberSince)} />
          <DetailRow label="Membership Status" value={MEMBERSHIP_STATUS_LABELS[member.membershipStatus]} />
          {!!member.email && <DetailRow label="Email" value={member.email} />}
          {!!member.notes && <DetailRow label="Notes" value={member.notes} />}
          {!!member.updatedBy && <DetailRow label="Last Updated By" value={`${member.updatedBy}`} />}
        </View>

        {!isFamily && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Address</Text>
            <Text style={styles.addressText}>{formatAddressMultiline(address ?? null) || '—'}</Text>
          </View>
        )}
        {isFamily && !!address && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Family Address</Text>
            <Text style={styles.addressText}>{formatAddressMultiline(address) || '—'}</Text>
          </View>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.editBtn} onPress={onEdit}>
            <Text style={styles.editBtnText}>✏️ Edit Member</Text>
          </TouchableOpacity>
          {member.membershipStatus === 'INACTIVE' ? (
            <TouchableOpacity style={[styles.activateBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={handleActivate}>
              <Text style={styles.activateBtnText}>✅ Activate Member</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.deactivateBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={handleDeactivate}>
              <Text style={styles.deactivateBtnText}>🚫 Deactivate Member</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
      <Toast message={message} opacity={opacity} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  backText: { color: '#0f3460', fontWeight: '600', fontSize: 15 },
  title: { fontSize: 16, fontWeight: 'bold', color: '#1a1a2e' },
  copyBtn: { backgroundColor: '#e8f0fe', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 20, elevation: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  memberName: { fontSize: 18, fontWeight: 'bold', color: '#1a1a2e', flex: 1 },
  detailLabelSmall: { fontSize: 11, fontWeight: '600', color: '#888', textTransform: 'uppercase', marginBottom: 3 },
  familyLink: { fontSize: 15, color: '#0f3460', fontWeight: '700' },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#555', marginBottom: 12, textTransform: 'uppercase' },
  addressText: { fontSize: 14, color: '#1a1a2e', lineHeight: 20 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  editBtn: { flex: 1, backgroundColor: '#e8f0fe', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  editBtnText: { color: '#0f3460', fontWeight: '700', fontSize: 13 },
  deactivateBtn: { flex: 1, backgroundColor: '#fdecea', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  deactivateBtnText: { color: '#c62828', fontWeight: '700', fontSize: 13 },
  activateBtn: { flex: 1, backgroundColor: '#e6f7ec', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  activateBtnText: { color: '#1e9e50', fontWeight: '700', fontSize: 13 },
});
