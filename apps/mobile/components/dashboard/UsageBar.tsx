import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';

type Props = {
  label: string;
  used: number;
  limit: number;
};

export function UsageBar({ label, used, limit }: Props) {
  const safeLimit = limit > 0 ? limit : 1;
  const ratio = Math.min(used / safeLimit, 1);
  const color = ratio > 0.85 ? colors.danger : ratio > 0.6 ? colors.warning : colors.primary;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{used} / {limit}</Text>
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
