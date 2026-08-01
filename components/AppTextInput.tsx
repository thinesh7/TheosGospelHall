import React from 'react';
import { Platform, TextInput as RNTextInput } from 'react-native';
import { MAX_FONT_SCALE } from './AppText';

type Props = React.ComponentProps<typeof RNTextInput>;

// react-native-web renders TextInput as a plain <input>/<textarea>, which
// picks up the browser's own default focus outline (a rectangular ring that
// ignores the app's rounded/themed input styling) unless explicitly
// suppressed. `outlineStyle` is a react-native-web-only style extension —
// native ignores unknown style keys, so this is a no-op there.
const webNoOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null;

export const TextInput = React.forwardRef<React.ElementRef<typeof RNTextInput>, Props>(
  ({ maxFontSizeMultiplier = MAX_FONT_SCALE, style, ...props }, ref) => (
    <RNTextInput
      ref={ref}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={webNoOutline ? [webNoOutline, style] : style}
      {...props}
    />
  )
);
TextInput.displayName = 'TextInput';
