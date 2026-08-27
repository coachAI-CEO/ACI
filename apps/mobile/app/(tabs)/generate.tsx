import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GenerateForm } from '../../components/generate/GenerateForm';
import { colors } from '../../constants/colors';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

export default function GenerateTab() {
  const { isOnline } = useNetworkStatus();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Generate</Text>
          <Text style={styles.subtitle}>
            {isOnline ? 'Create a drill, session, or progressive series.' : 'Generation requires an internet connection.'}
          </Text>
        </View>
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
    gap: 12,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 28,
  },
  header: {
    gap: 2,
    paddingHorizontal: 4,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '500',
  },
});
