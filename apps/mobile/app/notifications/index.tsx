import { SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native';
import { NotificationSettings } from '../../components/notifications/NotificationSettings';
import { colors } from '../../constants/colors';
import { useNotifications } from '../../hooks/useNotifications';
import { Button } from '../../components/ui/Button';

export default function NotificationsScreen() {
  const { hasPermission, requestPermission } = useNotifications();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Notifications</Text>
        <Text style={styles.subtitle}>Manage reminder permissions and toggles.</Text>

        <Button title="Request Permission" onPress={() => void requestPermission()} variant="secondary" />
        <Text style={styles.status}>Permission: {hasPermission === null ? 'unknown' : hasPermission ? 'granted' : 'denied'}</Text>

        <NotificationSettings />
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
  status: {
    color: colors.muted,
    fontSize: 12,
  },
});
