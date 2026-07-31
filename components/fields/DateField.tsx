import { useState } from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Text } from '@/components/AppText';
import { radii, spacing } from '@/constants/layout';
import { useTheme } from '@/utils/ThemeContext';

export interface DateFieldProps {
  value: Date | null;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  /** Date the native picker opens to when there's no value yet. */
  defaultDate?: Date;
  placeholder?: string;
}

export function formatDateDisplay(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

// Native: the existing trigger-button + @react-native-community/datetimepicker
// flow, moved out of RegistrationFormModal verbatim. See DateField.web.tsx —
// this native picker has no web build at all, hence the platform split.
export default function DateField({ value, onChange, minimumDate, maximumDate, defaultDate, placeholder = 'Select a date' }: DateFieldProps) {
  const { colors } = useTheme();
  const [showPicker, setShowPicker] = useState(false);

  const handleChange = (event: { type: string }, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (event.type === 'dismissed') return;
    if (selectedDate) onChange(selectedDate);
  };

  return (
    <View>
      <TouchableOpacity
        style={[styles.trigger, { backgroundColor: colors.surfaceAlt, borderColor: colors.divider }]}
        onPress={() => setShowPicker(true)}
      >
        <Text style={{ color: value ? colors.text : colors.subtext, fontSize: 15 }}>
          {value ? formatDateDisplay(value) : placeholder}
        </Text>
      </TouchableOpacity>
      {showPicker && (
        <DateTimePicker
          value={value ?? defaultDate ?? new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={maximumDate}
          minimumDate={minimumDate}
          onChange={handleChange}
        />
      )}
      {Platform.OS === 'ios' && showPicker && (
        <TouchableOpacity style={[styles.doneBtn, { backgroundColor: colors.accent }]} onPress={() => setShowPicker(false)}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: { borderRadius: radii.md, padding: spacing.md, borderWidth: 1, elevation: 2, justifyContent: 'center' },
  doneBtn: { alignSelf: 'flex-end', borderRadius: radii.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, marginTop: spacing.sm },
  doneBtnText: { color: '#fff', fontWeight: '600' },
});
