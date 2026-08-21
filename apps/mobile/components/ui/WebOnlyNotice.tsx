import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { webPath } from '../../constants/web';

type Props = {
  title?: string;
  body?: string;
  webHref?: string;
  ctaLabel?: string;
  compact?: boolean;
};

export function WebOnlyNotice({
  title = 'Available on web',
  body = 'Doc Hub and platform admin stay on the website for dense club workflows.',
  webHref = '/doc-hub',
  ctaLabel = 'Open on web',
  compact = false,
}: Props) {
  if (compact) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${ctaLabel}.`}
        onPress={() => void Linking.openURL(webPath(webHref))}
        style={({ pressed }) => [styles.compactWrap, pressed ? styles.pressed : null]}
      >
        <View style={styles.compactBody}>
          <Text style={styles.compactTitle}>{title}</Text>
          <Text style={styles.compactSub} numberOfLines={1}>
            {body}
          </Text>
        </View>
        <Text style={styles.compactCta}>{ctaLabel} ›</Text>
      </Pressable>
    );
  }
  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ctaLabel}
        onPress={() => void Linking.openURL(webPath(webHref))}
        style={({ pressed }) => [styles.linkBtn, pressed ? styles.pressed : null]}
      >
        <Text style={styles.linkText}>{ctaLabel} ›</Text>
      </Pressable>
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
  linkBtn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderColor: '#1d5430',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  linkText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: { opacity: 0.7 },
  compactWrap: {
    alignItems: 'center',
    backgroundColor: '#10243b',
    borderColor: '#1d3556',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  compactBody: { flex: 1, gap: 1, minWidth: 0 },
  compactTitle: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '700',
  },
  compactSub: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '500',
  },
  compactCta: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '700',
  },
});
