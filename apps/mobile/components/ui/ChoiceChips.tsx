import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { humanizeLabel } from '../../utils/format';

type Props<T extends string> = {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (next: T) => void;
  locked?: boolean;
  hint?: string;
  formatOption?: (value: T) => string;
};

export function ChoiceChips<T extends string>({
  label,
  value,
  options,
  onChange,
  locked,
  hint,
  formatOption = humanizeLabel as (value: T) => string,
}: Props<T>) {
  return (
    <View style={styles.block} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={[styles.row, locked ? styles.lockedRow : null]}>
        {options.map((item) => {
          const selected = item === value;
          const title = formatOption(item);
          return (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: Boolean(locked) }}
              accessibilityLabel={`${label}: ${title}`}
              disabled={locked}
              hitSlop={6}
              onPress={() => {
                if (!locked) onChange(item);
              }}
              style={({ pressed }) => [
                styles.chip,
                selected ? styles.chipActive : null,
                locked ? styles.chipLocked : null,
                pressed && !locked ? styles.chipPressed : null,
              ]}
            >
              <Text style={[styles.chipText, selected ? styles.chipTextActive : null]}>{title}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 8,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  hint: {
    color: colors.muted,
    fontSize: 12,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  lockedRow: {
    opacity: 0.9,
  },
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: {
    borderColor: colors.primary,
  },
  chipLocked: {
    opacity: 0.75,
  },
  chipPressed: {
    opacity: 0.8,
  },
  chipText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.primary,
  },
});
