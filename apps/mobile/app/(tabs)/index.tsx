import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { QuickActionGrid } from '../../components/dashboard/QuickActionGrid';
import { RecentVaultItem } from '../../components/dashboard/RecentVaultItem';
import { UpcomingEventItem } from '../../components/dashboard/UpcomingEventItem';
import { UsageBar } from '../../components/dashboard/UsageBar';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useUsage } from '../../hooks/useUsage';
import { getUpcomingEvents } from '../../services/calendar.service';
import { getRecentVaultSessions } from '../../services/vault.service';

export default function HomeTab() {
  const { user, isAuthenticated } = useAuth();

  const usageQuery = useUsage(isAuthenticated);
  const recentSessionsQuery = useQuery({
    queryKey: ['dashboard', 'recentVault'],
    queryFn: () => getRecentVaultSessions(3),
    enabled: isAuthenticated,
  });
  const upcomingEventsQuery = useQuery({
    queryKey: ['dashboard', 'upcomingEvents'],
    queryFn: () => getUpcomingEvents(2),
    enabled: isAuthenticated && Boolean(user?.features.canAccessCalendar),
  });

  const isLoading = usageQuery.isLoading || recentSessionsQuery.isLoading || upcomingEventsQuery.isLoading;

  const onRefresh = async () => {
    await Promise.all([
      usageQuery.refetch(),
      recentSessionsQuery.refetch(),
      upcomingEventsQuery.refetch(),
    ]);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={usageQuery.isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Card>
          <View style={styles.rowBetween}>
            <Text style={styles.greeting}>Good training day, Coach {user?.name || 'Coach'}.</Text>
            <Text onPress={() => router.push('/settings')} style={styles.inlineLink}>
              Settings
            </Text>
          </View>
          <View style={styles.badgeRow}>
            <Badge label={user?.subscriptionPlan || 'FREE'} />
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Usage this month</Text>
          <View style={styles.gap}>
            <UsageBar
              label="Sessions"
              used={usageQuery.data?.sessions.used || 0}
              limit={usageQuery.data?.sessions.limit || 0}
            />
            <UsageBar
              label="Drills"
              used={usageQuery.data?.drills.used || 0}
              limit={usageQuery.data?.drills.limit || 0}
            />
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Quick actions</Text>
          <QuickActionGrid canAccessCalendar={Boolean(user?.features.canAccessCalendar)} />
        </Card>

        <Card>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Recent vault items</Text>
            <Text onPress={() => router.push('/(tabs)/vault')} style={styles.inlineLink}>View all</Text>
          </View>
          {recentSessionsQuery.data?.length ? (
            recentSessionsQuery.data.map((item) => (
              <RecentVaultItem key={item.id} item={item} onPress={() => router.push('/(tabs)/vault')} />
            ))
          ) : (
            <Text style={styles.empty}>No saved sessions yet.</Text>
          )}
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Upcoming events</Text>
          {upcomingEventsQuery.data?.length ? (
            upcomingEventsQuery.data.map((event) => <UpcomingEventItem key={event.id} event={event} />)
          ) : (
            <Text style={styles.empty}>No events scheduled.</Text>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    gap: 12,
    padding: 14,
    paddingBottom: 24,
  },
  greeting: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  badgeRow: {
    marginTop: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  gap: {
    gap: 12,
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inlineLink: {
    color: colors.primary,
    fontWeight: '600',
  },
  empty: {
    color: colors.muted,
    fontSize: 13,
  },
});
