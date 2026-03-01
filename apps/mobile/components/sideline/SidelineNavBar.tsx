import { StyleSheet, Text, View } from 'react-native';

type Props = {
  canPrev: boolean;
  canNext: boolean;
  prevLabel: string;
  nextLabel: string;
  onPrev: () => void;
  onNext: () => void;
};

export function SidelineNavBar({ canPrev, canNext, prevLabel, nextLabel, onPrev, onNext }: Props) {
  return (
    <View style={styles.row}>
      <Text onPress={canPrev ? onPrev : undefined} style={[styles.button, !canPrev ? styles.disabled : null]}>
        ◀ {prevLabel}
      </Text>
      <Text onPress={canNext ? onNext : undefined} style={[styles.button, !canNext ? styles.disabled : null]}>
        {nextLabel} ▶
      </Text>
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
    color: '#fff',
    flex: 1,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 10,
    textAlign: 'center',
  },
  disabled: {
    color: '#6b7280',
  },
});
