import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { useGenerateStore, type GenerateType } from '../../stores/generate.store';
import { useOfflineStore } from '../../stores/offline.store';

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
  /** Optional: when set, this action is a Generate subtype picker and the tab
   * is pre-selected on tap. */
  generateType?: GenerateType;
  enabled: boolean;
};

type Props = {
  canAccessCalendar: boolean;
  canCreatePlayerPlans: boolean;
  tacticalBoardV1: boolean;
};

const BASE_ACTIONS: QuickAction[] = [
  { key: 'session', title: 'Generate session', icon: '✚', route: '/(tabs)/generate', generateType: 'session', enabled: true },
  { key: 'drill', title: 'Generate drill', icon: '◐', route: '/(tabs)/generate', generateType: 'drill', enabled: true },
  { key: 'series', title: 'Generate series', icon: '☷', route: '/(tabs)/generate', generateType: 'series', enabled: true },
  { key: 'video', title: 'Video analysis', icon: '▶', route: '/(tabs)/video', enabled: true },
  { key: 'calendar', title: 'Calendar', icon: '📅', route: '/(tabs)/calendar', enabled: true },
  { key: 'plans', title: 'Player plans', icon: '◧', route: '/player-plans', enabled: true },
  { key: 'coach', title: 'Coach Center', icon: '✦', route: '/coach-center', enabled: true },
  { key: 'boards', title: 'Boards', icon: '◇', route: '/boards', enabled: true },
];

export function QuickActionGrid({ canAccessCalendar, canCreatePlayerPlans, tacticalBoardV1 }: Props) {
  const setActiveType = useGenerateStore((s) => s.setActiveType);
  const cachedBoards = useOfflineStore((s) => s.cachedBoards);
  const boardsLoaded = useOfflineStore((s) => s.boardsCacheUpdatedAt != null);

  // If the boards sync has run and the user has zero, route them to a
  // create-on-launch flow instead of the listing.
  const hasZeroBoards = boardsLoaded && cachedBoards.length === 0;

  const handlePress = (action: QuickAction) => {
    if (action.generateType) setActiveType(action.generateType);
    if (action.key === 'boards' && hasZeroBoards) {
      router.push({ pathname: '/boards', params: { create: '1' } });
      return;
    }
    router.push(action.route);
  };

  return (
    <View style={styles.list} accessibilityRole="menu">
      {BASE_ACTIONS.map((action) => {
        const enabled =
          action.key === 'calendar'
            ? canAccessCalendar
            : action.key === 'plans'
              ? canCreatePlayerPlans
              : action.key === 'boards'
                ? tacticalBoardV1
                : action.enabled;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action.title}
            accessibilityState={{ disabled: !enabled }}
            disabled={!enabled}
            key={action.key}
            onPress={() => handlePress(action)}
            style={({ pressed }) => [
              styles.row,
              { opacity: !enabled ? 0.45 : pressed ? 0.75 : 1 },
            ]}
          >
            <Text style={[styles.icon, !enabled ? styles.iconDisabled : null]}>{action.icon}</Text>
            <Text style={[styles.title, !enabled ? styles.titleDisabled : null]} numberOfLines={1}>
              {action.title}
            </Text>
            <Text style={styles.chev}>›</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: '#121a2a',
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    borderBottomColor: 'rgba(255,255,255,0.06)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  icon: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    width: 22,
  },
  iconDisabled: {
    color: colors.muted,
  },
  title: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  titleDisabled: {
    color: colors.muted,
  },
  chev: {
    color: colors.muted,
    fontSize: 18,
    fontWeight: '400',
  },
});