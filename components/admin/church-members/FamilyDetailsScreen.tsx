import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../../AppText';
import { Toast, useToast } from '../../Toast';
import {
  Branch,
  deactivateFamily,
  Family,
  formatAddressMultiline,
  getCurrentAdminEmail,
  Member,
  membersOfFamily,
  nameWithHonorific,
  permanentlyDeleteFamily,
  reactivateFamily,
  RELATIONSHIP_LABELS,
} from '../../../utils/churchMembers';
import { Avatar, DetailRow, PhoneRow, StatusBadge } from './shared';

interface Props {
  family: Family;
  branch?: Branch;
  members: Member[];
  onBack: () => void;
  onEditFamily: () => void;
  onAddMember: () => void;
  onOpenMember: (memberId: string) => void;
}

export default function FamilyDetailsScreen({ family, branch, members, onBack, onEditFamily, onAddMember, onOpenMember }: Props) {
  const [busy, setBusy] = useState(false);
  const { message, opacity, showToast } = useToast();

  const familyMembers = membersOfFamily(family.id, members);
  const head = familyMembers.find(m => m.isFamilyHead);
  const activeCount = familyMembers.filter(m => m.membershipStatus === 'ACTIVE').length;

  const handleDeactivateFamily = () => {
    Alert.alert(
      'Deactivate Family?',
      (activeCount > 0
        ? `This will deactivate "${family.familyName}" and mark its ${activeCount} active member(s) as Inactive. `
        : `This will deactivate "${family.familyName}". `) +
        'Nothing is permanently deleted — the family and its members are preserved for historical purposes.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              const count = await deactivateFamily(family, members, getCurrentAdminEmail());
              showToast(count > 0 ? `🚫 Family deactivated (${count} member(s) set inactive)` : '🚫 Family deactivated');
            } catch {
              Alert.alert('Error', 'Could not delete the family. Check internet.');
            }
            setBusy(false);
          },
        },
      ]
    );
  };

  const handleReactivateFamily = async () => {
    setBusy(true);
    try {
      const count = await reactivateFamily(family, members, getCurrentAdminEmail());
      showToast(count > 0 ? `✅ Family reactivated (${count} member(s) set active)` : '✅ Family reactivated');
    } catch {
      Alert.alert('Error', 'Could not reactivate the family. Check internet.');
    }
    setBusy(false);
  };

  const handlePermanentDelete = () => {
    Alert.alert(
      'Permanently Delete Family',
      `Permanently delete "${family.familyName}" and all ${familyMembers.length} of its member(s)? This cannot be undone — every record will be removed completely, not just marked Inactive.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await permanentlyDeleteFamily(family, members, getCurrentAdminEmail());
              onBack();
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Could not delete the family. Check internet.');
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Family Details</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.nameRow}>
            <Avatar name={family.familyName} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.familyName}>{family.familyName}</Text>
              <Text style={styles.headText}>Head: {head ? nameWithHonorific(head.name, head.gender) : '—'}</Text>
            </View>
            <StatusBadge status={family.status === 'INACTIVE' ? 'INACTIVE' : (head?.membershipStatus ?? 'ACTIVE')} />
          </View>

          <DetailRow label="Branch" value={branch?.name ?? family.branchId} />
          <PhoneRow label="Family Phone" phone={family.familyPhone} onCopied={() => showToast('📋 Phone number copied')} />

          <View style={styles.addressRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>Address</Text>
              <Text style={styles.detailValue}>{formatAddressMultiline(family.address) || '—'}</Text>
              {!!family.address?.mapLink && (
                <TouchableOpacity onPress={() => Linking.openURL(family.address!.mapLink)} style={styles.mapLinkBtn}>
                  <Ionicons name="location" size={13} color="#0f3460" />
                  <Text style={styles.mapLinkText}>View on Map</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={onEditFamily} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="pencil" size={16} color="#0f3460" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.membersHeaderRow}>
          <Text style={styles.sectionTitle}>Family Members ({familyMembers.length})</Text>
        </View>

        {familyMembers.map((m, index) => (
          <TouchableOpacity key={m.id} style={styles.memberRow} onPress={() => onOpenMember(m.id)} activeOpacity={0.8}>
            <View style={styles.memberIndex}>
              <Text style={styles.memberIndexText}>{index + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>
                {nameWithHonorific(m.name, m.gender)}{m.isFamilyHead ? '  (Head)' : ''}
              </Text>
              <Text style={styles.memberMeta}>
                {m.relationship ? RELATIONSHIP_LABELS[m.relationship] : '—'}{m.phoneNumber ? ` • ${m.phoneNumber}` : ''}
              </Text>
            </View>
            <StatusBadge status={m.membershipStatus} small />
            <Ionicons name="chevron-forward" size={18} color="#ccc" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        ))}

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={onAddMember}>
            <Text style={styles.actionBtnText}>＋ Add Member</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={onEditFamily}>
            <Text style={styles.actionBtnText}>✏️ Edit Family</Text>
          </TouchableOpacity>
          {family.status === 'ACTIVE' ? (
            <TouchableOpacity style={[styles.actionBtnDanger, busy && { opacity: 0.6 }]} disabled={busy} onPress={handleDeactivateFamily}>
              <Text style={styles.actionBtnDangerText}>🚫 Deactivate Family</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.actionBtnSuccess, busy && { opacity: 0.6 }]} disabled={busy} onPress={handleReactivateFamily}>
              <Text style={styles.actionBtnSuccessText}>✅ Reactivate</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.permanentDeleteLink} disabled={busy} onPress={handlePermanentDelete}>
          <Text style={styles.permanentDeleteLinkText}>Permanently Delete Family</Text>
        </TouchableOpacity>
      </ScrollView>
      <Toast message={message} opacity={opacity} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  backText: { color: '#0f3460', fontWeight: '600', fontSize: 15 },
  title: { fontSize: 16, fontWeight: 'bold', color: '#1a1a2e' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 20, elevation: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  familyName: { fontSize: 18, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 4 },
  headText: { fontSize: 13, color: '#777' },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  detailLabel: { fontSize: 11, fontWeight: '600', color: '#888', textTransform: 'uppercase', marginBottom: 3 },
  detailValue: { fontSize: 15, color: '#1a1a2e' },
  mapLinkBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  mapLinkText: { fontSize: 12, fontWeight: '700', color: '#0f3460' },
  membersHeaderRow: { marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#1a1a2e' },
  memberRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 2, gap: 10 },
  memberIndex: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#e8f0fe', alignItems: 'center', justifyContent: 'center' },
  memberIndexText: { color: '#0f3460', fontWeight: '700', fontSize: 12 },
  memberName: { fontSize: 14, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 3 },
  memberMeta: { fontSize: 12, color: '#777' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 24 },
  actionBtn: { flex: 1, backgroundColor: '#e8f0fe', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center' },
  actionBtnText: { color: '#0f3460', fontWeight: '700', fontSize: 12 },
  actionBtnDanger: { flex: 1, backgroundColor: '#fdecea', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center' },
  actionBtnDangerText: { color: '#c62828', fontWeight: '700', fontSize: 12 },
  actionBtnSuccess: { flex: 1, backgroundColor: '#e6f7ec', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center' },
  actionBtnSuccessText: { color: '#1e9e50', fontWeight: '700', fontSize: 12 },
  permanentDeleteLink: { alignItems: 'center', paddingVertical: 8, marginBottom: 24 },
  permanentDeleteLinkText: { color: '#c62828', fontWeight: '600', fontSize: 12, textDecorationLine: 'underline' },
});
