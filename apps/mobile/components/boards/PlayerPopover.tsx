import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { WebDiagramPlayer, WebDiagramV1 } from '@aci/shared';
import { colors } from '../../constants/colors';

type Props = {
  player: WebDiagramPlayer;
  onChange: (next: WebDiagramPlayer) => void;
  onDelete: () => void;
  onClose: () => void;
};

const TEAMS: { id: WebDiagramPlayer['team']; label: string; color: string }[] = [
  { id: 'ATT', label: 'ATT', color: '#3b82f6' },
  { id: 'DEF', label: 'DEF', color: '#f97316' },
  { id: 'NEUTRAL', label: 'NEUTRAL', color: '#94a3b8' },
];

/**
 * Player details bubble. Mirrors the web editor's player panel
 * (number / role / team / delete).
 *
 * Caller is responsible for positioning. This component just renders a
 * floating card with the fields.
 */
export function PlayerPopover({ player, onChange, onDelete, onClose }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.label}>Number</Text>
        <TextInput
          value={String(player.number ?? '')}
          onChangeText={(t) => {
            const n = Number(t.replace(/[^0-9]/g, ''));
            if (Number.isFinite(n)) onChange({ ...player, number: n });
          }}
          style={styles.input}
          keyboardType="number-pad"
          maxLength={2}
        />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Role</Text>
        <TextInput
          value={player.role || ''}
          onChangeText={(t) => onChange({ ...player, role: t })}
          style={styles.input}
          placeholder="GK / CB / CM …"
          placeholderTextColor={colors.muted}
          maxLength={6}
        />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Team</Text>
        <View style={styles.teamRow}>
          {TEAMS.map((t) => {
            const selected = player.team === t.id;
            return (
              <Pressable
                key={t.id}
                accessibilityRole="button"
                accessibilityLabel={`Team ${t.label}`}
                onPress={() => onChange({ ...player, team: t.id })}
                style={[styles.teamBtn, selected ? styles.teamBtnSelected : null]}
              >
                <View style={[styles.teamDot, { backgroundColor: t.color }]} />
                <Text style={[styles.teamLabel, selected ? styles.teamLabelSelected : null]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete player"
          onPress={onDelete}
          style={({ pressed }) => [styles.deleteBtn, pressed ? { opacity: 0.7 } : null]}
        >
          <Text style={styles.deleteLabel}>Delete player</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={({ pressed }) => [styles.closeBtn, pressed ? { opacity: 0.7 } : null]}
        >
          <Text style={styles.closeLabel}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    padding: 12,
    width: 280,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'space-between' },
  label: { color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    fontSize: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  teamRow: { flexDirection: 'row', flex: 1, gap: 6, justifyContent: 'flex-end' },
  teamBtn: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    minHeight: 28,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  teamBtnSelected: { backgroundColor: '#14381f', borderColor: colors.primary },
  teamDot: { borderRadius: 999, height: 8, width: 8 },
  teamLabel: { color: colors.text, fontSize: 11, fontWeight: '700' },
  teamLabelSelected: { color: colors.primary },
  actions: { flexDirection: 'row', gap: 8, justifyContent: 'space-between', paddingTop: 4 },
  deleteBtn: {
    backgroundColor: '#7f1d1d',
    borderRadius: 8,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deleteLabel: { color: '#fee2e2', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  closeBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  closeLabel: { color: '#062816', fontSize: 13, fontWeight: '800', textAlign: 'center' },
});
