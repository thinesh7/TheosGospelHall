import { Children, ReactNode } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { resolveSpacing, SpacingKey } from '@/constants/layout';
import { useBreakpoint } from '@/hooks/use-breakpoint';

export interface ResponsiveColumns {
  mobile: number;
  tablet: number;
  desktop: number;
}

// For screens that need just the column count (e.g. to drive a FlatList's
// numColumns) rather than the wrapping <ResponsiveGrid> below. FlatList
// requires a remount when numColumns changes — pair this with
// `key={numColumns}` on the FlatList at the call site.
export function useResponsiveColumns(columns: ResponsiveColumns): number {
  const { breakpoint } = useBreakpoint();
  return columns[breakpoint];
}

interface ResponsiveGridProps {
  children: ReactNode;
  columns: ResponsiveColumns;
  gap?: SpacingKey | number;
  style?: StyleProp<ViewStyle>;
}

// For simple, non-virtualized card grids (an admin dashboard, a short video
// list). Wraps children in a flexWrap row, each sized to its column share.
// For long/virtualized lists, use useResponsiveColumns() with a FlatList
// instead — this component does not virtualize.
export function ResponsiveGrid({ children, columns, gap = 'md', style }: ResponsiveGridProps) {
  const numColumns = useResponsiveColumns(columns);
  const gapValue = resolveSpacing(gap);
  const itemWidth = `${100 / numColumns}%` as const;

  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -gapValue / 2 }, style]}>
      {Children.map(children, child => (
        <View style={{ width: itemWidth, paddingHorizontal: gapValue / 2, marginBottom: gapValue }}>
          {child}
        </View>
      ))}
    </View>
  );
}
