import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';

type Props<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Optional accessibility label for the whole group. */
  accessibilityLabel?: string;
  /** Compact mode — smaller padding/font for dense toolbars. */
  compact?: boolean;
};

/**
 * Single-row segmented control used by the tactical board viewer
 * (format / orientation / zoom) and similar "pick one of N" filters.
 *
 * Designed for short label sets (3–5 options). For longer lists, prefer
 * `PickerSheet` so it can scroll.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  compact,
}: Props<T>) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.wrap, compact ? styles.wrapCompact : null]}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={opt.label}
            onPress={() => onChange(opt.value)}
            style={({ pressed }) => [
              styles.segment,
              compact ? styles.segmentCompact : null,
              selected ? styles.segmentSelected : null,
              pressed && !selected ? styles.segmentPressed : null,
            ]}
          >
            <Text
              style={[
                styles.label,
                compact ? styles.labelCompact : null,
                selected ? styles.labelSelected : null,
              ]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 0,
    overflow: 'hidden',
    padding: 2,
  },
  wrapCompact: { borderRadius: 8 },
  segment: {
    alignItems: 'center',
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  segmentCompact: { paddingHorizontal: 10, paddingVertical: 4 },
  segmentSelected: { backgroundColor: '#14381f' },
  segmentPressed: { opacity: 0.7 },
  label: { color: colors.text, fontSize: 13, fontWeight: '600' },
  labelCompact: { fontSize: 12 },
  labelSelected: { color: colors.primary, fontWeight: '800' },
});
