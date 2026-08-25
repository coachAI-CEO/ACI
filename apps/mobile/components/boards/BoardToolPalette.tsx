import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';

export type Tool = 'move' | 'player' | 'arrow' | 'ball' | 'shape' | 'label' | 'erase';
export type Team = 'ATT' | 'DEF' | 'NEUTRAL';

type Props = {
  tool: Tool;
  onTool: (tool: Tool) => void;
};

const PRIMARY: { id: Tool; glyph: string; label: string }[] = [
  { id: 'move', glyph: '↖', label: 'Move' },
  { id: 'player', glyph: '●', label: 'Player' },
  { id: 'arrow', glyph: '→', label: 'Arrow' },
  { id: 'ball', glyph: '◉', label: 'Ball' },
  { id: 'erase', glyph: '⌫', label: 'Erase' },
];

/**
 * Bottom tool tray matching TACTICAL_BOARD_INTERACTIVE_MOCK:
 * five equal columns, glyph + label, selected = green soft fill.
 * Team ATT/DEF/NEU lives as a canvas overlay, not here.
 */
export function BoardToolPalette({ tool, onTool }: Props) {
  return (
    <View style={styles.wrap} accessibilityRole="toolbar">
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
              active ? styles.toolActive : null,
              pressed && !active ? styles.toolPressed : null,
            ]}
          >
            <View style={[styles.glyph, active ? styles.glyphActive : null]}>
              <Text style={[styles.glyphText, active ? styles.glyphTextActive : null]}>{p.glyph}</Text>
            </View>
            <Text style={[styles.label, active ? styles.labelActive : null]} numberOfLines={1}>
              {p.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function toolHint(tool: Tool): string {
  switch (tool) {
    case 'move':
      return 'Move · drag players';
    case 'player':
      return 'Player · tap to place';
    case 'arrow':
      return 'Arrow · drag to draw';
    case 'ball':
      return 'Ball · tap to place';
    case 'erase':
      return 'Erase · tap to remove';
    case 'shape':
      return 'Shape · tap to place';
    case 'label':
      return 'Label · tap to place';
    default:
      return 'Move · drag players';
  }
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.background,
    borderTopColor: 'rgba(255,255,255,0.06)',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 4,
    paddingBottom: 12,
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  tool: {
    alignItems: 'center',
    borderRadius: 10,
    flex: 1,
    gap: 3,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  toolActive: { backgroundColor: 'rgba(34,197,94,0.18)' },
  toolPressed: { opacity: 0.7 },
  glyph: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  glyphActive: {
    backgroundColor: 'rgba(34,197,94,0.18)',
    borderColor: 'rgba(34,197,94,0.4)',
  },
  glyphText: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  glyphTextActive: { color: colors.primary },
  label: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  labelActive: { color: colors.primary },
});
