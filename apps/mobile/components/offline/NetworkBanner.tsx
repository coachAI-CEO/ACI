import { StyleSheet, Text, View } from 'react-native';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

export function NetworkBanner() {
  const { isOnline } = useNetworkStatus();

  if (isOnline) {
    return null;
  }

  return (
    <View style={[styles.banner, styles.offline]}>
      <Text style={styles.text}>No internet connection. Viewing cached data.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  offline: {
    backgroundColor: '#f59e0b',
  },
  text: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});
