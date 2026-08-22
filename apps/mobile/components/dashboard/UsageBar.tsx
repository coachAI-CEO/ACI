import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';

type Props = {
  label: string;
  used: number;
  limit: number;
  /** Tighter padding + smaller label for dense surfaces (e.g. home dashboard). */
  compact?: boolean;
};

export function UsageBar({ label, used, limit, compact }: Props) {
  const unlimited = !Number.isFinite(limit) || limit <= 0;
  const safeLimit = unlimited ? Math.max(used, 1) : limit;
  const ratio = unlimited ? 0.08 : Math.min(used / safeLimit, 1);
  const color = unlimited ? colors.primary : ratio > 0.85 ? colors.danger : ratio > 0.6 ? colors.warning : colors.primary;
  const valueLabel = unlimited ? `${used} / Unlimited` : `${used} / ${limit}`;

  return (
    <View
      style={[styles.container, compact ? styles.containerCompact : null]}
      accessibilityRole="summary"
      accessibilityLabel={`${label}: ${valueLabel}`}
    >
      <View style={styles.row}>
        <Text style={[styles.label, compact ? styles.labelCompact : null]}>{label}</Text>
        <Text style={[styles.value, compact ? styles.valueCompact : null]}>{valueLabel}</Text>
      </View>
      <View style={[styles.track, compact ? styles.trackCompact : null]}>
        <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  containerCompact: {
    gap: 4,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  labelCompact: {
    fontSize: 12,
  },
  value: {
    color: colors.muted,
    fontSize: 13,
  },
  valueCompact: {
    fontSize: 11,
  },
  track: {
    backgroundColor: '#1a2436',
    borderRadius: 999,
    height: 6,
    overflow: 'hidden',
  },
  trackCompact: {
    height: 4,
  },
  fill: {
    borderRadius: 999,
    height: 6,
  },
});