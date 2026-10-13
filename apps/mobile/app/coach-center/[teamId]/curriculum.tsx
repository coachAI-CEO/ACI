import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { colors } from '../../../constants/colors';
import { describeApiError } from '../../../services/api';
import {
  getRecommendationsForWeek,
  getTeamOverview,
} from '../../../services/coach-center.service';
import { useGenerateStore } from '../../../stores/generate.store';
import { formatPhaseLabel, formatZoneLabel, formatCoachLevelLabel, formatPlayerLevelLabel } from '../../../utils/format';

function humanize(value?: string | null): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .split('_')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export default function CoachCenterCurriculumScreen() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const teamIdStr = String(teamId);
  const hydrateFromHref = useGenerateStore((s) => s.hydrateFromHref);
  const setActiveType = useGenerateStore((s) => s.setActiveType);

  const overview = useQuery({
    queryKey: ['coach-center', 'overview', teamIdStr],
    queryFn: () => getTeamOverview(teamIdStr),
    enabled: Boolean(teamIdStr),
    staleTime: 60_000,
  });

  const season = overview.data?.team.season;
  const weeks = season?.weeks ?? [];
  const initialIndex = season?.currentWeekIndex ?? 0;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const activeIndex = selectedIndex ?? initialIndex;
  const selectedWeek = weeks[activeIndex];

  const recsQuery = useQuery({
    queryKey: ['coach-center', 'recommendations', teamIdStr, activeIndex],
    queryFn: () => getRecommendationsForWeek(teamIdStr, activeIndex),
    enabled: Boolean(teamIdStr) && Number.isInteger(activeIndex),
    staleTime: 60_000,
  });

  const onBuildThisSession = (href?: string | null) => {
    const idx = href?.indexOf('?');
    const search = idx !== undefined && idx >= 0 ? href!.slice(idx + 1) : '';
    if (search) hydrateFromHref(search);
    setActiveType('session');
    router.push('/(tabs)/generate');
  };

  if (overview.isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  if (overview.error || !overview.data) {
    return (
      <SafeAreaView style={styles.container}>
        <ErrorMessage message={describeApiError(overview.error, 'Could not load curriculum.')} />
        <Button title="Back" onPress={() => router.back()} variant="secondary" />
      </SafeAreaView>
    );
  }

  const { team } = overview.data;
  const knowledge = selectedWeek?.knowledge;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={overview.isRefetching} onRefresh={() => void overview.refetch()} tintColor={colors.primary} />}
      >
        <View style={styles.headerBlock}>
          <Text style={styles.title}>{team.name}</Text>
          <Text style={styles.subtitle}>
            {team.ageGroup || '--'} · {team.gameModelLabel || team.gameModelId || '--'}
            {team.clubName ? ` · ${team.clubName}` : ''}
          </Text>
          <Text style={styles.eyebrow}>CURRICULUM · {weeks.length} WEEKS</Text>
        </View>

        {/* Week strip */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.weekStrip}
        >
          {weeks.map((w) => {
            const isActive = w.weekIndex === activeIndex;
            const isCurrent = w.weekIndex === initialIndex;
            return (
              <View key={w.id ?? `w-${w.weekIndex}`} style={styles.weekChipWrap}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={`Week ${w.weekIndex + 1}: ${w.theme || 'No theme'}`}
                  hitSlop={4}
                  onPress={() => setSelectedIndex(w.weekIndex)}
                  style={({ pressed }) => [
                    styles.weekChip,
                    isActive ? styles.weekChipActive : null,
                    pressed ? styles.weekChipPressed : null,
                  ]}
                >
                  <Text style={[styles.weekChipNum, isActive ? styles.weekChipNumActive : null]}>
                    {w.weekIndex + 1}
                  </Text>
                  {isCurrent && !isActive ? <Text style={styles.weekChipDot}>●</Text> : null}
                </Pressable>
                <Text style={styles.weekChipCaption} numberOfLines={1}>
                  {w.theme ? w.theme.split(' ').slice(0, 2).join(' ') : '—'}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        {!selectedWeek ? (
          <View style={styles.card}>
            <Text style={styles.meta}>No curriculum yet for this team.</Text>
          </View>
        ) : (
          <>
            {/* Selected week detail */}
            <View style={styles.heroCard}>
              <Text style={styles.heroEyebrow}>
                WEEK {selectedWeek.weekIndex + 1} · {humanize(selectedWeek.moment) || 'THIS WEEK'}
              </Text>
              <Text style={styles.heroTitle}>{selectedWeek.theme}</Text>

              <View style={styles.chipsRow}>
                {team.ageGroup ? <Badge label={team.ageGroup} tone="muted" /> : null}
                {selectedWeek.phase ? <Badge label={formatPhaseLabel(selectedWeek.phase)} tone="muted" /> : null}
                {selectedWeek.zone ? <Badge label={formatZoneLabel(selectedWeek.zone)} tone="muted" /> : null}
                {team.playerLevel ? (
                  <Badge label={formatPlayerLevelLabel(team.playerLevel)} tone="muted" />
                ) : null}
                {team.coachLevel ? (
                  <Badge label={formatCoachLevelLabel(team.coachLevel)} tone="muted" />
                ) : null}
              </View>

              {selectedWeek.focus ? <Text style={styles.heroFocus}>{selectedWeek.focus}</Text> : null}
              {selectedWeek.notes ? <Text style={styles.meta}>{selectedWeek.notes}</Text> : null}

              <Button
                title="Build this session"
                onPress={() => onBuildThisSession(selectedWeek.generateHref || team.generateHref)}
              />
            </View>

            {/* Knowledge card */}
            {knowledge ? (
              <View style={styles.card}>
                <Text style={styles.eyebrow}>{knowledge.audienceLabel || 'WHY THIS WEEK'}</Text>
                <Text style={styles.cardTitle}>{knowledge.format}</Text>
                {knowledge.why ? <Text style={styles.body}>{knowledge.why}</Text> : null}
                {knowledge.constraints?.length ? (
                  <View style={styles.bullets}>
                    <Text style={styles.bulletHeader}>This week&apos;s constraints</Text>
                    {knowledge.constraints.map((c, i) => (
                      <Text key={`c-${i}`} style={styles.bullet}>
                        · {c}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Session breakdown */}
            {knowledge?.ideas?.length ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Session breakdown</Text>
                {knowledge.ideas.map((idea, i) => (
                  <View key={`idea-${i}`} style={styles.slotCard}>
                    <Text style={styles.slotEyebrow}>{idea.slot}</Text>
                    <Text style={styles.slotTitle}>{idea.title}</Text>
                    {idea.detail ? <Text style={styles.meta}>{idea.detail}</Text> : null}
                  </View>
                ))}
              </View>
            ) : null}

            {/* Vault recommendations */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Vault sessions that fit this week</Text>
              {recsQuery.isLoading ? (
                <Text style={styles.meta}>Loading recommendations…</Text>
              ) : recsQuery.error ? (
                <ErrorMessage message={describeApiError(recsQuery.error)} />
              ) : !recsQuery.data || recsQuery.data.length === 0 ? (
                <Text style={styles.meta}>No matching vault sessions yet.</Text>
              ) : (
                recsQuery.data.map((r, idx) => (
                  <View key={`${r.id || r.refCode || idx}`} style={styles.row}>
                    <Text style={styles.body}>{r.title || r.refCode || 'Session'}</Text>
                    <Text style={styles.meta}>
                      {[r.refCode, r.ageGroup, r.durationMin ? `${r.durationMin} min` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                    {r.matchReason ? <Text style={styles.meta}>{r.matchReason}</Text> : null}
                    {r.id ? (
                      <Text
                        style={styles.link}
                        onPress={() =>
                          router.push({
                            pathname: '/vault/session/[sessionId]',
                            params: { sessionId: r.id! },
                          })
                        }
                      >
                        Open session ›
                      </Text>
                    ) : null}
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 },
  container: { gap: 12, padding: 16, paddingBottom: 28 },
  headerBlock: { gap: 4 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.2 },
  subtitle: { color: colors.muted, fontSize: 13 },
  eyebrow: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  weekStrip: {
    gap: 10,
    paddingVertical: 6,
  },
  weekChipWrap: { alignItems: 'center', gap: 4, width: 56 },
  weekChip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    height: 40,
    justifyContent: 'center',
    minWidth: 40,
    paddingHorizontal: 12,
  },
  weekChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  weekChipPressed: {
    opacity: 0.6,
  },
  weekChipNum: { color: colors.text, fontSize: 14, fontWeight: '800' },
  weekChipNumActive: { color: '#022c1d' },
  weekChipDot: { color: colors.primary, fontSize: 8, marginLeft: 4 },
  weekChipCaption: { color: colors.muted, fontSize: 10, textAlign: 'center' },

  heroCard: {
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderColor: 'rgba(34,197,94,0.35)',
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
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
  heroFocus: { color: colors.text, fontSize: 13, lineHeight: 19 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

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
  bullets: { gap: 4, marginTop: 4 },
  bulletHeader: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  bullet: { color: colors.text, fontSize: 13 },
  slotCard: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 2,
    padding: 10,
  },
  slotEyebrow: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  slotTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },

  row: { gap: 4, paddingVertical: 4 },
  link: { color: colors.primary, fontWeight: '700' },
});