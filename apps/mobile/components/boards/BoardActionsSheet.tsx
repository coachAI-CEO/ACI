import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type BoardActionId =
  | 'formations'
  | 'setup'
  | 'ai'
  | 'rename'
  | 'share'
  | 'web'
  | 'delete';

type ActionItem = {
  id: BoardActionId;
  label: string;
  sublabel?: string;
  destructive?: boolean;
};

type Props = {
  visible: boolean;
  shareLabel: string;
  onClose: () => void;
  onAction: (id: BoardActionId) => void;
};

/**
 * Themed board overflow — compact single screen, no scrolling.
 * Pitch orientation follows the phone (no manual flip control).
 */
export function BoardActionsSheet({
  visible,
  shareLabel,
  onClose,
  onAction,
}: Props) {
  const insets = useSafeAreaInsets();

  const primary: ActionItem[] = [
    { id: 'formations', label: 'Formations', sublabel: 'DEF · ATT' },
    { id: 'setup', label: 'Setup', sublabel: 'Phase · lanes' },
    { id: 'ai', label: 'AI coach', sublabel: 'Text · photo' },
    { id: 'rename', label: 'Rename' },
    { id: 'share', label: shareLabel.includes('Private') ? 'Make private' : 'Share club' },
    { id: 'web', label: 'Open web' },
  ];

  function pick(id: BoardActionId) {
    onClose();
    requestAnimationFrame(() => onAction(id));
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[styles.sheet, { paddingBottom: Math.max(16, insets.bottom) }]}
        accessibilityViewIsModal
      >
        <View style={styles.grab} />
        <Text style={styles.title}>Board actions</Text>

        <View style={styles.grid}>
          {primary.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              onPress={() => pick(item.id)}
              style={({ pressed }) => [styles.tile, pressed ? styles.tilePressed : null]}
            >
              <Text style={styles.tileLabel} numberOfLines={1}>
                {item.label}
              </Text>
              {item.sublabel ? (
                <Text style={styles.tileSub} numberOfLines={1}>
                  {item.sublabel}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete board"
            onPress={() => pick('delete')}
            style={({ pressed }) => [styles.deleteBtn, pressed ? { opacity: 0.8 } : null]}
          >
            <Text style={styles.deleteLabel}>Delete</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            onPress={onClose}
            style={({ pressed }) => [styles.cancelBtn, pressed ? { opacity: 0.8 } : null]}
          >
            <Text style={styles.cancelLabel}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 12,
  },
  grab: {
    alignSelf: 'center',
    backgroundColor: '#374151',
    borderRadius: 999,
    height: 4,
    marginTop: 8,
    width: 36,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
    paddingBottom: 10,
    paddingHorizontal: 4,
    paddingTop: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tile: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 12,
    width: '31.5%',
    flexGrow: 1,
    minWidth: '30%',
    maxWidth: '48%',
  },
  tilePressed: {
    borderColor: colors.primary,
    backgroundColor: '#14381f',
  },
  tileLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  tileSub: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  deleteBtn: {
    alignItems: 'center',
    borderColor: 'rgba(239,68,68,0.45)',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12,
  },
  deleteLabel: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  cancelBtn: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12,
  },
  cancelLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
});
