import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View, ScrollView } from 'react-native';
import { Text } from '../../AppText';
import {
  Branch,
  Family,
  familyDisplayName,
  familyDisplayStatus,
  familyHead,
  filterFamiliesAndMembers,
  Member,
  MembershipStatus,
  MEMBERSHIP_STATUS_COLORS,
  MEMBERSHIP_STATUS_LABELS,
  membersOfFamily,
  TypeFilter,
} from '../../../utils/churchMembers';
import { StatusBadge } from './shared';

interface Props {
  families: Family[];
  members: Member[];
  branches: Branch[];
  typeFilter?: TypeFilter;
  statusFilter?: MembershipStatus;
  search: string;
  branchScope?: string;
  showBranchTag?: boolean;
  onOpenFamily: (familyId: string) => void;
  onOpenMember: (memberId: string) => void;
  scroll?: boolean;
}

export default function MemberFamilyList({
  families,
  members,
  branches,
  typeFilter,
  statusFilter,
  search,
  branchScope,
  showBranchTag = false,
  onOpenFamily,
  onOpenMember,
  scroll = true,
}: Props) {
  const branchNameById = new Map(branches.map(b => [b.id, b.name]));

  const { families: filteredFamilies, singleMembers: filteredSingles } = filterFamiliesAndMembers(families, members, {
    branchScope,
    typeFilter,
    statusFilter,
    search,
  });

  const totalCount = filteredFamilies.length + filteredSingles.length;

  const content = (
    <>
      {totalCount === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="people" size={48} color="#c3cbe0" />
          </View>
          <Text style={styles.emptyTitle}>No members found.</Text>
          <Text style={styles.emptySubtitle}>Try adjusting your filters or add a new member.</Text>
        </View>
      ) : (
        <>
          {filteredFamilies.map(f => {
            const head = familyHead(f.id, members);
            const familyMembers = membersOfFamily(f.id, members);
            const count = familyMembers.length;
            const status = familyDisplayStatus(f.id, members);
            const statusFilterCount = statusFilter
              ? familyMembers.filter(m => m.membershipStatus === statusFilter).length
              : null;
            return (
              <TouchableOpacity key={`family-${f.id}`} style={styles.card} onPress={() => onOpenFamily(f.id)} activeOpacity={0.8}>
                <View style={styles.cardRow}>
                  <View style={styles.familyAvatar}>
                    <Ionicons name="people" size={20} color="#c17a2e" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.cardTopRow}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{familyDisplayName(f, head)}</Text>
                      <StatusBadge status={status} small />
                    </View>
                    <Text style={styles.cardMeta}>
                      {count} Member{count === 1 ? '' : 's'}
                      {showBranchTag ? ` • ${branchNameById.get(f.branchId) ?? f.branchId}` : ''}
                    </Text>
                    {statusFilterCount !== null && statusFilter && (
                      <Text style={[styles.cardMetaHighlight, { color: MEMBERSHIP_STATUS_COLORS[statusFilter] }]}>
                        {statusFilterCount} {MEMBERSHIP_STATUS_LABELS[statusFilter]}
                      </Text>
                    )}
                    <Text style={styles.cardMeta}>Head: {head?.name ?? '—'}</Text>
                    <Text style={styles.viewLink}>View →</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          {filteredSingles.map(m => (
            <TouchableOpacity key={`single-${m.id}`} style={styles.card} onPress={() => onOpenMember(m.id)} activeOpacity={0.8}>
              <View style={styles.cardRow}>
                <View style={styles.singleAvatar}>
                  <Ionicons name="person" size={20} color="#4c4fb0" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{m.name}</Text>
                    <StatusBadge status={m.membershipStatus} small />
                  </View>
                  <Text style={styles.cardMeta}>
                    Individual Member{showBranchTag ? ` • ${branchNameById.get(m.branchId) ?? m.branchId}` : ''}
                  </Text>
                  <Text style={styles.viewLink}>View →</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </>
      )}
    </>
  );

  if (!scroll) return <View>{content}</View>;
  return <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 8 }}>{content}</ScrollView>;
}

const styles = StyleSheet.create({
  emptyState: { alignItems: 'center', paddingTop: 40, paddingBottom: 20, paddingHorizontal: 24 },
  emptyIconWrap: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#f0f2f9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a2e', marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: '#888', textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    elevation: 3,
    borderLeftWidth: 5,
    borderLeftColor: '#0f3460',
  },
  cardRow: { flexDirection: 'row', gap: 12 },
  familyAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fde8cc', alignItems: 'center', justifyContent: 'center' },
  singleAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e0e4fb', alignItems: 'center', justifyContent: 'center' },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#1a1a2e', flex: 1 },
  cardMeta: { fontSize: 12, color: '#666', marginBottom: 2 },
  cardMetaHighlight: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  viewLink: { fontSize: 12, fontWeight: '700', color: '#0f3460', textAlign: 'right', marginTop: 4 },
});
