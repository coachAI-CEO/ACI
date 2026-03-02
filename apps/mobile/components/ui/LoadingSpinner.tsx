import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '../../constants/colors';

export function LoadingSpinner() {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
});
