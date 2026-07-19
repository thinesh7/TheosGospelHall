import { Ionicons } from '@expo/vector-icons';
import { ThemeName } from '../utils/theme';

interface Props {
  theme: ThemeName;
  size?: number;
  color: string;
}

export default function ThemeToggleIcon({ size = 22, color }: Props) {
  return <Ionicons name="contrast-outline" size={size} color={color} />;
}
