import { ThemeColors } from './theme';

// Shared between the user-facing reader (app/article-reader.tsx) and the
// admin editor's live preview, so what an admin sees while writing matches
// exactly what a reader will see.
export function buildArticleMarkdownStyles(c: ThemeColors, fontSize: number) {
  return {
    body: { color: c.text, fontSize, lineHeight: fontSize * 1.6 },
    heading1: { color: c.text, fontSize: fontSize + 10, fontWeight: '700' as const, marginTop: 24, marginBottom: 12 },
    heading2: { color: c.text, fontSize: fontSize + 6, fontWeight: '700' as const, marginTop: 22, marginBottom: 10 },
    heading3: { color: c.text, fontSize: fontSize + 3, fontWeight: '700' as const, marginTop: 20, marginBottom: 8 },
    paragraph: { marginTop: 0, marginBottom: 16 },
    strong: { fontWeight: '700' as const },
    em: { fontStyle: 'italic' as const },
    link: { color: c.accent, textDecorationLine: 'underline' as const },
    bullet_list: { marginBottom: 16 },
    ordered_list: { marginBottom: 16 },
    list_item: { marginBottom: 6 },
    blockquote: {
      backgroundColor: c.surfaceAlt,
      borderLeftColor: c.accent,
      borderLeftWidth: 4,
      paddingHorizontal: 14,
      paddingVertical: 8,
      marginVertical: 12,
    },
    code_inline: { backgroundColor: c.surfaceAlt, color: c.accent, borderRadius: 4 },
    code_block: { backgroundColor: c.surfaceAlt, borderRadius: 8, padding: 12 },
    fence: { backgroundColor: c.surfaceAlt, borderRadius: 8, padding: 12 },
    hr: { backgroundColor: c.divider, height: 1, marginVertical: 20 },
  };
}
