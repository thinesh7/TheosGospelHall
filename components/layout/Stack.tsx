import { ReactNode } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { resolveSpacing, SpacingKey } from '@/constants/layout';

interface StackProps {
  children: ReactNode;
  gap?: SpacingKey | number;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  style?: StyleProp<ViewStyle>;
}

// Vertical flex helper with a token-driven gap, replacing ad-hoc
// marginBottom chains between siblings.
export function Stack({ children, gap, align = 'stretch', justify = 'flex-start', style }: StackProps) {
  return (
    <View
      style={[
        {
          flexDirection: 'column',
          alignItems: align,
          justifyContent: justify,
          gap: resolveSpacing(gap),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
