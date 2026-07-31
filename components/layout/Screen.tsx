import { ReactNode } from 'react';
import { ScrollView, StyleProp, View, ViewStyle } from 'react-native';
import { Edge, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { useBreakpoint } from '@/hooks/use-breakpoint';

interface ScreenProps {
  children: ReactNode;
  /** Wrap content in a ScrollView. Default false (plain View). */
  scroll?: boolean;
  /** Which safe-area edges to pad. Default ['top', 'bottom']. */
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Override the default centered-content width on tablet/desktop. */
  maxWidth?: number;
}

// Top-level screen wrapper: applies safe-area padding, and from the tablet
// breakpoint up, centers content at `maxWidth` with auto side margins instead
// of letting it stretch edge-to-edge across a wide viewport.
export function Screen({
  children,
  scroll = false,
  edges = ['top', 'bottom'],
  style,
  contentContainerStyle,
  maxWidth = CONTENT_MAX_WIDTH,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { isTabletUp } = useBreakpoint();

  const edgeStyle: ViewStyle = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };

  const centeredStyle: ViewStyle | undefined = isTabletUp
    ? { width: '100%', maxWidth, alignSelf: 'center' }
    : undefined;

  const inner = <View style={[centeredStyle, contentContainerStyle]}>{children}</View>;

  if (scroll) {
    return (
      <ScrollView style={[{ flex: 1 }, edgeStyle, style]} showsVerticalScrollIndicator={false}>
        {inner}
      </ScrollView>
    );
  }

  return <View style={[{ flex: 1 }, edgeStyle, style]}>{inner}</View>;
}
