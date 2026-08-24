import { useState } from 'react';
import { ActionSheetIOS, Alert, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';

export type Tool = 'move' | 'player' | 'arrow' | 'shape' | 'label' | 'erase';
export type Team = 'ATT' | 'DEF' | 'NEUTRAL';

type Props = {
  tool: Tool;
  onTool: (tool: Tool) => void;
  team: Team;
  onTeam: (team: Team) => void;
};

const PRIMARY: { id: Tool; icon: string; label: string }[] = [
  { id: 'move', icon: '✥', label: 'Move' },
  { id: 'player', icon: '◉', label: 'Player' },
  { id: 'arrow', icon: '⇢', label: 'Arrow' },
  { id: 'shape', icon: '◯', label: 'Shape' },
  { id: 'erase', icon: '⌫', label: 'Erase' },
];

const TEAMS: { id: Team; label: string; color: string }[] = [
  { id: 'ATT', label: 'ATT', color: '#3b82f6' },
  { id: 'DEF', label: 'DEF', color: '#f97316' },
  { id: 'NEUTRAL', label: 'N', color: '#94a3b8' },
];

/**
 * Bottom tool palette. Mirrors the web's tool palette shape:
 *   - 5 primary tools (Move / Player / Arrow / Shape / Erase).
 *   - Team pill (ATT / DEF / NEUTRAL) — cycles on tap.
 *   - "More" sheet exposes advanced: ball, label, mini-goal, cone,
 *     mannequin, pole.
 */
export function BoardToolPalette({ tool, onTool, team, onTeam }: Props) {
  const [moreOpen, setMoreOpen] = useState(false);

  function openMore() {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'More tools',
          options: ['Cancel', 'Label', 'Ball', 'Mini-goal', 'Cone', 'Mannequin', 'Pole'],
          cancelButtonIndex: 0,
        },
        (idx) => {
          if (idx === 1) onTool('label');
        }
      );
    } else {
      Alert.alert('More tools', undefined, [
        { text: 'Label', onPress: () => onTool('label') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.tools}>
          {PRIMARY.map((p) => {
            const selected = tool === p.id;
            return (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityLabel={p.label}
                accessibilityState={{ selected }}
                onPress={() => onTool(p.id)}
                style={({ pressed }) => [
                  styles.toolBtn,
                  selected ? styles.toolBtnSelected : null,
                  pressed && !selected ? styles.toolBtnPressed : null,
                ]}
              >
                <Text style={[styles.toolIcon, selected ? styles.toolIconSelected : null]}>{p.icon}</Text>
                <Text style={[styles.toolLabel, selected ? styles.toolLabelSelected : null]} numberOfLines={1}>
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More"
            onPress={openMore}
            style={({ pressed }) => [styles.toolBtn, pressed ? styles.toolBtnPressed : null]}
          >
            <Text style={styles.toolIcon}>⋯</Text>
            <Text style={styles.toolLabel} numberOfLines={1}>
              More
            </Text>
          </Pressable>
        </View>

        <View style={styles.teams}>
          {TEAMS.map((t) => {
            const selected = t.id === team;
            return (
              <Pressable
                key={t.id}
                accessibilityRole="button"
                accessibilityLabel={`Team ${t.label}`}
                accessibilityState={{ selected }}
                onPress={() => onTeam(t.id)}
                style={({ pressed }) => [
                  styles.teamBtn,
                  selected ? styles.teamBtnSelected : null,
                  pressed && !selected ? styles.toolBtnPressed : null,
                ]}
              >
                <View style={[styles.teamDot, { backgroundColor: t.color }]} />
                <Text style={[styles.teamLabel, selected ? styles.toolLabelSelected : null]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Modal visible={moreOpen} transparent animationType="fade" onRequestClose={() => setMoreOpen(false)}>
        {/* Reserved for future full-screen tool picker. Currently the
            native action sheet handles "More" (see openMore above). */}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderTopWidth: 1,
    paddingBottom: 16,
    paddingTop: 10,
  },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingHorizontal: 12 },
  tools: { flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'space-between' },
  toolBtn: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 2,
    minHeight: 60,
    minWidth: 56,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  toolBtnSelected: { backgroundColor: '#14381f', borderColor: colors.primary },
  toolBtnPressed: { opacity: 0.7 },
  toolIcon: { color: colors.text, fontSize: 20, fontWeight: '700' },
  toolIconSelected: { color: colors.primary },
  toolLabel: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  toolLabelSelected: { color: colors.primary },
  teams: { flexDirection: 'column', gap: 6 },
  teamBtn: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 28,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  teamBtnSelected: { backgroundColor: '#14381f', borderColor: colors.primary },
  teamDot: { borderRadius: 999, height: 10, width: 10 },
  teamLabel: { color: colors.text, fontSize: 11, fontWeight: '700' },
});
