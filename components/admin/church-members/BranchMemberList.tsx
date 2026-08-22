import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../../AppText';
import { TextInput } from '../../AppTextInput';
import { Toast, useToast } from '../../Toast';
import {
  Branch,
  expandFamilyMembersGrouped,
  Family,
  filterFamiliesAndMembers,
  Member,
  MembershipStatus,
  TypeFilter,
} from '../../../utils/churchMembers';
import { buildListExportRows, exportMemberList } from '../../../utils/exportChurchMembers';
import MemberFamilyList from './MemberFamilyList';

const STATUS_OPTIONS: { value: MembershipStatus | undefined; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: undefined, label: 'All' },
];

const TYPE_OPTIONS: { value: TypeFilter | undefined; label: string; icon: 'people' | 'person' }[] = [
  { value: 'families', label: 'Families', icon: 'people' },
  { value: 'singles', label: 'Individuals', icon: 'person' },
  { value: undefined, label: 'All', icon: 'people' },
];

interface Props {
  branch: Branch;
  branches: Branch[];
  families: Family[];
  members: Member[];
  onBack: () => void;
  onOpenFamily: (id: string) => void;
  onOpenMember: (id: string) => void;
  onAddFamily: () => void;
  onAddSingle: () => void;
}

function statusWord(statusFilter: MembershipStatus | undefined): string {
  if (statusFilter === 'ACTIVE') return 'active';
  if (statusFilter === 'INACTIVE') return 'inactive';
  return 'all';
}

