import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { WebDiagramPlayer } from '@aci/shared';
import { colors } from '../../constants/colors';
import {
  COACHING_DRAW_KINDS,
  type LineDrawKind,
} from './boardTheme';
import type { KitDrawKind } from './KitTypePicker';
import type { ShapeDrawKind } from './ShapeTypePicker';
import type { Tool } from './BoardToolPalette';

type Team = 'ATT' | 'DEF' | 'NEUTRAL';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: Team;
  onTeam: (t: Team) => void;
  tool: Tool;
  arrowKind: LineDrawKind;
  onArrowKind: (k: LineDrawKind) => void;
  shapeKind: ShapeDrawKind;
  onShapeKind: (k: ShapeDrawKind) => void;
  kitKind: KitDrawKind;
  onKitKind: (k: KitDrawKind) => void;
  player: WebDiagramPlayer | null | undefined;
  onChangePlayer: (next: WebDiagramPlayer) => void;
  onDeletePlayer: () => void;
};

const SHAPES: { id: ShapeDrawKind; label: string }[] = [
  { id: 'spotlight', label: 'Spot' },
  { id: 'circle', label: 'Circle' },
  { id: 'rect', label: 'Rect' },
];

const KITS: { id: KitDrawKind; label: string }[] = [
  { id: 'cone', label: 'Cone' },
  { id: 'mini-goal', label: 'Goal' },
  { id: 'mannequin', label: 'Man' },
  { id: 'pole', label: 'Pole' },
];

/**
 * Landscape properties HUD — collapsed by default; edge tab pulls it out
 * over the pitch so the board keeps full width.
 */
