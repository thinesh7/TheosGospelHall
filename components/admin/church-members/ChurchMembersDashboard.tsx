import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../../AppText';
import { TextInput } from '../../AppTextInput';
import { Branch, Family, familyDisplayStatus, Member } from '../../../utils/churchMembers';
import MemberFamilyList from './MemberFamilyList';
import { CompactDropdown } from './shared';

type TypeTab = 'all' | 'families' | 'singles';

interface Props {
  branches: Branch[];
  families: Family[];
  members: Member[];
  onOpenBranch: (branchId: string) => void;
  onOpenFamily: (id: string) => void;
  onOpenMember: (id: string) => void;
  onAddFamily: () => void;
  onAddSingle: () => void;
  onOpenReports: () => void;
}

export default function ChurchMembersDashboard({
  branches,
  families,
  members,
  onOpenBranch,
  onOpenFamily,
  onOpenMember,
  onAddFamily,
  onAddSingle,
  onOpenReports,
}: Props) {
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [typeTab, setTypeTab] = useState<TypeTab>('all');
  const [search, setSearch] = useState('');

  const branchScope = branchFilter === 'ALL' ? undefined : branchFilter;

  const scopedMembers = branchScope ? members.filter(m => m.branchId === branchScope) : members;
  const scopedFamilies = branchScope ? families.filter(f => f.branchId === branchScope) : families;

  const summary = useMemo(() => {
    return {
      total: scopedMembers.length,
      families: scopedFamilies.length,
      singles: scopedMembers.filter(m => m.membershipType === 'SINGLE').length,
    };
  }, [scopedMembers, scopedFamilies]);

  const showBrowseList = branchFilter !== 'ALL' || typeTab !== 'all' || search.trim().length > 0;

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
          <TouchableOpacity style={styles.reportsBtn} onPress={onOpenReports}>
            <Ionicons name="bar-chart-outline" size={16} color="#0f3460" />
            <Text style={styles.reportsBtnText}>Summary</Text>
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

        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tab, typeTab === 'all' && styles.tabActive]} onPress={() => setTypeTab('all')}>
            <Text style={[styles.tabText, typeTab === 'all' && styles.tabTextActive]}>All ({summary.total})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, typeTab === 'families' && styles.tabActive]} onPress={() => setTypeTab('families')}>
            <Text style={[styles.tabText, typeTab === 'families' && styles.tabTextActive]}>Families ({summary.families})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, typeTab === 'singles' && styles.tabActive]} onPress={() => setTypeTab('singles')}>
            <Text style={[styles.tabText, typeTab === 'singles' && styles.tabTextActive]}>Singles ({summary.singles})</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.addBtn} onPress={onAddFamily}>
            <Text style={styles.addBtnText} numberOfLines={1} adjustsFontSizeToFit>＋ Add Family</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtnOutline} onPress={onAddSingle}>
            <Text style={styles.addBtnOutlineText} numberOfLines={1} adjustsFontSizeToFit>＋ Add Single Member</Text>
          </TouchableOpacity>
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
            filter={typeTab}
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
  reportsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, borderWidth: 1, borderColor: '#eee' },
  reportsBtnText: { fontSize: 13, fontWeight: '700', color: '#0f3460' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, elevation: 3, gap: 8, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 14, color: '#333' },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', alignItems: 'center' },
  tabActive: { backgroundColor: '#0f3460', borderColor: '#0f3460' },
  tabText: { fontSize: 12, fontWeight: '700', color: '#555' },
  tabTextActive: { color: '#fff' },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#555', marginBottom: 8, marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 18, alignItems: 'stretch' },
  addBtn: { flex: 1, backgroundColor: '#0f3460', borderRadius: 10, paddingVertical: 13, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13, textAlign: 'center' },
  addBtnOutline: { flex: 1, backgroundColor: '#e8f0fe', borderRadius: 10, paddingVertical: 13, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  addBtnOutlineText: { color: '#0f3460', fontWeight: 'bold', fontSize: 13, textAlign: 'center' },
  branchCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, elevation: 3, borderLeftWidth: 5, borderLeftColor: '#0f3460' },
  branchCardTitle: { fontSize: 15, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 4 },
  branchCardMeta: { fontSize: 12, color: '#666' },
  branchViewLink: { fontSize: 13, fontWeight: '700', color: '#0f3460' },
});
