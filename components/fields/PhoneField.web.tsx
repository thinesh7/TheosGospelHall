import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AsYouType, getCountries, getCountryCallingCode, isValidPhoneNumber, validatePhoneNumberLength } from 'libphonenumber-js/mobile';
import { Ionicons } from '@expo/vector-icons';
import { TextInput } from '@/components/AppTextInput';
import { radii, spacing } from '@/constants/layout';
import { useTheme } from '@/utils/ThemeContext';
import { PhoneFieldProps, PhoneFieldValue } from './PhoneField';

// Built once at module load (not per-render): every ISO country paired with
// its calling code, e.g. { code: 'IN', callingCode: '91' }, sorted with the
// default country first.
const COUNTRIES = getCountries()
  .map(code => ({ code, callingCode: getCountryCallingCode(code) }))
  .sort((a, b) => a.code.localeCompare(b.code));

// Web: react-native-phone-number-input's web dependency chain
// (react-native-country-picker-modal -> react-async-hook) has a broken
// package publish that Metro cannot resolve for web at all — it blocks the
// entire web bundle, not just this field. This is a plain country-select +
// digits input instead, backed by the same libphonenumber-js already used
// for validation in utils/registrations.ts, so no validation behavior changes.
export default function PhoneField({ formKey, defaultCountry = 'IN', onChange }: PhoneFieldProps) {
  const { colors } = useTheme();
  const [countryCode, setCountryCode] = useState(defaultCountry);
  const [nationalNumber, setNationalNumber] = useState('');
  const stateRef = useRef<PhoneFieldValue>({ formattedNumber: '', nationalNumber: '', callingCode: getCountryCallingCode(defaultCountry as any) });

  const emit = (patch: Partial<PhoneFieldValue>) => {
    stateRef.current = { ...stateRef.current, ...patch };
    onChange(stateRef.current);
  };

  const handleCountryChange = (code: string) => {
    setCountryCode(code);
    const callingCode = getCountryCallingCode(code as any);
    emit({ callingCode, formattedNumber: nationalNumber ? `+${callingCode}${nationalNumber}` : '' });
  };

  // Digits typed once past the longest plausible number for this country are
  // dropped rather than accepted and only caught at "Continue" — mirrors the
  // native widget's per-country length cap. Not applied until TOO_LONG
  // specifically (not merely "not yet valid"), so a number that's still
  // mid-typing is never truncated.
  const handleNumberChange = (raw: string) => {
    const cleaned = raw.replace(/[^0-9]/g, '');
    if (cleaned && validatePhoneNumberLength(cleaned, countryCode as any) === 'TOO_LONG') return;
    setNationalNumber(cleaned);
    const callingCode = getCountryCallingCode(countryCode as any);
    emit({ nationalNumber: cleaned, formattedNumber: cleaned ? `+${callingCode}${cleaned}` : '' });
  };

  // Live grouping (e.g. "98765 43210") via the same libphonenumber-js
  // metadata already used for validation, purely a display concern —
  // handleNumberChange above always strips back to raw digits regardless of
  // what's shown here, so this never affects the value actually submitted.
  const displayValue = nationalNumber ? new AsYouType(countryCode as any).input(nationalNumber) : '';
  const isComplete = nationalNumber.length > 0 && isValidPhoneNumber(`+${getCountryCallingCode(countryCode as any)}${nationalNumber}`);

  return (
    <View key={formKey} style={[styles.container, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider }]}>
      <select
        value={countryCode}
        onChange={e => handleCountryChange(e.target.value)}
        style={{
          ...selectResetStyle,
          color: colors.text,
          backgroundColor: colors.surfaceAlt,
          borderRight: `1px solid ${colors.divider}`,
        }}
      >
        {COUNTRIES.map(c => (
          <option key={c.code} value={c.code}>
            {c.code} +{c.callingCode}
          </option>
        ))}
      </select>
      <TextInput
        style={[styles.input, { color: colors.text }]}
        placeholder="Mobile number"
        placeholderTextColor={colors.subtext}
        value={displayValue}
        onChangeText={handleNumberChange}
        keyboardType="number-pad"
      />
      {isComplete && (
        <View style={styles.validIcon}>
          <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
        </View>
      )}
    </View>
  );
}

// Plain inline style object for the raw <select> — this file only ever
// compiles for the web target, so DOM style properties are valid here.
const selectResetStyle = {
  border: 'none',
  outline: 'none',
  fontSize: 15,
  paddingLeft: spacing.md,
  paddingRight: spacing.sm,
  height: '100%',
} as const;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 56,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  input: { flex: 1, paddingHorizontal: spacing.md, fontSize: 15, height: '100%' },
  validIcon: { paddingRight: spacing.md },
});
