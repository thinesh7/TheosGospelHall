import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import Svg, { Circle, Defs, Mask, Rect } from 'react-native-svg';
import { ThemeName } from '../utils/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  theme: ThemeName;
  size?: number;
  color: string;
}

const THEME_PHASE: Record<ThemeName, number> = {
  light: 0,
  sepia: 0.5,
  dark: 1,
};

export default function ThemeToggleIcon({ theme, size = 22, color }: Props) {
  const phaseAnim = useRef(new Animated.Value(THEME_PHASE[theme])).current;

  useEffect(() => {
    Animated.timing(phaseAnim, {
      toValue: THEME_PHASE[theme],
      duration: 450,
      useNativeDriver: false,
    }).start();
  }, [theme]);

  const r = 10.5;
  const shadowCx = phaseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 12 + r * 2],
  });

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <Mask id="moonMask">
          <Rect x="0" y="0" width="24" height="24" fill="black" />
          <Circle cx="12" cy="12" r={r} fill="white" />
          <AnimatedCircle cx={shadowCx} cy="12" r={r} fill="black" />
        </Mask>
      </Defs>
      <Circle cx="12" cy="12" r={r} fill="none" stroke={color} strokeWidth={2.2} opacity={0.45} />
      <Circle cx="12" cy="12" r={r} fill={color} mask="url(#moonMask)" />
    </Svg>
  );
}
