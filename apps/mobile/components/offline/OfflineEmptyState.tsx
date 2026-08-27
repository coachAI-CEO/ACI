import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';

export function OfflineEmptyState() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>No offline cache available</Text>
      <Text style={styles.subtitle}>Open sessions while online to make them available offline.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 10,
    borderStyle: 'dashed',
    borderWidth: 1,
    gap: 6,
    padding: 16,
  },
  title: {
    color: colors.text,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.muted,
    textAlign: 'center',
  },
});
