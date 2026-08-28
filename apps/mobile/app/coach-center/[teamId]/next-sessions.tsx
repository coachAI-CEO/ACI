import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { colors } from '../../../constants/colors';
import { describeApiError } from '../../../services/api';
import { getTeamOverview } from '../../../services/coach-center.service';
import { useGenerateStore } from '../../../stores/generate.store';

export default function CoachCenterNextSessionsScreen() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const teamIdStr = String(teamId);
  const hydrateFromHref = useGenerateStore((s) => s.hydrateFromHref);
  const setActiveType = useGenerateStore((s) => s.setActiveType);

  const query = useQuery({
    queryKey: ['coach-center', 'overview', teamIdStr],
    queryFn: () => getTeamOverview(teamIdStr),
    enabled: Boolean(teamIdStr),
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
          <ErrorMessage message={describeApiError(query.error, 'Could not load recommendations.')} />
          <Button title="Back" onPress={() => router.back()} variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  const { team, recommendations } = query.data;
  const season = team.season;
  const week = season?.currentWeek;

  const onGenerateThisWeek = (href?: string | null) => {
    const idx = href?.indexOf('?');
    const search = idx !== undefined && idx >= 0 ? href!.slice(idx + 1) : '';
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
        {/* Hero card — matches web's sky hero */}
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>GENERATE THIS WEEK&apos;S SESSION</Text>
          <Text style={styles.heroTitle}>
            {week?.theme || 'Plan this week'}
          </Text>
          <Text style={styles.heroSubtitle}>
            {[team.ageGroup, team.playerLevel, team.coachLevel]
              .filter(Boolean)
              .join(' · ') || 'Tailored to your team'}
          </Text>
          <View style={styles.heroChips}>
            {week?.phase ? <Badge label={`Phase · ${week.phase}`} tone="muted" /> : null}
            {week?.zone ? <Badge label={`Zone · ${week.zone}`} tone="muted" /> : null}
          </View>
          <Button
            title="Generate session"
            onPress={() => onGenerateThisWeek(week?.generateHref || team.generateHref)}
          />
        </View>

        {/* Vault recommendations list */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Vault sessions that fit</Text>
          {recommendations.length === 0 ? (
            <Text style={styles.meta}>No matching vault sessions yet.</Text>
          ) : (
            recommendations.map((item, idx) => {
              const meta = [
                item.refCode,
                item.ageGroup,
                item.durationMin ? `${item.durationMin} min` : null,
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <View key={`${item.id || item.refCode || idx}`} style={styles.row}>
                  <Text style={styles.body}>{item.title || item.refCode || 'Session'}</Text>
                  {meta ? <Text style={styles.meta}>{meta}</Text> : null}
                  {item.matchReason ? <Text style={styles.reason}>{item.matchReason}</Text> : null}
                  {item.id ? (
                    <View style={styles.rowActions}>
                      <Text
                        style={styles.link}
                        onPress={() =>
                          router.push({
                            pathname: '/vault/session/[sessionId]',
                            params: { sessionId: item.id! },
                          })
                        }
                      >
                        Open ›
                      </Text>
                      <Text
                        style={styles.link}
                        onPress={() =>
                          router.push({
                            pathname: '/sideline/[sessionId]',
                            params: { sessionId: item.id! },
                          })
                        }
                      >
                        Sideline ›
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 },
  container: { gap: 12, padding: 16, paddingBottom: 28 },

  heroCard: {
    backgroundColor: 'rgba(56,189,248,0.10)',
    borderColor: 'rgba(56,189,248,0.40)',
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  eyebrow: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  heroSubtitle: { color: colors.muted, fontSize: 13 },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

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
  reason: { color: colors.text, fontSize: 12, fontStyle: 'italic' },
  row: { gap: 4, paddingVertical: 6 },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 4 },
  link: { color: colors.primary, fontWeight: '700' },
});