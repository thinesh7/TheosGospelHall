import { useRef } from 'react';
import { StyleSheet } from 'react-native';
import PhoneInput from 'react-native-phone-number-input';
import { useTheme } from '@/utils/ThemeContext';

export interface PhoneFieldValue {
  /** Full formatted number including country code, e.g. "+919876543210" — what gets validated/stored. */
  formattedNumber: string;
  /** National-number digits only, no country code — display purposes. */
  nationalNumber: string;
  /** Calling code digits only, e.g. "91" — display purposes. */
  callingCode: string;
}

export interface PhoneFieldProps {
  /** Bump to force a full remount/reset (the underlying widget isn't a true controlled component). */
  formKey?: number;
  defaultCountry?: string;
  onChange: (value: PhoneFieldValue) => void;
}

// Native: wraps react-native-phone-number-input exactly as RegistrationFormModal
// used it before extraction. See PhoneField.web.tsx for why this needs a
// separate web implementation (that package's web dependency chain has a
// broken publish that Metro can't resolve for web at all).
export default function PhoneField({ formKey, defaultCountry = 'IN', onChange }: PhoneFieldProps) {
  const { theme, colors } = useTheme();
  const stateRef = useRef<PhoneFieldValue>({ formattedNumber: '', nationalNumber: '', callingCode: '91' });

  const emit = (patch: Partial<PhoneFieldValue>) => {
    stateRef.current = { ...stateRef.current, ...patch };
    onChange(stateRef.current);
  };

  return (
    <PhoneInput
      key={formKey}
      defaultCode={defaultCountry as any}
      layout="second"
      withDarkTheme={theme === 'dark'}
      onChangeFormattedText={formattedNumber => emit({ formattedNumber })}
      onChangeText={nationalNumber => emit({ nationalNumber })}
      onChangeCountry={country => emit({ callingCode: country.callingCode[0] })}
      containerStyle={[styles.container, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider }]}
      textContainerStyle={[styles.textContainer, { backgroundColor: colors.surfaceAlt }]}
      textInputStyle={[styles.textInput, { color: colors.text }]}
      codeTextStyle={[styles.codeText, { color: colors.text }]}
      textInputProps={{ placeholderTextColor: colors.subtext }}
    />
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', height: 56, borderRadius: 10, borderWidth: 1, elevation: 2 },
  textContainer: { borderRadius: 10, paddingVertical: 0 },
  textInput: { fontSize: 15 },
  codeText: { fontSize: 15 },
});
