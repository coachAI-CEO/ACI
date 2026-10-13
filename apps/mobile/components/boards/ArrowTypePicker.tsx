import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import {
  COACHING_DRAW_KINDS,
  WEB_LINE_KINDS,
  type LineDrawKind,
} from './boardTheme';

type Props = {
  value: LineDrawKind;
  onChange: (next: LineDrawKind) => void;
};

/**
 * Coaching presets + web line types while the Arrow tool is active.
 * Mirrors web `BoardToolbar` LINE_ITEMS plus Pass / Run / Press.
 */
export function ArrowTypePicker({ value, onChange }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Coaching arrow type">
        {COACHING_DRAW_KINDS.map((k) => (
          <KindButton key={k.id} kind={k} selected={value === k.id} onPress={() => onChange(k.id)} />
        ))}
      </View>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Line type">
        {WEB_LINE_KINDS.map((k) => (
          <KindButton key={k.id} kind={k} selected={value === k.id} onPress={() => onChange(k.id)} compact />
        ))}
      </View>
    </View>
  );
}

function KindButton({
  kind,
  selected,
  onPress,
  compact,
}: {
  kind: { id: LineDrawKind; label: string; color: string };
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={kind.label}
      onPress={onPress}
      style={[styles.btn, compact ? styles.btnCompact : null, selected ? styles.btnSelected : null]}
    >
      <View style={[styles.swatch, { backgroundColor: kind.color }]} />
      <Text numberOfLines={1} style={[styles.label, selected ? styles.labelSelected : null]}>
        {kind.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.background,
    borderTopColor: 'rgba(255,255,255,0.06)',
    borderTopWidth: 1,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 5,
  },
  btn: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  btnCompact: {
    paddingHorizontal: 3,
    paddingVertical: 7,
  },
  btnSelected: {
    backgroundColor: 'rgba(34,197,94,0.14)',
    borderColor: 'rgba(34,197,94,0.45)',
  },
  swatch: { borderRadius: 999, flexShrink: 0, height: 7, width: 12 },
  label: { color: colors.muted, flexShrink: 1, fontSize: 11, fontWeight: '700' },
  labelSelected: { color: colors.text },
});
