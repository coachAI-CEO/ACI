import { Linking, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { webPath } from '../../constants/web';
import { Button } from '../ui/Button';

type Props = {
  title?: string;
  body?: string;
  webHref?: string;
  ctaLabel?: string;
};

export function WebOnlyNotice({
  title = 'Available on web',
  body = 'Doc Hub and platform admin stay on the website for dense club workflows.',
  webHref = '/doc-hub',
  ctaLabel = 'Open on web',
}: Props) {
  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <Button title={ctaLabel} onPress={() => void Linking.openURL(webPath(webHref))} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  body: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
});
