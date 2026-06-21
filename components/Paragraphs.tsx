import { StyleSheet, Text, TextStyle } from 'react-native';

interface Props {
  text: string;
  style?: TextStyle;
}

export default function Paragraphs({ text, style }: Props) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  return (
    <>
      {paragraphs.map((p, i) => (
        <Text
          key={i}
          style={[
            styles.paragraph,
            style,
            i === paragraphs.length - 1 && { marginBottom: 0 },
          ]}
        >
          {p}
        </Text>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  paragraph: {
    fontSize: 14,
    color: '#444',
    lineHeight: 24,
    marginBottom: 14,
    textAlign: 'left',
    fontWeight: '500',
  },
});
