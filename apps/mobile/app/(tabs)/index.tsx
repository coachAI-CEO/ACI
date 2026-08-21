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
  const showUpgrade =
    plan === 'FREE' ||
    plan === 'TRIAL' ||
    nearLimit(sessionsUsed, sessionsLimit) ||
    nearLimit(drillsUsed, drillsLimit);

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
        <Card>
          <Text style={styles.greetingLine}>{greeting},</Text>
          <Text style={styles.greetingName}>Coach {firstName}</Text>
          <View style={styles.badgeRow}>
            <Badge label={user?.subscriptionPlan || 'FREE'} />
            {user?.clubName ? <Badge label={user.clubName} /> : null}
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
        </Card>

        {nextEvent ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open next calendar event"
            onPress={() => router.push('/(tabs)/calendar')}
            style={styles.nextCard}
          >
            <Text style={styles.nextKicker}>Up next</Text>
            <Text style={styles.nextTitle} numberOfLines={1}>
              {nextEvent.title || nextEvent.teamName || 'Training event'}
            </Text>
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
            <Text style={styles.nextCta}>Open calendar →</Text>
          </Pressable>
        ) : null}

        <Card>
          <Text style={styles.sectionTitle}>Usage this month</Text>
          <View style={styles.gap}>
            {usageQuery.data ? (
              <>
                <UsageBar label="Sessions" used={sessionsUsed} limit={sessionsLimit} />
                <UsageBar label="Drills" used={drillsUsed} limit={drillsLimit} />
              </>
            ) : (
              <View style={styles.skeletonGroup}>
                <View style={[styles.skeleton, { width: '90%' }]} />
                <View style={[styles.skeleton, { width: '70%' }]} />
              </View>
            )}
          </View>
          {showUpgrade ? (
            <View style={styles.upgradeWrap}>
              <Text style={styles.upgradeCopy}>Need more sessions or PDF export? Upgrade in the browser.</Text>
              <Button title="Upgrade on web" onPress={() => void Linking.openURL(webPath('/pricing'))} />
            </View>
          ) : null}
        </Card>

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
  greetingLine: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  greetingName: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  settingsLink: {
    alignSelf: 'flex-start',
    marginTop: 12,
    minHeight: 32,
    justifyContent: 'center',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
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
  upgradeWrap: {
    gap: 10,
    marginTop: 14,
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
    padding: 14,
  },
  nextKicker: {
    color: '#86efac',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  nextTitle: {
    color: colors.text,
    fontSize: 16,
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
    marginTop: 4,
  },
});
