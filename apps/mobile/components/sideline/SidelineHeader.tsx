import { StyleSheet, Text, View } from 'react-native';

type Props = {
  sessionRef: string;
  index: number;
  total: number;
  onExit: () => void;
};

export function SidelineHeader({ sessionRef, index, total, onExit }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{sessionRef} · Drill {index + 1}/{total}</Text>
      <Text style={styles.exit} onPress={onExit}>✕</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  exit: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    paddingHorizontal: 6,
  },
});
