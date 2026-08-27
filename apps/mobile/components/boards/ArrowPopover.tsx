import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { WebDiagramArrow } from '@aci/shared';
import { flipCurveControl } from '@aci/shared';
import { colors } from '../../constants/colors';
import {
  COACHING_DRAW_KINDS,
  WEB_LINE_KINDS,
  applyLineKindToArrow,
  drawKindFromArrow,
  type LineDrawKind,
} from './boardTheme';

type Props = {
  arrow: WebDiagramArrow;
  onChange: (next: WebDiagramArrow) => void;
  onDelete: () => void;
  onClose: () => void;
};

/**
 * Docked editor for a selected arrow — coaching type, web line type, flip, delete.
 */
export function ArrowPopover({ arrow, onChange, onDelete, onClose }: Props) {
  const kind = drawKindFromArrow(arrow);
  const from =
    arrow.from.x != null && arrow.from.y != null ? { x: arrow.from.x, y: arrow.from.y } : null;
  const to = arrow.to.x != null && arrow.to.y != null ? { x: arrow.to.x, y: arrow.to.y } : null;
  const canFlip = Boolean(arrow.control);

  function setKind(next: LineDrawKind) {
    onChange(applyLineKindToArrow(arrow, next, from, to));
  }

  function flipCurve() {
    if (!from || !to || !arrow.control) return;
    onChange({
      ...arrow,
      control: flipCurveControl(from, to, arrow.control),
    });
  }

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>Arrow</Text>
        <Text style={styles.hint}>Drag line or gold ends to move</Text>
      </View>
      <Text style={styles.section}>Coaching</Text>
      <View style={styles.kinds}>
        {COACHING_DRAW_KINDS.map((k) => (
          <KindChip key={k.id} kind={k} selected={kind === k.id} onPress={() => setKind(k.id)} />
        ))}
      </View>
      <Text style={styles.section}>Line type</Text>
      <View style={styles.kindsWrap}>
        {WEB_LINE_KINDS.map((k) => (
          <KindChip key={k.id} kind={k} selected={kind === k.id} onPress={() => setKind(k.id)} compact />
        ))}
      </View>
      <View style={styles.actions}>
        {canFlip ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Flip curve"
            onPress={flipCurve}
            style={({ pressed }) => [styles.secondaryBtn, pressed ? { opacity: 0.7 } : null]}
          >
            <Text style={styles.secondaryLabel}>Flip curve</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete arrow"
          onPress={onDelete}
          style={({ pressed }) => [styles.deleteBtn, pressed ? { opacity: 0.7 } : null]}
        >
          <Text style={styles.deleteLabel}>Delete</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Done"
          onPress={onClose}
          style={({ pressed }) => [styles.closeBtn, pressed ? { opacity: 0.7 } : null]}
        >
          <Text style={styles.closeLabel}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

function KindChip({
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
      accessibilityRole="button"
      accessibilityLabel={kind.label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.kindBtn, compact ? styles.kindBtnCompact : null, selected ? styles.kindBtnSelected : null]}
    >
      <View style={[styles.swatch, { backgroundColor: kind.color }]} />
      <Text numberOfLines={1} style={[styles.kindLabel, selected ? styles.kindLabelSelected : null]}>
        {kind.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    marginHorizontal: 10,
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  head: { alignItems: 'baseline', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: 13, fontWeight: '800' },
  hint: { color: colors.muted, flex: 1, fontSize: 11, fontWeight: '500', textAlign: 'right' },
  section: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  kinds: { flexDirection: 'row', gap: 5 },
  kindsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  kindBtn: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 4,
    paddingVertical: 7,
  },
  kindBtnCompact: {
    flexGrow: 0,
    flexBasis: '30%',
    minWidth: '30%',
  },
  kindBtnSelected: {
    backgroundColor: 'rgba(34,197,94,0.14)',
    borderColor: 'rgba(34,197,94,0.45)',
  },
  swatch: { borderRadius: 999, flexShrink: 0, height: 7, width: 12 },
  kindLabel: { color: colors.muted, flexShrink: 1, fontSize: 11, fontWeight: '700' },
  kindLabelSelected: { color: colors.text },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  secondaryBtn: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryLabel: { color: colors.text, fontSize: 12, fontWeight: '700' },
  deleteBtn: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deleteLabel: { color: '#fca5a5', fontSize: 12, fontWeight: '700' },
  closeBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    marginLeft: 'auto',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  closeLabel: { color: '#052e16', fontSize: 12, fontWeight: '800' },
});
