import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';

type Tone = 'default' | 'amber' | 'muted';

type Props = {
  label: string;
  tone?: Tone;
};

export function Badge({ label, tone = 'default' }: Props) {
  return (
    <View
      style={[
        styles.badge,
        tone === 'amber' ? styles.badgeAmber : null,
        tone === 'muted' ? styles.badgeMuted : null,
      ]}
    >
      <Text
        style={[
          styles.label,
          tone === 'amber' ? styles.labelAmber : null,
          tone === 'muted' ? styles.labelMuted : null,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#14381f',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeAmber: {
    backgroundColor: '#3d2a0c',
  },
  badgeMuted: {
    backgroundColor: '#1f2a3f',
  },
  label: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  labelAmber: {
    color: '#fbbf24',
  },
  labelMuted: {
    color: colors.muted,
  },
});
