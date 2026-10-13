import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';

type Props = {
  label: string;
  value?: string | null;
  placeholder?: string;
  locked?: boolean;
  /** When true, cell expands to fill the row even if siblings are present. */
  fullWidth?: boolean;
  /** Pinned to right side of the row when there's a left sibling. */
  pairLeft?: boolean;
  onPress: () => void;
};

export function DropdownCell({
  label,
  value,
  placeholder = '—',
  locked,
  fullWidth,
  pairLeft,
  onPress,
}: Props) {
  const displayValue = value || placeholder;
  const isPlaceholder = !value;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${displayValue}`}
      accessibilityState={{ selected: Boolean(value), disabled: Boolean(locked) }}
      disabled={locked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.cell,
        value ? styles.cellActive : null,
        locked ? styles.cellLocked : null,
        pressed && !locked ? styles.cellPressed : null,
        fullWidth ? styles.cellFull : null,
        pairLeft ? styles.cellPairLeft : null,
      ]}
    >
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, isPlaceholder ? styles.valuePlaceholder : null]} numberOfLines={2}>
        {displayValue}
      </Text>
      <Text style={[styles.chev, value ? styles.chevActive : null]}>▾</Text>
    </Pressable>
  );
}

type RowProps = {
  children: React.ReactNode;
};

export function DropdownRow({ children }: RowProps) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cell: {
    flex: 1,
    minHeight: 44,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    opacity: 1,
  },
  cellFull: {
    flex: 1,
  },
  cellPairLeft: {
    marginRight: 4,
  },
  cellActive: {
    backgroundColor: '#102a17',
    borderColor: '#1d5430',
  },
  cellLocked: {
    opacity: 0.7,
  },
  cellPressed: {
    opacity: 0.85,
  },
  label: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginRight: 6,
  },
  value: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
    flex: 1,
  },
  valuePlaceholder: {
    color: colors.muted,
    fontWeight: '500',
  },
  chev: {
    color: '#4b5b7a',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  chevActive: {
    color: colors.primary,
  },
});
