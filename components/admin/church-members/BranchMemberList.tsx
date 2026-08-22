import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../../AppText';
import { TextInput } from '../../AppTextInput';
import { Toast, useToast } from '../../Toast';
import {
  Branch,
  expandFilteredToMembers,
  Family,
  filterFamiliesAndMembers,
  Member,
} from '../../../utils/churchMembers';
import { buildListExportRows, exportMemberList } from '../../../utils/exportChurchMembers';
import MemberFamilyList, { FILTER_OPTIONS, ListFilter } from './MemberFamilyList';

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

export default function BranchMemberList({ branch, branches, families, members, onBack, onOpenFamily, onOpenMember, onAddFamily, onAddSingle }: Props) {
  const [filter, setFilter] = useState<ListFilter>('active');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const { message, opacity, showToast } = useToast();

  const filteredResult = useMemo(
    () => filterFamiliesAndMembers(families, members, { branchScope: branch.id, filter, search }),
    [families, members, branch.id, filter, search]
  );
  const exportCount = filteredResult.families.length + filteredResult.singleMembers.length;

  const handleExport = async (format: 'excel' | 'pdf') => {
    setShowExportMenu(false);
    if (exportCount === 0) { Alert.alert('No Records', 'No records available to export.'); return; }
    setExporting(format);
    try {
      const memberRows = expandFilteredToMembers(filteredResult, members);
      const rows = buildListExportRows(memberRows, families, branches);
      await exportMemberList(format, rows, branch.name);
      showToast('✅ Export ready — choose where to save');
    } catch (e: any) {
      Alert.alert('Export Failed', e?.message ?? 'Could not generate the export file.');
    }
    setExporting(null);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{branch.name} Members</Text>
      </View>

      <View style={styles.toolbar}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search members..."
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

        <View style={styles.filterRow}>
          {FILTER_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.filterChip, filter === opt.value && styles.filterChipActive]}
              onPress={() => setFilter(opt.value)}
            >
              <Text style={[styles.filterChipText, filter === opt.value && styles.filterChipTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.addBtn} onPress={onAddFamily}>
            <Text style={styles.addBtnText} numberOfLines={1} adjustsFontSizeToFit>＋ Add Family</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtnOutline} onPress={onAddSingle}>
            <Text style={styles.addBtnOutlineText} numberOfLines={1} adjustsFontSizeToFit>＋ Add Single Member</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.exportBtn, !!exporting && { opacity: 0.6 }]}
            disabled={!!exporting}
            onPress={() => setShowExportMenu(true)}
          >
            <Ionicons name={exporting ? 'hourglass-outline' : 'download-outline'} size={16} color="#0f3460" />
          </TouchableOpacity>
        </View>
      </View>

      <MemberFamilyList
        families={families}
        members={members}
        branches={branches}
        filter={filter}
        search={search}
        branchScope={branch.id}
        onOpenFamily={onOpenFamily}
        onOpenMember={onOpenMember}
      />

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
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  filterChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee' },
  filterChipActive: { backgroundColor: '#0f3460', borderColor: '#0f3460' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#555' },
  filterChipTextActive: { color: '#fff' },
  actionRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  addBtn: { flex: 1, backgroundColor: '#0f3460', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13, textAlign: 'center' },
  addBtnOutline: { flex: 1, backgroundColor: '#e8f0fe', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  addBtnOutlineText: { color: '#0f3460', fontWeight: 'bold', fontSize: 13, textAlign: 'center' },
  exportBtn: { backgroundColor: '#fff', borderRadius: 10, width: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#eee' },
  exportMenuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  exportMenuCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 340, elevation: 8 },
  exportMenuTitle: { fontSize: 17, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 4 },
  exportMenuSubtitle: { fontSize: 12, color: '#888', marginBottom: 16 },
  exportMenuOption: { paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#eee' },
  exportMenuOptionText: { fontSize: 15, fontWeight: '600', color: '#0f3460' },
  exportMenuCancel: { alignItems: 'center', paddingVertical: 14, marginTop: 6 },
  exportMenuCancelText: { fontSize: 14, color: '#888', fontWeight: '600' },
});
