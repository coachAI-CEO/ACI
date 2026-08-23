import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../components/ui/Button';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { colors } from '../../../constants/colors';
import { webPath } from '../../../constants/web';
import { describeApiError } from '../../../services/api';
import { updateCalendarEvent } from '../../../services/calendar.service';
import { getTeamOverview } from '../../../services/coach-center.service';
import { useGenerateStore } from '../../../stores/generate.store';

function formatWhen(value?: string | null): string {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

/**
 * Extract the `?...` portion of a web `generateHref` so the mobile can
 * hydrate the same coach-center fields onto its own Generate form.
 */
function searchFromHref(href?: string | null): string {
  if (!href) return '';
  const idx = href.indexOf('?');
  return idx >= 0 ? href.slice(idx + 1) : '';
}

/** Render a 2-column KPI cell. */
function KpiCell({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <View style={styles.kpiCell}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue} numberOfLines={1}>{value}</Text>
      {detail ? <Text style={styles.kpiDetail} numberOfLines={2}>{detail}</Text> : null}
    </View>
  );
}

/** Full-width pressable row used for the section card grid. */
function SectionRow({
  icon,
  title,
  detail,
  onPress,
}: {
  icon: string;
  title: string;
  detail?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.sectionRow, pressed ? styles.sectionRowPressed : null]}
    >
      <Text style={styles.sectionIcon}>{icon}</Text>
      <View style={styles.sectionText}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {detail ? <Text style={styles.sectionDetail}>{detail}</Text> : null}
      </View>
      <Text style={styles.sectionChev}>›</Text>
    </Pressable>
  );
}

