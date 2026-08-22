import { StyleSheet, TouchableOpacity, View, ScrollView } from 'react-native';
import { Text } from '../../AppText';
import {
  Branch,
  Family,
  familyDisplayStatus,
  familyHead,
  filterFamiliesAndMembers,
  ListFilter,
  Member,
  membersOfFamily,
} from '../../../utils/churchMembers';
import { StatusBadge } from './shared';

export type { ListFilter };

export const FILTER_OPTIONS: { value: ListFilter; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'families', label: 'Families' },
  { value: 'singles', label: 'Singles' },
  { value: 'transferred', label: 'Transferred' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'all', label: 'All' },
];

interface Props {
  families: Family[];
  members: Member[];
  branches: Branch[];
  filter: ListFilter;
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
  filter,
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
    filter,
    search,
  });

  const totalCount = filteredFamilies.length + filteredSingles.length;

  const content = (
    <>
      {totalCount === 0 ? (
        <Text style={styles.emptyText}>No members found.</Text>
      ) : (
        <>
          {filteredFamilies.map(f => {
            const head = familyHead(f.id, members);
            const count = membersOfFamily(f.id, members).length;
            const status = familyDisplayStatus(f.id, members);
            return (
              <TouchableOpacity key={`family-${f.id}`} style={styles.card} onPress={() => onOpenFamily(f.id)} activeOpacity={0.8}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{f.familyName}</Text>
                  <StatusBadge status={status} small />
                </View>
                <Text style={styles.cardMeta}>
                  {count} Member{count === 1 ? '' : 's'}
                  {showBranchTag ? ` • ${branchNameById.get(f.branchId) ?? f.branchId}` : ''}
                </Text>
                <Text style={styles.cardMeta}>Head: {head?.name ?? '—'}</Text>
                <Text style={styles.viewLink}>View →</Text>
              </TouchableOpacity>
            );
          })}

          {filteredSingles.map(m => (
            <TouchableOpacity key={`single-${m.id}`} style={styles.card} onPress={() => onOpenMember(m.id)} activeOpacity={0.8}>
              <View style={styles.cardTopRow}>
                <Text style={styles.cardTitle} numberOfLines={1}>{m.name}</Text>
                <StatusBadge status={m.membershipStatus} small />
              </View>
              <Text style={styles.cardMeta}>
                Single Member{showBranchTag ? ` • ${branchNameById.get(m.branchId) ?? m.branchId}` : ''}
              </Text>
              <Text style={styles.viewLink}>View →</Text>
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
  emptyText: { textAlign: 'center', color: '#aaa', marginTop: 30, fontSize: 14, fontStyle: 'italic' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    elevation: 3,
    borderLeftWidth: 5,
    borderLeftColor: '#0f3460',
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#1a1a2e', flex: 1 },
  cardMeta: { fontSize: 12, color: '#666', marginBottom: 2 },
  viewLink: { fontSize: 12, fontWeight: '700', color: '#0f3460', textAlign: 'right', marginTop: 4 },
});
