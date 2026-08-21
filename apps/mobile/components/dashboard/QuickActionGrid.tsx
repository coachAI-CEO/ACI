import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';

type QuickAction = {
  key: string;
  title: string;
  icon: string;
  route:
    | '/(tabs)/generate'
    | '/(tabs)/video'
    | '/(tabs)/calendar'
    | '/player-plans'
    | '/coach-center'
    | '/boards';
  enabled: boolean;
};

type Props = {
  canAccessCalendar: boolean;
  canCreatePlayerPlans: boolean;
};

const BASE_ACTIONS: QuickAction[] = [
  { key: 'session', title: 'Generate session', icon: '＋', route: '/(tabs)/generate', enabled: true },
  { key: 'drill', title: 'Generate drill', icon: '◐', route: '/(tabs)/generate', enabled: true },
  { key: 'video', title: 'Video analysis', icon: '▶', route: '/(tabs)/video', enabled: true },
  { key: 'calendar', title: 'Calendar', icon: '📅', route: '/(tabs)/calendar', enabled: true },
  { key: 'plans', title: 'Player plans', icon: '📋', route: '/player-plans', enabled: true },
  { key: 'coach', title: 'Coach Center', icon: '🛠', route: '/coach-center', enabled: true },
  { key: 'boards', title: 'Boards', icon: '◇', route: '/boards', enabled: true },
];

export function QuickActionGrid({ canAccessCalendar, canCreatePlayerPlans }: Props) {
  return (
    <View style={styles.grid} accessibilityRole="menu">
      {BASE_ACTIONS.map((action) => {
        const enabled =
          action.key === 'calendar'
            ? canAccessCalendar
            : action.key === 'plans'
              ? canCreatePlayerPlans
              : action.enabled;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action.title}
            accessibilityState={{ disabled: !enabled }}
            disabled={!enabled}
            key={action.key}
            onPress={() => router.push(action.route)}
            style={({ pressed }) => [
              styles.tile,
              { opacity: !enabled ? 0.45 : pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={styles.icon}>{action.icon}</Text>
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
    backgroundColor: '#151e2f',
    borderRadius: 12,
    gap: 6,
    justifyContent: 'center',
    minHeight: 72,
    paddingHorizontal: 12,
    paddingVertical: 12,
    width: '48%',
  },
  icon: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  title: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
});
