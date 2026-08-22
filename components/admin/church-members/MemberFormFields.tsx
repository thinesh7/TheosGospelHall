import { View } from 'react-native';
import { Text } from '../../AppText';
import { TextInput } from '../../AppTextInput';
import {
  FAMILY_MEMBER_RELATIONSHIPS,
  GENDER_LABELS,
  MARITAL_STATUS_LABELS,
  MaritalStatus,
  MemberFormInput,
  MembershipStatus,
  MEMBERSHIP_STATUS_LABELS,
  Relationship,
  RELATIONSHIP_LABELS,
} from '../../../utils/churchMembers';
import { DateField, DropdownField, styles } from './shared';

const TODAY = new Date();

interface Props {
  value: MemberFormInput;
  onChange: (updates: Partial<MemberFormInput>) => void;
  showRelationship?: boolean;
  showAddress?: boolean;
  nameLabel?: string;
}

export default function MemberFormFields({
  value,
  onChange,
  showRelationship = false,
  showAddress = false,
  nameLabel = 'Full Name',
}: Props) {
  return (
    <>
      <View style={styles.formField}>
        <Text style={styles.formLabel}>{nameLabel} *</Text>
        <TextInput
          style={styles.formInput}
          placeholder="e.g. Daniel Kumar"
          placeholderTextColor="#999"
          value={value.name}
          onChangeText={v => onChange({ name: v })}
        />
      </View>

      <DropdownField
        label="Gender *"
        placeholder="Select gender"
        value={value.gender}
        onChange={v => onChange({ gender: v })}
        options={(Object.keys(GENDER_LABELS) as (keyof typeof GENDER_LABELS)[]).map(g => ({ value: g, label: GENDER_LABELS[g] }))}
      />

      {showRelationship && (
        <DropdownField<Relationship>
          label="Relationship *"
          placeholder="Select relationship"
          value={value.relationship}
          onChange={v =>
            onChange({
              relationship: v,
              // Husband/Wife default to Married but the admin can still change it.
              maritalStatus: v === 'HUSBAND' || v === 'WIFE' ? 'MARRIED' : value.maritalStatus,
            })
          }
          options={FAMILY_MEMBER_RELATIONSHIPS.map(r => ({ value: r, label: RELATIONSHIP_LABELS[r] }))}
        />
      )}

      <DateField
        label="Date of Birth (Optional)"
        value={value.dateOfBirth}
        onChange={d => onChange({ dateOfBirth: d })}
        maximumDate={TODAY}
      />

      <View style={styles.formField}>
        <Text style={styles.formLabel}>Phone Number (Optional)</Text>
        <TextInput
          style={styles.formInput}
          placeholder="10-digit mobile number"
          placeholderTextColor="#999"
          value={value.phoneNumber}
          onChangeText={v => onChange({ phoneNumber: v.replace(/[^\d]/g, '').slice(0, 10) })}
          keyboardType="number-pad"
          maxLength={10}
        />
      </View>

      <DateField
        label="Baptism Date (Optional)"
        value={value.baptismDate}
        onChange={d => onChange({ baptismDate: d })}
        maximumDate={TODAY}
      />

      <DateField
        label="Member Since (Optional)"
        value={value.memberSince}
        onChange={d => onChange({ memberSince: d })}
        maximumDate={TODAY}
      />

      <DropdownField<MaritalStatus>
        label="Marital Status (Optional)"
        placeholder="Select marital status"
        value={value.maritalStatus}
        onChange={v => onChange({ maritalStatus: v, marriageDate: v === 'SINGLE' ? null : value.marriageDate })}
        options={(Object.keys(MARITAL_STATUS_LABELS) as MaritalStatus[]).map(s => ({ value: s, label: MARITAL_STATUS_LABELS[s] }))}
      />

      {value.maritalStatus !== 'SINGLE' && (
        <DateField
          label="Marriage Date (Optional)"
          value={value.marriageDate}
          onChange={d => onChange({ marriageDate: d })}
          maximumDate={TODAY}
        />
      )}

      {showAddress && (
        <>
          <View style={styles.formField}>
            <Text style={styles.formLabel}>Address (Optional)</Text>
            <TextInput
              style={[styles.formInput, styles.formInputMulti]}
              placeholder="House, street, city, state, pincode"
              placeholderTextColor="#999"
              value={value.address.addressLine1}
              onChangeText={v => onChange({ address: { ...value.address, addressLine1: v } })}
              multiline
            />
          </View>
          <View style={styles.formField}>
            <Text style={styles.formLabel}>Google Maps Location Link (Optional)</Text>
            <TextInput
              style={styles.formInput}
              placeholder="https://maps.app.goo.gl/..."
              placeholderTextColor="#999"
              value={value.address.mapLink}
              onChangeText={v => onChange({ address: { ...value.address, mapLink: v } })}
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>
        </>
      )}

      <DropdownField<MembershipStatus>
        label="Membership Status"
        placeholder="Select status"
        value={value.membershipStatus}
        onChange={v => onChange({ membershipStatus: v })}
        options={(Object.keys(MEMBERSHIP_STATUS_LABELS) as MembershipStatus[]).map(s => ({ value: s, label: MEMBERSHIP_STATUS_LABELS[s] }))}
      />
    </>
  );
}
