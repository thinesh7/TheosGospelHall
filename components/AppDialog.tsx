import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import { radii, spacing, typography } from '@/constants/layout';
import { useTheme } from '@/utils/ThemeContext';

export interface DialogButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface DialogState {
  title: string;
  message?: string;
  buttons: DialogButton[];
}

interface AppDialogAPI {
  // Deliberately mirrors React Native's Alert.alert(title, message, buttons)
  // signature so call sites migrate mechanically: `Alert.alert(` -> `dialog.alert(`.
  alert: (title: string, message?: string, buttons?: DialogButton[]) => void;
}

const AppDialogContext = createContext<AppDialogAPI | null>(null);

const DEFAULT_BUTTONS: DialogButton[] = [{ text: 'OK' }];

// react-native-web's Alert.alert is a literal no-op (confirmed: it silently
// swallows every confirm/delete dialog in the app on web today). Native
// platforms keep using the real Alert.alert via this same API — zero
// behavior change there. Only web renders a custom overlay.
export function AppDialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const alert = useCallback((title: string, message?: string, buttons: DialogButton[] = DEFAULT_BUTTONS) => {
    if (Platform.OS !== 'web') {
      Alert.alert(title, message, buttons);
      return;
    }
    setDialog({ title, message, buttons });
  }, []);

  const handlePress = (button: DialogButton) => {
    setDialog(null);
    button.onPress?.();
  };

  // Memoized so consumers of useAppDialog() don't re-render every time
  // AppDialogProvider itself re-renders (e.g. from its own dialog state
  // changing) — alert's identity is already stable via useCallback.
  const api = useMemo<AppDialogAPI>(() => ({ alert }), [alert]);

  return (
    <AppDialogContext.Provider value={api}>
      {children}
      {dialog && <WebDialogOverlay dialog={dialog} onPress={handlePress} />}
    </AppDialogContext.Provider>
  );
}

export function useAppDialog(): AppDialogAPI {
  const ctx = useContext(AppDialogContext);
  if (!ctx) throw new Error('useAppDialog must be used inside <AppDialogProvider>');
  return ctx;
}

function WebDialogOverlay({ dialog, onPress }: { dialog: DialogState; onPress: (button: DialogButton) => void }) {
  const { colors } = useTheme();
  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.text }]}>{dialog.title}</Text>
          {!!dialog.message && <Text style={[styles.message, { color: colors.subtext }]}>{dialog.message}</Text>}
          <View style={styles.buttonRow}>
            {dialog.buttons.map((button, i) => (
              <Pressable
                key={i}
                style={({ pressed }) => [
                  styles.button,
                  { backgroundColor: colors.accent },
                  button.style === 'destructive' && { backgroundColor: '#e63946' },
                  button.style === 'cancel' && { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.divider },
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => onPress(button)}
              >
                <Text style={[styles.buttonText, button.style === 'cancel' && { color: colors.text }]}>{button.text}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%', maxWidth: 360, borderRadius: radii.lg, padding: spacing.xl },
  title: {
    fontSize: typography.title.fontSize,
    lineHeight: typography.title.lineHeight,
    fontWeight: typography.title.fontWeight,
    marginBottom: spacing.sm,
  },
  message: { fontSize: typography.body.fontSize, lineHeight: typography.body.lineHeight, marginBottom: spacing.lg },
  buttonRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, flexWrap: 'wrap' },
  button: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radii.md },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: typography.body.fontSize },
});
