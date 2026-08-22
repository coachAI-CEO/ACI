import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { WebOnlyNotice } from '../../components/ui/WebOnlyNotice';
import { QuickActionGrid } from '../../components/dashboard/QuickActionGrid';
import { RecentVaultItem } from '../../components/dashboard/RecentVaultItem';
import { UpcomingEventItem } from '../../components/dashboard/UpcomingEventItem';
import { UsageBar } from '../../components/dashboard/UsageBar';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useUsage } from '../../hooks/useUsage';
import { getUpcomingEvents } from '../../services/calendar.service';
import { getRecentVaultSessions } from '../../services/vault.service';


function coachFirstName(name?: string | null): string {
  const raw = (name || 'Coach').trim();
  if (!raw) return 'Coach';
  // Strip leading "Coach " so we don't end up with "Coach Coach Alvarez"
  const withoutTitle = raw.replace(/^coach\s+/i, '');
  // First token only
  return withoutTitle.split(/\s+/)[0] || withoutTitle;
}

function greetingForHour(hour: number): string {
  if (hour < 5) return 'Late nights';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good training day';
  if (hour < 21) return 'Good evening';
  return 'Good night';
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

  const sessionsUsed = usageQuery.data?.sessions.used || 0;
  const sessionsLimit = usageQuery.data?.sessions.limit || 0;
  const drillsUsed = usageQuery.data?.drills.used || 0;
  const drillsLimit = usageQuery.data?.drills.limit || 0;
  const plan = String(user?.subscriptionPlan || 'FREE').toUpperCase();

  const firstName = coachFirstName(user?.name);
  const greeting = greetingForHour(new Date().getHours());
  const nextEvent = upcomingEventsQuery.data?.[0];

  const onRefresh = async () => {
    await Promise.all([
      usageQuery.refetch(),
      recentSessionsQuery.refetch(),
      upcomingEventsQuery.refetch(),
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={usageQuery.isRefetching || recentSessionsQuery.isRefetching || upcomingEventsQuery.isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <Card compact>
          <View style={styles.greetingRow}>
            <View style={styles.greetingLeft}>
              <Text style={styles.greetingLine} numberOfLines={1}>
                {greeting}, Coach {firstName}
              </Text>
              <View style={styles.badgeRow}>
                <Badge label={plan} />
                {user?.adminRole === 'SUPER_ADMIN' ? (
                  <Badge label="Super admin" tone="amber" />
                ) : user?.adminRole === 'ADMIN' ? (
                  <Badge label="Admin" tone="amber" />
                ) : user?.adminRole === 'MODERATOR' ? (
                  <Badge label="Moderator" tone="muted" />
                ) : user?.adminRole === 'SUPPORT' ? (
                  <Badge label="Support" tone="muted" />
                ) : null}
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open settings"
              hitSlop={8}
              onPress={() => router.push('/settings')}
              style={styles.settingsLink}
            >
              <Text style={styles.inlineLink}>Settings</Text>
            </Pressable>
          </View>
        </Card>

        {nextEvent ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open next calendar event"
            onPress={() => router.push('/(tabs)/calendar')}
            style={styles.nextCard}
          >
            <View style={styles.nextRow}>
              <View style={styles.nextLeft}>
                <Text style={styles.nextKicker}>Up next</Text>
                <Text style={styles.nextTitle} numberOfLines={1}>
                  {nextEvent.title || nextEvent.teamName || 'Training event'}
                </Text>
              </View>
              <Text style={styles.nextCta}>Open →</Text>
            </View>
            <Text style={styles.nextMeta} numberOfLines={1}>
              {nextEvent.teamName ? `${nextEvent.teamName} · ` : ''}
              {new Date(nextEvent.scheduledDate || nextEvent.startAt || '').toLocaleString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open usage in settings"
          onPress={() => router.push('/settings')}
        >
          <Card>
            <Text style={styles.sectionEyebrow}>Usage & limits</Text>
            <View style={styles.usageGrid}>
              {usageQuery.data ? (
                <>
                  <UsageBar label="Sessions" used={sessionsUsed} limit={sessionsLimit} compact />
                  <UsageBar label="Drills" used={drillsUsed} limit={drillsLimit} compact />
                </>
              ) : (
                <View style={styles.skeletonGroup}>
                  <View style={[styles.skeleton, { width: '90%' }]} />
                  <View style={[styles.skeleton, { width: '70%' }]} />
                </View>
              )}
            </View>
          </Card>
        </Pressable>

        <View>
          <Text style={styles.sectionTitleOutside}>Quick actions</Text>
          <QuickActionGrid
            canAccessCalendar={Boolean(user?.features.canAccessCalendar)}
            canCreatePlayerPlans={Boolean(user?.features.canCreatePlayerPlans)}
          />
        </View>

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
          ) : recentSessionsQuery.isLoading ? (
            <View style={styles.skeletonGroup}>
              <View style={[styles.skeleton, { width: '85%' }]} />
              <View style={[styles.skeleton, { width: '75%' }]} />
            </View>
          ) : (
            <Text style={styles.empty}>No saved sessions yet.</Text>
          )}
        </Card>

        {user?.features.canAccessCalendar ? (
          <Card>
            <Text style={styles.sectionTitle}>Upcoming events</Text>
            {upcomingEventsQuery.data?.length && upcomingEventsQuery.data.length > 1 ? (
              upcomingEventsQuery.data.slice(1).map((event) => <UpcomingEventItem key={event.id} event={event} />)
            ) : upcomingEventsQuery.isLoading ? (
              <View style={styles.skeletonGroup}>
                <View style={[styles.skeleton, { width: '80%' }]} />
              </View>
            ) : (
              <Text style={styles.empty}>No more events scheduled.</Text>
            )}
          </Card>
        ) : null}

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
    gap: 16,
    padding: 16,
    paddingBottom: 28,
  },
  greetingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  greetingLeft: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  greetingLine: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  settingsLink: {
    minHeight: 32,
    justifyContent: 'center',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  sectionEyebrow: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  sectionTitleOutside: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  gap: {
    gap: 14,
  },
  usageGrid: {
    gap: 6,
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
  skeletonGroup: {
    gap: 8,
  },
  skeleton: {
    backgroundColor: '#1f2a3f',
    borderRadius: 6,
    height: 18,
  },
  nextCard: {
    backgroundColor: '#0e2a1d',
    borderColor: 'rgba(34,197,94,0.45)',
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  nextRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  nextLeft: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  nextKicker: {
    color: '#86efac',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  nextTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  nextMeta: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
  },
  nextCta: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
});
