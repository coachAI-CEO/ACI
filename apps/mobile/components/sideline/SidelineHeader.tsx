import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  sessionRef: string;
  index: number;
  total: number;
  onExit: () => void;
};

export function SidelineHeader({ sessionRef, index, total, onExit }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Exit sideline mode"
          hitSlop={12}
          onPress={onExit}
          style={({ pressed }) => [styles.exitBtn, pressed ? styles.exitPressed : null]}
        >
          <Text style={styles.exitText}>Exit</Text>
        </Pressable>
        <Text style={styles.eyebrow} numberOfLines={1}>
          {sessionRef}
        </Text>
        <View style={styles.spacer} />
      </View>
      <Text style={styles.title} numberOfLines={1}>
        Drill {index + 1} of {total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 4,
    paddingBottom: 4,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 36,
  },
  exitBtn: {
    backgroundColor: '#1f2937',
    borderColor: '#4b5563',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  exitPressed: {
    opacity: 0.75,
  },
  exitText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  eyebrow: {
    color: '#9ca3af',
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 4,
  },
  spacer: {
    minWidth: 56,
  },
});