export function BoardLandscapeHud({
  open,
  onOpenChange,
  team,
  onTeam,
  tool,
  arrowKind,
  onArrowKind,
  shapeKind,
  onShapeKind,
  kitKind,
  onKitKind,
  player,
  onChangePlayer,
  onDeletePlayer,
}: Props) {
  return (
    <View
      style={open ? styles.root : styles.rootCollapsed}
      pointerEvents="box-none"
    >
      {/* Edge tab — always visible; pulls HUD over the pitch */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={open ? 'Close properties' : 'Open properties'}
        accessibilityState={{ expanded: open }}
        onPress={() => onOpenChange(!open)}
        style={({ pressed }) => [styles.tab, open ? styles.tabOpen : null, pressed ? { opacity: 0.85 } : null]}
      >
        <Text style={styles.tabChevron}>{open ? '›' : '‹'}</Text>
        <Text style={styles.tabLabel}>HUD</Text>
      </Pressable>

      {open ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss properties"
            onPress={() => onOpenChange(false)}
            style={styles.backdrop}
          />
          <View style={styles.panel} accessibilityLabel="Board properties">
            <View style={styles.panelHead}>
              <Text style={styles.panelTitle}>Properties</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={() => onOpenChange(false)}
                hitSlop={8}
                style={styles.closeBtn}
              >
                <Text style={styles.closeLabel}>✕</Text>
              </Pressable>
            </View>

            <View>
              <View style={styles.capRow}>
                <Text style={styles.cap}>Team</Text>
              </View>
              <View style={styles.teamGrid}>
                {(
                  [
                    { id: 'ATT' as const, label: 'ATT', dot: '#86efac', active: styles.teamAtt },
                    { id: 'DEF' as const, label: 'DEF', dot: '#fca5a5', active: styles.teamDef },
                    { id: 'NEUTRAL' as const, label: 'NEU', dot: '#fde68a', active: styles.teamNeu },
                  ] as const
                ).map((t) => {
                  const selected = team === t.id;
                  return (
                    <Pressable
                      key={t.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => onTeam(t.id)}
                      style={[styles.teamBtn, selected ? t.active : null]}
                    >
                      <View style={[styles.dot, { backgroundColor: t.dot }]} />
                      <Text style={[styles.teamLabel, selected ? styles.teamLabelOn : null]}>{t.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {tool === 'arrow' ? (
              <View>
                <Text style={styles.cap}>Arrow type</Text>
                <View style={styles.typeGrid}>
                  {COACHING_DRAW_KINDS.map((k) => {
                    const selected = arrowKind === k.id;
                    return (
                      <Pressable
                        key={k.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => onArrowKind(k.id)}
                        style={[styles.typeBtn, selected ? styles.typeBtnOn : null]}
                      >
                        <View style={[styles.swatch, { backgroundColor: k.color }]} />
                        <Text
                          style={[styles.typeLabel, selected ? styles.typeLabelOn : null]}
                          numberOfLines={1}
                        >
                          {k.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {tool === 'shape' ? (
              <View>
                <Text style={styles.cap}>Shape</Text>
                <View style={styles.typeGrid}>
                  {SHAPES.map((k) => {
                    const selected = shapeKind === k.id;
                    return (
                      <Pressable
                        key={k.id}
                        onPress={() => onShapeKind(k.id)}
                        style={[styles.typeBtn, selected ? styles.typeBtnOn : null]}
                      >
                        <Text style={[styles.typeLabel, selected ? styles.typeLabelOn : null]}>
                          {k.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {tool === 'kit' ? (
              <View>
                <Text style={styles.cap}>Kit</Text>
                <View style={styles.typeGrid}>
                  {KITS.map((k) => {
                    const selected = kitKind === k.id;
                    return (
                      <Pressable
                        key={k.id}
                        onPress={() => onKitKind(k.id)}
                        style={[styles.typeBtn, selected ? styles.typeBtnOn : null]}
                      >
                        <Text style={[styles.typeLabel, selected ? styles.typeLabelOn : null]}>
                          {k.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={styles.inspector}>
              <View style={styles.capRow}>
                <Text style={styles.cap}>Player</Text>
                {player ? <Text style={styles.capMeta}>#{player.number ?? '—'}</Text> : null}
              </View>
              {player ? (
                <>
                  <View>
                    <Text style={styles.fieldLabel}>Number</Text>
                    <TextInput
                      value={player.number != null ? String(player.number) : ''}
                      onChangeText={(t) => {
                        const n = t.replace(/[^0-9]/g, '');
                        onChangePlayer({
                          ...player,
                          number: n === '' ? undefined : Math.min(99, parseInt(n, 10) || 0),
                        });
                      }}
                      keyboardType="number-pad"
                      maxLength={2}
                      style={styles.input}
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                  <View>
                    <Text style={styles.fieldLabel}>Role</Text>
                    <TextInput
                      value={player.role || ''}
                      onChangeText={(t) => onChangePlayer({ ...player, role: t.slice(0, 8) })}
                      style={styles.input}
                      placeholder="RCB / ST…"
                      placeholderTextColor={colors.muted}
                      maxLength={8}
                    />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Remove player"
                    onPress={onDeletePlayer}
                    style={({ pressed }) => [styles.removeBtn, pressed ? { opacity: 0.75 } : null]}
                  >
                    <Text style={styles.removeLabel}>Remove player</Text>
                  </Pressable>
                </>
              ) : (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>Select a player on the pitch to inspect</Text>
                </View>
              )}
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

const PANEL_W = 176;

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  rootCollapsed: {
    bottom: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: 40,
    zIndex: 20,
  },
  tab: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 10,
    borderColor: colors.border,
    borderRightWidth: 0,
    borderTopLeftRadius: 10,
    borderWidth: 1,
    gap: 2,
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 10,
    position: 'absolute',
    right: 0,
    top: '42%',
    zIndex: 30,
  },
  tabOpen: {
    borderColor: 'rgba(34,197,94,0.45)',
    right: PANEL_W,
  },
  tabChevron: { color: colors.primary, fontSize: 14, fontWeight: '800', lineHeight: 16 },
  tabLabel: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 21,
  },
  panel: {
    backgroundColor: colors.background,
    borderLeftColor: 'rgba(255,255,255,0.08)',
    borderLeftWidth: 1,
    bottom: 0,
    gap: 12,
    paddingBottom: 12,
    paddingHorizontal: 10,
    paddingTop: 10,
    position: 'absolute',
    right: 0,
    top: 0,
    width: PANEL_W,
    zIndex: 22,
  },
  panelHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  panelTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  closeBtn: { paddingHorizontal: 4, paddingVertical: 2 },
  closeLabel: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  capRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  cap: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  capMeta: { color: colors.primary, fontSize: 9, fontWeight: '700' },
  teamGrid: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 3,
    padding: 3,
  },
  teamBtn: {
    alignItems: 'center',
    borderRadius: 7,
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    paddingVertical: 7,
  },
  teamAtt: { backgroundColor: 'rgba(34,197,94,0.2)' },
  teamDef: { backgroundColor: 'rgba(239,68,68,0.2)' },
  teamNeu: { backgroundColor: 'rgba(245,158,11,0.2)' },
  dot: { borderRadius: 999, height: 7, width: 7 },
  teamLabel: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  teamLabelOn: { color: colors.text },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  typeBtn: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '45%',
    flexDirection: 'row',
    flexGrow: 1,
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 7,
  },
  typeBtnOn: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderColor: 'rgba(34,197,94,0.45)',
  },
  swatch: { borderRadius: 999, height: 6, width: 10 },
  typeLabel: { color: colors.muted, flexShrink: 1, fontSize: 10, fontWeight: '700' },
  typeLabelOn: { color: colors.text },
  inspector: {
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    minHeight: 120,
    padding: 10,
  },
  fieldLabel: { color: colors.muted, fontSize: 10, fontWeight: '700', marginBottom: 3 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 13,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  removeBtn: {
    backgroundColor: 'rgba(127,29,29,0.35)',
    borderColor: 'rgba(239,68,68,0.4)',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
    paddingVertical: 8,
  },
  removeLabel: { color: '#fca5a5', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  empty: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingHorizontal: 6 },
  emptyText: { color: colors.muted, fontSize: 11, lineHeight: 15, textAlign: 'center' },
});
