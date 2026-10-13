import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { WebDiagramArea } from '@aci/shared';
import { colors } from '../../constants/colors';

export type ShapeDrawKind = NonNullable<WebDiagramArea['shape']>;

type Props = {
  value: ShapeDrawKind;
  onChange: (next: ShapeDrawKind) => void;
};

const SHAPE_KINDS: { id: ShapeDrawKind; label: string }[] = [
  { id: 'spotlight', label: 'Spot' },
  { id: 'circle', label: 'Circle' },
  { id: 'rect', label: 'Rect' },
];

/**
 * Shape subtype row while the Shape tool is active.
 */
export function ShapeTypePicker({ value, onChange }: Props) {
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel="Shape type">
      {SHAPE_KINDS.map((k) => {
        const selected = value === k.id;
        return (
          <Pressable
            key={k.id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={k.label}
            onPress={() => onChange(k.id)}
            style={[styles.btn, selected ? styles.btnSelected : null]}
          >
            <Text style={[styles.label, selected ? styles.labelSelected : null]}>{k.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.background,
    borderTopColor: 'rgba(255,255,255,0.06)',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  btn: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  btnSelected: {
    backgroundColor: 'rgba(34,197,94,0.14)',
    borderColor: 'rgba(34,197,94,0.45)',
  },
  label: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  labelSelected: { color: colors.text },
});
