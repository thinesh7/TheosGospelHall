import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../../AppText';
import { TextInput } from '../../AppTextInput';
import { Branch, Family, familyDisplayStatus, Member } from '../../../utils/churchMembers';
import MemberFamilyList from './MemberFamilyList';
import { CompactDropdown } from './shared';

interface Props {
  branches: Branch[];
  families: Family[];
  members: Member[];
  onOpenBranch: (branchId: string) => void;
  onOpenFamily: (id: string) => void;
  onOpenMember: (id: string) => void;
  onOpenReports: () => void;
}

export default function ChurchMembersDashboard({
  branches,
  families,
  members,
  onOpenBranch,
  onOpenFamily,
  onOpenMember,
  onOpenReports,
}: Props) {
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  const branchScope = branchFilter === 'ALL' ? undefined : branchFilter;

  const showBrowseList = branchFilter !== 'ALL' || search.trim().length > 0;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 8 }}>
        <View style={styles.toolbarRow}>
          <CompactDropdown
            title="Branch"
            value={branchFilter}
            onChange={setBranchFilter}
            options={[{ value: 'ALL', label: 'All Branches' }, ...branches.map(b => ({ value: b.id, label: b.name }))]}
          />
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={onOpenReports} activeOpacity={0.85}>
            <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.reportsBtn}>
              <Ionicons name="sparkles" size={15} color="#f4b942" />
              <Text style={styles.reportsBtnText}>Summary</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by member name or phone number"
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        {!showBrowseList ? (
          <>
            <Text style={styles.sectionLabel}>Branches</Text>
            {branches.map(b => {
              const activeBranchMembers = members.filter(m => m.branchId === b.id && m.membershipStatus === 'ACTIVE').length;
              const activeBranchFamilies = families.filter(f => f.branchId === b.id && familyDisplayStatus(f.id, members) === 'ACTIVE').length;
              return (
                <TouchableOpacity key={b.id} style={styles.branchCard} onPress={() => onOpenBranch(b.id)} activeOpacity={0.8}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.branchCardTitle}>{b.name}</Text>
                    <Text style={styles.branchCardMeta}>
                      {activeBranchMembers} Active Members | {activeBranchFamilies} Active Families
                    </Text>
                  </View>
                  <Text style={styles.branchViewLink}>View →</Text>
                </TouchableOpacity>
              );
            })}
          </>
        ) : (
          <MemberFamilyList
            families={families}
            members={members}
            branches={branches}
            search={search}
            branchScope={branchScope}
            showBranchTag={!branchScope}
            onOpenFamily={onOpenFamily}
            onOpenMember={onOpenMember}
            scroll={false}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbarRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  reportsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 11, elevation: 4, shadowColor: '#0f3460', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 5 },
  reportsBtnText: { fontSize: 13, fontWeight: '700', color: '#f4b942', letterSpacing: 0.3 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, elevation: 3, gap: 8, marginBottom: 16 },
  searchInput: { flex: 1, fontSize: 14, color: '#333' },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#555', marginBottom: 8, marginTop: 4 },
  branchCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, elevation: 3, borderLeftWidth: 5, borderLeftColor: '#0f3460' },
  branchCardTitle: { fontSize: 15, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 4 },
  branchCardMeta: { fontSize: 12, color: '#666' },
  branchViewLink: { fontSize: 13, fontWeight: '700', color: '#0f3460' },
});
