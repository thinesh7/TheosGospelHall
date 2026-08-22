import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../AppText';
import {
  Branch,
  ensureSeedBranches,
  Family,
  getCurrentAdminEmail,
  Member,
  subscribeBranches,
  subscribeFamilies,
  subscribeMembers,
} from '../../utils/churchMembers';
import AddFamilyMemberScreen from './church-members/AddFamilyMemberScreen';
import AddFamilyWizard from './church-members/AddFamilyWizard';
import AddSingleMemberScreen from './church-members/AddSingleMemberScreen';
import BranchMemberList from './church-members/BranchMemberList';
import ChurchMembersDashboard from './church-members/ChurchMembersDashboard';
import ChurchMembersReports from './church-members/ChurchMembersReports';
import EditFamilyScreen from './church-members/EditFamilyScreen';
import EditMemberScreen from './church-members/EditMemberScreen';
import FamilyDetailsScreen from './church-members/FamilyDetailsScreen';
import MemberDetailsScreen from './church-members/MemberDetailsScreen';
import { AdminScreenHandle } from './SpecialMeetingsAdmin';

type CMView =
  | { type: 'dashboard' }
  | { type: 'branch'; branchId: string }
  | { type: 'addFamily'; branchId?: string }
  | { type: 'addSingle'; branchId?: string }
  | { type: 'familyDetails'; familyId: string }
  | { type: 'editFamily'; familyId: string }
  | { type: 'addFamilyMember'; familyId: string }
  | { type: 'memberDetails'; memberId: string }
  | { type: 'editMember'; memberId: string }
  | { type: 'reports' };

const ChurchMembersAdmin = forwardRef<AdminScreenHandle, Record<string, never>>((_props, ref) => {
  const [stack, setStack] = useState<CMView[]>([{ type: 'dashboard' }]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const wizardRef = useRef<AdminScreenHandle>(null);

  useImperativeHandle(ref, () => ({
    goBack: () => {
      if (wizardRef.current?.goBack()) return true;
      if (stack.length > 1) {
        setStack(prev => prev.slice(0, -1));
        return true;
      }
      return false;
    },
  }));

  useEffect(() => {
    ensureSeedBranches(getCurrentAdminEmail()).catch(() => {});
    const unsubBranches = subscribeBranches(setBranches);
    const unsubFamilies = subscribeFamilies(setFamilies);
    let membersLoaded = false;
    const unsubMembers = subscribeMembers(list => {
      setMembers(list);
      if (!membersLoaded) {
        membersLoaded = true;
        setLoading(false);
      }
    });
    return () => {
      unsubBranches();
      unsubFamilies();
      unsubMembers();
    };
  }, []);

  const push = (view: CMView) => setStack(prev => [...prev, view]);
  const pop = () => setStack(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));

  const current = stack[stack.length - 1];

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.loadingText}>Loading Church Members...</Text>
      </View>
    );
  }

  switch (current.type) {
    case 'dashboard':
      return (
        <ChurchMembersDashboard
          branches={branches}
          families={families}
          members={members}
          onOpenBranch={branchId => push({ type: 'branch', branchId })}
          onOpenFamily={familyId => push({ type: 'familyDetails', familyId })}
          onOpenMember={memberId => push({ type: 'memberDetails', memberId })}
          onAddFamily={() => push({ type: 'addFamily' })}
          onAddSingle={() => push({ type: 'addSingle' })}
          onOpenReports={() => push({ type: 'reports' })}
        />
      );

    case 'branch': {
      const branch = branches.find(b => b.id === current.branchId);
      if (!branch) return <NotFound message="Branch not found." onBack={pop} />;
      return (
        <BranchMemberList
          branch={branch}
          branches={branches}
          families={families}
          members={members}
          onBack={pop}
          onOpenFamily={familyId => push({ type: 'familyDetails', familyId })}
          onOpenMember={memberId => push({ type: 'memberDetails', memberId })}
          onAddFamily={() => push({ type: 'addFamily', branchId: branch.id })}
          onAddSingle={() => push({ type: 'addSingle', branchId: branch.id })}
        />
      );
    }

    case 'addFamily':
      return (
        <AddFamilyWizard
          ref={wizardRef}
          branches={branches}
          defaultBranchId={current.branchId}
          onCancel={pop}
          onSaved={familyId => {
            setStack(prev => [...prev.slice(0, -1), { type: 'familyDetails', familyId }]);
          }}
        />
      );

    case 'addSingle':
      return (
        <AddSingleMemberScreen
          branches={branches}
          defaultBranchId={current.branchId}
          onCancel={pop}
          onSaved={memberId => {
            setStack(prev => [...prev.slice(0, -1), { type: 'memberDetails', memberId }]);
          }}
        />
      );

    case 'familyDetails': {
      const family = families.find(f => f.id === current.familyId);
      if (!family) return <NotFound message="Family not found." onBack={pop} />;
      const branch = branches.find(b => b.id === family.branchId);
      return (
        <FamilyDetailsScreen
          family={family}
          branch={branch}
          members={members}
          onBack={pop}
          onEditFamily={() => push({ type: 'editFamily', familyId: family.id })}
          onAddMember={() => push({ type: 'addFamilyMember', familyId: family.id })}
          onOpenMember={memberId => push({ type: 'memberDetails', memberId })}
        />
      );
    }

    case 'editFamily': {
      const family = families.find(f => f.id === current.familyId);
      if (!family) return <NotFound message="Family not found." onBack={pop} />;
      return <EditFamilyScreen family={family} branches={branches} onCancel={pop} onSaved={pop} />;
    }

    case 'addFamilyMember': {
      const family = families.find(f => f.id === current.familyId);
      if (!family) return <NotFound message="Family not found." onBack={pop} />;
      return (
        <AddFamilyMemberScreen
          family={family}
          onCancel={pop}
          onSaved={memberId => setStack(prev => [...prev.slice(0, -1), { type: 'memberDetails', memberId }])}
        />
      );
    }

    case 'memberDetails': {
      const member = members.find(m => m.id === current.memberId);
      if (!member) return <NotFound message="Member not found." onBack={pop} />;
      const family = member.familyId ? families.find(f => f.id === member.familyId) : undefined;
      const branch = branches.find(b => b.id === member.branchId);
      return (
        <MemberDetailsScreen
          member={member}
          family={family}
          branch={branch}
          onBack={pop}
          onEdit={() => push({ type: 'editMember', memberId: member.id })}
          onOpenFamily={family ? familyId => push({ type: 'familyDetails', familyId }) : undefined}
        />
      );
    }

    case 'editMember': {
      const member = members.find(m => m.id === current.memberId);
      if (!member) return <NotFound message="Member not found." onBack={pop} />;
      return <EditMemberScreen member={member} onCancel={pop} onSaved={pop} />;
    }

    case 'reports':
      return <ChurchMembersReports branches={branches} families={families} members={members} onBack={pop} />;

    default:
      return null;
  }
});

function NotFound({ message, onBack }: { message: string; onBack: () => void }) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    const t = setTimeout(() => onBackRef.current(), 800);
    return () => clearTimeout(t);
  }, []);
  return (
    <View style={styles.loadingWrap}>
      <Text style={styles.loadingText}>{message}</Text>
    </View>
  );
}

ChurchMembersAdmin.displayName = 'ChurchMembersAdmin';

export default ChurchMembersAdmin;

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  loadingText: { color: '#888', fontSize: 14 },
});
