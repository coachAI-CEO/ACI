import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';

type Props = {
  label: string;
  used: number;
  limit: number;
};

export function UsageBar({ label, used, limit }: Props) {
  const unlimited = !Number.isFinite(limit) || limit <= 0;
  const safeLimit = unlimited ? Math.max(used, 1) : limit;
  const ratio = unlimited ? 0 : Math.min(used / safeLimit, 1);
  const color = unlimited ? colors.primary : ratio > 0.85 ? colors.danger : ratio > 0.6 ? colors.warning : colors.primary;
  const valueLabel = unlimited ? `${used} / Unlimited` : `${used} / ${limit}`;

  return (
    <View
      style={styles.container}
      accessibilityRole="summary"
      accessibilityLabel={`${label}: ${valueLabel}`}
    >
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{valueLabel}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
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
  value: {
    color: colors.muted,
    fontSize: 13,
  },
  track: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    height: 9,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 999,
    height: 9,
  },
});
