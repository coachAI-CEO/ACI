import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';

type QuickAction = {
  key: string;
  title: string;
  route: '/(tabs)/generate' | '/(tabs)/video' | '/(tabs)/calendar';
  enabled: boolean;
};

type Props = {
  canAccessCalendar: boolean;
};

const BASE_ACTIONS: QuickAction[] = [
  { key: 'session', title: 'Generate Session', route: '/(tabs)/generate', enabled: true },
  { key: 'drill', title: 'Generate Drill', route: '/(tabs)/generate', enabled: true },
  { key: 'video', title: 'Video Analysis', route: '/(tabs)/video', enabled: true },
  { key: 'calendar', title: 'Calendar', route: '/(tabs)/calendar', enabled: true },
];

export function QuickActionGrid({ canAccessCalendar }: Props) {
  return (
    <View style={styles.grid}>
      {BASE_ACTIONS.map((action) => {
        const enabled = action.key === 'calendar' ? canAccessCalendar : action.enabled;
        return (
          <Pressable
            disabled={!enabled}
            key={action.key}
            onPress={() => router.push(action.route)}
            style={({ pressed }) => [
              styles.tile,
              { opacity: !enabled ? 0.45 : pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={styles.title}>{action.title}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 84,
    padding: 12,
    width: '48%',
  },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
});
