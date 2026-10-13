import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { useNotificationsStore } from '../../stores/notifications.store';

export function NotificationSettings() {
  const sessionRemindersEnabled = useNotificationsStore((s) => s.sessionRemindersEnabled);
  const weeklySummaryEnabled = useNotificationsStore((s) => s.weeklySummaryEnabled);
  const setSessionRemindersEnabled = useNotificationsStore((s) => s.setSessionRemindersEnabled);
  const setWeeklySummaryEnabled = useNotificationsStore((s) => s.setWeeklySummaryEnabled);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Notification Settings</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Session reminders</Text>
        <Text
          style={[styles.toggle, sessionRemindersEnabled ? styles.toggleOn : styles.toggleOff]}
          onPress={() => setSessionRemindersEnabled(!sessionRemindersEnabled)}
        >
          {sessionRemindersEnabled ? 'ON' : 'OFF'}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Weekly summary</Text>
        <Text
          style={[styles.toggle, weeklySummaryEnabled ? styles.toggleOn : styles.toggleOff]}
          onPress={() => setWeeklySummaryEnabled(!weeklySummaryEnabled)}
        >
          {weeklySummaryEnabled ? 'ON' : 'OFF'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    color: colors.text,
  },
  toggle: {
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  toggleOn: {
    backgroundColor: '#14532d',
    color: '#86efac',
  },
  toggleOff: {
    backgroundColor: '#3f1d1d',
    color: '#fca5a5',
  },
});
