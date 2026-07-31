import { radii, spacing } from '@/constants/layout';
import { useTheme } from '@/utils/ThemeContext';
import { DateFieldProps } from './DateField';

export function formatDateDisplay(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function toInputValue(date: Date | null | undefined): string {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fromInputValue(raw: string): Date | null {
  if (!raw) return null;
  const [y, m, d] = raw.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Web: @react-native-community/datetimepicker has no web build at all, so
// this renders the browser's own native <input type="date"> instead — same
// value/onChange contract as DateField.tsx, no platform branching needed at
// the call site.
export default function DateField({ value, onChange, minimumDate, maximumDate }: DateFieldProps) {
  const { colors } = useTheme();
  return (
    <input
      type="date"
      value={toInputValue(value)}
      min={toInputValue(minimumDate)}
      max={toInputValue(maximumDate)}
      onChange={e => {
        const date = fromInputValue(e.target.value);
        if (date) onChange(date);
      }}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        height: 48,
        borderRadius: radii.md,
        padding: spacing.md,
        fontSize: 15,
        border: `1px solid ${colors.divider}`,
        backgroundColor: colors.surfaceAlt,
        color: colors.text,
      }}
    />
  );
}
