import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Linking, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { WebOnlyNotice } from '../../components/ui/WebOnlyNotice';
import { QuickActionGrid } from '../../components/dashboard/QuickActionGrid';
import { RecentVaultItem } from '../../components/dashboard/RecentVaultItem';
import { UpcomingEventItem } from '../../components/dashboard/UpcomingEventItem';
import { UsageBar } from '../../components/dashboard/UsageBar';
import { colors } from '../../constants/colors';
import { webPath } from '../../constants/web';
import { useAuth } from '../../hooks/useAuth';
import { useUsage } from '../../hooks/useUsage';
import { getUpcomingEvents } from '../../services/calendar.service';
import { getRecentVaultSessions } from '../../services/vault.service';

function nearLimit(used: number, limit: number): boolean {
  if (!Number.isFinite(limit) || limit <= 0) return false;
  return used / limit >= 0.85;
}

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

  const sessionsUsed = usageQuery.data?.sessions.used || 0;
  const sessionsLimit = usageQuery.data?.sessions.limit || 0;
  const drillsUsed = usageQuery.data?.drills.used || 0;
  const drillsLimit = usageQuery.data?.drills.limit || 0;
  const plan = String(user?.subscriptionPlan || 'FREE').toUpperCase();
  const showUpgrade =
    plan === 'FREE' ||
    plan === 'TRIAL' ||
    nearLimit(sessionsUsed, sessionsLimit) ||
    nearLimit(drillsUsed, drillsLimit);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={usageQuery.isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Card>
          <View style={styles.rowBetween}>
            <Text style={styles.greeting}>Good training day, Coach {user?.name || 'Coach'}.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open settings"
              hitSlop={8}
              onPress={() => router.push('/settings')}
              style={styles.linkPress}
            >
              <Text style={styles.inlineLink}>Settings</Text>
            </Pressable>
          </View>
          <View style={styles.badgeRow}>
            <Badge label={user?.subscriptionPlan || 'FREE'} />
            {user?.clubName ? <Badge label={user.clubName} /> : null}
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Usage this month</Text>
          <View style={styles.gap}>
            <UsageBar label="Sessions" used={sessionsUsed} limit={sessionsLimit} />
            <UsageBar label="Drills" used={drillsUsed} limit={drillsLimit} />
          </View>
          {showUpgrade ? (
            <View style={styles.upgradeWrap}>
              <Text style={styles.upgradeCopy}>Need more sessions or PDF export? Upgrade in the browser.</Text>
              <Button title="Upgrade on web" onPress={() => void Linking.openURL(webPath('/pricing'))} />
            </View>
          ) : null}
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Quick actions</Text>
          <QuickActionGrid
            canAccessCalendar={Boolean(user?.features.canAccessCalendar)}
            canCreatePlayerPlans={Boolean(user?.features.canCreatePlayerPlans)}
          />
        </Card>

        <Card>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Recent vault items</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View all vault items"
              hitSlop={8}
              onPress={() => router.push('/(tabs)/vault')}
              style={styles.linkPress}
            >
              <Text style={styles.inlineLink}>View all</Text>
            </Pressable>
          </View>
          {recentSessionsQuery.data?.length ? (
            recentSessionsQuery.data.map((item) => (
              <RecentVaultItem
                key={item.id}
                item={item}
                onPress={() =>
                  router.push({ pathname: '/vault/session/[sessionId]', params: { sessionId: item.id } })
                }
              />
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

        <WebOnlyNotice
          title="Doc Hub & admin"
          body="Club Doc Hub and platform admin are web-only. Open them in Safari or Chrome when you need dense authoring."
          webHref="/doc-hub"
          ctaLabel="Open Doc Hub on web"
        />
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
  upgradeWrap: {
    gap: 10,
    marginTop: 12,
  },
  upgradeCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
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
  linkPress: {
    minHeight: 44,
    justifyContent: 'center',
    paddingLeft: 8,
  },
  empty: {
    color: colors.muted,
    fontSize: 13,
  },
});