export default function BranchMemberList({ branch, branches, families, members, onBack, onOpenFamily, onOpenMember, onAddFamily, onAddSingle }: Props) {
  const [statusFilter, setStatusFilter] = useState<MembershipStatus | undefined>('ACTIVE');
  const [typeFilter, setTypeFilter] = useState<TypeFilter | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const { message, opacity, showToast } = useToast();

  const filteredResult = useMemo(
    () => filterFamiliesAndMembers(families, members, { branchScope: branch.id, typeFilter, statusFilter, search }),
    [families, members, branch.id, typeFilter, statusFilter, search]
  );
  const exportCount = filteredResult.families.length + filteredResult.singleMembers.length;

  // Status toggle counts (Active/Inactive/All) always count individual
  // PEOPLE across both families and singles, ignoring the current search
  // text and the type toggle below — so a family with 2 inactive members
  // contributes 2 to the Inactive count, not 1.
  const statusCounts = useMemo(() => {
    const branchMembers = members.filter(m => m.branchId === branch.id);
    return {
      ACTIVE: branchMembers.filter(m => m.membershipStatus === 'ACTIVE').length,
      INACTIVE: branchMembers.filter(m => m.membershipStatus === 'INACTIVE').length,
      undefined: branchMembers.length,
    } as Record<string, number>;
  }, [members, branch.id]);

  // Member Type toggle counts (Families/Individuals/All) are scoped to whichever
  // status is currently selected above. "All" and "Individuals" count people;
  // "Families" counts family units.
  const typeCounts = useMemo(() => {
    const scopedMembers = members.filter(m => m.branchId === branch.id && (!statusFilter || m.membershipStatus === statusFilter));
    const scopedFamilies = families.filter(
      f => f.branchId === branch.id && (!statusFilter || members.some(m => m.familyId === f.id && m.membershipStatus === statusFilter))
    );
    return {
      undefined: scopedMembers.length,
      families: scopedFamilies.length,
      singles: scopedMembers.filter(m => m.membershipType === 'SINGLE').length,
    } as Record<string, number>;
  }, [families, members, branch.id, statusFilter]);

  const sectionLabel =
    typeFilter === 'families'
      ? `Families${statusFilter ? ` (${STATUS_OPTIONS.find(o => o.value === statusFilter)?.label})` : ''}`
      : typeFilter === 'singles'
      ? `Individuals${statusFilter ? ` (${STATUS_OPTIONS.find(o => o.value === statusFilter)?.label})` : ''}`
      : 'Members';

  const bannerText =
    typeFilter === 'families'
      ? `Showing ${statusWord(statusFilter)} families only`
      : typeFilter === 'singles'
      ? `Showing ${statusWord(statusFilter)} individual members only`
      : `Showing ${statusWord(statusFilter)} members (All types)`;

  const handleExport = async (format: 'excel' | 'pdf') => {
    setShowExportMenu(false);
    if (exportCount === 0) { Alert.alert('No Records', 'No records available to export.'); return; }
    setExporting(format);
    try {
      const familyMembers = expandFamilyMembersGrouped(filteredResult, members);
      const familyRows = buildListExportRows(familyMembers, families, branches);
      const singleRows = buildListExportRows(filteredResult.singleMembers, families, branches);
      await exportMemberList(format, familyRows, singleRows, branch.name);
      showToast('✅ Export ready — choose where to save');
    } catch (e: any) {
      Alert.alert('Export Failed', e?.message ?? 'Could not generate the export file.');
    }
    setExporting(null);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{branch.name} Members</Text>
        </View>

        <View style={styles.toolbar}>
          <View style={styles.addCard}>
            <TouchableOpacity style={[styles.addCardHalf, { flex: 0.85 }]} onPress={onAddFamily}>
              <Ionicons name="people" size={17} color="#0f3460" />
              <Text style={styles.addCardText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>＋ Add Family</Text>
            </TouchableOpacity>
            <View style={styles.addCardDivider} />
            <TouchableOpacity style={[styles.addCardHalf, { flex: 1.15 }]} onPress={onAddSingle}>
              <Ionicons name="person" size={17} color="#0f3460" />
              <Text style={styles.addCardText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>＋ Add Individual Member</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#666" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search members by name or phone..."
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

          <View style={styles.toggleRow}>
            {STATUS_OPTIONS.map(opt => (
              <TouchableOpacity
                key={String(opt.value)}
                style={[styles.toggleBtn, statusFilter === opt.value && styles.toggleBtnActive]}
                onPress={() => setStatusFilter(opt.value)}
              >
                <Text style={[styles.toggleBtnText, statusFilter === opt.value && styles.toggleBtnTextActive]}>
                  {opt.label} ({statusCounts[String(opt.value)]})
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.memberTypeLabel}>Member Type</Text>
          <View style={styles.toggleRow}>
            {TYPE_OPTIONS.map(opt => (
              <TouchableOpacity
                key={String(opt.value)}
                style={[styles.typeBtn, typeFilter === opt.value && styles.typeBtnActive]}
                onPress={() => setTypeFilter(opt.value)}
              >
                <Ionicons name={opt.icon} size={15} color={typeFilter === opt.value ? '#fff' : '#555'} />
                <Text style={[styles.typeBtnText, typeFilter === opt.value && styles.typeBtnTextActive]}>
                  {opt.label} ({typeCounts[String(opt.value)]})
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>{sectionLabel}</Text>
            <TouchableOpacity
              style={[styles.exportBtn, !!exporting && { opacity: 0.6 }]}
              disabled={!!exporting}
              onPress={() => setShowExportMenu(true)}
            >
              <Ionicons name={exporting ? 'hourglass-outline' : 'download-outline'} size={15} color="#0f3460" />
              <Text style={styles.exportBtnText}>{exporting ? 'Exporting...' : 'Export'}</Text>
              <Ionicons name="chevron-down" size={13} color="#0f3460" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          <MemberFamilyList
            families={families}
            members={members}
            branches={branches}
            typeFilter={typeFilter}
            statusFilter={statusFilter}
            search={search}
            branchScope={branch.id}
            onOpenFamily={onOpenFamily}
            onOpenMember={onOpenMember}
            scroll={false}
          />

          <View style={styles.banner}>
            <Ionicons name="information-circle" size={16} color="#0f3460" />
            <Text style={styles.bannerText}>{bannerText}</Text>
          </View>
        </View>
      </ScrollView>

      <Modal visible={showExportMenu} transparent animationType="fade" onRequestClose={() => setShowExportMenu(false)}>
        <TouchableOpacity style={styles.exportMenuBackdrop} activeOpacity={1} onPress={() => setShowExportMenu(false)}>
          <View style={styles.exportMenuCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.exportMenuTitle}>Export {branch.name} Members</Text>
            <Text style={styles.exportMenuSubtitle}>{exportCount} record(s) match current filters</Text>
            <TouchableOpacity style={styles.exportMenuOption} disabled={exportCount === 0} onPress={() => handleExport('excel')}>
              <Text style={styles.exportMenuOptionText}>Excel (.xlsx)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportMenuOption} disabled={exportCount === 0} onPress={() => handleExport('pdf')}>
              <Text style={styles.exportMenuOptionText}>PDF (.pdf)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportMenuCancel} onPress={() => setShowExportMenu(false)}>
              <Text style={styles.exportMenuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Toast message={message} opacity={opacity} />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, paddingBottom: 8, backgroundColor: '#f5f5f5' },
  backText: { color: '#0f3460', fontWeight: '600', fontSize: 15 },
  title: { fontSize: 15, fontWeight: 'bold', color: '#1a1a2e' },
  toolbar: { paddingHorizontal: 16, paddingBottom: 6, backgroundColor: '#f5f5f5' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, elevation: 3, gap: 8, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 14, color: '#333' },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#0f3460', borderColor: '#0f3460' },
  toggleBtnText: { fontSize: 12, fontWeight: '700', color: '#555' },
  toggleBtnTextActive: { color: '#fff' },
  memberTypeLabel: { fontSize: 11, fontWeight: '700', color: '#888', textTransform: 'uppercase', marginBottom: 6 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee' },
  typeBtnActive: { backgroundColor: '#0f3460', borderColor: '#0f3460' },
  typeBtnText: { fontSize: 12, fontWeight: '700', color: '#555' },
  typeBtnTextActive: { color: '#fff' },
  addCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dce3f0',
    marginBottom: 12,
    overflow: 'hidden',
  },
  addCardHalf: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 14, paddingHorizontal: 2, minWidth: 0 },
  addCardDivider: { width: 1, backgroundColor: '#dce3f0' },
  addCardText: { color: '#0f3460', fontWeight: '700', fontSize: 13, textAlign: 'center' },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sectionLabel: { fontSize: 15, fontWeight: '700', color: '#1a1a2e' },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  exportBtnText: { color: '#0f3460', fontWeight: '700', fontSize: 12 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#e8f0fe', borderRadius: 12, padding: 12, marginTop: 4, marginBottom: 20 },
  bannerText: { flex: 1, fontSize: 12, color: '#0f3460', fontWeight: '600' },
  exportMenuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  exportMenuCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 340, elevation: 8 },
  exportMenuTitle: { fontSize: 17, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 4 },
  exportMenuSubtitle: { fontSize: 12, color: '#888', marginBottom: 16 },
  exportMenuOption: { paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#eee' },
  exportMenuOptionText: { fontSize: 15, fontWeight: '600', color: '#0f3460' },
  exportMenuCancel: { alignItems: 'center', paddingVertical: 14, marginTop: 6 },
  exportMenuCancelText: { fontSize: 14, color: '#888', fontWeight: '600' },
});
