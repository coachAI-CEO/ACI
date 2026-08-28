import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../../constants/colors';

type Props = {
  visible: boolean;
  title?: string;
  initialValue: string;
  onCancel: () => void;
  onSubmit: (value: string) => void;
};

/**
 * Cross-platform text prompt (replaces iOS-only `Alert.prompt`).
 */
export function TextPromptModal({
  visible,
  title = 'Rename',
  initialValue,
  onCancel,
  onSubmit,
}: Props) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            style={styles.input}
            autoFocus
            maxLength={40}
            returnKeyType="done"
            onSubmitEditing={() => {
              const next = value.trim();
              if (next) onSubmit(next);
            }}
            placeholderTextColor={colors.muted}
          />
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={onCancel}
              style={({ pressed }) => [styles.secondary, pressed ? { opacity: 0.7 } : null]}
            >
              <Text style={styles.secondaryLabel}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save"
              onPress={() => {
                const next = value.trim();
                if (next) onSubmit(next);
              }}
              style={({ pressed }) => [styles.primary, pressed ? { opacity: 0.7 } : null]}
            >
              <Text style={styles.primaryLabel}>Save</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    padding: 16,
    width: '100%',
  },
  title: { color: colors.text, fontSize: 16, fontWeight: '800' },
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
  actions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  secondary: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryLabel: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  primary: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  primaryLabel: { color: '#052e16', fontSize: 13, fontWeight: '800' },
});
