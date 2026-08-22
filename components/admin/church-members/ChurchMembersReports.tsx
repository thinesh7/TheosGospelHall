import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../../AppText';
import { Toast, useToast } from '../../Toast';
import { Branch, Family, GENDER_LABELS, Member, MembershipStatus, MEMBERSHIP_STATUS_LABELS } from '../../../utils/churchMembers';
import { exportChurchMembersReport, ReportBranchRow, ReportData } from '../../../utils/exportChurchMembers';
import { CompactDropdown } from './shared';

interface Props {
  branches: Branch[];
  families: Family[];
  members: Member[];
  onBack: () => void;
}

type StatusFilter = 'ALL' | MembershipStatus;

function countGroup(members: Member[], families: Family[], branchId?: string, status?: StatusFilter) {
  let m = branchId ? members.filter(x => x.branchId === branchId) : members;
  let f = branchId ? families.filter(x => x.branchId === branchId) : families;
  if (status && status !== 'ALL') {
    // A family counts toward a status-scoped tally only if it has at least
    // one member with that status — e.g. "Families" under an Active scope
    // means "families with at least 1 active member", not every family.
    const matchingFamilyIds = new Set(
      m.filter(x => x.membershipStatus === status && x.familyId).map(x => x.familyId as string)
    );
    f = f.filter(fam => matchingFamilyIds.has(fam.id));
    m = m.filter(x => x.membershipStatus === status);
  }
  return {
    total: m.length,
    active: m.filter(x => x.membershipStatus === 'ACTIVE').length,
    inactive: m.filter(x => x.membershipStatus === 'INACTIVE').length,
    families: f.length,
    singles: m.filter(x => x.membershipType === 'SINGLE').length,
    male: m.filter(x => x.gender === 'MALE').length,
    female: m.filter(x => x.gender === 'FEMALE').length,
  };
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function ChurchMembersReports({ branches, families, members, onBack }: Props) {
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const { message, opacity, showToast } = useToast();

  const overall = useMemo(
    () => countGroup(members, families, branchFilter === 'ALL' ? undefined : branchFilter, statusFilter),
    [members, families, branchFilter, statusFilter]
  );

  const branchRows: ReportBranchRow[] = useMemo(
    () =>
      branches.map(b => {
        const g = countGroup(members, families, b.id, statusFilter);
        return { branchName: b.name, total: g.total, active: g.active, inactive: g.inactive, families: g.families, singles: g.singles };
      }),
    [branches, members, families, statusFilter]
  );

  // "Members by Branch" and "Gender Summary" always reflect the current
  // active congregation — independent of the Status dropdown above, which
  // only scopes the Overall Summary tiles.
  const activeBranchRows = useMemo(
    () => branches.map(b => ({ branchName: b.name, total: countGroup(members, families, b.id, 'ACTIVE').total })),
    [branches, members, families]
  );
  const maxActiveBranchTotal = Math.max(1, ...activeBranchRows.map(r => r.total));

  // Always-active view of the current branch scope — independent of the
  // Status dropdown. Used for the "Active Members" / "Families" / "Single
  // Members" tiles (Families = families with >=1 active member, Single
  // Members = active singles only) as well as the Gender Summary bars.
  const activeOverall = useMemo(
    () => countGroup(members, families, branchFilter === 'ALL' ? undefined : branchFilter, 'ACTIVE'),
    [members, families, branchFilter]
  );

  const scopeLabel = `${branchFilter === 'ALL' ? 'All Branches' : branches.find(b => b.id === branchFilter)?.name ?? branchFilter}${statusFilter !== 'ALL' ? ` • ${MEMBERSHIP_STATUS_LABELS[statusFilter]}` : ''}`;

  const handleExport = async (format: 'excel' | 'pdf') => {
    setShowExportMenu(false);
    setExporting(format);
    try {
      const report: ReportData = {
        scopeLabel,
        total: overall.total,
        active: activeOverall.active,
        inactive: overall.inactive,
        families: activeOverall.families,
        singles: activeOverall.singles,
        male: activeOverall.male,
        female: activeOverall.female,
        branchRows,
      };
      await exportChurchMembersReport(format, report);
      showToast('✅ Report ready — choose where to save');
    } catch (e: any) {
      Alert.alert('Export Failed', e?.message ?? 'Could not generate the report file.');
    }
    setExporting(null);
  };

  const genderTotal = activeOverall.male + activeOverall.female || 1;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Members Reports (Summary)</Text>
          <Text style={styles.subtitle}>As of {todayLabel()}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.toolbarRow}>
          <CompactDropdown
            title="Branch"
            value={branchFilter}
            onChange={setBranchFilter}
            options={[{ value: 'ALL', label: 'All Branches' }, ...branches.map(b => ({ value: b.id, label: b.name }))]}
          />
          <CompactDropdown
            title="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'ALL', label: 'All Status' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'INACTIVE', label: 'Inactive' },
            ]}
          />
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            style={[styles.iconBtn, !!exporting && { opacity: 0.6 }]}
            disabled={!!exporting}
            onPress={() => setShowExportMenu(true)}
          >
            <Ionicons name={exporting ? 'hourglass-outline' : 'download-outline'} size={18} color="#0f3460" />
          </TouchableOpacity>
        </View>

        <View style={styles.summaryGrid}>
          <SummaryTile label="Active Members" value={activeOverall.active} color="#1e9e50" />
          <SummaryTile label="Families" value={activeOverall.families} color="#6a4c93" />
          <SummaryTile label="Individual Members" value={activeOverall.singles} color="#6a4c93" />
        </View>
        <View style={styles.summaryGrid}>
          <SummaryTile label="Inactive Members" value={overall.inactive} color="#e65100" />
          <SummaryTile label="Total Members" value={overall.total} color="#0f3460" />
        </View>

        <Text style={styles.sectionTitle}>Gender Summary (Active)</Text>
        <View style={styles.card}>
          <BarRow label={GENDER_LABELS.MALE} value={activeOverall.male} total={genderTotal} color="#1565c0" />
          <BarRow label={GENDER_LABELS.FEMALE} value={activeOverall.female} total={genderTotal} color="#c2185b" />
        </View>

        <Text style={styles.sectionTitle}>Members by Branch (Active)</Text>
        <View style={styles.card}>
          {activeBranchRows.map(row => (
            <BarRow key={row.branchName} label={row.branchName} value={row.total} total={maxActiveBranchTotal} color="#0f3460" showCountOnly />
          ))}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>

      <Modal visible={showExportMenu} transparent animationType="fade" onRequestClose={() => setShowExportMenu(false)}>
        <TouchableOpacity style={styles.exportMenuBackdrop} activeOpacity={1} onPress={() => setShowExportMenu(false)}>
          <View style={styles.exportMenuCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.exportMenuTitle}>Download Report</Text>
            <Text style={styles.exportMenuSubtitle}>{scopeLabel}</Text>
            <TouchableOpacity style={styles.exportMenuOption} onPress={() => handleExport('excel')}>
              <Text style={styles.exportMenuOptionText}>Excel (.xlsx)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportMenuOption} onPress={() => handleExport('pdf')}>
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

function SummaryTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.summaryTile}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function BarRow({
  label,
  value,
  total,
  color,
  showCountOnly,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  showCountOnly?: boolean;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <View style={styles.barRow}>
      <View style={styles.barLabelRow}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barValue}>{showCountOnly ? value : `${value} (${pct}%)`}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, backgroundColor: '#f5f5f5' },
  backText: { color: '#0f3460', fontWeight: '600', fontSize: 15 },
  title: { fontSize: 15, fontWeight: 'bold', color: '#1a1a2e' },
  subtitle: { fontSize: 11, color: '#888', marginTop: 2 },
  toolbarRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  iconBtn: { backgroundColor: '#fff', borderRadius: 10, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#eee' },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 10, marginTop: 6 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  summaryTile: { flexBasis: '31%', flexGrow: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', elevation: 3 },
  summaryValue: { fontSize: 20, fontWeight: 'bold' },
  summaryLabel: { fontSize: 11, color: '#777', marginTop: 4, textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 22, elevation: 3 },
  barRow: { marginBottom: 16 },
  barLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  barLabel: { fontSize: 13, fontWeight: '600', color: '#333' },
  barValue: { fontSize: 12, color: '#777' },
  barTrack: { height: 10, borderRadius: 5, backgroundColor: '#eee', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5 },
  exportMenuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  exportMenuCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 340, elevation: 8 },
  exportMenuTitle: { fontSize: 17, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 4 },
  exportMenuSubtitle: { fontSize: 12, color: '#888', marginBottom: 16 },
  exportMenuOption: { paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#eee' },
  exportMenuOptionText: { fontSize: 15, fontWeight: '600', color: '#0f3460' },
  exportMenuCancel: { alignItems: 'center', paddingVertical: 14, marginTop: 6 },
  exportMenuCancelText: { fontSize: 14, color: '#888', fontWeight: '600' },
});