export default function CoachCenterTeamScreen() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const hydrateFromHref = useGenerateStore((s) => s.hydrateFromHref);
  const setActiveType = useGenerateStore((s) => s.setActiveType);

  const query = useQuery({
    queryKey: ['coach-center', 'overview', teamId],
    queryFn: () => getTeamOverview(String(teamId)),
    enabled: Boolean(teamId),
    staleTime: 60_000,
  });

  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  if (query.error || !query.data) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <ErrorMessage message={describeApiError(query.error, 'Could not load team.')} />
          <Button title="Back" onPress={() => router.back()} variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  const { team, upcoming, nextMatch, recommendations } = query.data;
  const season = team.season;
  const currentWeek = season?.currentWeek;
  const teamIdStr = String(teamId);

  const onMarkComplete = async (eventId: string) => {
    setBusyId(eventId);
    setActionError(null);
    try {
      await updateCalendarEvent(eventId, { completed: true });
      await queryClient.invalidateQueries({ queryKey: ['coach-center', 'overview', teamId] });
    } catch (err) {
      setActionError(describeApiError(err, 'Could not mark complete.'));
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Take the web's `generateHref` (e.g.
   * `/demo/session?ageGroup=U18&...&topic=Playing+out`) and use it to
   * hydrate the mobile Generate form, then jump to the Generate tab.
   */
  const onBuildThisSession = (href?: string | null) => {
    const search = searchFromHref(href);
    if (search) hydrateFromHref(search);
    setActiveType('session');
    router.push('/(tabs)/generate');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.primary} />}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{team.name}</Text>
            <Text style={styles.subtitle}>
              {team.ageGroup || '--'} · {team.gameModelLabel || team.gameModelId || '--'}
              {team.clubName ? ` · ${team.clubName}` : ''}
            </Text>
          </View>
        </View>

        {/* Phase B3 — 2×2 KPI grid */}
        <View style={styles.kpiGrid}>
          <KpiCell
            label="Team"
            value={team.name}
            detail={
              [
                team.ageGroup,
                team.playerLevel ? team.playerLevel.toLowerCase().replace(/^./, (c) => c.toUpperCase()) : null,
                team.coachLevel ? `Coach ${team.coachLevel.replace(/^USSF_/, '').replace('_PLUS', '+')}` : null,
              ]
                .filter(Boolean)
                .join(' · ') || 'Create a team'
            }
          />
          <KpiCell
            label="Season week"
            value={season ? String(season.currentWeekIndex) : '—'}
            detail={currentWeek?.theme || 'No curriculum yet'}
          />
          <KpiCell
            label="Upcoming sessions"
            value={String(upcoming.length)}
            detail={upcoming[0]?.session?.title || 'Nothing scheduled'}
          />
          <KpiCell
            label="Next match"
            value={nextMatch?.opponent || '—'}
            detail={nextMatch ? new Date(nextMatch.matchDate).toLocaleDateString() : 'Prepare a game-day sheet'}
          />
        </View>

        {/* Phase B2 — This week's curriculum hero */}
        {currentWeek ? (
          <View style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>THIS WEEK&apos;S CURRICULUM</Text>
            <Text style={styles.heroTitle}>{currentWeek.theme}</Text>
            <Text style={styles.heroDetail}>
              {[currentWeek.phase, currentWeek.zone?.replace('_', ' ').toLowerCase(), currentWeek.moment]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            {currentWeek.focus ? <Text style={styles.heroFocus}>{currentWeek.focus}</Text> : null}
            <Button
              title="Build this session"
              onPress={() => onBuildThisSession(currentWeek.generateHref || team.generateHref)}
            />
            <Pressable
              accessibilityRole="link"
              onPress={() =>
                router.push({
                  pathname: '/coach-center/[teamId]/curriculum',
                  params: { teamId: teamIdStr },
                })
              }
              style={styles.heroLinkBtn}
            >
              <Text style={styles.heroLink}>See full curriculum</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Next match quick card (kept for direct CTA) */}
        {nextMatch ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Next match</Text>
            <Text style={styles.body}>
              {nextMatch.opponent || 'Opponent TBD'} · {formatWhen(nextMatch.matchDate)}
            </Text>
            {nextMatch.venue ? <Text style={styles.meta}>{nextMatch.venue}</Text> : null}
            {nextMatch.keyFocus ? <Text style={styles.meta}>{nextMatch.keyFocus}</Text> : null}
            <Button
              title="Open game day pack"
              onPress={() =>
                router.push({
                  pathname: '/coach-center/[teamId]/game-days/[gameDayId]',
                  params: { teamId: teamIdStr, gameDayId: nextMatch.id },
                })
              }
              variant="secondary"
            />
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Upcoming sessions</Text>
          {upcoming.length ? (
            upcoming.map((event) => (
              <View key={event.id} style={styles.row}>
                <Text style={styles.body}>
                  {event.session?.title || 'Training'}
                  {event.completed ? ' · Done' : ''}
                </Text>
                <Text style={styles.meta}>{formatWhen(event.scheduledDate)}</Text>
                <View style={styles.rowActions}>
                  {event.session?.id ? (
                    <Text
                      style={styles.link}
                      onPress={() =>
                        router.push({ pathname: '/sideline/[sessionId]', params: { sessionId: event.session!.id } })
                      }
                    >
                      Sideline
                    </Text>
                  ) : null}
                  {event.session?.id ? (
                    <Text
                      style={styles.link}
                      onPress={() =>
                        router.push({
                          pathname: '/vault/session/[sessionId]',
                          params: { sessionId: event.session!.id },
                        })
                      }
                    >
                      Session
                    </Text>
                  ) : null}
                  {!event.completed ? (
                    <Text
                      style={styles.link}
                      onPress={() => {
                        if (busyId === event.id) return;
                        void onMarkComplete(event.id);
                      }}
                    >
                      {busyId === event.id ? 'Saving…' : 'Mark done'}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.meta}>No upcoming sessions in the next two weeks.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recommended next sessions</Text>
          {recommendations.length ? (
            recommendations.map((item, idx) => (
              <View key={`${item.id || item.refCode || idx}`} style={styles.row}>
                <Text style={styles.body}>{item.title || item.refCode || 'Session'}</Text>
                {item.matchReason ? <Text style={styles.meta}>{item.matchReason}</Text> : null}
                {item.id ? (
                  <View style={styles.rowActions}>
                    <Text
                      style={styles.link}
                      onPress={() =>
                        router.push({ pathname: '/vault/session/[sessionId]', params: { sessionId: item.id! } })
                      }
                    >
                      Open session
                    </Text>
                    <Text
                      style={styles.link}
                      onPress={() =>
                        router.push({ pathname: '/sideline/[sessionId]', params: { sessionId: item.id! } })
                      }
                    >
                      Sideline
                    </Text>
                  </View>
                ) : null}
              </View>
            ))
          ) : (
            <Text style={styles.meta}>No recommendations yet.</Text>
          )}
        </View>

        {actionError ? <ErrorMessage message={actionError} /> : null}

        {/* Phase B4 — section card row grid.
            Only rows pointing at routes that already exist on mobile are
            wired up. The Next sessions / Season chat rows will be enabled
            as their respective phases (D/E) ship. */}
        <View style={styles.sectionsCard}>
          <Text style={styles.cardTitle}>Sections</Text>
          <SectionRow
            icon="✦"
            title="Curriculum"
            detail="16-week season plan"
            onPress={() =>
              router.push({
                pathname: '/coach-center/[teamId]/curriculum',
                params: { teamId: teamIdStr },
              })
            }
          />
          <SectionRow
            icon="◷"
            title="Calendar"
            detail="This week’s training"
            onPress={() =>
              router.push({ pathname: '/coach-center/[teamId]/week', params: { teamId: teamIdStr } })
            }
          />
          <SectionRow
            icon="★"
            title="Next sessions"
            detail="Vault recommendations"
            onPress={() =>
              router.push({
                pathname: '/coach-center/[teamId]/next-sessions',
                params: { teamId: teamIdStr },
              })
            }
          />
          <SectionRow
            icon="✎"
            title="Season chat"
            detail="Ask about this team"
            onPress={() =>
              router.push({
                pathname: '/coach-center/[teamId]/chat',
                params: { teamId: teamIdStr },
              })
            }
          />
          <SectionRow
            icon="◆"
            title="Game days"
            detail="Match-day packs"
            onPress={() =>
              router.push({ pathname: '/coach-center/[teamId]/game-days', params: { teamId: teamIdStr } })
            }
          />
          <SectionRow
            icon="↗"
            title="Authoring on web"
            detail="Team settings, curriculum editor, chat history"
            onPress={() => void Linking.openURL(webPath('/coach-center'))}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 },
  container: { gap: 12, padding: 16, paddingBottom: 28 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  headerText: { flex: 1, gap: 4 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.2 },
  subtitle: { color: colors.muted, fontSize: 13 },

  // KPI grid (Phase B3)
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  kpiCell: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    gap: 2,
    padding: 12,
  },
  kpiLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  kpiValue: { color: colors.text, fontSize: 17, fontWeight: '800' },
  kpiDetail: { color: colors.muted, fontSize: 12 },

  // Hero (Phase B2)
  heroCard: {
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderColor: 'rgba(34,197,94,0.35)',
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
    padding: 14,
  },
  heroEyebrow: {
    color: '#22c55e',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  heroDetail: { color: colors.text, fontSize: 13 },
  heroFocus: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  heroLinkBtn: { alignSelf: 'flex-start' },
  heroLink: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    paddingVertical: 4,
  },

  // Sections card (Phase B4)
  sectionsCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  sectionRow: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 12,
    minHeight: 44,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  sectionRowPressed: { backgroundColor: colors.surfaceAlt },
  sectionIcon: {
    color: colors.primary,
    fontSize: 18,
    textAlign: 'center',
    width: 28,
  },
  sectionText: { flex: 1, gap: 2 },
  sectionTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  sectionDetail: { color: colors.muted, fontSize: 12 },
  sectionChev: { color: colors.muted, fontSize: 22, fontWeight: '300' },

  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  body: { color: colors.text, fontSize: 14 },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  row: { gap: 4, paddingVertical: 4 },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  link: { color: colors.primary, fontWeight: '600' },
});