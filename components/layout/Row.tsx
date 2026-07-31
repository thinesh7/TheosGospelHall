import { ReactNode } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { resolveSpacing, SpacingKey } from '@/constants/layout';

interface RowProps {
  children: ReactNode;
  gap?: SpacingKey | number;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  wrap?: boolean;
  style?: StyleProp<ViewStyle>;
}

// Horizontal flex helper with a token-driven gap, replacing ad-hoc
// marginRight/marginLeft chains between siblings.
export function Row({ children, gap, align = 'center', justify = 'flex-start', wrap = false, style }: RowProps) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: align,
          justifyContent: justify,
          flexWrap: wrap ? 'wrap' : 'nowrap',
          gap: resolveSpacing(gap),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
