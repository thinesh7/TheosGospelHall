import React from 'react';
import { TextInput as RNTextInput } from 'react-native';
import { MAX_FONT_SCALE } from './AppText';

type Props = React.ComponentProps<typeof RNTextInput>;

export const TextInput = React.forwardRef<React.ElementRef<typeof RNTextInput>, Props>(
  ({ maxFontSizeMultiplier = MAX_FONT_SCALE, ...props }, ref) => (
    <RNTextInput ref={ref} maxFontSizeMultiplier={maxFontSizeMultiplier} {...props} />
  )
);
TextInput.displayName = 'TextInput';
