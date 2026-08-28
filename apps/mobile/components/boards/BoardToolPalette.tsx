import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';

export type Tool = 'move' | 'player' | 'arrow' | 'ball' | 'shape' | 'label' | 'kit' | 'erase';
export type Team = 'ATT' | 'DEF' | 'NEUTRAL';

type Props = {
  tool: Tool;
  onTool: (tool: Tool) => void;
  /** Portrait = bottom row; landscape = left rail. */
  layout?: 'row' | 'column';
  /** Clear arrows on active frame (landscape rail footer). */
  onClearArrows?: () => void;
};

const PRIMARY: { id: Tool; glyph: string; label: string }[] = [
  { id: 'move', glyph: '↖', label: 'Move' },
  { id: 'player', glyph: '●', label: 'Player' },
  { id: 'arrow', glyph: '→', label: 'Arrow' },
  { id: 'ball', glyph: '◉', label: 'Ball' },
  { id: 'label', glyph: 'T', label: 'Label' },
  { id: 'shape', glyph: '◎', label: 'Shape' },
  { id: 'kit', glyph: '△', label: 'Kit' },
  { id: 'erase', glyph: '⌫', label: 'Erase' },
];

/**
 * Tool tray — bottom row (portrait) or left rail (landscape Gemini shell).
 */
export function BoardToolPalette({ tool, onTool, layout = 'row', onClearArrows }: Props) {
  const vertical = layout === 'column';
  return (
    <View
      style={[styles.wrap, vertical ? styles.wrapColumn : null]}
      accessibilityRole="toolbar"
    >
      {vertical ? <Text style={styles.railCap}>Tools</Text> : null}
      {PRIMARY.map((p) => {
        const active = tool === p.id;
        return (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityLabel={p.label}
            accessibilityState={{ selected: active }}
            onPress={() => onTool(p.id)}
            style={({ pressed }) => [
              styles.tool,
              vertical ? styles.toolColumn : null,
              active ? (p.id === 'erase' ? styles.toolEraseActive : styles.toolActive) : null,
              pressed && !active ? styles.toolPressed : null,
            ]}
          >
            <View style={[styles.glyph, active ? styles.glyphActive : null]}>
              <Text style={[styles.glyphText, active ? styles.glyphTextActive : null]}>{p.glyph}</Text>
            </View>
            {!vertical ? (
              <Text style={[styles.label, active ? styles.labelActive : null]} numberOfLines={1}>
                {p.label}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
      {vertical && onClearArrows ? (
        <>
          <View style={styles.railSpacer} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear arrows"
            onPress={onClearArrows}
            style={({ pressed }) => [styles.clearBtn, pressed ? { opacity: 0.7 } : null]}
          >
            <Text style={styles.clearGlyph}>⌫</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

export function toolHint(tool: Tool): string {
  switch (tool) {
    case 'move':
      return 'Move · drag players / arrows / kit';
    case 'player':
      return 'Player · tap to place';
    case 'arrow':
      return 'Arrow · pick type · drag to draw';
    case 'ball':
      return 'Ball · tap to place';
    case 'label':
      return 'Label · tap to place';
    case 'shape':
      return 'Shape · pick type · tap to place';
    case 'kit':
      return 'Kit · pick item · tap to place';
    case 'erase':
      return 'Erase · tap to remove';
    default:
      return 'Move · drag players / arrows / kit';
  }
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.background,
    borderTopColor: 'rgba(255,255,255,0.06)',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 1,
    paddingBottom: 12,
    paddingHorizontal: 4,
    paddingTop: 8,
  },
  wrapColumn: {
    alignItems: 'center',
    borderRightColor: 'rgba(255,255,255,0.06)',
    borderRightWidth: 1,
    borderTopWidth: 0,
    flexDirection: 'column',
    gap: 2,
    justifyContent: 'flex-start',
    paddingBottom: 6,
    paddingHorizontal: 4,
    paddingTop: 6,
    width: 44,
  },
  railCap: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  tool: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    gap: 2,
    minWidth: 0,
    paddingHorizontal: 1,
    paddingVertical: 6,
  },
  toolColumn: {
    flexGrow: 0,
    flexShrink: 0,
    paddingVertical: 5,
    width: '100%',
  },
  toolActive: { backgroundColor: 'rgba(34,197,94,0.18)' },
  toolEraseActive: { backgroundColor: 'rgba(239,68,68,0.22)' },
  toolPressed: { opacity: 0.7 },
  glyph: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 7,
    borderWidth: 1,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  glyphActive: {
    backgroundColor: 'rgba(34,197,94,0.18)',
    borderColor: 'rgba(34,197,94,0.4)',
  },
  glyphText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  glyphTextActive: { color: colors.primary },
  label: { color: colors.muted, fontSize: 8, fontWeight: '600' },
  labelActive: { color: colors.primary },
  railSpacer: { flex: 1, minHeight: 4 },
  clearBtn: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 34,
  },
  clearGlyph: { color: colors.muted, fontSize: 12, fontWeight: '700' },
});
