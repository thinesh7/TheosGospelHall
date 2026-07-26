import React from 'react';
import { Text as RNText } from 'react-native';

export const MAX_FONT_SCALE = 1.3;

type Props = React.ComponentProps<typeof RNText>;

export const Text = React.forwardRef<React.ElementRef<typeof RNText>, Props>(
  ({ maxFontSizeMultiplier = MAX_FONT_SCALE, ...props }, ref) => (
    <RNText ref={ref} maxFontSizeMultiplier={maxFontSizeMultiplier} {...props} />
  )
);
Text.displayName = 'Text';
