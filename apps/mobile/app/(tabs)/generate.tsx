import { SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native';
import { GenerateForm } from '../../components/generate/GenerateForm';
import { colors } from '../../constants/colors';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

export default function GenerateTab() {
  const { isOnline } = useNetworkStatus();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Generate</Text>
        <Text style={styles.subtitle}>
          {isOnline ? 'Create a drill, session, or progressive series.' : 'Generation requires an internet connection.'}
        </Text>
        {isOnline ? <GenerateForm /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  container: {
    gap: 14,
    padding: 14,
    paddingBottom: 28,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.muted,
  },
});
