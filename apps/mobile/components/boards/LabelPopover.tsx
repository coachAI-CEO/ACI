import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { WebDiagramLabel } from '@aci/shared';
import { colors } from '../../constants/colors';

type Props = {
  label: WebDiagramLabel;
  onChange: (next: WebDiagramLabel) => void;
  onDelete: () => void;
  onClose: () => void;
};

/**
 * Docked editor for a pitch label — text, delete, done.
 */
export function LabelPopover({ label, onChange, onDelete, onClose }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Label</Text>
      <TextInput
        value={label.text}
        onChangeText={(text) => onChange({ ...label, text })}
        style={styles.input}
        placeholder="Zone / note"
        placeholderTextColor={colors.muted}
        autoFocus
        maxLength={48}
        returnKeyType="done"
        onSubmitEditing={onClose}
      />
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete label"
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginHorizontal: 10,
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  title: { color: colors.text, fontSize: 13, fontWeight: '800' },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actions: { flexDirection: 'row', gap: 8 },
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
