import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  canPrev: boolean;
  canNext: boolean;
  prevHint?: string;
  nextHint?: string;
  onPrev: () => void;
  onNext: () => void;
};

export function SidelineNavBar({
  canPrev,
  canNext,
  prevHint,
  nextHint,
  onPrev,
  onNext,
}: Props) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={canPrev ? `Previous drill${prevHint ? `, ${prevHint}` : ''}` : 'No previous drill'}
        disabled={!canPrev}
        onPress={onPrev}
        style={({ pressed }) => [
          styles.button,
          !canPrev ? styles.disabledBtn : null,
          pressed && canPrev ? styles.pressed : null,
        ]}
      >
        <Text style={[styles.primary, !canPrev ? styles.disabledText : null]}>◀ Previous</Text>
        {prevHint ? (
          <Text numberOfLines={1} style={[styles.hint, !canPrev ? styles.disabledText : null]}>
            {prevHint}
          </Text>
        ) : null}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={canNext ? `Next drill${nextHint ? `, ${nextHint}` : ''}` : 'No next drill'}
        disabled={!canNext}
        onPress={onNext}
        style={({ pressed }) => [
          styles.button,
          !canNext ? styles.disabledBtn : null,
          pressed && canNext ? styles.pressed : null,
        ]}
      >
        <Text style={[styles.primary, !canNext ? styles.disabledText : null]}>Next ▶</Text>
        {nextHint ? (
          <Text numberOfLines={1} style={[styles.hint, !canNext ? styles.disabledText : null]}>
            {nextHint}
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  button: {
    backgroundColor: '#111827',
    borderColor: '#374151',
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  pressed: {
    opacity: 0.8,
  },
  disabledBtn: {
    opacity: 0.55,
  },
  primary: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  hint: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  disabledText: {
    color: '#6b7280',
  },
});
